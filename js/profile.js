import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-storage.js";

const storage = getStorage();

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toastIcon');
  const msg   = document.getElementById('toastMessage');
  if (!toast) return;
  msg.textContent = message;
  toast.classList.remove('error');
  icon.textContent = type === 'error' ? 'cancel' : 'check_circle';
  if (type === 'error') toast.classList.add('error');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function initThemeToggle() {
  const html  = document.documentElement;
  const icon  = document.getElementById('themeIcon');
  const saved = localStorage.getItem('servify-theme') || 'light';
  html.setAttribute('data-theme', saved);
  if (icon) icon.textContent = saved === 'dark' ? 'light_mode' : 'dark_mode';
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    if (icon) icon.textContent = next === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem('servify-theme', next);
  });
}

function populateProfile(data, user) {
  const name     = data.name     || user.displayName || 'Admin';
  const email    = data.email    || user.email       || '';
  const phone    = data.phone    || '—';
  const location = data.location || '—';
  const username = data.username || '@admin';
  const photoURL = data.photoURL || user.photoURL   || '';

  // Sidebar
  document.getElementById('sidebarName').textContent     = name;
  document.getElementById('sidebarEmail').textContent    = email;
  document.getElementById('sidebarLocation').textContent = location;

  // Avatar
  setAvatar(photoURL, name);

  // Info view
  document.getElementById('viewName').textContent     = name;
  document.getElementById('viewUsername').textContent = username;
  document.getElementById('viewEmail').textContent    = email;
  document.getElementById('viewPhone').textContent    = phone;
  document.getElementById('viewLocation').textContent = location;

  // Pre-fill edit form
  document.getElementById('editName').value     = name;
  document.getElementById('editUsername').value = username;
  document.getElementById('editEmail').value    = email;
  document.getElementById('editPhone').value    = phone;
  document.getElementById('editLocation').value = location;

  // Joined date
  if (data.createdAt) {
    const d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const metaSpans = document.querySelectorAll('.profile-meta-item');
    if (metaSpans[0]) metaSpans[0].querySelector('span:last-child').textContent = `Joined ${label}`;
  }
}

