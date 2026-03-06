import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "signin.html";
    return;
  }

  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    window.location.href = "signin.html";
    return;
  }

  const data = docSnap.data();

  if (data.role !== "admin") {
    window.location.href = "signin.html";
    return;
  }

  document.body.style.visibility = "visible";
});

let providers = [];
let customers = [];
let services = [];

let bookings = [];

let notifications = [
  { id: 1, icon: 'pending_actions', color: 'amber', title: '3 Pending Provider Approvals', desc: 'Priya Sharma, James Okoro, Chen Wei are awaiting review.', time: '2 min ago', unread: true, page: 'providers' },
  { id: 2, icon: 'cancel', color: 'red', title: 'Booking Cancelled', desc: 'Tom Bradley cancelled Deep Home Cleaning booking.', time: '18 min ago', unread: true, page: 'bookings' },
  { id: 3, icon: 'cancel', color: 'red', title: 'Booking Cancelled', desc: 'Isla Thompson cancelled Plumbing Repair booking.', time: '1 hr ago', unread: true, page: 'bookings' },
  { id: 4, icon: 'person_add', color: 'blue', title: 'New Customer Registered', desc: 'Aisha Nwosu joined the platform.', time: '3 hrs ago', unread: false, page: 'customers' },
  { id: 5, icon: 'category', color: 'green', title: 'New Service Request', desc: 'A provider requested to list "Carpentry Work".', time: '5 hrs ago', unread: false, page: 'services' },
];

let providerFilter = 'all';
let bookingFilter = 'all';
let customerFilter = 'all';
let uploadedImageDataUrl = '';
let editingServiceId = null; 

let providerQuery = '';
let serviceQuery = '';
let bookingQuery = '';
let customerQuery = '';

function badge(status) {
  const map = { Approved: 'badge-approved', Pending: 'badge-pending', Rejected: 'badge-rejected', Active: 'badge-active', Inactive: 'badge-inactive', Confirmed: 'badge-confirmed', Cancelled: 'badge-cancelled', Revoked: 'badge-revoked' };
  return `<span class="badge ${map[status] || 'badge-pending'}">${status}</span>`;
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let val = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    val += step;
    if (val >= target) { el.textContent = target; clearInterval(timer); }
    else el.textContent = val;
  }, 20);
}

function matchesQuery(str, query) {
  return str.toLowerCase().includes(query.toLowerCase().trim());
}

