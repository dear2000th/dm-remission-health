const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkPatientAccess } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { getFirestore, isFirestoreReady } = require('../firebase');

// GET /api/patients/:id/records - Get health records
router.get('/:id/records', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const { week } = req.query;

  let query = `
    SELECT * FROM health_records
    WHERE patient_id = ?
  `;
  const params = [patientId];

  if (week) {
    const weekNum = parseInt(week);
    if (weekNum >= 1 && weekNum <= 20) {
      query += ` AND week_number = ?`;
      params.push(weekNum);
    }
  }

  query += ` ORDER BY week_number ASC, day_of_week ASC`;

  const records = db.prepare(query).all(...params);
  res.json({ records });
});

// POST /api/patients/:id/records - Upsert daily record
router.post('/:id/records', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT hn FROM patients WHERE id = ?').get(patientId);
  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  const {
    week_number,
    day_of_week,
    record_date,
    bp_systolic,
    bp_diastolic,
    glucose_first_meal_pre,
    glucose_first_meal_post,
    glucose_last_meal_pre,
    glucose_last_meal_post,
    step_count,
    notes
  } = req.body;

  // Validation
  const weekNum = parseInt(week_number);
  const dayNum = parseInt(day_of_week);

  if (isNaN(weekNum) || weekNum < 1 || weekNum > 20) {
    return res.status(400).json({ error: 'สัปดาห์ต้องอยู่ระหว่าง 1 ถึง 20' });
  }
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) {
    return res.status(400).json({ error: 'วันที่ของสัปดาห์ต้องอยู่ระหว่าง 1 ถึง 7' });
  }

  // Validate Ranges for medical sanity
  function validateRange(val, min, max, label) {
    if (val !== undefined && val !== null && val !== '') {
      const num = parseFloat(val);
      if (isNaN(num) || num < min || num > max) {
        throw new Error(`${label} ต้องเป็นตัวเลขระหว่าง ${min} ถึง ${max}`);
      }
      return num;
    }
    return null;
  }

  let cleanSys, cleanDia, cleanG1Pre, cleanG1Post, cleanG2Pre, cleanG2Post, cleanSteps;
  try {
    cleanSys = validateRange(bp_systolic, 40, 300, 'ความดัน บน (Systolic)');
    cleanDia = validateRange(bp_diastolic, 30, 200, 'ความดัน ล่าง (Diastolic)');
    cleanG1Pre = validateRange(glucose_first_meal_pre, 20, 700, 'น้ำตาลมื้อแรก ก่อนอาหาร');
    cleanG1Post = validateRange(glucose_first_meal_post, 20, 700, 'น้ำตาลมื้อแรก หลังอาหาร');
    cleanG2Pre = validateRange(glucose_last_meal_pre, 20, 700, 'น้ำตาลมื้อสุดท้าย ก่อนอาหาร');
    cleanG2Post = validateRange(glucose_last_meal_post, 20, 700, 'น้ำตาลมื้อสุดท้าย หลังอาหาร');
    cleanSteps = validateRange(step_count, 0, 150000, 'จำนวนก้าวเดิน');
  } catch (valErr) {
    return res.status(400).json({ error: valErr.message });
  }

  // Upsert record using prepared statement
  const stmt = db.prepare(`
    INSERT INTO health_records (
      patient_id, week_number, day_of_week, record_date,
      bp_systolic, bp_diastolic,
      glucose_first_meal_pre, glucose_first_meal_post,
      glucose_last_meal_pre, glucose_last_meal_post,
      step_count, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(patient_id, week_number, day_of_week) DO UPDATE SET
      record_date = excluded.record_date,
      bp_systolic = excluded.bp_systolic,
      bp_diastolic = excluded.bp_diastolic,
      glucose_first_meal_pre = excluded.glucose_first_meal_pre,
      glucose_first_meal_post = excluded.glucose_first_meal_post,
      glucose_last_meal_pre = excluded.glucose_last_meal_pre,
      glucose_last_meal_post = excluded.glucose_last_meal_post,
      step_count = excluded.step_count,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    patientId,
    weekNum,
    dayNum,
    record_date || null,
    cleanSys,
    cleanDia,
    cleanG1Pre,
    cleanG1Post,
    cleanG2Pre,
    cleanG2Post,
    cleanSteps !== null ? parseInt(cleanSteps) : null,
    notes ? notes.trim() : null
  );

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'SAVE_HEALTH_RECORD',
    resource: `/api/patients/${patientId}/records`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { week: weekNum, day: dayNum, sys: cleanSys, dia: cleanDia, fbs: cleanG1Pre }
  });

  // Sync health record to Cloud Firestore
  if (isFirestoreReady()) {
    try {
      const fsDb = getFirestore();
      if (fsDb) {
        fsDb.collection('patients').doc(String(patientId))
          .collection('health_records').doc(`w${weekNum}_d${dayNum}`)
          .set({
            patient_id: patientId,
            week_number: weekNum,
            day_of_week: dayNum,
            record_date: record_date || new Date().toISOString().split('T')[0],
            bp_systolic: cleanSys !== null ? cleanSys : null,
            bp_diastolic: cleanDia !== null ? cleanDia : null,
            glucose_first_meal_pre: cleanG1Pre !== null ? cleanG1Pre : null,
            glucose_first_meal_post: cleanG1Post !== null ? cleanG1Post : null,
            glucose_last_meal_pre: cleanG2Pre !== null ? cleanG2Pre : null,
            glucose_last_meal_post: cleanG2Post !== null ? cleanG2Post : null,
            step_count: cleanSteps !== null ? parseInt(cleanSteps) : null,
            notes: notes ? notes.trim() : '',
            updated_at: new Date().toISOString()
          }, { merge: true }).catch(err => console.warn('Firestore record sync warning:', err.message));
      }
    } catch (fsErr) {
      console.warn('Firestore record sync error:', fsErr.message);
    }
  }

  res.json({
    message: `บันทึกข้อมูลสุขภาพ สัปดาห์ที่ ${weekNum} วันที่ ${dayNum} เรียบร้อยแล้ว`,
    data: {
      patient_id: patientId,
      week_number: weekNum,
      day_of_week: dayNum
    }
  });
});

// POST /api/patients/:id/reset-blocks - Clear 20-week blocks (Port of VBA ClearSpecific20Blocks)
router.post('/:id/reset-blocks', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT hn FROM patients WHERE id = ?').get(patientId);
  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  const { target } = req.body; // 'all' or week number 1-20

  let deletedCount = 0;
  if (target === 'all' || !target) {
    // Clear all 20 blocks
    const info = db.prepare('DELETE FROM health_records WHERE patient_id = ?').run(patientId);
    deletedCount = info.changes;
  } else {
    const weekNum = parseInt(target);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 20) {
      return res.status(400).json({ error: 'สัปดาห์ที่ต้องการล้างต้องอยู่ระหว่าง 1 ถึง 20' });
    }
    const info = db.prepare('DELETE FROM health_records WHERE patient_id = ? AND week_number = ?').run(patientId, weekNum);
    deletedCount = info.changes;
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'RESET_BLOCKS',
    resource: `/api/patients/${patientId}/reset-blocks`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { target: target || 'all', deletedCount }
  });

  res.json({
    message: target === 'all' || !target
      ? `ล้างข้อมูลสุขภาพครบทั้ง 20 สัปดาห์เรียบร้อยแล้ว (${deletedCount} รายการ)`
      : `ล้างข้อมูลสุขภาพสัปดาห์ที่ ${target} เรียบร้อยแล้ว (${deletedCount} รายการ)`
  });
});

module.exports = router;
