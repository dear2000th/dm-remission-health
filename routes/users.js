const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// All endpoints in this router require ADMIN role
router.use(verifyToken, requireRole(['admin']));

// GET /api/users - List all users
router.get('/', (req, res) => {
  const { q } = req.query;

  let query = `
    SELECT u.id, u.username, u.role, u.full_name, u.email,
           u.failed_attempts, u.locked_until, u.created_at,
           p.hn as patient_hn, p.id as patient_id
    FROM users u
    LEFT JOIN patients p ON p.user_id = u.id
  `;
  const params = [];

  if (q && q.trim()) {
    query += ` WHERE u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.role LIKE ?`;
    const search = `%${q.trim()}%`;
    params.push(search, search, search, search);
  }

  query += ` ORDER BY u.id ASC`;

  const users = db.prepare(query).all(...params);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'VIEW_USER_LIST',
    resource: '/api/users',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { count: users.length }
  });

  res.json({ users });
});

// GET /api/users/:id - Get single user
router.get('/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.prepare(`
    SELECT u.id, u.username, u.role, u.full_name, u.email,
           u.failed_attempts, u.locked_until, u.created_at,
           p.hn as patient_hn, p.id as patient_id
    FROM users u
    LEFT JOIN patients p ON p.user_id = u.id
    WHERE u.id = ?
  `).get(userId);

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  res.json({ user });
});

// POST /api/users - Create new user
router.post('/', (req, res) => {
  const { username, password, role, full_name, email, patient_id } = req.body;

  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้, รหัสผ่าน, สิทธิ์ และชื่อ-นามสกุลให้ครบถ้วน' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข ขีดล่าง หรือจุด ความยาว 3-30 ตัวอักษร' });
  }

  const validRoles = ['admin', 'doctor', 'nurse', 'patient'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'สิทธิ์ผู้ใช้งานไม่ถูกต้อง' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
  }

  // Check unique username
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' });
  }

  // Hash password with bcrypt (Cost factor = 12)
  const salt = bcrypt.genSaltSync(12);
  const passwordHash = bcrypt.hashSync(password, salt);

  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, email)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(cleanUsername, passwordHash, role, full_name.trim(), email ? email.trim() : null);
  const newUserId = result.lastInsertRowid;

  // If patient role and linked patient_id provided, link to patients table
  if (role === 'patient' && patient_id) {
    db.prepare('UPDATE patients SET user_id = ? WHERE id = ?').run(newUserId, parseInt(patient_id));
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'CREATE_USER',
    resource: `/api/users/${newUserId}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { created_username: cleanUsername, role, full_name }
  });

  res.status(201).json({
    message: `สร้างผู้ใช้งาน "${cleanUsername}" เรียบร้อยแล้ว`,
    userId: newUserId
  });
});

// PUT /api/users/:id - Update user details, reset password, or unlock account
router.put('/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  const { full_name, email, role, password, unlock_account, patient_id } = req.body;

  let newPasswordHash = user.password_hash;
  if (password && password.trim()) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }
    const salt = bcrypt.genSaltSync(12);
    newPasswordHash = bcrypt.hashSync(password.trim(), salt);
  }

  let failedAttempts = user.failed_attempts;
  let lockedUntil = user.locked_until;

  if (unlock_account === true) {
    failedAttempts = 0;
    lockedUntil = null;
  }

  const newRole = role || user.role;
  const validRoles = ['admin', 'doctor', 'nurse', 'patient'];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ error: 'สิทธิ์ผู้ใช้งานไม่ถูกต้อง' });
  }

  db.prepare(`
    UPDATE users
    SET full_name = COALESCE(?, full_name),
        email = ?,
        role = ?,
        password_hash = ?,
        failed_attempts = ?,
        locked_until = ?
    WHERE id = ?
  `).run(
    full_name ? full_name.trim() : user.full_name,
    email !== undefined ? (email ? email.trim() : null) : user.email,
    newRole,
    newPasswordHash,
    failedAttempts,
    lockedUntil,
    userId
  );

  // If patient link updated
  if (newRole === 'patient' && patient_id) {
    db.prepare('UPDATE patients SET user_id = ? WHERE id = ?').run(userId, parseInt(patient_id));
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'UPDATE_USER',
    resource: `/api/users/${userId}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: {
      target_username: user.username,
      updated_role: newRole,
      password_reset: !!password,
      unlocked: unlock_account === true
    }
  });

  res.json({ message: `ปรับปรุงข้อมูลผู้ใช้งาน "${user.username}" เรียบร้อยแล้ว` });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res) => {
  const userId = parseInt(req.params.id);

  // Guard: Cannot delete yourself!
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบที่กำลังใช้งานอยู่' });
  }

  const user = db.prepare('SELECT id, username, role, full_name FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' });
  }

  // If linked to patient, unlink first
  db.prepare('UPDATE patients SET user_id = NULL WHERE user_id = ?').run(userId);

  // Delete user
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'DELETE_USER',
    resource: `/api/users/${userId}`,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { deleted_username: user.username, role: user.role, full_name: user.full_name }
  });

  res.json({ message: `ลบผู้ใช้งาน "${user.username}" เรียบร้อยแล้ว` });
});

module.exports = router;
