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

// GET /api/patients/:id - Patient detail
router.get('/:id', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  // Get recording stats
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT week_number) as total_weeks_recorded,
      COUNT(id) as total_days_recorded,
      MIN(record_date) as first_log_date,
      MAX(record_date) as last_log_date
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
    const existingCid = db.prepare("SELECT id FROM patients WHERE citizen_id = ? OR REPLACE(citizen_id, '-', '') = ?").get(cleanCitizenId, digitsOnly);
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

// PUT /api/patients/:id - Update all patient info (HN, Citizen ID, Name, Gender, Age, Weights, HbA1c, etc.)
router.put('/:id', verifyToken, requireRole(['admin', 'doctor', 'nurse']), (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

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
    status,
    notes
  } = req.body;

  // Check unique HN if changing
  let cleanHn = patient.hn;
  if (hn && hn.trim() && hn.trim() !== patient.hn) {
    const existingHn = db.prepare('SELECT id FROM patients WHERE hn = ? AND id != ?').get(hn.trim(), patientId);
    if (existingHn) {
      return res.status(409).json({ error: 'รหัส HN นี้ถูกใช้งานโดยผู้ป่วยรายอื่นแล้ว' });
    }
    cleanHn = hn.trim();
  }

  // Citizen ID validation
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
      const duplicate = db.prepare("SELECT id FROM patients WHERE (citizen_id = ? OR REPLACE(citizen_id, '-', '') = ?) AND id != ?").get(cleanCitizenId, digitsOnly, patientId);
      if (duplicate) {
        return res.status(409).json({ error: 'เลขประจำตัวประชาชนนี้มีอยู่ในระบบแล้ว' });
      }
    }
  }

  db.prepare(`
    UPDATE patients
    SET hn = COALESCE(?, hn),
        citizen_id = ?,
        full_name = COALESCE(?, full_name),
        gender = COALESCE(?, gender),
        birth_date = COALESCE(?, birth_date),
        age = COALESCE(?, age),
        initial_weight_kg = COALESCE(?, initial_weight_kg),
        target_weight_kg = COALESCE(?, target_weight_kg),
        initial_hba1c = COALESCE(?, initial_hba1c),
        program_start_date = COALESCE(?, program_start_date),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    cleanHn,
    cleanCitizenId,
    full_name ? full_name.trim() : null,
    gender || null,
    birth_date || null,
    age !== undefined && age !== '' ? parseInt(age) : null,
    initial_weight_kg !== undefined && initial_weight_kg !== '' ? parseFloat(initial_weight_kg) : null,
    target_weight_kg !== undefined && target_weight_kg !== '' ? parseFloat(target_weight_kg) : null,
    initial_hba1c !== undefined && initial_hba1c !== '' ? parseFloat(initial_hba1c) : null,
    program_start_date || null,
    status || null,
    notes !== undefined ? notes : null,
    patientId
  );

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'UPDATE_PATIENT',
    resource: `/api/patients/${patientId}`,
    patientHn: cleanHn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: req.body
  });

  res.json({ message: 'ปรับปรุงข้อมูลผู้ป่วยเรียบร้อยแล้ว' });
});

// DELETE /api/patients/:id - Delete patient and all their health records
router.delete('/:id', verifyToken, requireRole(['admin', 'doctor']), (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  // Delete all health records for this patient
  const recInfo = db.prepare('DELETE FROM health_records WHERE patient_id = ?').run(patientId);

  // Delete patient
  db.prepare('DELETE FROM patients WHERE id = ?').run(patientId);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'DELETE_PATIENT',
    resource: `/api/patients/${patientId}`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: {
      full_name: patient.full_name,
      citizen_id: patient.citizen_id,
      deleted_records_count: recInfo.changes
    }
  });

  res.json({
    message: `ลบข้อมูลผู้ป่วย ${patient.full_name} (${patient.hn}) และประวัติบันทึกสุขภาพ ${recInfo.changes} รายการเรียบร้อยแล้ว`
  });
});

module.exports = router;
