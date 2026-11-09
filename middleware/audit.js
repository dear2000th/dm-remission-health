const { db } = require('../database');

function logAudit({ userId, username, role, action, resource, patientHn, ipAddress, userAgent, details }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, role, action, resource, patient_hn, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId || null,
      username || 'ANONYMOUS',
      role || 'NONE',
      action,
      resource,
      patientHn || null,
      ipAddress || 'UNKNOWN',
      userAgent || 'UNKNOWN',
      details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
    );
  } catch (err) {
    console.error('Audit log failed to write:', err.message);
  }
}

function auditMiddleware(action, resource) {
  return (req, res, next) => {
    // Intercept finish to log response status
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logAudit({
          userId: req.user ? req.user.id : null,
          username: req.user ? req.user.username : 'ANONYMOUS',
          role: req.user ? req.user.role : 'GUEST',
          action: action || req.method,
          resource: resource || req.originalUrl,
          patientHn: req.params.hn || req.patientHn || null,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          details: { method: req.method, status: res.statusCode, params: req.params }
        });
      }
    });
    next();
  };
}

module.exports = {
  logAudit,
  auditMiddleware
};
