const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/audit-logs - View security audit logs
router.get('/', verifyToken, requireRole(['admin', 'doctor']), (req, res) => {
  const { limit = 50, action, hn } = req.query;
  const numLimit = Math.min(200, parseInt(limit) || 50);

  let query = `SELECT * FROM audit_logs`;
  const params = [];
  const whereClauses = [];

  if (action) {
    whereClauses.push('action = ?');
    params.push(action);
  }
  if (hn) {
    whereClauses.push('patient_hn = ?');
    params.push(hn);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ` ORDER BY id DESC LIMIT ?`;
  params.push(numLimit);

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

module.exports = router;
