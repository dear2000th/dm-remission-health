// DM Remission Application Controller
const App = (function () {
  let currentUser = null;
  let currentPatient = null;
  let currentAnalytics = null;
  let patientsList = [];
  let usersList = [];
  let userToDelete = null;
  let searchDebounceTimer = null;

  // Helper selectors
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  function init() {
    setupEventListeners();

    // Check if token already exists
    if (API.getToken()) {
      API.getMe()
        .then(me => {
          currentUser = me.user;
          showDashboard();
        })
        .catch(err => {
          console.warn('Existing token invalid, showing login:', err);
          showLogin();
        });
    } else {
      showLogin();
    }
  }

  function setupEventListeners() {
    window.addEventListener('auth:expired', () => {
      alert('Session ของท่านหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
      showLogin();
    });

    // 1. Login Form Submit & Password Toggle
    const togglePwBtn = $('btn-toggle-password');
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const pwInput = $('password');
        const isPassword = pwInput.type === 'password';
        pwInput.type = isPassword ? 'text' : 'password';
        togglePwBtn.textContent = isPassword ? '🙈' : '👁️';
      });
    }

    const loginForm = $('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = $('login-error');
        const submitBtn = $('btn-submit-login');
        errEl.style.display = 'none';

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>กำลังตรวจสอบข้อมูลสิทธิ์...</span>';
        }

        try {
          const res = await API.login($('username').value.trim(), $('password').value);
          API.setToken(res.token);
          currentUser = res.user;
          showDashboard();
        } catch (err) {
          errEl.innerText = err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
          errEl.style.display = 'block';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>เข้าสู่ระบบอย่างปลอดภัย</span> &rarr;';
          }
        }
      });
    }

    // 2. Logout Button
    const logoutBtn = $('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await API.logout(); } catch (e) {}
        API.setToken(null);
        currentUser = null;
        currentPatient = null;
        showLogin();
      });
    }

    // 3. Quick Demo Login buttons
    $$('[data-quick-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        $('username').value = btn.getAttribute('data-quick-user');
        $('password').value = btn.getAttribute('data-quick-pass');
        $('login-form').dispatchEvent(new Event('submit'));
      });
    });

    // 4. Tabs navigation
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const content = $(`tab-${target}`);
        if (content) content.classList.add('active');

        if (target === 'charts') {
          setTimeout(renderCharts, 50);
        } else if (target === 'users') {
          loadUsersList();
        } else if (target === 'audit') {
          loadAuditLogs();
        }
      });
    });

    // 5. Patient selector change
    const patientSelect = $('patient-select');
    if (patientSelect) {
      patientSelect.addEventListener('change', (e) => {
        const patientId = parseInt(e.target.value);
        if (patientId) {
          loadPatientData(patientId);
        }
      });
    }

    // 6. Universal Patient Search (Citizen ID / HN / Full Name)
    const searchInput = $('patient-search-input');
    const searchDropdown = $('search-results-dropdown');

    if (searchInput && searchDropdown) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        const q = e.target.value.trim();

        if (q.length === 0) {
          searchDropdown.style.display = 'none';
          searchDropdown.innerHTML = '';
          return;
        }

        searchDebounceTimer = setTimeout(async () => {
          try {
            const data = await API.getPatients(q);
            const results = data.patients || [];

            if (results.length === 0) {
              searchDropdown.innerHTML = `
                <div class="search-no-result">
                  🔍 ไม่พบผู้ป่วยที่ตรงกับ "${q}"<br>
                  <small style="color: var(--slate-400);">ค้นหาได้ด้วย: เลขบัตร ปชช. 13 หลัก, HN หรือ ชื่อ-สกุล</small>
                </div>
              `;
            } else {
              searchDropdown.innerHTML = results.map(p => {
                const cidText = p.citizen_id ? `ปชช: ${p.citizen_id}` : 'ไม่มีเลข ปชช.';
                return `
                  <div class="search-result-item" data-select-patient="${p.id}">
                    <div class="search-item-top">
                      <span class="search-item-name">${p.full_name}</span>
                      <span class="hn-pill" style="font-size: 0.7rem; padding: 0.1rem 0.4rem;">${p.hn}</span>
                    </div>
                    <div class="search-item-meta">
                      <span>🪪 ${cidText}</span>
                      <span>อายุ: ${p.age || '-'} ปี</span>
                      <span>สถานะ: ${p.status}</span>
                    </div>
                  </div>
                `;
              }).join('');

              // Bind item click
              searchDropdown.querySelectorAll('[data-select-patient]').forEach(item => {
                item.addEventListener('click', () => {
                  const pid = parseInt(item.getAttribute('data-select-patient'));
                  if (pid) {
                    if (patientSelect) patientSelect.value = pid;
                    loadPatientData(pid);
                    searchDropdown.style.display = 'none';
                    searchInput.value = '';
                  }
                });
              });
            }

            searchDropdown.style.display = 'block';
          } catch (err) {
            console.error('Search error:', err);
          }
        }, 250);
      });

      // Close search dropdown on click outside
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
          searchDropdown.style.display = 'none';
        }
      });
    }

    // Citizen ID Auto-formatter for Thai 13-digit ID: X-XXXX-XXXXX-XX-X
    const citizenInput = $('new-citizen-id');
    if (citizenInput) {
      citizenInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 13);
        if (v.length > 12) {
          v = `${v[0]}-${v.slice(1, 5)}-${v.slice(5, 10)}-${v.slice(10, 12)}-${v[12]}`;
        } else if (v.length > 10) {
          v = `${v[0]}-${v.slice(1, 5)}-${v.slice(5, 10)}-${v.slice(10)}`;
        } else if (v.length > 5) {
          v = `${v[0]}-${v.slice(1, 5)}-${v.slice(5)}`;
        } else if (v.length > 1) {
          v = `${v[0]}-${v.slice(1)}`;
        }
        e.target.value = v;
      });
    }

    // 7. Top Actions Buttons
    const btnNewPatient = $('btn-new-patient');
    if (btnNewPatient) {
      btnNewPatient.addEventListener('click', () => {
        openModal($('patient-modal'));
      });
    }

    const btnOpenEntry = $('btn-open-entry');
    if (btnOpenEntry) {
      btnOpenEntry.addEventListener('click', () => {
        openEntryModal(1, 1);
      });
    }

    const btnOpenEntry2 = $('btn-open-entry-2');
    if (btnOpenEntry2) {
      btnOpenEntry2.addEventListener('click', () => {
        openEntryModal(1, 1);
      });
    }

    const btnOpenReset = $('btn-open-reset');
    if (btnOpenReset) {
      btnOpenReset.addEventListener('click', () => {
        openModal($('reset-modal'));
      });
    }

    // Edit Patient Listeners
    const btnOpenEditPatient = $('btn-open-edit-patient');
    if (btnOpenEditPatient) {
      btnOpenEditPatient.addEventListener('click', () => {
        if (!currentPatient) {
          alert('กรุณาเลือกผู้ป่วยก่อน');
          return;
        }
        $('edit-hn').value = currentPatient.hn || '';
        $('edit-citizen-id').value = currentPatient.citizen_id || '';
        $('edit-name').value = currentPatient.full_name || '';
        $('edit-gender').value = currentPatient.gender || 'M';
        $('edit-age').value = currentPatient.age || '';
        $('edit-weight').value = currentPatient.initial_weight_kg || '';
        $('edit-target-weight').value = currentPatient.target_weight_kg || '';
        $('edit-hba1c').value = currentPatient.initial_hba1c || '';
        $('edit-start-date').value = currentPatient.program_start_date || '';
        $('edit-status').value = currentPatient.status || 'active';
        $('edit-notes').value = currentPatient.notes || '';
        openModal($('edit-patient-modal'));
      });
    }

    const editPatientForm = $('edit-patient-form');
    if (editPatientForm) {
      editPatientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPatient) return;
        const submitBtn = editPatientForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = '⏳ กำลังบันทึกขึ้น Cloud Firebase...';
        }

        const payload = {
          hn: $('edit-hn').value,
          citizen_id: $('edit-citizen-id').value || null,
          full_name: $('edit-name').value,
          gender: $('edit-gender').value,
          age: $('edit-age').value,
          initial_weight_kg: $('edit-weight').value,
          target_weight_kg: $('edit-target-weight').value,
          initial_hba1c: $('edit-hba1c').value,
          program_start_date: $('edit-start-date').value,
          status: $('edit-status').value,
          notes: $('edit-notes').value
        };

        try {
          const res = await API.updatePatient(currentPatient.id, payload);
          closeModal($('edit-patient-modal'));
          alert('แก้ไขข้อมูลเวชระเบียนผู้ป่วยขึ้น Cloud Firestore เรียบร้อยแล้ว!');
          await loadPatientsList();
          await loadPatientData(currentPatient.id);
        } catch (err) {
          alert(`เกิดข้อผิดพลาดในการแก้ไข: ${err.message}`);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'บันทึกการแก้ไข';
          }
        }
      });
    }

    // Delete Patient Listeners
    const btnOpenDeletePatient = $('btn-open-delete-patient');
    if (btnOpenDeletePatient) {
      btnOpenDeletePatient.addEventListener('click', () => {
        if (!currentPatient) {
          alert('กรุณาเลือกผู้ป่วยก่อน');
          return;
        }
        $('delete-patient-name').innerText = currentPatient.full_name;
        $('delete-patient-hn').innerText = currentPatient.hn;
        $('delete-patient-cid').innerText = currentPatient.citizen_id || 'ไม่ระบุ';
        openModal($('delete-patient-modal'));
      });
    }

    const btnConfirmDeletePatient = $('btn-confirm-delete-patient');
    if (btnConfirmDeletePatient) {
      btnConfirmDeletePatient.addEventListener('click', async () => {
        if (!currentPatient) return;
        try {
          btnConfirmDeletePatient.disabled = true;
          const res = await API.deletePatient(currentPatient.id);
          closeModal($('delete-patient-modal'));
          alert(res.message || 'ลบข้อมูลผู้ป่วยเรียบร้อยแล้ว');
          await loadPatientsList();
          if (patientsList.length > 0) {
            await loadPatientData(patientsList[0].id);
          } else {
            currentPatient = null;
            $('patient-name').innerText = 'ไม่พบข้อมูลผู้ป่วย';
            $('patient-hn').innerText = '-';
            $('patient-meta').innerHTML = '';
          }
        } catch (err) {
          alert(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
        } finally {
          btnConfirmDeletePatient.disabled = false;
        }
      });
    }

    const btnPrintReport = $('btn-print-report');
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => {
        window.print();
      });
    }

    // 8. Admin User Management Event Listeners
    const btnOpenNewUser = $('btn-open-new-user');
    if (btnOpenNewUser) {
      btnOpenNewUser.addEventListener('click', () => {
        openUserModal(null);
      });
    }

    const userRoleSelect = $('user-role');
    if (userRoleSelect) {
      userRoleSelect.addEventListener('change', (e) => {
        const isPatient = e.target.value === 'patient';
        $('patient-link-group').style.display = isPatient ? 'block' : 'none';
        if (isPatient) populatePatientLinkDropdown();
      });
    }

    const userForm = $('user-form');
    if (userForm) {
      userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = $('edit-user-id').value;

        const payload = {
          username: $('user-username').value.trim(),
          full_name: $('user-fullname').value.trim(),
          email: $('user-email').value.trim() || null,
          role: $('user-role').value,
          password: $('user-password').value || undefined,
          unlock_account: $('user-unlock-check').checked,
          patient_id: $('user-role').value === 'patient' ? $('user-patient-link').value || null : null
        };

        try {
          if (!userId) {
            // Create user
            if (!payload.password) {
              alert('กรุณาระบุรหัสผ่านสำหรับผู้ใช้งานใหม่');
              return;
            }
            const res = await API.createUser(payload);
            alert(res.message || 'สร้างผู้ใช้งานใหม่สำเร็จ!');
          } else {
            // Update user
            const res = await API.updateUser(userId, payload);
            alert(res.message || 'ปรับปรุงข้อมูลผู้ใช้งานสำเร็จ!');
          }
          closeModal($('user-modal'));
          await loadUsersList();
        } catch (err) {
          alert(`เกิดข้อผิดพลาด: ${err.message}`);
        }
      });
    }

    const btnConfirmDeleteUser = $('btn-confirm-delete-user');
    if (btnConfirmDeleteUser) {
      btnConfirmDeleteUser.addEventListener('click', async () => {
        if (!userToDelete) return;
        try {
          const res = await API.deleteUser(userToDelete.id);
          closeModal($('delete-user-modal'));
          alert(res.message || 'ลบผู้ใช้งานเรียบร้อยแล้ว');
          userToDelete = null;
          await loadUsersList();
        } catch (err) {
          alert(`เกิดข้อผิดพลาด: ${err.message}`);
        }
      });
    }

    // 9. Modal Close Buttons (delegated)
    $$('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        const modal = $(modalId);
        if (modal) closeModal(modal);
      });
    });

    // Close when clicking modal backdrop
    $$('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    });

    // 10. Daily Entry Form Submit
    const entryForm = $('entry-form');
    if (entryForm) {
      entryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPatient) {
          alert('กรุณาเลือกผู้ป่วยก่อนบันทึก');
          return;
        }

        const payload = {
          week_number: parseInt($('entry-week').value),
          day_of_week: parseInt($('entry-day').value),
          record_date: $('entry-date').value || null,
          bp_systolic: $('entry-sys').value || null,
          bp_diastolic: $('entry-dia').value || null,
          glucose_first_meal_pre: $('entry-g1-pre').value || null,
          glucose_first_meal_post: $('entry-g1-post').value || null,
          glucose_last_meal_pre: $('entry-g2-pre').value || null,
          glucose_last_meal_post: $('entry-g2-post').value || null,
          step_count: $('entry-steps').value || null,
          notes: $('entry-notes').value || null
        };

        const submitBtn = entryForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = '⏳ กำลังบันทึกขึ้น Cloud Firebase...';
        }

        try {
          const res = await API.saveRecord(currentPatient.id, payload);
          closeModal($('entry-modal'));
          alert(res.message || 'บันทึกข้อมูลสุขภาพขึ้น Cloud Firestore เรียบร้อยแล้ว!');
          await loadPatientData(currentPatient.id);
        } catch (err) {
          alert(`เกิดข้อผิดพลาด: ${err.message}`);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '💾 บันทึกข้อมูล';
          }
        }
      });
    }

    // 11. Add Patient Form Submit (with Citizen ID)
    const patientForm = $('patient-form');
    if (patientForm) {
      patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = patientForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = '⏳ กำลังส่งข้อมูลขึ้น Cloud Firebase...';
        }

        const payload = {
          hn: $('new-hn').value,
          citizen_id: $('new-citizen-id').value || null,
          full_name: $('new-name').value,
          gender: $('new-gender').value,
          age: $('new-age').value,
          initial_weight_kg: $('new-weight').value,
          target_weight_kg: $('new-target-weight').value,
          initial_hba1c: $('new-hba1c').value,
          program_start_date: $('new-start-date').value,
          notes: $('new-notes').value
        };

        try {
          const res = await API.createPatient(payload);
          closeModal($('patient-modal'));
          patientForm.reset();
          alert('ลงทะเบียนผู้ป่วยใหม่ขึ้น Cloud Firestore สำเร็จ!');
          await loadPatientsList();
          loadPatientData(res.patientId);
        } catch (err) {
          alert(`เกิดข้อผิดพลาด: ${err.message}`);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'ลงทะเบียนผู้ป่วย';
          }
        }
      });
    }

    // 12. Reset Blocks Confirm Button
    const btnConfirmReset = $('btn-confirm-reset');
    if (btnConfirmReset) {
      btnConfirmReset.addEventListener('click', async () => {
        if (!currentPatient) return;
        const target = $('reset-target').value;
        try {
          const res = await API.resetBlocks(currentPatient.id, target);
          closeModal($('reset-modal'));
          alert(res.message);
          await loadPatientData(currentPatient.id);
        } catch (err) {
          alert(`เกิดข้อผิดพลาด: ${err.message}`);
        }
      });
    }
  }

  function showLogin() {
    $('login-view').style.display = 'flex';
    $('app-view').style.display = 'none';
    if ($('nav-user-area')) $('nav-user-area').style.display = 'none';
    $('username').value = '';
    $('password').value = '';
    $('login-error').style.display = 'none';
  }

  async function showDashboard() {
    $('login-view').style.display = 'none';
    $('app-view').style.display = 'block';
    if ($('nav-user-area')) $('nav-user-area').style.display = 'flex';

    // Set user info
    $('user-name-display').innerText = currentUser.full_name;
    $('user-role-tag').innerText = currentUser.role;
    $('user-role-tag').className = `role-tag ${currentUser.role}`;

    // Role-based visibility
    const canManagePatients = currentUser.role === 'admin' || currentUser.role === 'doctor';
    if ($('btn-new-patient')) $('btn-new-patient').style.display = canManagePatients ? 'inline-flex' : 'none';
    if ($('btn-open-edit-patient')) $('btn-open-edit-patient').style.display = canManagePatients ? 'inline-flex' : 'none';
    if ($('btn-open-delete-patient')) $('btn-open-delete-patient').style.display = canManagePatients ? 'inline-flex' : 'none';
    if ($('btn-open-reset')) $('btn-open-reset').style.display = canManagePatients ? 'inline-flex' : 'none';

    if (currentUser.role === 'admin') {
      $('tab-users-btn').style.display = 'inline-flex';
      $('tab-audit-btn').style.display = 'inline-flex';
      $('patient-select').style.display = 'inline-block';
      $('search-box-wrap').style.display = 'block';
    } else if (currentUser.role === 'doctor' || currentUser.role === 'nurse') {
      $('tab-users-btn').style.display = 'none';
      $('tab-audit-btn').style.display = 'inline-flex';
      $('patient-select').style.display = 'inline-block';
      $('search-box-wrap').style.display = 'block';
    } else {
      // Patient
      $('tab-users-btn').style.display = 'none';
      $('tab-audit-btn').style.display = 'none';
      $('patient-select').style.display = 'none';
      $('search-box-wrap').style.display = 'none';
    }

    await loadPatientsList();
  }

  // --- Admin User Management Methods ---
  async function loadUsersList() {
    try {
      const res = await API.getUsers();
      usersList = res.users || [];
      const tbody = $('users-table-body');
      tbody.innerHTML = '';

      usersList.forEach(u => {
        const isSelf = u.id === currentUser.id;
        const isLocked = u.locked_until && new Date(u.locked_until) > new Date();

        let statusBadge = '<span class="badge badge-success">● ปกติ</span>';
        if (isLocked) {
          statusBadge = '<span class="badge badge-danger">🔒 ถูกระงับชั่วคราว</span>';
        } else if (u.failed_attempts > 0) {
          statusBadge = `<span class="badge badge-warning">⚠️ ผิด ${u.failed_attempts} ครั้ง</span>`;
        }

        const roleLabels = {
          admin: '⚙️ Admin',
          doctor: '👨‍⚕️ Doctor',
          nurse: '👩‍⚕️ Nurse',
          patient: '🧑‍🦱 Patient'
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${u.id}</strong></td>
          <td><strong>${u.username}</strong></td>
          <td>${u.full_name} ${u.patient_hn ? `<small class="hn-pill" style="font-size:0.7rem;">${u.patient_hn}</small>` : ''}</td>
          <td><span class="role-tag ${u.role}">${roleLabels[u.role] || u.role}</span></td>
          <td><small>${u.email || '-'}</small></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.35rem; justify-content: center;">
              <button class="btn btn-outline btn-sm btn-edit-user" data-user-id="${u.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">
                ✏️ แก้ไข
              </button>
              ${isSelf ? '' : `
                <button class="btn btn-outline btn-sm btn-delete-user" data-user-id="${u.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; color: var(--danger); border-color: var(--slate-300);">
                  🗑️ ลบ
                </button>
              `}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind Edit User buttons
      tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = parseInt(btn.getAttribute('data-user-id'));
          const userObj = usersList.find(x => x.id === uid);
          if (userObj) openUserModal(userObj);
        });
      });

      // Bind Delete User buttons
      tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = parseInt(btn.getAttribute('data-user-id'));
          const userObj = usersList.find(x => x.id === uid);
          if (userObj) openDeleteUserModal(userObj);
        });
      });

    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  function openUserModal(user = null) {
    if (!user) {
      // Add mode
      $('user-modal-title').innerText = '👥 เพิ่มผู้ใช้งานใหม่';
      $('edit-user-id').value = '';
      $('user-username').disabled = false;
      $('user-username').value = '';
      $('user-fullname').value = '';
      $('user-email').value = '';
      $('user-role').value = 'doctor';
      $('user-password').value = '';
      $('user-password').required = true;
      $('pw-required-note').style.display = 'inline';
      $('pw-hint').style.display = 'none';
      $('patient-link-group').style.display = 'none';
      $('user-unlock-group').style.display = 'none';
      $('user-unlock-check').checked = false;
    } else {
      // Edit mode
      $('user-modal-title').innerText = `✏️ แก้ไขผู้ใช้งาน: ${user.username}`;
      $('edit-user-id').value = user.id;
      $('user-username').disabled = true;
      $('user-username').value = user.username;
      $('user-fullname').value = user.full_name;
      $('user-email').value = user.email || '';
      $('user-role').value = user.role;
      $('user-password').value = '';
      $('user-password').required = false;
      $('pw-required-note').style.display = 'none';
      $('pw-hint').style.display = 'block';

      const isPatient = user.role === 'patient';
      $('patient-link-group').style.display = isPatient ? 'block' : 'none';
      if (isPatient) {
        populatePatientLinkDropdown(user.patient_id);
      }

      const isLocked = (user.locked_until && new Date(user.locked_until) > new Date()) || user.failed_attempts > 0;
      $('user-unlock-group').style.display = isLocked ? 'block' : 'none';
      $('user-unlock-check').checked = isLocked;
    }

    openModal($('user-modal'));
  }

  function openDeleteUserModal(user) {
    userToDelete = user;
    $('delete-user-name').innerText = user.full_name;
    $('delete-user-username').innerText = user.username;
    $('delete-user-role').innerText = user.role;
    openModal($('delete-user-modal'));
  }

  function populatePatientLinkDropdown(selectedId = null) {
    const sel = $('user-patient-link');
    sel.innerHTML = '<option value="">-- ไม่เชื่อมโยง --</option>';
    patientsList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.hn} - ${p.full_name}`;
      if (selectedId && p.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // --- Patients & Analytics Methods ---
  async function loadPatientsList() {
    try {
      const data = await API.getPatients();
      patientsList = data.patients || [];

      const select = $('patient-select');
      select.innerHTML = '';
      patientsList.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.hn} - ${p.full_name}`;
        select.appendChild(opt);
      });

      if (patientsList.length > 0) {
        const selectedId = (currentUser.patient && currentUser.patient.id) || patientsList[0].id;
        select.value = selectedId;
        await loadPatientData(selectedId);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    }
  }

  async function loadPatientData(patientId) {
    try {
      const analytics = await API.getAnalytics(patientId);
      currentPatient = analytics.patient;
      currentAnalytics = analytics;

      renderPatientBar();
      renderKPICards();
      renderCharts();
      renderDailyBlocks();
      renderSummaryMatrix();
    } catch (err) {
      console.error('Failed to load patient analytics:', err);
      alert(`ไม่สามารถดึงข้อมูลผู้ป่วยได้: ${err.message}`);
    }
  }

  function renderPatientBar() {
    $('patient-name').innerText = currentPatient.full_name;
    $('patient-hn').innerText = currentPatient.hn;
    const cidFormatted = currentPatient.citizen_id || 'ไม่ระบุ';

    $('patient-meta').innerHTML = `
      <span>🪪 เลขบัตร ปชช.: <strong>${cidFormatted}</strong></span>
      <span>อายุ: <strong>${currentPatient.age || '-'} ปี</strong></span>
      <span>น้ำหนักเริ่มต้น: <strong>${currentPatient.initial_weight_kg || '-'} กก.</strong></span>
      <span>เป้าหมาย: <strong>${currentPatient.target_weight_kg || '-'} กก.</strong></span>
      <span>HbA1c เริ่มต้น: <strong>${currentPatient.initial_hba1c ? currentPatient.initial_hba1c + '%' : '-'}</strong></span>
      <span>เริ่มโปรแกรม: <strong>${currentPatient.program_start_date || '-'}</strong></span>
    `;
  }

  function renderKPICards() {
    const { grandAverages, remission } = currentAnalytics;

    // Remission KPI
    $('kpi-score').innerText = `${remission.scorePercent}%`;
    $('kpi-score-text').innerText = remission.statusText;
    $('kpi-score-text').className = `kpi-desc ${remission.badgeClass}`;

    // BP KPI
    if (grandAverages.bp_systolic && grandAverages.bp_diastolic) {
      $('kpi-bp').innerText = `${grandAverages.bp_systolic} / ${grandAverages.bp_diastolic}`;
      $('kpi-bp-text').innerText = grandAverages.bp_systolic <= 120 && grandAverages.bp_diastolic <= 80
        ? '✅ เกณฑ์ปกติที่ดีเยี่ยม (<120/80)'
        : (grandAverages.bp_systolic <= 130 ? '⚠️ ระดับเฝ้าระวัง' : '❗ สูงกว่าเกณฑ์มาตรฐาน');
    } else {
      $('kpi-bp').innerText = '- / -';
      $('kpi-bp-text').innerText = 'รอข้อมูลบันทึก';
    }

    // Glucose KPI
    const fbs = grandAverages.glucose_first_meal_pre;
    const postBs = grandAverages.glucose_first_meal_post;
    if (fbs) {
      $('kpi-glucose').innerText = `${fbs} mg/dL`;
      $('kpi-glucose-text').innerText = `ก่อนอาหาร (หลังอาหาร: ${postBs || '-'} mg/dL)`;
    } else {
      $('kpi-glucose').innerText = '- mg/dL';
      $('kpi-glucose-text').innerText = 'รอข้อมูลบันทึก';
    }

    // Steps KPI
    const steps = grandAverages.step_count;
    if (steps) {
      $('kpi-steps').innerText = `${steps.toLocaleString()}`;
      $('kpi-steps-text').innerText = steps >= 8000 ? '🎉 บรรลุเป้าหมายการเดิน (>8,000)' : '🏃 เป้าหมาย 8,000-10,000 ก้าว/วัน';
    } else {
      $('kpi-steps').innerText = '- ก้าว';
      $('kpi-steps-text').innerText = 'รอข้อมูลบันทึก';
    }
  }

  function renderCharts() {
    if (!currentAnalytics || !currentAnalytics.charts) return;
    const { charts } = currentAnalytics;
    if (window.AppCharts) {
      window.AppCharts.renderBPChart('chart-bp', charts.labels, charts.bp.systolic, charts.bp.diastolic);
      window.AppCharts.renderGlucoseChart(
        'chart-glucose',
        charts.labels,
        charts.glucose.firstPre,
        charts.glucose.firstPost,
        charts.glucose.lastPre,
        charts.glucose.lastPost
      );
      window.AppCharts.renderStepsChart('chart-steps', charts.labels, charts.steps);
    }
  }

  // Renders the 20-week daily block structure (Compact, Professional, Zero Overflow)
  function renderDailyBlocks() {
    const container = $('blocks-container');
    container.innerHTML = '';
    const { weeklyMatrix } = currentAnalytics;

    weeklyMatrix.forEach(wm => {
      const card = document.createElement('div');
      card.className = 'week-accordion';

      const isOpen = wm.week_number === 1 || wm.days_logged > 0;

      card.innerHTML = `
        <div class="week-header ${isOpen ? 'open' : ''}" data-toggle-week="${wm.week_number}">
          <div class="week-title">
            <span>สัปดาห์ที่ ${wm.week_number}</span>
            <span class="badge ${wm.days_logged > 0 ? 'badge-primary' : 'badge-neutral'}">
              บันทึก ${wm.days_logged}/7 วัน
            </span>
          </div>
          <div>
            <button class="btn btn-outline btn-sm btn-action-entry" data-week="${wm.week_number}" data-day="1">
              ➕ บันทึกสัปดาห์นี้
            </button>
          </div>
        </div>
        <div class="week-body" style="display: ${isOpen ? 'block' : 'none'};">
          <div class="table-wrap">
            <table class="clean-table">
              <thead>
                <tr>
                  <th style="width: 14%;">วันที่</th>
                  <th style="width: 20%;">ความดัน (บน/ล่าง)</th>
                  <th style="width: 24%;">น้ำตาล มื้อแรก (ก่อน/หลัง)</th>
                  <th style="width: 24%;">น้ำตาล มื้อสุดท้าย (ก่อน/หลัง)</th>
                  <th style="width: 18%;">ก้าวเดิน</th>
                  <th style="width: 12%;">แก้ไข</th>
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const d = wm.days[day] || {};
                  const bpStr = (d.bp_systolic && d.bp_diastolic) ? `${d.bp_systolic} / ${d.bp_diastolic}` : '-';
                  const g1Str = (d.glucose_first_meal_pre || d.glucose_first_meal_post) ? `${d.glucose_first_meal_pre || '-'} / ${d.glucose_first_meal_post || '-'}` : '-';
                  const g2Str = (d.glucose_last_meal_pre || d.glucose_last_meal_post) ? `${d.glucose_last_meal_pre || '-'} / ${d.glucose_last_meal_post || '-'}` : '-';
                  const stepsStr = d.step_count ? d.step_count.toLocaleString() : '-';

                  return `
                    <tr>
                      <td><strong>วันที่ ${day}</strong></td>
                      <td>${bpStr}</td>
                      <td>${g1Str}</td>
                      <td>${g2Str}</td>
                      <td>${stepsStr}</td>
                      <td>
                        <button class="btn btn-outline btn-sm btn-action-entry" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" data-week="${wm.week_number}" data-day="${day}">
                          ✏️ แก้ไข
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
                <tr class="avg-row">
                  <td><strong>เฉลี่ย สัปดาห์ ${wm.week_number}</strong></td>
                  <td><strong>${wm.averages.bp_systolic || '-' } / ${wm.averages.bp_diastolic || '-'}</strong></td>
                  <td><strong>${wm.averages.glucose_first_meal_pre || '-'} / ${wm.averages.glucose_first_meal_post || '-'}</strong></td>
                  <td><strong>${wm.averages.glucose_last_meal_pre || '-'} / ${wm.averages.glucose_last_meal_post || '-'}</strong></td>
                  <td><strong>${wm.averages.step_count ? wm.averages.step_count.toLocaleString() : '-'}</strong></td>
                  <td><span class="badge badge-success">เฉลี่ย</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    // Accordion toggle click handlers
    container.querySelectorAll('[data-toggle-week]').forEach(hdr => {
      hdr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-action-entry')) return;
        const body = hdr.nextElementSibling;
        const isCurrentlyOpen = body.style.display === 'block';
        body.style.display = isCurrentlyOpen ? 'none' : 'block';
        hdr.classList.toggle('open', !isCurrentlyOpen);
      });
    });

    // Action entry buttons inside table
    container.querySelectorAll('.btn-action-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const w = parseInt(btn.getAttribute('data-week'));
        const d = parseInt(btn.getAttribute('data-day'));
        openEntryModal(w, d);
      });
    });
  }

  // Renders the side-by-side 20-week Summary Table (Mirroring columns J to Q of Excel)
  function renderSummaryMatrix() {
    const tbody = $('summary-matrix-tbody');
    tbody.innerHTML = '';
    const { weeklyMatrix, grandAverages } = currentAnalytics;

    weeklyMatrix.forEach(wm => {
      const avg = wm.averages;
      const bpStr = (avg.bp_systolic && avg.bp_diastolic) ? `${avg.bp_systolic} / ${avg.bp_diastolic}` : '-';
      const g1Str = (avg.glucose_first_meal_pre || avg.glucose_first_meal_post) ? `${avg.glucose_first_meal_pre || '-'} / ${avg.glucose_first_meal_post || '-'}` : '-';
      const g2Str = (avg.glucose_last_meal_pre || avg.glucose_last_meal_post) ? `${avg.glucose_last_meal_pre || '-'} / ${avg.glucose_last_meal_post || '-'}` : '-';
      const stepsStr = avg.step_count ? avg.step_count.toLocaleString() : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>สัปดาห์ที่ ${wm.week_number}</strong></td>
        <td>${bpStr}</td>
        <td>${g1Str}</td>
        <td>${g2Str}</td>
        <td>${stepsStr}</td>
      `;
      tbody.appendChild(tr);
    });

    // Grand Average Row (Row 23)
    const grandBp = (grandAverages.bp_systolic && grandAverages.bp_diastolic)
      ? `${grandAverages.bp_systolic} / ${grandAverages.bp_diastolic}` : '-';
    const grandG1 = (grandAverages.glucose_first_meal_pre || grandAverages.glucose_first_meal_post)
      ? `${grandAverages.glucose_first_meal_pre || '-'} / ${grandAverages.glucose_first_meal_post || '-'}` : '-';
    const grandG2 = (grandAverages.glucose_last_meal_pre || grandAverages.glucose_last_meal_post)
      ? `${grandAverages.glucose_last_meal_pre || '-'} / ${grandAverages.glucose_last_meal_post || '-'}` : '-';
    const grandSteps = grandAverages.step_count ? grandAverages.step_count.toLocaleString() : '-';

    $('grand-avg-row').innerHTML = `
      <td><strong>เฉลี่ยรวม 20 สัปดาห์</strong></td>
      <td><strong>${grandBp}</strong></td>
      <td><strong>${grandG1}</strong></td>
      <td><strong>${grandG2}</strong></td>
      <td><strong>${grandSteps}</strong></td>
    `;
  }

  async function loadAuditLogs() {
    try {
      const res = await API.getAuditLogs({ limit: 50 });
      const tbody = $('audit-table-body');
      tbody.innerHTML = '';
      (res.logs || []).forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${log.id}</td>
          <td><small>${new Date(log.created_at).toLocaleString('th-TH')}</small></td>
          <td><strong>${log.username}</strong></td>
          <td><span class="badge ${log.action.includes('FAIL') ? 'badge-danger' : 'badge-primary'}">${log.action}</span></td>
          <td>${log.patient_hn || '-'}</td>
          <td><small>${log.ip_address}</small></td>
          <td><span class="badge badge-success">OK</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Audit load failed:', err);
    }
  }

  function openEntryModal(week = 1, day = 1) {
    $('entry-week').value = week;
    $('entry-day').value = day;

    // Pre-fill existing data if present
    let rec = {};
    if (currentAnalytics && currentAnalytics.weeklyMatrix) {
      const wm = currentAnalytics.weeklyMatrix[week - 1];
      if (wm && wm.days && wm.days[day]) {
        rec = wm.days[day];
      }
    }

    $('entry-date').value = rec.record_date || new Date().toISOString().split('T')[0];
    $('entry-sys').value = rec.bp_systolic || '';
    $('entry-dia').value = rec.bp_diastolic || '';
    $('entry-g1-pre').value = rec.glucose_first_meal_pre || '';
    $('entry-g1-post').value = rec.glucose_first_meal_post || '';
    $('entry-g2-pre').value = rec.glucose_last_meal_pre || '';
    $('entry-g2-post').value = rec.glucose_last_meal_post || '';
    $('entry-steps').value = rec.step_count || '';
    $('entry-notes').value = rec.notes || '';

    openModal($('entry-modal'));
  }

  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  return {
    init,
    openEntryModal,
    openModal,
    closeModal
  };
})();

// Explicitly attach App to global window object
window.App = App;
window.addEventListener('DOMContentLoaded', App.init);
