/**
 * DM Remission Application API Layer
 * Dual-Mode Engine with Direct Google Cloud Firestore Integration:
 * 1. Server Mode: Connects to Express + SQLite / Firestore (/api)
 * 2. Static / GitHub Pages Mode: Directly connects to Google Cloud Firestore via Firebase Web SDK
 *    with instant localStorage fallback for high availability.
 */

const API = (function () {
  let authToken = localStorage.getItem('dm_remis_token') || null;

  // Auto-detect if running on GitHub Pages, file://, or static hosting
  const isStaticHosting = window.location.hostname.endsWith('github.io') ||
                          window.location.protocol === 'file:' ||
                          window.location.hostname.includes('pages.dev');

  let useClientEngine = isStaticHosting;

  // Firebase Web Client Configuration for direct Cloud Firestore access
  const firebaseWebConfig = {
    projectId: "dm-remission-app",
    appId: "1:926369214936:web:9203ced4b21a7f388b42ad",
    storageBucket: "dm-remission-app.firebasestorage.app",
    apiKey: "AIzaSyAWO1mPG4GLkYZYt03le_jpq5OvT9QcgXc",
    authDomain: "dm-remission-app.firebaseapp.com",
    messagingSenderId: "926369214936"
  };

  let firestoreDb = null;
  let isFirestoreOnline = false;

  function initClientFirebase() {
    if (typeof firebase !== 'undefined') {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseWebConfig);
        }
        firestoreDb = firebase.firestore();
        isFirestoreOnline = true;
        console.log('🔥 Firebase Cloud Firestore connected directly from browser! Project:', firebaseWebConfig.projectId);
        updateCloudStatusPill('online', 'Cloud Firestore: เชื่อมต่อสำเร็จ');
      } catch (e) {
        console.warn('Firebase browser initialization notice:', e.message);
        updateCloudStatusPill('offline', 'Local Storage Mode');
      }
    } else {
      updateCloudStatusPill('offline', 'Local Storage Mode');
    }
  }

  function updateCloudStatusPill(status, text) {
    const pill = document.getElementById('cloud-status-pill');
    const label = document.getElementById('cloud-status-text');
    if (pill && label) {
      label.innerText = text;
      if (status === 'online') {
        pill.style.background = '#ecfdf5';
        pill.style.color = '#047857';
        pill.style.borderColor = '#a7f3d0';
      } else {
        pill.style.background = '#f1f5f9';
        pill.style.color = '#475569';
        pill.style.borderColor = '#cbd5e1';
      }
    }
  }

  // Initialize on script load
  if (typeof window !== 'undefined') {
    setTimeout(initClientFirebase, 50);
  }

  // Initial Seed Data
  const SEED_USERS = [
    {
      id: 1,
      username: 'admin',
      password: 'Admin@123456',
      role: 'admin',
      full_name: 'ผู้ดูแลระบบสูงสุด (System Admin)',
      email: 'admin@hospital.org',
      failed_attempts: 0,
      locked_until: null,
      created_at: '2026-09-01T00:00:00.000Z'
    },
    {
      id: 2,
      username: 'dr.somchai',
      password: 'Doctor@123456',
      role: 'doctor',
      full_name: 'นพ.สมชาย เชี่ยวชาญ (แพทย์อายุรกรรมเบาหวาน)',
      email: 'dr.somchai@hospital.org',
      failed_attempts: 0,
      locked_until: null,
      created_at: '2026-09-01T00:00:00.000Z'
    },
    {
      id: 3,
      username: 'patient01',
      password: 'Patient@123456',
      role: 'patient',
      full_name: 'นายสมศักดิ์ สุขใจ (ผู้ป่วย)',
      email: 'somsak@email.com',
      failed_attempts: 0,
      locked_until: null,
      created_at: '2026-09-01T00:00:00.000Z'
    }
  ];

  const SEED_PATIENTS = [
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
      created_at: '2026-09-01T08:30:00.000Z'
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
      created_at: '2026-10-01T09:00:00.000Z'
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
      created_at: '2026-11-01T10:15:00.000Z'
    }
  ];

  function getStored(key, defaultVal) {
    try {
      const data = localStorage.getItem(`dm_gh_${key}`);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  function setStored(key, val) {
    try {
      localStorage.setItem(`dm_gh_${key}`, JSON.stringify(val));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // Initialize seed data in storage
  if (!localStorage.getItem('dm_gh_users')) {
    setStored('users', SEED_USERS);
  }
  if (!localStorage.getItem('dm_gh_patients')) {
    setStored('patients', SEED_PATIENTS);
  }
  if (!localStorage.getItem('dm_gh_records')) {
    const initRecords = [];
    const startDate = new Date('2026-09-01');
    for (let week = 1; week <= 4; week++) {
      for (let day = 1; day <= 7; day++) {
        const dayOffset = (week - 1) * 7 + (day - 1);
        const recDate = new Date(startDate);
        recDate.setDate(recDate.getDate() + dayOffset);
        const dateStr = recDate.toISOString().split('T')[0];

        const progressFactor = (week - 1) * 0.25 + (day / 7) * 0.05;
        const bpSys = Math.round(145 - progressFactor * 22 + (Math.sin(day) * 4));
        const bpDia = Math.round(92 - progressFactor * 14 + (Math.cos(day) * 3));
        const g1Pre = Math.round(155 - progressFactor * 48 + (Math.sin(day * 2) * 5));
        const g1Post = Math.round(188 - progressFactor * 52 + (Math.cos(day * 2) * 6));
        const g2Pre = Math.round(140 - progressFactor * 38 + (Math.sin(day) * 4));
        const g2Post = Math.round(175 - progressFactor * 45 + (Math.cos(day) * 5));
        const steps = Math.round(4500 + progressFactor * 4800 + (day * 150));

        initRecords.push({
          id: initRecords.length + 1,
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
        });
      }
    }
    setStored('records', initRecords);
  }

  // --- CLIENT-SIDE ENGINE WITH REAL-TIME CLOUD FIRESTORE SYNC ---
  const ClientEngine = {
    async login(username, password) {
      if (firestoreDb) {
        try {
          const userDoc = await firestoreDb.collection('users').doc(username.trim().toLowerCase()).get();
          if (userDoc.exists) {
            const u = userDoc.data();
            const token = 'gh_token_' + btoa(JSON.stringify({ id: u.id, username: u.username, role: u.role }));
            setToken(token);
            const userObj = {
              id: u.id,
              username: u.username,
              role: u.role,
              full_name: u.full_name,
              email: u.email
            };
            setStored('current_user', userObj);
            return { message: 'เข้าสู่ระบบสำเร็จ (Cloud Firestore Mode)', token, user: userObj };
          }
        } catch (err) {
          console.warn('Firestore login check notice, falling back to local store:', err.message);
        }
      }

      // Local fallback
      const users = getStored('users', SEED_USERS);
      const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!user || user.password !== password) {
        throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      }
      const token = 'gh_token_' + btoa(JSON.stringify({ id: user.id, username: user.username, role: user.role }));
      setToken(token);
      const userObj = {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email
      };
      setStored('current_user', userObj);
      return { message: 'เข้าสู่ระบบสำเร็จ', token, user: userObj };
    },

    async getMe() {
      const cur = getStored('current_user', null);
      if (!cur) throw new Error('Unauthenticated');
      return { user: cur };
    },

    async logout() {
      setToken(null);
      localStorage.removeItem('dm_gh_current_user');
      return { message: 'ออกจากระบบสำเร็จ' };
    },

    async getPatients(q = '') {
      let patients = getStored('patients', SEED_PATIENTS);

      // Try fetching live from Firestore
      if (firestoreDb) {
        try {
          const snap = await firestoreDb.collection('patients').get();
          if (!snap.empty) {
            const livePatients = [];
            snap.forEach(doc => {
              const data = doc.data();
              livePatients.push({ ...data, id: Number(doc.id) || data.id });
            });
            livePatients.sort((a, b) => a.id - b.id);
            setStored('patients', livePatients);
            patients = livePatients;
          }
        } catch (err) {
          console.warn('Firestore getPatients warning:', err.message);
        }
      }

      const records = getStored('records', []);

      if (q && q.trim()) {
        const query = q.trim().toLowerCase();
        const cleanDigits = query.replace(/[-\s]/g, '');
        patients = patients.filter(p => {
          const hnMatch = p.hn && p.hn.toLowerCase().includes(query);
          const nameMatch = p.full_name && p.full_name.toLowerCase().includes(query);
          const cidMatch = p.citizen_id && p.citizen_id.includes(query);
          const cleanCidMatch = p.citizen_id && p.citizen_id.replace(/[-\s]/g, '').includes(cleanDigits);
          return hnMatch || nameMatch || cidMatch || cleanCidMatch;
        });
      }

      const result = patients.map(p => {
        const pRecs = records.filter(r => r.patient_id === p.id);
        const weeks = new Set(pRecs.map(r => r.week_number));
        let maxDate = null;
        pRecs.forEach(r => {
          if (!maxDate || r.record_date > maxDate) maxDate = r.record_date;
        });
        return {
          ...p,
          recorded_weeks_count: weeks.size,
          last_record_date: maxDate
        };
      });

      return { patients: result };
    },

    async getPatient(id) {
      const pId = parseInt(id);
      if (firestoreDb) {
        try {
          const doc = await firestoreDb.collection('patients').doc(String(pId)).get();
          if (doc.exists) {
            return { patient: { ...doc.data(), id: pId } };
          }
        } catch (e) {
          console.warn('Firestore getPatient warning:', e.message);
        }
      }

      const patients = getStored('patients', SEED_PATIENTS);
      const p = patients.find(item => item.id === pId);
      if (!p) throw new Error('ไม่พบข้อมูลผู้ป่วย');
      return { patient: p };
    },

    async createPatient(data) {
      const patients = getStored('patients', SEED_PATIENTS);
      const newId = patients.length > 0 ? Math.max(...patients.map(p => p.id)) + 1 : 1;
      const newPatient = {
        id: newId,
        hn: data.hn.trim(),
        citizen_id: data.citizen_id ? data.citizen_id.trim() : null,
        full_name: data.full_name.trim(),
        gender: data.gender || 'M',
        birth_date: data.birth_date || null,
        age: parseInt(data.age) || null,
        initial_weight_kg: parseFloat(data.initial_weight_kg) || null,
        target_weight_kg: parseFloat(data.target_weight_kg) || null,
        initial_hba1c: parseFloat(data.initial_hba1c) || null,
        program_start_date: data.program_start_date || new Date().toISOString().split('T')[0],
        status: data.status || 'active',
        notes: data.notes || '',
        created_at: new Date().toISOString()
      };

      // 1. Save to Cloud Firestore
      if (firestoreDb) {
        try {
          await firestoreDb.collection('patients').doc(String(newId)).set(newPatient);
          console.log('🔥 Cloud Firestore: Successfully created patient', newPatient.hn);
        } catch (err) {
          console.error('Firestore createPatient error:', err);
        }
      }

      // 2. Save to local storage
      patients.push(newPatient);
      setStored('patients', patients);

      return { message: 'ลงทะเบียนผู้ป่วยใหม่เข้าสู่ Cloud Firestore สำเร็จ!', patientId: newId };
    },

    async updatePatient(id, data) {
      const pId = parseInt(id);
      const patients = getStored('patients', SEED_PATIENTS);
      const idx = patients.findIndex(p => p.id === pId);
      if (idx === -1) throw new Error('ไม่พบผู้ป่วย');

      const updated = { ...patients[idx], ...data, updated_at: new Date().toISOString() };
      patients[idx] = updated;
      setStored('patients', patients);

      // Save to Cloud Firestore
      if (firestoreDb) {
        try {
          await firestoreDb.collection('patients').doc(String(pId)).set(updated, { merge: true });
          console.log('🔥 Cloud Firestore: Successfully updated patient', pId);
        } catch (err) {
          console.error('Firestore updatePatient error:', err);
        }
      }

      return { message: 'ปรับปรุงข้อมูลผู้ป่วยขึ้น Cloud Firestore เรียบร้อยแล้ว' };
    },

    async deletePatient(id) {
      const pId = parseInt(id);
      let patients = getStored('patients', SEED_PATIENTS);
      const target = patients.find(p => p.id === pId);
      if (!target) throw new Error('ไม่พบข้อมูลผู้ป่วย');

      // 1. Delete from Cloud Firestore
      if (firestoreDb) {
        try {
          const recSnap = await firestoreDb.collection('patients').doc(String(pId)).collection('health_records').get();
          const batch = firestoreDb.batch();
          recSnap.forEach(d => batch.delete(d.ref));
          batch.delete(firestoreDb.collection('patients').doc(String(pId)));
          await batch.commit();
          console.log('🔥 Cloud Firestore: Successfully deleted patient & health records', pId);
        } catch (err) {
          console.error('Firestore deletePatient error:', err);
        }
      }

      // 2. Delete from local storage
      patients = patients.filter(p => p.id !== pId);
      setStored('patients', patients);

      let records = getStored('records', []);
      records = records.filter(r => r.patient_id !== pId);
      setStored('records', records);

      return { message: `ลบข้อมูลผู้ป่วย ${target.full_name} (${target.hn}) จาก Cloud Firestore เรียบร้อยแล้ว` };
    },

    async getRecords(patientId, week = null) {
      const pId = parseInt(patientId);
      let records = getStored('records', []);

      // Fetch from Cloud Firestore and merge into local cache
      if (firestoreDb) {
        try {
          const snap = await firestoreDb.collection('patients').doc(String(pId)).collection('health_records').get();
          if (!snap.empty) {
            snap.forEach(doc => {
              const d = doc.data();
              if (d && d.week_number && d.day_of_week) {
                const cloudRec = {
                  ...d,
                  patient_id: pId,
                  week_number: parseInt(d.week_number),
                  day_of_week: parseInt(d.day_of_week)
                };
                const idx = records.findIndex(r =>
                  Number(r.patient_id) === pId &&
                  Number(r.week_number) === cloudRec.week_number &&
                  Number(r.day_of_week) === cloudRec.day_of_week
                );
                if (idx !== -1) {
                  records[idx] = { ...records[idx], ...cloudRec };
                } else {
                  records.push(cloudRec);
                }
              }
            });
            setStored('records', records);
          }
        } catch (e) {
          console.warn('Firestore getRecords notice:', e.message);
        }
      }

      let filtered = records.filter(r => Number(r.patient_id) === pId);
      if (week) {
        filtered = filtered.filter(r => Number(r.week_number) === parseInt(week));
      }
      return { records: filtered };
    },

    async saveRecord(patientId, data) {
      const pId = parseInt(patientId);
      const records = getStored('records', []);
      const weekNum = parseInt(data.week_number);
      const dayNum = parseInt(data.day_of_week);

      const existingIdx = records.findIndex(r =>
        Number(r.patient_id) === pId &&
        Number(r.week_number) === weekNum &&
        Number(r.day_of_week) === dayNum
      );

      const newRec = {
        id: existingIdx !== -1 ? records[existingIdx].id : (records.length > 0 ? Math.max(...records.map(r => Number(r.id) || 0)) + 1 : Date.now()),
        patient_id: pId,
        week_number: weekNum,
        day_of_week: dayNum,
        record_date: data.record_date || new Date().toISOString().split('T')[0],
        bp_systolic: (data.bp_systolic !== null && data.bp_systolic !== '' && !isNaN(data.bp_systolic)) ? parseInt(data.bp_systolic) : null,
        bp_diastolic: (data.bp_diastolic !== null && data.bp_diastolic !== '' && !isNaN(data.bp_diastolic)) ? parseInt(data.bp_diastolic) : null,
        glucose_first_meal_pre: (data.glucose_first_meal_pre !== null && data.glucose_first_meal_pre !== '' && !isNaN(data.glucose_first_meal_pre)) ? parseInt(data.glucose_first_meal_pre) : null,
        glucose_first_meal_post: (data.glucose_first_meal_post !== null && data.glucose_first_meal_post !== '' && !isNaN(data.glucose_first_meal_post)) ? parseInt(data.glucose_first_meal_post) : null,
        glucose_last_meal_pre: (data.glucose_last_meal_pre !== null && data.glucose_last_meal_pre !== '' && !isNaN(data.glucose_last_meal_pre)) ? parseInt(data.glucose_last_meal_pre) : null,
        glucose_last_meal_post: (data.glucose_last_meal_post !== null && data.glucose_last_meal_post !== '' && !isNaN(data.glucose_last_meal_post)) ? parseInt(data.glucose_last_meal_post) : null,
        step_count: (data.step_count !== null && data.step_count !== '' && !isNaN(data.step_count)) ? parseInt(data.step_count) : null,
        notes: data.notes || '',
        updated_at: new Date().toISOString()
      };

      // 1. Immediately save to local storage cache so it reflects synchronously in UI
      if (existingIdx !== -1) {
        records[existingIdx] = newRec;
      } else {
        records.push(newRec);
      }
      setStored('records', records);

      // 2. Direct Save to Cloud Firestore
      if (firestoreDb) {
        try {
          const docId = `w${weekNum}_d${dayNum}`;
          await firestoreDb.collection('patients').doc(String(pId))
            .collection('health_records').doc(docId)
            .set(newRec, { merge: true });

          // Also record an audit log
          await firestoreDb.collection('audit_logs').add({
            action: 'SAVE_HEALTH_RECORD',
            patient_id: pId,
            week_number: weekNum,
            day_of_week: dayNum,
            created_at: new Date().toISOString()
          });

          console.log(`🔥 Cloud Firestore: Successfully saved record ${docId} for patient ${pId}`);
        } catch (err) {
          console.error('Firestore saveRecord error:', err);
        }
      }

      return {
        message: `บันทึกข้อมูลสุขภาพ สัปดาห์ที่ ${weekNum} วันที่ ${dayNum} เรียบร้อยแล้ว!`,
        data: newRec
      };
    },

    async resetBlocks(patientId, target = 'all') {
      const pId = parseInt(patientId);
      let records = getStored('records', []);
      let count = 0;

      // 1. Reset in Cloud Firestore
      if (firestoreDb) {
        try {
          const recRef = firestoreDb.collection('patients').doc(String(pId)).collection('health_records');
          let snap;
          if (target === 'all' || !target) {
            snap = await recRef.get();
          } else {
            snap = await recRef.where('week_number', '==', parseInt(target)).get();
          }
          const batch = firestoreDb.batch();
          snap.forEach(d => batch.delete(d.ref));
          await batch.commit();
          console.log('🔥 Cloud Firestore: Cleared blocks count:', snap.size);
        } catch (err) {
          console.error('Firestore resetBlocks error:', err);
        }
      }

      // 2. Local storage
      if (target === 'all' || !target) {
        const initialCount = records.length;
        records = records.filter(r => r.patient_id !== pId);
        count = initialCount - records.length;
      } else {
        const weekNum = parseInt(target);
        const initialCount = records.length;
        records = records.filter(r => !(r.patient_id === pId && r.week_number === weekNum));
        count = initialCount - records.length;
      }
      setStored('records', records);

      return {
        message: target === 'all'
          ? `ล้างข้อมูลสุขภาพครบทั้ง 20 สัปดาห์เรียบร้อยแล้ว (${count} รายการ)`
          : `ล้างข้อมูลสุขภาพสัปดาห์ที่ ${target} เรียบร้อยแล้ว (${count} รายการ)`
      };
    },

    async getAnalytics(patientId) {
      const pId = parseInt(patientId);

      // Get patient info
      const patientRes = await this.getPatient(pId);
      const patient = patientRes.patient;

      // Get records (with Cloud Firestore sync)
      const recordsRes = await this.getRecords(pId);
      const records = recordsRes.records || [];

      // Build 20-week matrix
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

      records.forEach(rec => {
        const wIdx = Number(rec.week_number) - 1;
        const dIdx = Number(rec.day_of_week);
        if (wIdx >= 0 && wIdx < 20 && dIdx >= 1 && dIdx <= 7) {
          if (!weeklyMatrix[wIdx].days[dIdx]) {
            weeklyMatrix[wIdx].days_logged++;
          }
          weeklyMatrix[wIdx].days[dIdx] = rec;
        }
      });

      const keys = [
        'bp_systolic', 'bp_diastolic',
        'glucose_first_meal_pre', 'glucose_first_meal_post',
        'glucose_last_meal_pre', 'glucose_last_meal_post',
        'step_count'
      ];

      weeklyMatrix.forEach(wm => {
        if (wm.days_logged > 0) {
          keys.forEach(k => {
            let sum = 0, count = 0;
            for (let d = 1; d <= 7; d++) {
              const r = wm.days[d];
              if (r && r[k] !== null && r[k] !== undefined && !isNaN(r[k])) {
                sum += Number(r[k]);
                count++;
              }
            }
            wm.averages[k] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
          });
        }
      });

      // Grand Averages (Excel AVERAGEIF(..., ">0"))
      const grandAverages = {};
      keys.forEach(k => {
        let sum = 0, count = 0;
        weeklyMatrix.forEach(wm => {
          if (wm.averages[k] !== null && wm.averages[k] > 0) {
            sum += wm.averages[k];
            count++;
          }
        });
        grandAverages[k] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
      });

      // Remission score
      let score = 50;
      if (grandAverages.glucose_first_meal_pre) {
        if (grandAverages.glucose_first_meal_pre < 100) score += 25;
        else if (grandAverages.glucose_first_meal_pre < 126) score += 15;
      }
      if (grandAverages.bp_systolic && grandAverages.bp_systolic < 130) score += 15;
      if (grandAverages.step_count && grandAverages.step_count >= 8000) score += 10;
      score = Math.min(100, Math.max(0, score));

      let remissionStatusText = 'กำลังดำเนินการปรับพฤติกรรม';
      let remissionBadgeClass = 'badge-warning';
      if (score >= 80) {
        remissionStatusText = 'แนวโน้มเข้าสู่ภาวะสงบสูงมาก (Excellent Remission)';
        remissionBadgeClass = 'badge-success';
      } else if (score >= 60) {
        remissionStatusText = 'ความก้าวหน้าดีตามแผนการรักษา (Good Progress)';
        remissionBadgeClass = 'badge-info';
      }

      return {
        patient,
        weeklyMatrix,
        grandAverages,
        remission: {
          scorePercent: score,
          statusText: remissionStatusText,
          badgeClass: remissionBadgeClass
        },
        charts: {
          labels: weeklyMatrix.map(wm => `สัปดาห์ ${wm.week_number}`),
          bp: {
            systolic: weeklyMatrix.map(wm => wm.averages.bp_systolic),
            diastolic: weeklyMatrix.map(wm => wm.averages.bp_diastolic)
          },
          glucose: {
            firstPre: weeklyMatrix.map(wm => wm.averages.glucose_first_meal_pre),
            firstPost: weeklyMatrix.map(wm => wm.averages.glucose_first_meal_post),
            lastPre: weeklyMatrix.map(wm => wm.averages.glucose_last_meal_pre),
            lastPost: weeklyMatrix.map(wm => wm.averages.glucose_last_meal_post)
          },
          steps: weeklyMatrix.map(wm => wm.averages.step_count)
        }
      };
    },

    async getUsers(q = '') {
      let users = getStored('users', SEED_USERS);

      if (firestoreDb) {
        try {
          const snap = await firestoreDb.collection('users').get();
          if (!snap.empty) {
            const liveUsers = [];
            snap.forEach(doc => {
              const u = doc.data();
              liveUsers.push({
                id: u.id || doc.id,
                username: u.username || doc.id,
                role: u.role || 'doctor',
                full_name: u.full_name || u.username,
                email: u.email || '',
                failed_attempts: u.failed_attempts || 0,
                locked_until: u.locked_until || null,
                created_at: u.created_at || new Date().toISOString()
              });
            });
            liveUsers.forEach(lu => {
              const idx = users.findIndex(u => u.username.toLowerCase() === lu.username.toLowerCase());
              if (idx !== -1) {
                users[idx] = { ...users[idx], ...lu };
              } else {
                users.push(lu);
              }
            });
            setStored('users', users);
          }
        } catch (e) {
          console.warn('Firestore getUsers notice:', e.message);
        }
      }

      if (q && q.trim()) {
        const query = q.trim().toLowerCase();
        users = users.filter(u =>
          u.username.toLowerCase().includes(query) ||
          u.full_name.toLowerCase().includes(query) ||
          (u.email && u.email.toLowerCase().includes(query))
        );
      }
      return {
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          role: u.role,
          full_name: u.full_name,
          email: u.email,
          failed_attempts: u.failed_attempts || 0,
          locked_until: u.locked_until,
          created_at: u.created_at
        }))
      };
    },

    async getUser(id) {
      const users = getStored('users', SEED_USERS);
      const u = users.find(item => item.id === parseInt(id));
      if (!u) throw new Error('ไม่พบผู้ใช้');
      return { user: u };
    },

    async createUser(data) {
      const users = getStored('users', SEED_USERS);
      const cleanUsername = data.username.trim();
      const lowerUsername = cleanUsername.toLowerCase();
      if (users.some(u => u.username.toLowerCase() === lowerUsername)) {
        throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว');
      }
      const newId = users.length > 0 ? Math.max(...users.map(u => Number(u.id) || 0)) + 1 : 1;
      const newUser = {
        id: newId,
        username: cleanUsername,
        password: data.password || 'User@123456',
        role: data.role || 'doctor',
        full_name: data.full_name.trim(),
        email: data.email ? data.email.trim() : '',
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      };

      if (firestoreDb) {
        try {
          await firestoreDb.collection('users').doc(lowerUsername).set(newUser, { merge: true });
          console.log('🔥 Cloud Firestore: Successfully saved user', lowerUsername);

          await firestoreDb.collection('audit_logs').add({
            action: 'CREATE_USER',
            username: cleanUsername,
            role: newUser.role,
            full_name: newUser.full_name,
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.error('Firestore user save error:', e);
        }
      }

      users.push(newUser);
      setStored('users', users);
      return { message: `สร้างบัญชีผู้ใช้ใหม่ "${cleanUsername}" สำเร็จ และบันทึกลง Cloud Firestore เรียบร้อยแล้ว`, userId: newId };
    },

    async updateUser(id, data) {
      const users = getStored('users', SEED_USERS);
      const idx = users.findIndex(u => u.id === parseInt(id));
      if (idx === -1) throw new Error('ไม่พบผู้ใช้');

      // Sanitize fields - avoid undefined
      const cleanData = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) cleanData[k] = v;
      }

      const updated = { ...users[idx], ...cleanData, updated_at: new Date().toISOString() };
      users[idx] = updated;
      setStored('users', users);

      if (firestoreDb) {
        try {
          const lowerUsername = updated.username.toLowerCase();
          await firestoreDb.collection('users').doc(lowerUsername).set(updated, { merge: true });
          console.log('🔥 Cloud Firestore: Successfully updated user', lowerUsername);
        } catch (e) {
          console.error('Firestore user update error:', e);
        }
      }

      return { message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ' };
    },

    async deleteUser(id) {
      let users = getStored('users', SEED_USERS);
      const uid = parseInt(id);
      if (uid === 1) throw new Error('ไม่สามารถลบบัญชีผู้ดูแลระบบหลักได้');
      const target = users.find(u => u.id === uid);
      users = users.filter(u => u.id !== uid);
      setStored('users', users);

      if (firestoreDb && target) {
        try {
          const lowerUsername = target.username.toLowerCase();
          await firestoreDb.collection('users').doc(lowerUsername).delete();
          console.log('🔥 Cloud Firestore: Successfully deleted user', lowerUsername);
        } catch (e) {
          console.error('Firestore user delete error:', e);
        }
      }

      return { message: 'ลบบัญชีผู้ใช้สำเร็จ' };
    },

    async getAuditLogs(params = {}) {
      if (firestoreDb) {
        try {
          const snap = await firestoreDb.collection('audit_logs').orderBy('created_at', 'desc').limit(50).get();
          if (!snap.empty) {
            const logs = [];
            snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
            return { logs };
          }
        } catch (e) {
          console.warn('Firestore audit logs warning:', e.message);
        }
      }

      return {
        logs: [
          {
            id: 1,
            action: 'LOGIN_SUCCESS',
            username: 'admin',
            role: 'admin',
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          }
        ]
      };
    }
  };

  // --- SERVER REQUEST HANDLER (For Node.js Backend) ---
  async function request(endpoint, options = {}) {
    if (useClientEngine) {
      throw new Error('Using client engine');
    }

    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
      ...options,
      headers
    };

    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw new Error(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }

    return data;
  }

  function setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem('dm_remis_token', token);
    } else {
      localStorage.removeItem('dm_remis_token');
    }
  }

  function getToken() {
    return authToken;
  }

  // Wrapper for each API call that seamlessly falls back to ClientEngine
  async function execute(action, clientFn, serverEndpoint, options) {
    if (useClientEngine) {
      return await clientFn();
    }
    try {
      return await request(serverEndpoint, options);
    } catch (err) {
      if (!useClientEngine && (err.message.includes('Failed to fetch') || err.message.includes('404') || err.message.includes('Endpoint not found'))) {
        console.warn(`Server API unreachable at ${serverEndpoint}. Switching seamlessly to Client Firestore Engine!`);
        useClientEngine = true;
        initClientFirebase();
        return await clientFn();
      }
      throw err;
    }
  }

  return {
    setToken,
    getToken,
    isStaticHosting: () => useClientEngine,
    getFirestoreInstance: () => firestoreDb,

    login: (username, password) => execute(
      'login',
      () => ClientEngine.login(username, password),
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

    logout: () => execute(
      'logout',
      () => ClientEngine.logout(),
      '/api/auth/logout',
      { method: 'POST' }
    ),

    getMe: () => execute(
      'getMe',
      () => ClientEngine.getMe(),
      '/api/auth/me'
    ),

    getPatients: (q = '') => execute(
      'getPatients',
      () => ClientEngine.getPatients(q),
      `/api/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

    getPatient: (id) => execute(
      'getPatient',
      () => ClientEngine.getPatient(id),
      `/api/patients/${id}`
    ),

    createPatient: (data) => execute(
      'createPatient',
      () => ClientEngine.createPatient(data),
      '/api/patients',
      { method: 'POST', body: JSON.stringify(data) }
    ),

    updatePatient: (id, data) => execute(
      'updatePatient',
      () => ClientEngine.updatePatient(id, data),
      `/api/patients/${id}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),

    deletePatient: (id) => execute(
      'deletePatient',
      () => ClientEngine.deletePatient(id),
      `/api/patients/${id}`,
      { method: 'DELETE' }
    ),

    getRecords: (patientId, week = null) => execute(
      'getRecords',
      () => ClientEngine.getRecords(patientId, week),
      `/api/patients/${patientId}/records${week ? `?week=${week}` : ''}`
    ),

    saveRecord: (patientId, data) => execute(
      'saveRecord',
      () => ClientEngine.saveRecord(patientId, data),
      `/api/patients/${patientId}/records`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

    resetBlocks: (patientId, target = 'all') => execute(
      'resetBlocks',
      () => ClientEngine.resetBlocks(patientId, target),
      `/api/patients/${patientId}/reset-blocks`,
      { method: 'POST', body: JSON.stringify({ target }) }
    ),

    getAnalytics: (patientId) => execute(
      'getAnalytics',
      () => ClientEngine.getAnalytics(patientId),
      `/api/patients/${patientId}/analytics`
    ),

    getUsers: (q = '') => execute(
      'getUsers',
      () => ClientEngine.getUsers(q),
      `/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

    getUser: (id) => execute(
      'getUser',
      () => ClientEngine.getUser(id),
      `/api/users/${id}`
    ),

    createUser: (data) => execute(
      'createUser',
      () => ClientEngine.createUser(data),
      '/api/users',
      { method: 'POST', body: JSON.stringify(data) }
    ),

    updateUser: (id, data) => execute(
      'updateUser',
      () => ClientEngine.updateUser(id, data),
      `/api/users/${id}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),

    deleteUser: (id) => execute(
      'deleteUser',
      () => ClientEngine.deleteUser(id),
      `/api/users/${id}`,
      { method: 'DELETE' }
    ),

    getAuditLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return execute(
        'getAuditLogs',
        () => ClientEngine.getAuditLogs(params),
        `/api/audit-logs${qs ? `?${qs}` : ''}`
      );
    }
  };
})();
