const bcrypt = require('bcryptjs');
const { initFirebase, getFirestore, isFirestoreReady } = require('./firebase');

async function seedFirestore() {
  console.log('====================================================');
  console.log('🔥 Initializing Cloud Firestore Seeding Process...');
  console.log('====================================================');

  const db = initFirebase();

  if (!isFirestoreReady() || !db) {
    console.error('❌ ไม่พบไฟล์ serviceAccountKey.json หรือตัวแปร FIREBASE_* ใน .env');
    console.error('กรุณาดาวน์โหลด Service Account Key จาก Firebase Console แล้วนำมาวางที่โฟลเดอร์นี้');
    console.error('คู่มือการตั้งค่าดูได้ที่ README.md');
    process.exit(1);
  }

  try {
    const salt = bcrypt.genSaltSync(12);
    const adminPass = bcrypt.hashSync('Admin@123456', salt);
    const doctorPass = bcrypt.hashSync('Doctor@123456', salt);
    const patientPass = bcrypt.hashSync('Patient@123456', salt);

    // 1. Seed Users
    console.log('1. Seeding Users to Firestore...');
    const users = [
      {
        id: 1,
        username: 'admin',
        password_hash: adminPass,
        role: 'admin',
        full_name: 'ผู้ดูแลระบบสูงสุด (System Admin)',
        email: 'admin@hospital.org',
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        username: 'dr.somchai',
        password_hash: doctorPass,
        role: 'doctor',
        full_name: 'นพ.สมชาย เชี่ยวชาญ (แพทย์อายุรกรรมเบาหวาน)',
        email: 'dr.somchai@hospital.org',
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        username: 'patient01',
        password_hash: patientPass,
        role: 'patient',
        full_name: 'นายสมศักดิ์ สุขใจ (ผู้ป่วย)',
        email: 'somsak@email.com',
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      }
    ];

    for (const u of users) {
      await db.collection('users').doc(u.username).set(u, { merge: true });
      console.log(` - User added/updated: ${u.username} (${u.role})`);
    }

    // 2. Seed Patients
    console.log('\n2. Seeding Patients to Firestore...');
    const patients = [
      {
        id: 1,
        hn: 'HN-68001',
        citizen_id: '1-1002-00123-45-6',
        user_id: 3,
        full_name: 'นายสมศักดิ์ สุขใจ',
        gender: 'M',
        birth_date: '1974-05-15',
        age: 52,
        initial_weight_kg: 82.5,
        target_weight_kg: 72.0,
        initial_hba1c: 8.4,
        program_start_date: '2026-09-01',
        status: 'active',
        notes: 'เข้าร่วมโครงการ DM Remission มีเป้าหมายลดน้ำหนักและหยุดยาลดเบาหวาน',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        hn: 'HN-68002',
        citizen_id: '3-1005-00987-65-4',
        user_id: null,
        full_name: 'นางวิภาวรรณ มีสุข',
        gender: 'F',
        birth_date: '1978-11-20',
        age: 48,
        initial_weight_kg: 69.0,
        target_weight_kg: 60.0,
        initial_hba1c: 7.6,
        program_start_date: '2026-10-01',
        status: 'active',
        notes: 'ควบคุมอาหารแบบ Low Carb เน้นการเดินเร็ว',
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        hn: 'HN-68003',
        citizen_id: '1-1014-00555-88-9',
        user_id: null,
        full_name: 'นายประเสริฐ เกษมสุข',
        gender: 'M',
        birth_date: '1967-03-10',
        age: 59,
        initial_weight_kg: 88.0,
        target_weight_kg: 75.0,
        initial_hba1c: 9.1,
        program_start_date: '2026-11-01',
        status: 'active',
        notes: 'ผู้ป่วยลงทะเบียนใหม่ เริ่มสัปดาห์ที่ 1',
        created_at: new Date().toISOString()
      }
    ];

    for (const p of patients) {
      await db.collection('patients').doc(String(p.id)).set(p, { merge: true });
      console.log(` - Patient added/updated: ${p.hn} (${p.full_name})`);
    }

    // 3. Seed 4 Weeks of Health Records for Patient 1
    console.log('\n3. Seeding 4-Week Health Records for Patient 1 in Firestore...');
    const startDate = new Date('2026-09-01');
    const recordsBatch = db.batch();

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

        const docRef = db.collection('patients').doc('1')
          .collection('health_records').doc(`w${week}_d${day}`);

        recordsBatch.set(docRef, {
          patient_id: 1,
          week_number: week,
          day_of_week: day,
          record_date: dateStr,
          bp_systolic: bpSys,
          bp_diastolic: bpDia,
          glucose_first_meal_pre: g1Pre,
          glucose_first_meal_post: g1Post,
          glucose_last_meal_pre: g2Pre,
          glucose_last_meal_post: g2Post,
          step_count: steps,
          notes: day === 1 ? `เริ่มต้นสัปดาห์ที่ ${week}` : '',
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
    }

    await recordsBatch.commit();
    console.log(' - Successfully seeded 28 health records for Patient 1!');

    // 4. Initial Audit Log
    console.log('\n4. Recording Firestore Init Audit Log...');
    await db.collection('audit_logs').add({
      user_id: 1,
      username: 'admin',
      role: 'admin',
      action: 'FIRESTORE_INIT_SEED',
      resource: 'FIREBASE_MIGRATION',
      ip_address: '127.0.0.1',
      details: 'เริ่มต้นและโยกย้ายฐานข้อมูลไปยัง Cloud Firestore สำเร็จ',
      created_at: new Date().toISOString()
    });

    console.log('\n====================================================');
    console.log('🎉 ข้อมูลทั้งหมดถูกนำเข้าสู่ Cloud Firestore สำเร็จเรียบร้อย!');
    console.log('====================================================');

  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการ Seed ข้อมูลเข้า Firestore:', err);
  }
}

seedFirestore();