function setAvatar(photoURL, name) {
  const avatarEl     = document.getElementById('profileAvatarDisplay');
  const headerAvatar = document.querySelector('a.admin-avatar');
  const letter       = (name || 'A').charAt(0).toUpperCase();

  if (photoURL) {
    avatarEl.innerHTML = `<img src="${photoURL}" alt="Profile photo" />`;
    if (headerAvatar) headerAvatar.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="" />`;
  } else {
    avatarEl.textContent = letter;
    if (headerAvatar) headerAvatar.textContent = letter;
  }
}

function initAvatarUpload(user) {
  const editBtn   = document.getElementById('avatarEditBtn');
  const fileInput = document.getElementById('avatarFileInput');

  editBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }

    const avatarEl = document.getElementById('profileAvatarDisplay');
    avatarEl.innerHTML = `<span class="material-icons-round" style="font-size:32px;animation:spin 1s linear infinite">sync</span>`;

    try {
      const storageRef  = ref(storage, `profilePhotos/${user.uid}`);
      const uploadTask  = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', null,
        (err) => {
          showToast('Upload failed: ' + err.message, 'error');
          avatarEl.textContent = (user.displayName || 'A').charAt(0).toUpperCase();
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
          setAvatar(url, document.getElementById('sidebarName').textContent);
          showToast('Profile photo updated.');
          fileInput.value = '';
        }
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function initInfoEdit(user) {
  const editBtn   = document.getElementById('editInfoBtn');
  const cancelBtn = document.getElementById('cancelInfoBtn');
  const saveBtn   = document.getElementById('saveInfoBtn');
  const infoView  = document.getElementById('infoView');
  const infoForm  = document.getElementById('infoForm');

  const showForm = () => {
    infoView.classList.add('hidden');
    infoForm.classList.remove('hidden');
    editBtn.innerHTML = '<span class="material-icons-round">close</span> Cancel';
  };
  const showView = () => {
    infoForm.classList.add('hidden');
    infoView.classList.remove('hidden');
    editBtn.innerHTML = '<span class="material-icons-round">edit</span> Edit';
  };

  editBtn.addEventListener('click', () => infoForm.classList.contains('hidden') ? showForm() : showView());
  cancelBtn.addEventListener('click', showView);

  saveBtn.addEventListener('click', async () => {
    const name     = document.getElementById('editName').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const email    = document.getElementById('editEmail').value.trim();
    const phone    = document.getElementById('editPhone').value.trim();
    const location = document.getElementById('editLocation').value.trim();

    if (!name || !email) { showToast('Name and email are required.', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await updateDoc(doc(db, 'users', user.uid), { name, username, email, phone, location });

      document.getElementById('viewName').textContent     = name;
      document.getElementById('viewUsername').textContent = username;
      document.getElementById('viewEmail').textContent    = email;
      document.getElementById('viewPhone').textContent    = phone;
      document.getElementById('viewLocation').textContent = location;
      document.getElementById('sidebarName').textContent  = name;
      document.getElementById('sidebarEmail').textContent = email;
      document.getElementById('sidebarLocation').textContent = location;

      const avatarEl = document.getElementById('profileAvatarDisplay');
      if (!avatarEl.querySelector('img')) avatarEl.textContent = name.charAt(0).toUpperCase();

      showView();
      showToast('Profile updated successfully.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-round">save</span> Save Changes';
    }
  });
}

function checkStrength(pw) {
  const checks = {
    len:     pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    num:     /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw)
  };
  const score = Object.values(checks).filter(Boolean).length;

  Object.entries(checks).forEach(([key, met]) => {
    const el = document.getElementById(`req-${key}`);
    if (!el) return;
    el.classList.toggle('met', met);
    el.querySelector('.material-icons-round').textContent = met ? 'check_circle' : 'radio_button_unchecked';
  });

  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  const levels = [
    { pct: 0,   color: '',             text: ''       },
    { pct: 25,  color: '#ef4444',      text: 'Weak'   },
    { pct: 50,  color: '#f97316',      text: 'Fair'   },
    { pct: 75,  color: '#eab308',      text: 'Good'   },
    { pct: 100, color: 'var(--green)', text: 'Strong' },
  ];
  const lvl = levels[score];
  if (fill)  { fill.style.width = lvl.pct + '%'; fill.style.background = lvl.color; }
  if (label) { label.textContent = lvl.text; label.style.color = lvl.color; }

  return checks;
}

function initPasswordChange(user) {
  const editBtn     = document.getElementById('editPwBtn');
  const cancelBtn   = document.getElementById('cancelPwBtn');
  const saveBtn     = document.getElementById('savePwBtn');
  const pwView      = document.getElementById('pwView');
  const pwForm      = document.getElementById('pwForm');
  const newPwInput  = document.getElementById('newPw');
  const confPwInput = document.getElementById('confirmPw');
  const matchMsg    = document.getElementById('pwMatchMsg');

  const showForm = () => {
    pwView.classList.add('hidden');
    pwForm.classList.remove('hidden');
    editBtn.innerHTML = '<span class="material-icons-round">close</span> Cancel';
  };
  const showView = () => {
    pwForm.classList.add('hidden');
    pwView.classList.remove('hidden');
    editBtn.innerHTML = '<span class="material-icons-round">edit</span> Change';
    ['currentPw','newPw','confirmPw'].forEach(id => { document.getElementById(id).value = ''; });
    checkStrength('');
    matchMsg.textContent = '';
    matchMsg.className = 'pw-match-msg';
  };

  editBtn.addEventListener('click', () => pwForm.classList.contains('hidden') ? showForm() : showView());
  cancelBtn.addEventListener('click', showView);

  // Show/hide toggles
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon  = btn.querySelector('.material-icons-round');
      input.type  = input.type === 'password' ? 'text' : 'password';
      icon.textContent = input.type === 'password' ? 'visibility' : 'visibility_off';
    });
  });

  newPwInput.addEventListener('input', () => checkStrength(newPwInput.value));

  confPwInput.addEventListener('input', () => {
    if (!confPwInput.value) { matchMsg.textContent = ''; matchMsg.className = 'pw-match-msg'; return; }
    const match = confPwInput.value === newPwInput.value;
    matchMsg.textContent = match ? '✓ Passwords match' : '✗ Passwords do not match';
    matchMsg.className   = 'pw-match-msg ' + (match ? 'match' : 'no-match');
  });

  saveBtn.addEventListener('click', async () => {
    const currentPw = document.getElementById('currentPw').value;
    const newPw     = newPwInput.value;
    const confirmPw = confPwInput.value;

    if (!currentPw || !newPw || !confirmPw) { showToast('Please fill in all password fields.', 'error'); return; }
    if (newPw !== confirmPw)                 { showToast('New passwords do not match.', 'error'); return; }
    if (!checkStrength(newPw).len)           { showToast('Password must be at least 8 characters.', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating…';

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);

      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const lastChangedEls = document.querySelectorAll('#pwView .field-value');
      if (lastChangedEls[1]) lastChangedEls[1].textContent = today;

      showView();
      showToast('Password updated successfully.');
    } catch (err) {
      const msg = (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
        ? 'Current password is incorrect.'
        : err.message;
      showToast(msg, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-round">lock_reset</span> Update Password';
    }
  });
}

function initPasswordReset(user) {
  const pwView = document.getElementById('pwView');
  if (!pwView) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:10px 0 4px; display:flex; align-items:center; gap:6px;';
  wrap.innerHTML = `<button class="text-btn" id="sendResetEmailBtn" style="font-size:13px;display:flex;align-items:center;gap:4px;">
    <span class="material-icons-round" style="font-size:15px">mail</span>
    Send password reset email instead
  </button>`;
  pwView.appendChild(wrap);

  document.getElementById('sendResetEmailBtn').addEventListener('click', async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast(`Reset email sent to ${user.email}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function initLogout() {
  const doLogout = async (e) => {
    e?.preventDefault();
    await signOut(auth);
    localStorage.removeItem('servify-admin');
    window.location.href = 'signin.html';
  };
  document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
  document.getElementById('signOutAllBtn')?.addEventListener('click', doLogout);
}

function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('mobile-open');
      backdrop.classList.toggle('visible');
      document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });
  backdrop?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  });
}

document.head.insertAdjacentHTML('beforeend', '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>');

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'signin.html'; return; }

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists() || snap.data().role !== 'admin') {
    window.location.href = 'signin.html';
    return;
  }

  document.body.style.visibility = 'visible';

  initThemeToggle();
  initSidebar();
  populateProfile(snap.data(), user);
  initAvatarUpload(user);
  initInfoEdit(user);
  initPasswordChange(user);
  initPasswordReset(user);
  initLogout();
});