function renderDashboard() {
  animateCount('totalProviders', providers.length);
  animateCount('pendingProviders', providers.filter(p => p.status === 'Pending').length);
  animateCount('totalCustomers', customers.length);
  animateCount('totalBookings', bookings.length);

  document.getElementById('recentBookingsBody').innerHTML = bookings.slice(0, 4).map(b => `
    <tr>
      <td>${b.customer}</td>
      <td>${b.service}</td>
      <td>${badge(b.status)}</td>
      <td>${formatDate(b.date)}</td>
    </tr>
  `).join('');

  const pending = providers.filter(p => p.status === 'Pending');
  const list = document.getElementById('pendingProvidersList');
  if (pending.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="material-icons-round">check_circle</span><p>No pending approvals</p></div>`;
    return;
  }
  list.innerHTML = pending.map(p => `
    <div class="pending-item">
      <div class="pending-avatar">${initials(p.name)}</div>
      <div class="pending-info">
        <div class="pending-name">${p.name}</div>
        <div class="pending-meta">${p.email}</div>
      </div>
      ${badge(p.status)}
    </div>
  `).join('');
}

async function loadProviders() {
  const q = query(collection(db, "users"), where("role", "==", "provider"));
  const querySnapshot = await getDocs(q);
  providers = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    let status = 'Pending';
    if (data.approved === true) status = 'Approved';
    else if (data.rejected === true) status = 'Rejected';

    providers.push({
      id: docSnap.id,       
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      status
    });
  });
  renderProviders();
  renderDashboard();
}

function renderProviders() {
  let data = providerFilter === 'all' ? providers : providers.filter(p => p.status === providerFilter);
  if (providerQuery) data = data.filter(p => matchesQuery(p.name + p.email + p.phone, providerQuery));
  const tbody = document.getElementById('providersTableBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-icons-round">search_off</span><p>${providerQuery ? 'No providers match your search.' : 'No providers match this filter.'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><div class="provider-name-cell"><div class="provider-avatar-sm">${initials(p.name)}</div>${p.name}</div></td>
      <td class="hide-sm">${p.email}</td>
      <td class="hide-md">${p.phone}</td>
      <td>${badge(p.status)}</td>
      <td>
        <div class="actions-cell">
          ${p.status !== 'Approved' ? `<button class="action-btn approve" data-action="approve" data-id="${p.id}"><span class="material-icons-round">check</span>Approve</button>` : ''}
          ${p.status !== 'Rejected' ? `<button class="action-btn reject" data-action="reject" data-id="${p.id}"><span class="material-icons-round">close</span>Reject</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function approveProvider(id) {
  try {
    await updateDoc(doc(db, "users", id), { approved: true, rejected: false });
    await loadProviders();
    showToast("Provider approved successfully.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function rejectProvider(id) {
  try {
    await updateDoc(doc(db, "users", id), { approved: false, rejected: true });
    await loadProviders();
    showToast("Provider rejected.", "error");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadCustomers() {
  const q = query(collection(db, "users"), where("role", "==", "customer"));
  const snapshot = await getDocs(q);
  customers = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    customers.push({
      id: docSnap.id,
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      address: data.address || "",
      joined: data.createdAt?.toDate()?.toISOString(),
      approval: "Approved"
    });
  });
  renderCustomers();
  renderDashboard();
}

function renderCustomers() {
  let data = customerFilter === 'all' ? customers : customers.filter(c => c.approval === customerFilter);
  if (customerQuery) data = data.filter(c => matchesQuery(c.name + c.email + c.phone + c.address, customerQuery));
  const tbody = document.getElementById('customersTableBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="material-icons-round">search_off</span><p>${customerQuery ? 'No customers match your search.' : 'No customers match this filter.'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td><div class="provider-name-cell"><div class="provider-avatar-sm">${initials(c.name)}</div>${c.name}</div></td>
      <td class="hide-sm">${c.email}</td>
      <td class="hide-md">${c.phone}</td>
      <td class="hide-lg address-cell" title="${c.address}">${c.address}</td>
      <td class="hide-sm">${formatDate(c.joined)}</td>
      <td>${badge(c.approval)}</td>
      <td>
        <div class="actions-cell">
          ${c.approval === 'Approved'
            ? `<button class="action-btn revoke" data-action="revoke" data-id="${c.id}"><span class="material-icons-round">block</span>Revoke</button>`
            : `<button class="action-btn restore" data-action="restore" data-id="${c.id}"><span class="material-icons-round">check_circle</span>Restore</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}

function revokeCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  c.approval = 'Revoked';
  renderCustomers();
  addNotification({ icon: 'block', color: 'red', title: 'Customer Access Revoked', desc: `${c.name}'s access has been revoked.`, time: 'Just now', page: 'customers' });
  showToast(`${c.name}'s access has been revoked.`, 'error');
}

function restoreCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  c.approval = 'Approved';
  renderCustomers();
  addNotification({ icon: 'check_circle', color: 'green', title: 'Customer Access Restored', desc: `${c.name}'s access has been restored.`, time: 'Just now', page: 'customers' });
  showToast(`${c.name}'s access has been restored.`, 'success');
}

async function loadServices() {
  const snapshot = await getDocs(collection(db, "services"));
  services = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const mins = data.estimatedDuration;
    const durationLabel = mins
      ? (mins >= 60 ? `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hr${mins >= 120 ? 's' : ''}` : `${mins} min`)
      : '';
    services.push({
      id: docSnap.id,                               
      serviceName: data.serviceName || docSnap.id,
      basePrice: data.basePrice || 0,
      estimatedDuration: durationLabel,
      active: data.active === true ? 'Active' : 'Inactive',
      description: data.description || '',
      imageUrl: data.imageUrl || ''
    });
  });
  renderServices();
}

async function toggleServiceStatus(id) {
  const s = services.find(s => s.id === id);
  if (!s) return;
  const newActive = s.active === 'Active' ? false : true;
  try {
    await updateDoc(doc(db, "services", id), { active: newActive });
    s.active = newActive ? 'Active' : 'Inactive';
    renderServices();
    showToast(`"${s.serviceName}" set to ${s.active}.`, s.active === 'Active' ? 'success' : 'error');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderServices() {
  let data = [...services];
  if (serviceQuery) data = data.filter(s => matchesQuery(s.serviceName + s.description + s.active, serviceQuery));
  const tbody = document.getElementById('servicesTableBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-icons-round">search_off</span><p>${serviceQuery ? 'No services match your search.' : 'No services found.'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(s => `
    <tr data-id="${s.id}" style="cursor:pointer" title="Double-click to edit">
      <td>${s.imageUrl ? `<img class="service-thumb" src="${s.imageUrl}" alt="${s.serviceName}" />` : `<div class="service-thumb-placeholder"><span class="material-icons-round">image</span></div>`}</td>
      <td>${s.serviceName}</td>
      <td class="hide-sm">LKR ${s.basePrice.toLocaleString()}</td>
      <td class="hide-md">${s.estimatedDuration}</td>
      <td>
        <button class="status-toggle ${s.active === 'Active' ? 'status-toggle--on' : 'status-toggle--off'}" data-action="toggle-service" data-id="${s.id}" title="Toggle status">
          <span class="status-toggle__track">
            <span class="status-toggle__thumb"></span>
          </span>
          <span class="status-toggle__label">${s.active}</span>
        </button>
      </td>
    </tr>
  `).join('');


  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('dblclick', (e) => {

      if (e.target.closest('[data-action="toggle-service"]')) return;
      const svc = services.find(s => s.id === row.dataset.id);
      if (svc) openModal(svc);
    });
  });
}

async function loadBookings() {
  const snapshot = await getDocs(collection(db, "bookings"));
  bookings = [];

  const userCache = {};
  const rawBookings = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    rawBookings.push({ id: docSnap.id, ...data });
    if (data.userId) userCache[data.userId] = null;
  });

  await Promise.all(
    Object.keys(userCache).map(async (uid) => {
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        userCache[uid] = userSnap.exists() ? (userSnap.data().name || uid) : uid;
      } catch {
        userCache[uid] = uid;
      }
    })
  );

  // Capitalise status to match badge() map
  function capitalise(str) {
    if (!str) return 'Pending';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  bookings = rawBookings.map((b) => ({
    id: b.id,
    customer: userCache[b.userId] || 'Unknown',
    service: b.serviceName || '—',
    price: b.price || 0,
    status: capitalise(b.status),
    date: b.timestamp?.toDate?.()?.toISOString() ?? null,
  }));

  // Sort newest first
  bookings.sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1) ;

  renderBookings();
  renderDashboard();
}

function renderBookings() {
  let data = bookingFilter === 'all' ? bookings : bookings.filter(b => b.status === bookingFilter);
  if (bookingQuery) data = data.filter(b => matchesQuery(b.customer + b.service + b.status, bookingQuery));
  const tbody = document.getElementById('bookingsTableBody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-icons-round">search_off</span><p>${bookingQuery ? 'No bookings match your search.' : 'No bookings match this filter.'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${b.customer}</td>
      <td class="hide-sm">${b.service}</td>
      <td class="hide-md">LKR ${b.price.toLocaleString()}</td>
      <td>${badge(b.status)}</td>
      <td class="hide-sm">${formatDate(b.date)}</td>
    </tr>
  `).join('');
}

function addNotification(notif) {
  notifications.unshift({ id: Date.now(), unread: true, ...notif });
  renderNotifications();
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  const empty = document.getElementById('notifEmpty');
  const countEl = document.getElementById('notifCount');
  const unreadCount = notifications.filter(n => n.unread).length;

  countEl.textContent = unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : '';

  if (notifications.length === 0) {
    list.innerHTML = '';
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" data-id="${n.id}" data-page="${n.page}">
      <div class="notif-icon-wrap ${n.color}"><span class="material-icons-round">${n.icon}</span></div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      const page = item.dataset.page;
      const notif = notifications.find(n => n.id === id);
      if (notif) notif.unread = false;
      renderNotifications();
      closeNotifPanel();
      if (page) navigateTo(page);
    });
  });
}

function closeNotifPanel() {
  document.getElementById('notifPanel').classList.remove('open');
}

function initSearchBox(inputId, clearId, onQuery) {
  const input = document.getElementById(inputId);
  const clear = document.getElementById(clearId);
  if (!input || !clear) return;

  input.addEventListener('input', () => {
    const q = input.value;
    clear.classList.toggle('visible', q.length > 0);
    onQuery(q);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.classList.remove('visible');
    onQuery('');
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', providers: 'Providers', services: 'Services', bookings: 'Bookings', customers: 'Customers' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'providers') renderProviders();
  if (page === 'services') renderServices();
  if (page === 'bookings') renderBookings();
  if (page === 'customers') renderCustomers();

  closeMobileSidebar();
}

function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarBackdrop').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarBackdrop').classList.remove('visible');
  document.body.style.overflow = '';
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.remove('error');
  document.getElementById('toastIcon').textContent = type === 'error' ? 'cancel' : 'check_circle';
  if (type === 'error') toast.classList.add('error');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function openModal(svc = null) {
  resetModal();
  editingServiceId = svc ? svc.id : null;

  const isEdit = !!svc;
  document.querySelector('#addServiceModal .modal-header h3').textContent = isEdit ? 'Edit Service' : 'Add New Service';
  document.getElementById('saveService').innerHTML = `<span class="material-icons-round">${isEdit ? 'edit' : 'save'}</span> ${isEdit ? 'Update Service' : 'Save Service'}`;

  if (isEdit) {
    document.getElementById('serviceName').value = svc.serviceName;
    document.getElementById('serviceDescription').value = svc.description;
    document.getElementById('servicePrice').value = svc.basePrice;
    document.getElementById('serviceStatus').value = svc.active === 'Active' ? 'Active' : 'Inactive';

    // Convert duration label back to minutes for the number input
    const durMins = parseDurationToMins(svc.estimatedDuration);
    document.getElementById('serviceDuration').value = durMins || '';

    if (svc.imageUrl) {
      uploadedImageDataUrl = svc.imageUrl;
      document.getElementById('uploadPreview').src = svc.imageUrl;
      document.getElementById('uploadPreview').classList.add('visible');
      document.getElementById('uploadRemove').classList.add('visible');
      document.getElementById('uploadPlaceholder').style.display = 'none';
    }
  }

  document.getElementById('addServiceModal').classList.add('open');
}

function closeModal() {
  document.getElementById('addServiceModal').classList.remove('open');
  editingServiceId = null;
}

function resetModal() {
  ['serviceName', 'serviceDescription', 'servicePrice', 'serviceDuration'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('serviceStatus').value = 'Active';
  document.getElementById('serviceImageFile').value = '';
  uploadedImageDataUrl = '';
  document.getElementById('uploadPreview').src = '';
  document.getElementById('uploadPreview').classList.remove('visible');
  document.getElementById('uploadRemove').classList.remove('visible');
  document.getElementById('uploadPlaceholder').style.display = '';
}

// Convert stored duration label (e.g. "2 hrs", "30 min") back to minutes integer
function parseDurationToMins(label) {
  if (!label) return 0;
  const hrMatch = label.match(/([\d.]+)\s*hr/i);
  const minMatch = label.match(/([\d.]+)\s*min/i);
  if (hrMatch) return Math.round(parseFloat(hrMatch[1]) * 60);
  if (minMatch) return Math.round(parseFloat(minMatch[1]));
  return parseInt(label) || 0;
}

async function saveService() {
  const name = document.getElementById('serviceName').value.trim();
  const description = document.getElementById('serviceDescription').value.trim();
  const price = parseFloat(document.getElementById('servicePrice').value);
  const durationMins = parseInt(document.getElementById('serviceDuration').value);
  const status = document.getElementById('serviceStatus').value;

  if (!name || isNaN(price) || isNaN(durationMins) || durationMins < 1) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const payload = {
    serviceName: name,
    description,
    basePrice: price,
    estimatedDuration: durationMins,
    active: status === 'Active',
    imageUrl: uploadedImageDataUrl,
  };

  try {
    if (editingServiceId) {
      // ── Edit existing service ──
      await updateDoc(doc(db, "services", editingServiceId), payload);
      addNotification({ icon: 'edit', color: 'blue', title: 'Service Updated', desc: `"${name}" was updated.`, time: 'Just now', page: 'services' });
      showToast(`"${name}" updated successfully.`, 'success');
    } else {
      // ── Add new service ──
      const docId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      await setDoc(doc(db, "services", docId), { ...payload, createdAt: new Date() });
      addNotification({ icon: 'category', color: 'green', title: 'New Service Added', desc: `"${name}" was added to the catalogue.`, time: 'Just now', page: 'services' });
      showToast(`"${name}" added to services.`, 'success');
    }
    closeModal();
    await loadServices();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function initImageUpload() {
  const fileInput = document.getElementById('serviceImageFile');
  const preview = document.getElementById('uploadPreview');
  const placeholder = document.getElementById('uploadPlaceholder');
  const removeBtn = document.getElementById('uploadRemove');
  const zone = document.getElementById('imageUploadZone');

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      uploadedImageDataUrl = ev.target.result;
      preview.src = uploadedImageDataUrl;
      preview.classList.add('visible');
      removeBtn.classList.add('visible');
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    uploadedImageDataUrl = '';
    preview.src = '';
    preview.classList.remove('visible');
    removeBtn.classList.remove('visible');
    placeholder.style.display = '';
    fileInput.value = '';
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
}

function initThemeToggle() {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('servify-theme') || 'light';
  html.setAttribute('data-theme', saved);
  icon.textContent = saved === 'dark' ? 'light_mode' : 'dark_mode';
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    icon.textContent = next === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem('servify-theme', next);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();
  initImageUpload();
  renderNotifications();

  const sidebar = document.getElementById('sidebar');

  document.getElementById('menuToggle').addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.contains('mobile-open') ? closeMobileSidebar() : openMobileSidebar();
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  document.getElementById('sidebarBackdrop').addEventListener('click', closeMobileSidebar);

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); });
  });

  document.querySelectorAll('.text-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  document.getElementById('notifBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('notifPanel').classList.toggle('open');
  });

  document.getElementById('notifClear').addEventListener('click', () => {
    notifications.forEach(n => n.unread = false);
    renderNotifications();
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('notifWrap').contains(e.target)) closeNotifPanel();
  });

  document.getElementById('openAddServiceModal').addEventListener('click', () => openModal())
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('saveService').addEventListener('click', () => saveService());
  document.getElementById('addServiceModal').addEventListener('click', e => { if (e.target === document.getElementById('addServiceModal')) closeModal(); });


  document.getElementById('providersTableBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'approve') approveProvider(id);
    if (btn.dataset.action === 'reject') rejectProvider(id);
  });

  document.getElementById('customersTableBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'revoke') revokeCustomer(id);
    if (btn.dataset.action === 'restore') restoreCustomer(id);
  });

  document.getElementById('servicesTableBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="toggle-service"]');
    if (!btn) return;
    toggleServiceStatus(btn.dataset.id);   // string Firestore doc ID
  });

  document.querySelectorAll('#page-providers .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-providers .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      providerFilter = btn.dataset.filter;
      renderProviders();
    });
  });

  document.querySelectorAll('#page-bookings .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-bookings .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bookingFilter = btn.dataset.filter;
      renderBookings();
    });
  });

  document.querySelectorAll('#page-customers .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-customers .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customerFilter = btn.dataset.filter;
      renderCustomers();
    });
  });

  initSearchBox('providerSearch', 'providerSearchClear', q => { providerQuery = q; renderProviders(); });
  initSearchBox('serviceSearch', 'serviceSearchClear', q => { serviceQuery = q; renderServices(); });
  initSearchBox('bookingSearch', 'bookingSearchClear', q => { bookingQuery = q; renderBookings(); });
  initSearchBox('customerSearch', 'customerSearchClear', q => { customerQuery = q; renderCustomers(); });

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      localStorage.removeItem('servify-admin');
      window.location.href = 'signin.html';
    } catch (error) {
      alert('Logout failed: ' + error.message);
    }
  });

  await loadProviders();
  await loadCustomers();
  await loadServices();
  await loadBookings();
  navigateTo('dashboard');
});