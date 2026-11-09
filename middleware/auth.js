const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'dm_remission_super_secure_key_2026_!@#$';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'ไม่พบ Token ยืนยันตัวตน กรุณาเข้าสู่ระบบ' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // Verify user is still valid in database
    const user = db.prepare('SELECT id, username, role, full_name FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'ผู้ใช้นี้ไม่มีอยู่ในระบบ หรือถูกระงับสิทธิ์แล้ว' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session หมดอายุ หรือ Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ท่านไม่มีสิทธิ์ในการเข้าถึงข้อมูลส่วนนี้ (Access Denied)' });
    }
    next();
  };
}

// BOLA / IDOR Protection: Patient can only access their own linked patient record
function checkPatientAccess(req, res, next) {
  const patientId = parseInt(req.params.id || req.params.patientId);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'รหัสผู้ป่วยไม่ถูกต้อง' });
  }

  // Doctors and Admins can access all patients
  if (req.user.role === 'admin' || req.user.role === 'doctor' || req.user.role === 'nurse') {
    return next();
  }

  // If patient role, verify this patient record belongs to them
  const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(patientId);
  if (!patient || patient.user_id !== req.user.id) {
    return res.status(403).json({ error: 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลของผู้ป่วยรายอื่น (Security Violation)' });
  }

  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  requireRole,
  checkPatientAccess
};
