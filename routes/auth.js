const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db } = require('../database');
const { generateToken, verifyToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// Anti-Brute-Force Rate Limiter: max 10 attempts per 5 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ตรวจพบความพยายามเข้าสู่ระบบมากเกินไป กรุณารอ 5 นาทีแล้วลองใหม่อีกครั้ง' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  // 1. Find user using parameterized query (Prevent SQLi)
  const user = db.prepare(`
    SELECT id, username, password_hash, role, full_name, failed_attempts, locked_until
    FROM users
    WHERE username = ?
  `).get(username.trim());

  if (!user) {
    logAudit({
      username,
      action: 'LOGIN_FAILED',
      resource: '/api/auth/login',
      ipAddress: ip,
      userAgent,
      details: 'User not found'
    });
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // 2. Check Lockout status
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(423).json({
      error: `บัญชีนี้ถูกระงับชั่วคราวเนื่องจากใส่รหัสผิดหลายครั้ง กรุณารออีก ${remainingMinutes} นาที`
    });
  }

  // 3. Verify Password with bcrypt
  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    const failedAttempts = (user.failed_attempts || 0) + 1;
    let lockUntil = null;

    if (failedAttempts >= 5) {
      // Lock for 15 minutes after 5 consecutive failures
      lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    db.prepare(`
      UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?
    `).run(failedAttempts, lockUntil, user.id);

    logAudit({
      userId: user.id,
      username: user.username,
      role: user.role,
      action: 'LOGIN_FAILED',
      resource: '/api/auth/login',
      ipAddress: ip,
      userAgent,
      details: `Wrong password. Attempt #${failedAttempts}`
    });

    if (failedAttempts >= 5) {
      return res.status(423).json({ error: 'คุณใส่รหัสผ่านผิดเกิน 5 ครั้ง บัญชีถูกล็อค 15 นาที เพื่อความปลอดภัย' });
    }

    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  // 4. Success: Reset failed attempts & generate JWT
  db.prepare(`
    UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?
  `).run(user.id);

  // If patient, find their patient profile id
  let patientInfo = null;
  if (user.role === 'patient') {
    patientInfo = db.prepare('SELECT id, hn, full_name FROM patients WHERE user_id = ?').get(user.id);
  }

  const token = generateToken(user);

  logAudit({
    userId: user.id,
    username: user.username,
    role: user.role,
    action: 'LOGIN_SUCCESS',
    resource: '/api/auth/login',
    patientHn: patientInfo ? patientInfo.hn : null,
    ipAddress: ip,
    userAgent,
    details: 'User authenticated successfully'
  });

  res.json({
    message: 'เข้าสู่ระบบสำเร็จ',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      patient: patientInfo || null
    }
  });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  let patientInfo = null;
  if (req.user.role === 'patient') {
    patientInfo = db.prepare('SELECT id, hn, full_name, age, target_weight_kg FROM patients WHERE user_id = ?').get(req.user.id);
  }

  res.json({
    user: {
      ...req.user,
      patient: patientInfo || null
    }
  });
});

// POST /api/auth/logout
router.post('/logout', verifyToken, (req, res) => {
  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'LOGOUT',
    resource: '/api/auth/logout',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
});

module.exports = router;
