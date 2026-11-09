const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkPatientAccess } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// GET /api/patients/:id/analytics - 20-week calculations & chart data
router.get('/:id/analytics', verifyToken, checkPatientAccess, (req, res) => {
  const patientId = parseInt(req.params.id);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'ไม่พบผู้ป่วย' });
  }

  // Fetch all records for this patient
  const records = db.prepare(`
    SELECT * FROM health_records
    WHERE patient_id = ?
    ORDER BY week_number ASC, day_of_week ASC
  `).all(patientId);

  // Group records by week (1 to 20)
  const weeklyMatrix = [];
  for (let w = 1; w <= 20; w++) {
    weeklyMatrix.push({
      week_number: w,
      days_logged: 0,
      days: {},
      averages: {
        bp_systolic: null,
        bp_diastolic: null,
        glucose_first_meal_pre: null,
        glucose_first_meal_post: null,
        glucose_last_meal_pre: null,
        glucose_last_meal_post: null,
        step_count: null
      }
    });
  }

  // Populate days
  records.forEach(rec => {
    const wIndex = rec.week_number - 1;
    if (wIndex >= 0 && wIndex < 20) {
      weeklyMatrix[wIndex].days[rec.day_of_week] = rec;
      weeklyMatrix[wIndex].days_logged++;
    }
  });

  // Calculate weekly averages (Replicating Rows 10, 18, 26, ... without #DIV/0!)
  const keys = [
    'bp_systolic',
    'bp_diastolic',
    'glucose_first_meal_pre',
    'glucose_first_meal_post',
    'glucose_last_meal_pre',
    'glucose_last_meal_post',
    'step_count'
  ];

  weeklyMatrix.forEach(wm => {
    if (wm.days_logged > 0) {
      keys.forEach(k => {
        let sum = 0;
        let count = 0;
        for (let d = 1; d <= 7; d++) {
          const rec = wm.days[d];
          if (rec && rec[k] !== null && rec[k] !== undefined && !isNaN(rec[k])) {
            sum += rec[k];
            count++;
          }
        }
        wm.averages[k] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
      });
    }
  });

  // Calculate Grand Total Average (Row 23: AVERAGEIF(..., ">0"))
  const grandAverages = {};
  keys.forEach(k => {
    let sum = 0;
    let count = 0;
    weeklyMatrix.forEach(wm => {
      const val = wm.averages[k];
      if (val !== null && val > 0) {
        sum += val;
        count++;
      }
    });
    grandAverages[k] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  });

  // Remission Target Compliance Check
  // Fasting Normal: < 100 mg/dL, Controlled: < 126
  // Post-meal Normal: < 140 mg/dL, Controlled: < 180
  // BP Normal: < 120/80 mmHg, Controlled: < 130/80
  // Steps Target: >= 7,000 steps/day
  let remissionPoints = 0;
  let totalEvaluated = 0;

  if (grandAverages.glucose_first_meal_pre !== null) {
    totalEvaluated++;
    if (grandAverages.glucose_first_meal_pre < 100) remissionPoints += 2;
    else if (grandAverages.glucose_first_meal_pre <= 125) remissionPoints += 1;
  }
  if (grandAverages.glucose_first_meal_post !== null) {
    totalEvaluated++;
    if (grandAverages.glucose_first_meal_post < 140) remissionPoints += 2;
    else if (grandAverages.glucose_first_meal_post <= 180) remissionPoints += 1;
  }
  if (grandAverages.bp_systolic !== null && grandAverages.bp_diastolic !== null) {
    totalEvaluated++;
    if (grandAverages.bp_systolic <= 120 && grandAverages.bp_diastolic <= 80) remissionPoints += 2;
    else if (grandAverages.bp_systolic <= 130 && grandAverages.bp_diastolic <= 85) remissionPoints += 1;
  }
  if (grandAverages.step_count !== null) {
    totalEvaluated++;
    if (grandAverages.step_count >= 8000) remissionPoints += 2;
    else if (grandAverages.step_count >= 5000) remissionPoints += 1;
  }

  const maxPoints = Math.max(1, totalEvaluated * 2);
  const remissionScorePercent = Math.round((remissionPoints / maxPoints) * 100);

  let remissionStatusText = 'กำลังเริ่มต้นเก็บข้อมูล';
  let remissionBadgeClass = 'badge-neutral';
  if (totalEvaluated > 0) {
    if (remissionScorePercent >= 85) {
      remissionStatusText = 'เข้าสู่เกณฑ์ Remission ที่ดีเยี่ยม (Optimal Remission)';
      remissionBadgeClass = 'badge-success';
    } else if (remissionScorePercent >= 60) {
      remissionStatusText = 'มีพัฒนาการดี ควบคุมได้ดี (Well-Controlled Progress)';
      remissionBadgeClass = 'badge-primary';
    } else {
      remissionStatusText = 'ยังต้องปรับพฤติกรรมและการรักษา (Needs Lifestyle Adjustment)';
      remissionBadgeClass = 'badge-warning';
    }
  }

  // Prepare Chart Series
  // 1. Weekly Trends (20 Weeks)
  const chartWeeks = weeklyMatrix.map(wm => `สัปดาห์ ${wm.week_number}`);
  const chartBpSys = weeklyMatrix.map(wm => wm.averages.bp_systolic);
  const chartBpDia = weeklyMatrix.map(wm => wm.averages.bp_diastolic);
  const chartG1Pre = weeklyMatrix.map(wm => wm.averages.glucose_first_meal_pre);
  const chartG1Post = weeklyMatrix.map(wm => wm.averages.glucose_first_meal_post);
  const chartG2Pre = weeklyMatrix.map(wm => wm.averages.glucose_last_meal_pre);
  const chartG2Post = weeklyMatrix.map(wm => wm.averages.glucose_last_meal_post);
  const chartSteps = weeklyMatrix.map(wm => wm.averages.step_count);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: 'VIEW_ANALYTICS',
    resource: `/api/patients/${patientId}/analytics`,
    patientHn: patient.hn,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    patient,
    weeklyMatrix,
    grandAverages,
    remission: {
      scorePercent: remissionScorePercent,
      statusText: remissionStatusText,
      badgeClass: remissionBadgeClass
    },
    charts: {
      labels: chartWeeks,
      bp: { systolic: chartBpSys, diastolic: chartBpDia },
      glucose: {
        firstPre: chartG1Pre,
        firstPost: chartG1Post,
        lastPre: chartG2Pre,
        lastPost: chartG2Post
      },
      steps: chartSteps
    }
  });
});

module.exports = router;
