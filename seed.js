const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./database');

async function seed() {
  initDatabase();

  console.log('Seeding initial security users & DM Remission test data with National IDs...');

  // 1. Create Users
  const salt = bcrypt.genSaltSync(12);
  const adminPass = bcrypt.hashSync('Admin@123456', salt);
  const doctorPass = bcrypt.hashSync('Doctor@123456', salt);
  const patientPass = bcrypt.hashSync('Patient@123456', salt);

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password_hash, role, full_name, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(1, 'admin', adminPass, 'admin', 'ผู้ดูแลระบบสูงสุด (System Admin)', 'admin@hospital.org');
  insertUser.run(2, 'dr.somchai', doctorPass, 'doctor', 'นพ.สมชาย เชี่ยวชาญ (แพทย์อายุรกรรมเบาหวาน)', 'dr.somchai@hospital.org');
  insertUser.run(3, 'patient01', patientPass, 'patient', 'นายสมศักดิ์ สุขใจ (ผู้ป่วย)', 'somsak@email.com');

  // 2. Create Patients with Citizen IDs (เลขบัตรประชาชน 13 หลัก)
  const insertPatient = db.prepare(`
    INSERT OR REPLACE INTO patients (
      id, hn, citizen_id, user_id, full_name, gender, birth_date, age,
      initial_weight_kg, target_weight_kg, initial_hba1c, program_start_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPatient.run(
    1,
    'HN-68001',
    '1-1002-00123-45-6',
    3,
    'นายสมศักดิ์ สุขใจ',
    'M',
    '1974-05-15',
    52,
    82.5,
    72.0,
    8.4,
    '2026-09-01',
    'active',
    'เข้าร่วมโครงการ DM Remission มีเป้าหมายลดน้ำหนักและหยุดยาลดเบาหวาน'
  );

  insertPatient.run(
    2,
    'HN-68002',
    '3-1005-00987-65-4',
    null,
    'นางวิภาวรรณ มีสุข',
    'F',
    '1978-11-20',
    48,
    69.0,
    60.0,
    7.6,
    '2026-10-01',
    'active',
    'ควบคุมอาหารแบบ Low Carb เน้นการเดินเร็ว'
  );

  insertPatient.run(
    3,
    'HN-68003',
    '1-1014-00555-88-9',
    null,
    'นายประเสริฐ เกษมสุข',
    'M',
    '1967-03-10',
    59,
    88.0,
    75.0,
    9.1,
    '2026-11-01',
    'active',
    'ผู้ป่วยลงทะเบียนใหม่ เริ่มสัปดาห์ที่ 1'
  );

  // 3. Insert realistic DM Remission records for Patient 1 (Weeks 1 to 4)
  const insertRecord = db.prepare(`
    INSERT OR REPLACE INTO health_records (
      patient_id, week_number, day_of_week, record_date,
      bp_systolic, bp_diastolic,
      glucose_first_meal_pre, glucose_first_meal_post,
      glucose_last_meal_pre, glucose_last_meal_post,
      step_count, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const startDate = new Date('2026-09-01');

  for (let week = 1; week <= 4; week++) {
    for (let day = 1; day <= 7; day++) {
      const dayOffset = (week - 1) * 7 + (day - 1);
      const recDate = new Date(startDate);
      recDate.setDate(recDate.getDate() + dayOffset);
      const dateStr = recDate.toISOString().split('T')[0];

      const progressFactor = (week - 1) * 0.25 + (day / 7) * 0.05;
      const bpSys = Math.round(145 - progressFactor * 22 + (Math.random() * 6 - 3));
      const bpDia = Math.round(92 - progressFactor * 14 + (Math.random() * 4 - 2));
      const g1Pre = Math.round(155 - progressFactor * 48 + (Math.random() * 8 - 4));
      const g1Post = Math.round(188 - progressFactor * 52 + (Math.random() * 10 - 5));
      const g2Pre = Math.round(140 - progressFactor * 38 + (Math.random() * 6 - 3));
      const g2Post = Math.round(175 - progressFactor * 45 + (Math.random() * 10 - 5));
      const steps = Math.round(4500 + progressFactor * 4800 + (Math.random() * 600 - 300));

      insertRecord.run(
        1,
        week,
        day,
        dateStr,
        bpSys,
        bpDia,
        g1Pre,
        g1Post,
        g2Pre,
        g2Post,
        steps,
        day === 1 ? `เริ่มต้นสัปดาห์ที่ ${week}` : ''
      );
    }
  }

  // Week 1 for Patient 2
  for (let day = 1; day <= 5; day++) {
    const dayOffset = day - 1;
    const recDate = new Date('2026-10-01');
    recDate.setDate(recDate.getDate() + dayOffset);
    insertRecord.run(
      2,
      1,
      day,
      recDate.toISOString().split('T')[0],
      134,
      84,
      138,
      165,
      130,
      155,
      5800,
      'เดินออกกำลังกายช่วงเย็น'
    );
  }

  console.log('Seed with National IDs completed successfully!');
}

seed();
