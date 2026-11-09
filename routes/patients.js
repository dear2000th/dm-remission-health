const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, requireRole, checkPatientAccess } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// GET /api/patients - List & Search patients by Citizen ID, HN, or Full Name
router.get('/', verifyToken, (req, res) => {
  const { q } = req.query;

  // If patient, only return themselves
  if (req.user.role === 'patient') {
    const patient = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(req.user.id);
    return res.json({ patients: patient ? [patient] : [] });
  }

  let query = `
    SELECT p.*,
      (SELECT COUNT(DISTINCT week_number) FROM health_records WHERE patient_id = p.id) as recorded_weeks_count,
      (SELECT MAX(record_date) FROM health_records WHERE patient_id = p.id) as last_record_date
    FROM patients p
  `;
  const params = [];

  if (q && q.trim()) {
    const rawSearch = q.trim();
    const cleanDigits = rawSearch.replace(/[-\s]/g, '');

    query += `
      WHERE p.hn LIKE ?
         OR p.full_name LIKE ?
         OR p.citizen_id LIKE ?
         OR REPLACE(p.citizen_id, '-', '') LIKE ?
    `;
    params.push(`%${rawSearch}%`, `%${rawSearch}%`, `%${rawSearch}%`, `%${cleanDigits}%`);
  }

  query += ` ORDER BY p.id ASC`;

  const patients = db.prepare(query).all(...params);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'VIEW_PATIENT_LIST',
    resource: '/api/patients',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { search: q || null, count: patients.length }
  });

  res.json({ patients });
});

// GET /api/patients/:id - Patient details
router.get('/:id', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วย' });
  }

  // Summary statistics
  const stats = db.prepare(`
    SELECT
      COUNT(id) as total_days_logged,
      COUNT(DISTINCT week_number) as active_weeks,
      AVG(bp_systolic) as avg_bp_sys,
      AVG(bp_diastolic) as avg_bp_dia,
      AVG(glucose_first_meal_pre) as avg_fbs,
      AVG(step_count) as avg_steps
    FROM health_records
    WHERE patient_id = ?
  `).get(patientId);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'VIEW_PATIENT_DETAIL',
    resource: `/api/patients/${patientId}`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({ patient, stats });
});

// POST /api/patients - Create new patient (with citizen_id)
router.post('/', verifyToken, requireRole(['admin', 'doctor', 'nurse']), (req, res) => {
  const {
    hn,
    citizen_id,
    full_name,
    gender,
    birth_date,
    age,
    initial_weight_kg,
    target_weight_kg,
    initial_hba1c,
    program_start_date,
    notes
  } = req.body;

  if (!hn || !full_name || !program_start_date) {
    return res.status(400).json({ error: 'กรุณากรอก HN, ชื่อ-นามสกุล และวันที่เริ่มโปรแกรมให้ครบถ้วน' });
  }

  // Check unique HN
  const existingHn = db.prepare('SELECT id FROM patients WHERE hn = ?').get(hn.trim());
  if (existingHn) {
    return res.status(409).json({ error: 'รหัส HN นี้มีอยู่ในระบบแล้ว' });
  }

  // Validate citizen_id if provided (13 digits check)
  let cleanCitizenId = null;
  if (citizen_id && citizen_id.trim()) {
    const rawCid = citizen_id.trim();
    const digitsOnly = rawCid.replace(/[-\s]/g, '');
    if (digitsOnly.length !== 13 || !/^\d+$/.test(digitsOnly)) {
      return res.status(400).json({ error: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก' });
    }
    // Format as 1-1002-00123-45-6
    cleanCitizenId = `${digitsOnly[0]}-${digitsOnly.slice(1, 5)}-${digitsOnly.slice(5, 10)}-${digitsOnly.slice(10, 12)}-${digitsOnly[12]}`;

    // Check unique Citizen ID
    const existingCid = db.prepare('SELECT id FROM patients WHERE citizen_id = ? OR REPLACE(citizen_id, "-", "") = ?').get(cleanCitizenId, digitsOnly);
    if (existingCid) {
      return res.status(409).json({ error: 'เลขประจำตัวประชาชนนี้มีอยู่ในระบบแล้ว' });
    }
  }

  const stmt = db.prepare(`
    INSERT INTO patients (
      hn, citizen_id, full_name, gender, birth_date, age,
      initial_weight_kg, target_weight_kg, initial_hba1c,
      program_start_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);

  const result = stmt.run(
    hn.trim(),
    cleanCitizenId,
    full_name.trim(),
    gender || 'Other',
    birth_date || null,
    age ? parseInt(age) : null,
    initial_weight_kg ? parseFloat(initial_weight_kg) : null,
    target_weight_kg ? parseFloat(target_weight_kg) : null,
    initial_hba1c ? parseFloat(initial_hba1c) : null,
    program_start_date,
    notes || null
  );

  const newPatientId = result.lastInsertRowid;

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'CREATE_PATIENT',
    resource: `/api/patients/${newPatientId}`,
    patientHn: hn.trim(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { full_name, citizen_id: cleanCitizenId, initial_hba1c }
  });

  res.status(201).json({
    message: 'ลงทะเบียนผู้ป่วยเข้าสู่โครงการ DM Remission เรียบร้อยแล้ว',
    patientId: newPatientId
  });
});

// PUT /api/patients/:id - Update patient (including citizen_id)
router.put('/:id', verifyToken, requireRole(['admin', 'doctor', 'nurse']), (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  const {
    citizen_id,
    full_name,
    age,
    target_weight_kg,
    status,
    notes
  } = req.body;

  let cleanCitizenId = patient.citizen_id;
  if (citizen_id !== undefined && citizen_id !== null) {
    const rawCid = String(citizen_id).trim();
    if (rawCid === '') {
      cleanCitizenId = null;
    } else {
      const digitsOnly = rawCid.replace(/[-\s]/g, '');
      if (digitsOnly.length !== 13 || !/^\d+$/.test(digitsOnly)) {
        return res.status(400).json({ error: 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก' });
      }
      cleanCitizenId = `${digitsOnly[0]}-${digitsOnly.slice(1, 5)}-${digitsOnly.slice(5, 10)}-${digitsOnly.slice(10, 12)}-${digitsOnly[12]}`;

      // Check duplicate
      const duplicate = db.prepare('SELECT id FROM patients WHERE (citizen_id = ? OR REPLACE(citizen_id, "-", "") = ?) AND id != ?').get(cleanCitizenId, digitsOnly, patientId);
      if (duplicate) {
        return res.status(409).json({ error: 'เลขประจำตัวประชาชนนี้มีอยู่ในระบบแล้ว' });
      }
    }
  }

  db.prepare(`
    UPDATE patients
    SET citizen_id = ?,
        full_name = COALESCE(?, full_name),
        age = COALESCE(?, age),
        target_weight_kg = COALESCE(?, target_weight_kg),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    cleanCitizenId,
    full_name ? full_name.trim() : null,
    age ? parseInt(age) : null,
    target_weight_kg ? parseFloat(target_weight_kg) : null,
    status || null,
    notes || null,
    patientId
  );

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'UPDATE_PATIENT',
    resource: `/api/patients/${patientId}`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: req.body
  });

  res.json({ message: 'ปรับปรุงข้อมูลผู้ป่วยเรียบร้อยแล้ว' });
});

module.exports = router;
