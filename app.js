'use strict';

const PLANTATION_TYPES = [
  "Coconut Plantation", "Lanzones Plantation", "Durian Plantation",
  "Maize Production — Right Bank", "Maize Production — Left Bank", "Maize Production — Upper Valley",
  "String Beans Plantation", "Tomato Plantation", "Potato Plantation",
  "Squash Production", "Eggplant Farming", "Zucchini Plantation",
  "Rambutan Plantation", "Peanut Production", "Tuber Farming"
];

const DEV_PHASE_TYPES = ["Tomato Plantation", "Potato Plantation"];
const DEFAULT_WAGE = 350.0;
const RECORDS_PER_PAGE = 50;
const AUTO_SAVE_INTERVAL = 30000;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024;

// Keep this in sync with package.json and api/upload.js's allowed content types.
const BLOB_CLIENT_VERSION = '0.27.0';

const DEFAULT_STARTING_CAPITAL = {
  "Coconut Plantation": 5000, "Lanzones Plantation": 5000, "Durian Plantation": 5000,
  "Maize Production — Right Bank": 5000, "Maize Production — Left Bank": 5000, "Maize Production — Upper Valley": 5000,
  "String Beans Plantation": 7000, "Tomato Plantation": 0, "Potato Plantation": 0,
  "Squash Production": 0, "Eggplant Farming": 0, "Zucchini Plantation": 0,
  "Rambutan Plantation": 3000, "Peanut Production": 0, "Tuber Farming": 0
};

const DEFAULT_HARVEST_SHARE_PCT = {
  "Coconut Plantation": 0, "Lanzones Plantation": 0, "Durian Plantation": 0,
  "Maize Production — Right Bank": 0.30, "Maize Production — Left Bank": 0.30, "Maize Production — Upper Valley": 0.30,
  "String Beans Plantation": 0.40, "Tomato Plantation": 0, "Potato Plantation": 0,
  "Squash Production": 0, "Eggplant Farming": 0, "Zucchini Plantation": 0,
  "Rambutan Plantation": 0, "Peanut Production": 0, "Tuber Farming": 0
};

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilogram (kg)" }, { value: "pcs", label: "Piece (pcs)" },
  { value: "serving", label: "Serving (srv)" }, { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" }, { value: "bottle", label: "Bottle" },
  { value: "sack", label: "Sack" }, { value: "gallon", label: "Gallon" }
];

const PLANTATION_ORDER = [
  { file: 'coconut.html', type: 'Coconut Plantation' },
  { file: 'lanzones.html', type: 'Lanzones Plantation' },
  { file: 'durian.html', type: 'Durian Plantation' },
  { file: 'rambutan.html', type: 'Rambutan Plantation' },
  { file: 'maize-right-bank.html', type: 'Maize Production — Right Bank' },
  { file: 'maize-left-bank.html', type: 'Maize Production — Left Bank' },
  { file: 'maize-upper-valley.html', type: 'Maize Production — Upper Valley' },
  { file: 'string-beans.html', type: 'String Beans Plantation' },
  { file: 'tomato.html', type: 'Tomato Plantation' },
  { file: 'potato.html', type: 'Potato Plantation' },
  { file: 'squash.html', type: 'Squash Production' },
  { file: 'eggplant.html', type: 'Eggplant Farming' },
  { file: 'zucchini.html', type: 'Zucchini Plantation' },
  { file: 'peanut.html', type: 'Peanut Production' },
  { file: 'tuber.html', type: 'Tuber Farming' }
];

let records = [];
let personalRecords = [];
let grossSales = {};
let startingCapital = {};
let capitalEntries = [];
let cashAdvances = [];
let harvestSharePct = {};
let plantationPricing = {};
let plantationMedia = {};
let plantationSales = [];
let activityRecords = [];
let inventoryItems = [];
let payslips = [];
let planningTasks = [];
let monthlyBudgets = {};
let lenderLoans = [];
let products = [];

let nextId = 1, nextPersonalId = 1, nextCapitalId = 1, nextAdvanceId = 1;
let nextLoanId = 1, nextSaleId = 1, nextActivityId = 1, nextInventoryId = 1;
let nextPayslipId = 1, nextPlanningId = 1, nextProductId = 1;

let editingId = null, editingPersonalId = null, editingAdvanceId = null;
let editingActivityId = null, editingSaleId = null, editingLoanId = null, editingProductId = null;

let currentCategory = 'business';
let currentPage = 1;
let filteredRecords = [];
let chartInstances = {};
let deletedRecord = null, undoTimeout = null;
let isFormDirty = false, isLoading = false;
let workerRowSeq = 0, itemRowSeq = 0, pItemRowSeq = 0;
let toastTimer = null, autoSaveTimer = null;
let pendingDeleteId = null, pendingDeleteIsPersonal = false;
let payrollPreview = null;
let weatherLocation = null, weatherCache = null;
let selectedPlantationType = null;
let pendingActivityPhoto = null, pendingActivityVideoFile = null;
let pendingProductPhoto = null, pendingPlantationPhoto = null, pendingPlantationVideoFile = null;
let ownerUnlocked = false, ownerPinHash = null;
let pendingNavigationTarget = null;
let persistTimer = null;
let isOnline = navigator.onLine;

const PRESELECTED_PLANTATION = window.PRESELECTED_PLANTATION || null;
const IS_PLANTATION_PAGE = !!PRESELECTED_PLANTATION;
const PUBLIC_VIEWS = ['about', 'shop'];
const OWNER_PIN_KEY = 'owner-pin-hash-v1';
const OWNER_UNLOCKED_KEY = 'valley-creeks-owner-unlocked';
const STATE_CACHE_KEY = 'valley-creeks-state-cache-v1';
const PENDING_SAVE_KEY = 'valley-creeks-pending-save-v1';

function peso(n) { return "₱" + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function round2(n) { return Math.round(n * 100) / 100; }
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isFutureDate(s) { return s && s > todayISO(); }
function escapeHtml(t) {
  if (t === null || t === undefined) return '';
  const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML;
}
function laborCostOf(w) { return (w.full_days + (w.half_days || 0) * 0.5) * w.daily_wage; }
function laborDaysOf(w) { return w.full_days + (w.half_days || 0) * 0.5; }
function expenditureFor(type) { return records.filter(r => r.plantation_type === type).reduce((s, r) => s + r.total_expenditure, 0); }

function plantationEmoji(type) {
  const m = {
    "Coconut Plantation": "🥥", "Lanzones Plantation": "🫐", "Durian Plantation": "🌰",
    "Maize Production — Right Bank": "🌽", "Maize Production — Left Bank": "🌽", "Maize Production — Upper Valley": "🌽",
    "String Beans Plantation": "🫛", "Tomato Plantation": "🍅", "Potato Plantation": "🥔",
    "Squash Production": "🎃", "Eggplant Farming": "🍆", "Zucchini Plantation": "🥒",
    "Rambutan Plantation": "🍒", "Peanut Production": "🥜", "Tuber Farming": "🍠"
  };
  return m[type] || "🌴";
}

function unitOptionsHtml(selected) {
  return UNIT_OPTIONS.map(u => `<option value="${u.value}" ${selected === u.value ? 'selected' : ''}>${u.label}</option>`).join('');
}

function showToast(msg, type = 'info', duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.className = 'toast';
  if (type === 'error') t.classList.add('error');
  if (type === 'success') t.classList.add('success');
  if (type === 'undo') t.classList.add('undo');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function setLoading(v) {
  isLoading = v;
  const o = document.getElementById('loading-overlay');
  if (o) o.classList.toggle('open', v);
}

function openConfirmModal(title, text, onYes) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-text').textContent = text;
  document.getElementById('confirm-yes').textContent = 'Delete';
  document.getElementById('confirm-yes').onclick = () => {
    document.getElementById('confirm-modal').classList.remove('open');
    onYes();
  };
  document.getElementById('confirm-modal').classList.add('open');
}

function collectState() {
  return {
    records, personalRecords, grossSales, startingCapital, capitalEntries,
    cashAdvances, harvestSharePct, plantationPricing, plantationMedia, plantationSales,
    activityRecords, inventoryItems, payslips, planningTasks, monthlyBudgets, lenderLoans,
    products,
    nextId, nextPersonalId, nextCapitalId, nextAdvanceId, nextLoanId, nextSaleId,
    nextActivityId, nextInventoryId, nextPayslipId, nextPlanningId, nextProductId
  };
}

function applyState(s) {
  if (!s || typeof s !== 'object') return;
  records = s.records || [];
  personalRecords = s.personalRecords || [];
  grossSales = s.grossSales || {};
  startingCapital = s.startingCapital || {};
  capitalEntries = s.capitalEntries || [];
  cashAdvances = s.cashAdvances || [];
  harvestSharePct = s.harvestSharePct || {};
  plantationPricing = s.plantationPricing || {};
  plantationMedia = s.plantationMedia || {};
  plantationSales = s.plantationSales || [];
  activityRecords = s.activityRecords || [];
  inventoryItems = s.inventoryItems || [];
  payslips = s.payslips || [];
  planningTasks = s.planningTasks || [];
  monthlyBudgets = s.monthlyBudgets || {};
  lenderLoans = s.lenderLoans || [];
  products = s.products || [];
  nextId = s.nextId || 1;
  nextPersonalId = s.nextPersonalId || 1;
  nextCapitalId = s.nextCapitalId || 1;
  nextAdvanceId = s.nextAdvanceId || 1;
  nextLoanId = s.nextLoanId || 1;
  nextSaleId = s.nextSaleId || 1;
  nextActivityId = s.nextActivityId || 1;
  nextInventoryId = s.nextInventoryId || 1;
  nextPayslipId = s.nextPayslipId || 1;
  nextPlanningId = s.nextPlanningId || 1;
  nextProductId = s.nextProductId || 1;

  PLANTATION_TYPES.forEach(t => {
    if (startingCapital[t] === undefined) startingCapital[t] = DEFAULT_STARTING_CAPITAL[t] ?? 0;
    if (harvestSharePct[t] === undefined) harvestSharePct[t] = DEFAULT_HARVEST_SHARE_PCT[t] ?? 0;
  });
}

function saveLocalCache() {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(collectState()));
  } catch (e) {
    console.warn('Local cache write failed (storage may be full):', e);
  }
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Local cache read failed:', e);
  }
  return null;
}

function queuePendingSave() {
  try {
    localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ queuedAt: Date.now() }));
  } catch (e) {}
}
function clearPendingSave() {
  try { localStorage.removeItem(PENDING_SAVE_KEY); } catch (e) {}
}
function hasPendingSave() {
  try { return !!localStorage.getItem(PENDING_SAVE_KEY); } catch (e) { return false; }
}

function scheduleSave() {
  saveLocalCache();
  queuePendingSave();
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(saveNow, 600);
}

async function saveNow() {
  persistTimer = null;
  if (!navigator.onLine) {
    console.log('Offline — save queued for when connection returns.');
    return;
  }
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: collectState() })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    clearPendingSave();
    console.log('✅ Saved to server.');
  } catch (err) {
    console.error('saveNow error:', err);
    showToast('⚠️ Save failed — queued and will retry when you reconnect.', 'error', 4000);
  }
}

async function loadFromServer() {
  setLoading(true);

  const cached = loadLocalCache();
  if (cached) applyState(cached);

  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.state) {
      applyState(data.state);
      saveLocalCache();
    } else {
      PLANTATION_TYPES.forEach(t => {
        if (startingCapital[t] === undefined) startingCapital[t] = DEFAULT_STARTING_CAPITAL[t] ?? 0;
        if (harvestSharePct[t] === undefined) harvestSharePct[t] = DEFAULT_HARVEST_SHARE_PCT[t] ?? 0;
      });
      await saveNow();
    }
    clearPendingSave();
  } catch (err) {
    console.warn('Server load failed — using cache:', err);
    if (!cached) showToast('⚠️ Offline and no cache — starting with empty data.', 'error', 5000);
  } finally {
    setLoading(false);
  }

  if (hasPendingSave()) {
    console.log('Found pending save — flushing…');
    await saveNow();
  }
}

window.addEventListener('online', () => {
  isOnline = true;
  showToast('🌐 Back online', 'success', 2000);
  if (hasPendingSave()) saveNow();
});
window.addEventListener('offline', () => {
  isOnline = false;
  showToast('📴 Offline — changes saved locally', 'info', 3000);
});

/**
 * Uploads a file directly from the browser to Vercel Blob.
 *
 * The file never passes through a Vercel Function — the client library
 * negotiates a short-lived token with /api/upload and then streams the file
 * straight to Blob storage. This is what allows files up to 10 GB.
 *
 * Requires:
 *   - api/upload.js deployed and calling handleUpload()
 *   - BLOB_READ_WRITE_TOKEN present in the Vercel project env
 *   - Testing on a deployed URL (Blob cannot call back to localhost)
 */
async function uploadToBlob(file, pathnamePrefix) {
  const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `${pathnamePrefix}/${Date.now()}-${safeName}`;
  const multipart = file.size > 100 * 1024 * 1024;

  const { upload } = await import(`https://esm.sh/@vercel/blob@${BLOB_CLIENT_VERSION}/client`);

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    multipart
  });

  return blob.url;
}

async function deleteBlob(url) {
  if (!url) return;
  try {
    await fetch('/api/upload?url=' + encodeURIComponent(url), { method: 'DELETE' });
  } catch (e) {
    console.warn('Blob delete failed:', e);
  }
}

function isPrivateView(v) { return !PUBLIC_VIEWS.includes(v); }

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function applyLockUI() {
  document.body.classList.toggle('owner-locked', !ownerUnlocked);
  const link = document.getElementById('owner-access-link');
  const linkM = document.getElementById('owner-access-link-mobile');
  const label = ownerUnlocked ? '🔓 Lock app' : '🔒 Owner Login';
  if (link) link.textContent = label;
  if (linkM) linkM.textContent = label;
  const si = document.getElementById('global-search-input');
  if (si) si.disabled = !ownerUnlocked;
  const badge = document.getElementById('record-count-badge');
  if (badge && !ownerUnlocked) badge.textContent = 'Valley and Creeks Farm';
}

function openOwnerGate() {
  const title = document.getElementById('owner-gate-title');
  const text = document.getElementById('owner-gate-text');
  const cf = document.getElementById('owner-gate-confirm-field');
  document.getElementById('owner-gate-error').style.display = 'none';
  document.getElementById('owner-gate-pin').value = '';
  document.getElementById('owner-gate-pin-confirm').value = '';
  if (!ownerPinHash) {
    title.textContent = '🔐 Set an Owner PIN';
    text.textContent = 'No PIN is set. Choose one now to protect your data.';
    cf.style.display = '';
  } else {
    title.textContent = '🔒 Owner Login';
    text.textContent = 'Enter your PIN to access the dashboard.';
    cf.style.display = 'none';
  }
  document.getElementById('owner-gate-modal').classList.add('open');
}

function closeOwnerGate() {
  document.getElementById('owner-gate-modal').classList.remove('open');
  pendingNavigationTarget = null;
}

async function submitOwnerGate() {
  const pin = document.getElementById('owner-gate-pin').value;
  if (!pin || pin.length < 4) {
    showToast('⚠️ PIN must be at least 4 characters', 'error');
    return;
  }
  if (!ownerPinHash) {
    const c = document.getElementById('owner-gate-pin-confirm').value;
    if (pin !== c) {
      document.getElementById('owner-gate-error').textContent = "PINs don't match.";
      document.getElementById('owner-gate-error').style.display = '';
      return;
    }
    ownerPinHash = await sha256Hex(pin);
    localStorage.setItem(OWNER_PIN_KEY, ownerPinHash);
    showToast('✅ Owner PIN set', 'success');
  } else {
    const h = await sha256Hex(pin);
    if (h !== ownerPinHash) {
      document.getElementById('owner-gate-error').textContent = "PIN doesn't match.";
      document.getElementById('owner-gate-error').style.display = '';
      return;
    }
  }
  ownerUnlocked = true;
  localStorage.setItem(OWNER_UNLOCKED_KEY, '1');
  applyLockUI();
  document.getElementById('owner-gate-modal').classList.remove('open');
  const t = pendingNavigationTarget || 'dashboard';
  pendingNavigationTarget = null;
  navigateTo(t);
  refreshAll();
}

function lockApp() {
  ownerUnlocked = false;
  localStorage.removeItem(OWNER_UNLOCKED_KEY);
  applyLockUI();
  navigateTo('about');
  showToast('🔒 Locked', 'success');
}

function handleOwnerAccessClick() {
  if (IS_PLANTATION_PAGE) { lockApp(); return; }
  if (ownerUnlocked) lockApp(); else openOwnerGate();
}

function navigateTo(viewName) {
  if (isPrivateView(viewName) && !ownerUnlocked && !IS_PLANTATION_PAGE) {
    pendingNavigationTarget = viewName;
    openOwnerGate();
    return;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  document.querySelectorAll('.hamburger-dropdown a[data-view], .sidebar-link[data-view]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName);
  });
}

function plantationSalesTotalFor(type) {
  return round2(plantationSales.filter(s => s.plantation_type === type).reduce((s, x) => s + x.total, 0));
}

function computeGrossSalesFor(type) {
  const salesTotal = plantationSalesTotalFor(type);
  if (salesTotal > 0) return salesTotal;
  const ov = plantationPricing[type];
  if (ov && ov.totalYield > 0) return round2(ov.totalYield * (ov.currentPricePerKg || 0));
  return grossSales[type] || 0;
}

function grossSalesSourceLabelFor(type) {
  if (plantationSalesTotalFor(type) > 0) return 'from Sell Produce sales';
  const ov = plantationPricing[type];
  if (ov && ov.totalYield > 0) return 'from Encoded Yield & Pricing';
  if ((grossSales[type] || 0) > 0) return 'manual fallback';
  return 'not set yet';
}

function netSalesFor(type) {
  return round2(computeGrossSalesFor(type) - expenditureFor(type));
}

function computeCapitalFor(type) {
  const ex = startingCapital[type] || 0;
  const ent = capitalEntries.filter(c => c.plantation_type === type);
  const add = ent.reduce((s, c) => s + c.amount, 0);
  const spent = records.filter(r => r.plantation_type === type).reduce((s, r) => s + r.total_expenditure, 0);
  return { existing: ex, additional: add, entries: ent, spent, current: round2(ex + add - spent) };
}

function computeAdvanceWorkerTotals() {
  const totals = {};
  cashAdvances.forEach(a => {
    if (!totals[a.name]) totals[a.name] = { borrowed: 0, repaid: 0 };
    totals[a.name].borrowed += a.amount;
    if (a.repaid) totals[a.name].repaid += a.amount;
  });
  return Object.entries(totals).map(([n, t]) => ({
    name: n, borrowed: t.borrowed, repaid: t.repaid, outstanding: round2(t.borrowed - t.repaid)
  })).sort((a, b) => b.outstanding - a.outstanding);
}

function computeLoanTotals(loan) {
  const interest = round2(loan.principal * (loan.interestRate / 100));
  return { interestAmount: interest, totalPayable: round2(loan.principal + interest) };
}

function populateTypeDropdowns() {
  const f = document.getElementById('f-type');
  if (f) f.innerHTML = PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const s = document.getElementById('s-type');
  if (s) s.innerHTML = `<option value="">All plantation types</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const capType = document.getElementById('cap-type');
  if (capType) capType.innerHTML = PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const advType = document.getElementById('adv-type');
  if (advType) advType.innerHTML = `<option value="">— none —</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const invUnit = document.getElementById('inv-unit');
  if (invUnit) invUnit.innerHTML = unitOptionsHtml();

  const prType = document.getElementById('pr-type');
  if (prType) prType.innerHTML = `<option value="">All plantations</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const planType = document.getElementById('plan-type');
  if (planType) planType.innerHTML = PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const actPl = document.getElementById('activity-plantation');
  if (actPl) actPl.innerHTML = `<option value="">— general / not specific —</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const prodPl = document.getElementById('prod-plantation');
  if (prodPl) prodPl.innerHTML = `<option value="">— none —</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  const prodUnit = document.getElementById('prod-unit');
  if (prodUnit) prodUnit.innerHTML = unitOptionsHtml();

  const loanType = document.getElementById('loan-type');
  if (loanType) loanType.innerHTML = `<option value="">— none —</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');
}

function populatePlantationSubmenu() {
  const out = document.getElementById('plantation-submenu');
  const sidebarOut = document.getElementById('sidebar-plantation-submenu');
  if (out) {
    out.innerHTML = PLANTATION_TYPES.map(type =>
      `<a class="submenu-item" data-plantation="${escapeHtml(type)}">${plantationEmoji(type)} ${type}</a>`
    ).join('');
  }
  if (sidebarOut) {
    sidebarOut.innerHTML = PLANTATION_TYPES.map(type =>
      `<a class="sidebar-link submenu-item" data-plantation="${escapeHtml(type)}">${plantationEmoji(type)} ${type}</a>`
    ).join('');
  }
  document.querySelectorAll('#plantation-submenu a.submenu-item, #sidebar-plantation-submenu a.submenu-item').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const type = this.getAttribute('data-plantation');
      const match = PLANTATION_ORDER.find(p => p.type === type);
      if (match) window.location.href = 'plantations/' + match.file;
      document.getElementById('hamburgerDropdown').classList.remove('open');
    });
  });
}

function enhancePlantationSelect(id) {
  const select = document.getElementById(id);
  if (!select || select.dataset.customized === '1') return;
  select.dataset.customized = '1';
}

function workerRowTemplate(id, w = {}) {
  const pp = w.payment_period || "daily";
  const paid = !!w.paid;
  return `
  <div class="dyn-row worker-row" data-row-id="${id}" role="listitem">
    <div><label for="w-name-${id}">Name</label><input type="text" id="w-name-${id}" class="w-name" value="${escapeHtml(w.name || '')}" placeholder="Worker name" required onchange="markDirty()"></div>
    <div><label for="w-job-${id}">Job</label><input type="text" id="w-job-${id}" class="w-job" value="${escapeHtml(w.job_description || '')}" placeholder="e.g. Harvesting" onchange="markDirty()"></div>
    <div><label for="w-full-${id}">Days</label><input type="number" id="w-full-${id}" class="w-full" value="${w.full_days ?? 0}" min="0" step="0.5" oninput="updateTotals();markDirty()"></div>
    <div><label for="w-period-${id}">Payment</label>
      <select id="w-period-${id}" class="w-period" onchange="updateTotals();markDirty()">
        <option value="daily" ${pp === 'daily' ? 'selected' : ''}>Daily</option>
        <option value="weekly" ${pp === 'weekly' ? 'selected' : ''}>Weekly</option>
        <option value="monthly" ${pp === 'monthly' ? 'selected' : ''}>Monthly</option>
      </select>
    </div>
    <div><label for="w-wage-${id}">Wage (₱)</label><input type="number" id="w-wage-${id}" class="w-wage" value="${w.daily_wage ?? DEFAULT_WAGE}" min="0" step="0.01" oninput="updateTotals();markDirty()"></div>
    <div><label for="w-paid-${id}">Paid?</label><button type="button" id="w-paid-${id}" class="paid-toggle-btn w-paid ${paid ? 'is-paid' : ''}" data-paid="${paid ? '1' : '0'}" onclick="toggleWorkerRowPaid(this)">${paid ? '✓ Paid' : 'Unpaid'}</button></div>
    <button class="remove-btn" onclick="removeRow(this)" title="Remove worker" aria-label="Remove worker">✕</button>
  </div>`;
}

function itemRowTemplate(id, it = {}) {
  return `
  <div class="dyn-row item-row" data-row-id="${id}" role="listitem">
    <div><label for="i-name-${id}">Item</label><input type="text" id="i-name-${id}" class="i-name" value="${escapeHtml(it.name || '')}" placeholder="e.g. Fertilizer" required onchange="markDirty()"></div>
    <div><label for="i-qty-${id}">Qty</label><input type="number" id="i-qty-${id}" class="i-qty" value="${it.quantity ?? 0}" min="0" step="0.01" oninput="updateItemCost(this);markDirty()"></div>
    <div><label for="i-unit-${id}">Unit</label>
      <select id="i-unit-${id}" class="i-unit" onchange="updateItemCost(this);markDirty()">
        ${unitOptionsHtml(it.unit)}
      </select>
    </div>
    <div><label for="i-price-${id}">Price per unit (₱)</label><input type="number" id="i-price-${id}" class="i-price" value="${it.price_per_unit ?? 0}" min="0" step="0.01" oninput="updateItemCost(this);markDirty()"></div>
    <div><label for="i-cost-${id}">Total cost (₱)</label><input type="number" id="i-cost-${id}" class="i-cost" value="${it.cost ?? 0}" min="0" step="0.01" readonly style="background:var(--void);cursor:default;"></div>
    <button class="remove-btn" onclick="removeRow(this)" title="Remove item" aria-label="Remove item">✕</button>
  </div>`;
}

function personalItemRowTemplate(id, it = {}) {
  return `
  <div class="dyn-row item-row" data-row-id="${id}" role="listitem">
    <div><label for="pi-name-${id}">Item / description</label><input type="text" id="pi-name-${id}" class="pi-name" value="${escapeHtml(it.name || '')}" placeholder="e.g. Groceries" required onchange="markDirty()"></div>
    <div><label for="pi-qty-${id}">Qty</label><input type="number" id="pi-qty-${id}" class="pi-qty" value="${it.quantity ?? 0}" min="0" step="0.01" oninput="updatePersonalItemCost(this);markDirty()"></div>
    <div><label for="pi-unit-${id}">Unit</label>
      <select id="pi-unit-${id}" class="pi-unit" onchange="updatePersonalItemCost(this);markDirty()">
        ${unitOptionsHtml(it.unit)}
      </select>
    </div>
    <div><label for="pi-price-${id}">Price per unit (₱)</label><input type="number" id="pi-price-${id}" class="pi-price" value="${it.price_per_unit ?? 0}" min="0" step="0.01" oninput="updatePersonalItemCost(this);markDirty()"></div>
    <div><label for="pi-cost-${id}">Total cost (₱)</label><input type="number" id="pi-cost-${id}" class="pi-cost" value="${it.cost ?? 0}" min="0" step="0.01" readonly style="background:var(--void);cursor:default;"></div>
    <button class="remove-btn" onclick="removeRow(this)" title="Remove item" aria-label="Remove item">✕</button>
  </div>`;
}

function addWorkerRow(w = {}) {
  workerRowSeq++;
  const el = document.getElementById('worker-rows');
  if (!el) return;
  el.insertAdjacentHTML('beforeend', workerRowTemplate(workerRowSeq, w));
  updateTotals();
  markDirty();
}

function addItemRow(it = {}) {
  itemRowSeq++;
  const el = document.getElementById('item-rows');
  if (!el) return;
  el.insertAdjacentHTML('beforeend', itemRowTemplate(itemRowSeq, it));
  const row = el.querySelector(`.dyn-row[data-row-id="${itemRowSeq}"]`);
  if (row) updateItemCost(row.querySelector('.i-qty'));
  updateTotals();
  markDirty();
}

function addPersonalItemRow(it = {}) {
  pItemRowSeq++;
  const el = document.getElementById('p-item-rows');
  if (!el) return;
  el.insertAdjacentHTML('beforeend', personalItemRowTemplate(pItemRowSeq, it));
  const row = el.querySelector(`.dyn-row[data-row-id="${pItemRowSeq}"]`);
  if (row) updatePersonalItemCost(row.querySelector('.pi-qty'));
  updatePersonalTotals();
  markDirty();
}

function removeRow(btn) {
  btn.closest('.dyn-row').remove();
  updateTotals();
  markDirty();
}

function toggleWorkerRowPaid(btn) {
  const paid = btn.dataset.paid === '1';
  btn.dataset.paid = paid ? '0' : '1';
  btn.classList.toggle('is-paid', !paid);
  btn.textContent = !paid ? '✓ Paid' : 'Unpaid';
  markDirty();
}

function collectWorkers() {
  return [...document.querySelectorAll('#worker-rows .dyn-row')].map(row => {
    const name = row.querySelector('.w-name').value.trim();
    if (!name) return null;
    return {
      name,
      job_description: row.querySelector('.w-job').value.trim() || "General Labor",
      full_days: Math.max(0, parseFloat(row.querySelector('.w-full').value) || 0),
      half_days: 0,
      daily_wage: Math.max(0, parseFloat(row.querySelector('.w-wage').value) || DEFAULT_WAGE),
      payment_period: row.querySelector('.w-period').value || "daily",
      paid: row.querySelector('.w-paid')?.dataset.paid === '1',
      work_dates: [document.getElementById('f-date').value || todayISO()]
    };
  }).filter(Boolean);
}

function collectItems() {
  return [...document.querySelectorAll('#item-rows .dyn-row')].map(row => {
    const name = row.querySelector('.i-name').value.trim();
    if (!name) return null;
    return {
      name,
      quantity: Math.max(0, parseFloat(row.querySelector('.i-qty').value) || 0),
      unit: row.querySelector('.i-unit').value,
      price_per_unit: Math.max(0, parseFloat(row.querySelector('.i-price').value) || 0),
      cost: parseFloat(row.querySelector('.i-cost').value) || 0
    };
  }).filter(Boolean);
}

function collectPersonalItems() {
  return [...document.querySelectorAll('#p-item-rows .dyn-row')].map(row => {
    const name = row.querySelector('.pi-name').value.trim();
    if (!name) return null;
    return {
      name,
      quantity: Math.max(0, parseFloat(row.querySelector('.pi-qty').value) || 0),
      unit: row.querySelector('.pi-unit').value,
      price_per_unit: Math.max(0, parseFloat(row.querySelector('.pi-price').value) || 0),
      cost: parseFloat(row.querySelector('.pi-cost').value) || 0
    };
  }).filter(Boolean);
}

function updateItemCost(el) {
  const row = el.closest('.dyn-row');
  const qty = parseFloat(row.querySelector('.i-qty').value) || 0;
  const price = parseFloat(row.querySelector('.i-price').value) || 0;
  row.querySelector('.i-cost').value = round2(qty * price);
  updateTotals();
}

function updatePersonalItemCost(el) {
  const row = el.closest('.dyn-row');
  const qty = parseFloat(row.querySelector('.pi-qty').value) || 0;
  const price = parseFloat(row.querySelector('.pi-price').value) || 0;
  row.querySelector('.pi-cost').value = round2(qty * price);
  updatePersonalTotals();
}

function updateTotals() {
  const workers = collectWorkers();
  const items = collectItems();
  const labor = workers.reduce((s, w) => s + laborCostOf(w), 0);
  const itemsTotal = items.reduce((s, i) => s + i.cost, 0);
  const yEl = document.getElementById('f-yield');
  const pEl = document.getElementById('f-price-per-kg');
  const rEl = document.getElementById('f-revenue');
  const yieldVal = yEl ? parseFloat(yEl.value) || 0 : 0;
  const pricePerKg = pEl ? parseFloat(pEl.value) || 0 : 0;
  const revenue = rEl ? parseFloat(rEl.value) || 0 : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('t-labor', peso(labor));
  set('t-items', peso(itemsTotal));
  set('t-yield', yieldVal + ' kg');
  set('t-price-per-kg', peso(pricePerKg));
  set('t-revenue', peso(revenue));
  set('t-grand', peso(labor + itemsTotal));
  set('worker-count-label', `(${workers.length})`);
  set('item-count-label', `(${items.length})`);
}

function updateGrossIncomePreview() {
  const y = Math.max(0, parseFloat(document.getElementById('f-yield').value) || 0);
  const p = Math.max(0, parseFloat(document.getElementById('f-price-per-kg').value) || 0);
  document.getElementById('f-revenue').value = round2(y * p);
}

function updatePersonalTotals() {
  const items = collectPersonalItems();
  const total = items.reduce((s, i) => s + i.cost, 0);
  const g = document.getElementById('p-t-grand');
  if (g) g.textContent = peso(total);
  const l = document.getElementById('p-item-count-label');
  if (l) l.textContent = `(${items.length})`;
}

function setCategory(cat) {
  currentCategory = cat;
  const b = document.getElementById('cat-business-btn');
  const p = document.getElementById('cat-personal-btn');
  if (b) { b.className = cat === 'business' ? 'active-business' : ''; b.setAttribute('aria-pressed', cat === 'business' ? 'true' : 'false'); }
  if (p) { p.className = cat === 'personal' ? 'active-personal' : ''; p.setAttribute('aria-pressed', cat === 'personal' ? 'true' : 'false'); }
  const bf = document.getElementById('business-fields');
  const pf = document.getElementById('personal-fields');
  if (bf) bf.style.display = cat === 'business' ? '' : 'none';
  if (pf) pf.style.display = cat === 'personal' ? '' : 'none';
}

function resetForm() {
  editingId = null;
  editingPersonalId = null;
  isFormDirty = false;
  setCategory('business');
  const sb = document.getElementById('save-btn');
  if (sb) sb.textContent = "Save record";
  const ft = document.getElementById('f-type'); if (ft) ft.value = PLANTATION_TYPES[0];
  const fd = document.getElementById('f-date'); if (fd) fd.value = todayISO();
  const fw = document.getElementById('f-wage'); if (fw) fw.value = DEFAULT_WAGE;
  const fy = document.getElementById('f-yield'); if (fy) fy.value = 0;
  const fp = document.getElementById('f-price-per-kg'); if (fp) fp.value = 0;
  const fr = document.getElementById('f-revenue'); if (fr) fr.value = 0;
  const wr = document.getElementById('worker-rows'); if (wr) wr.innerHTML = '';
  const ir = document.getElementById('item-rows'); if (ir) ir.innerHTML = '';
  addWorkerRow();
  addItemRow();
  updateTotals();
  const pd = document.getElementById('p-date'); if (pd) pd.value = todayISO();
  const pir = document.getElementById('p-item-rows'); if (pir) pir.innerHTML = '';
  addPersonalItemRow();
  updatePersonalTotals();
}

function confirmClearForm() {
  if (!isFormDirty && !editingId && !editingPersonalId) { resetForm(); return; }
  openConfirmModal('Clear form?', 'You have unsaved changes. Clear the form?', () => {
    resetForm();
    showToast('Form cleared', 'info');
  });
}

function markDirty() {
  isFormDirty = true;
  const dot = document.getElementById('auto-save-dot');
  if (dot) dot.className = 'dot saving';
  const t = document.getElementById('auto-save-text');
  if (t) t.textContent = 'Unsaved changes';
}

async function saveRecord() {
  if (isLoading) return;
  if (currentCategory === 'personal') return savePersonalRecord();

  const workers = collectWorkers();
  const items = collectItems();
  if (workers.length === 0 && items.length === 0) {
    showToast('⚠️ Add at least one worker or item first', 'error');
    return;
  }
  const date = document.getElementById('f-date').value;
  if (isFutureDate(date)) {
    showToast('⚠️ Date cannot be in the future', 'error');
    return;
  }

  setLoading(true);
  try {
    const type = document.getElementById('f-type').value;
    const dailyWage = Math.max(0, parseFloat(document.getElementById('f-wage').value) || DEFAULT_WAGE);
    const yieldVal = Math.max(0, parseFloat(document.getElementById('f-yield').value) || 0);
    const pricePerKg = Math.max(0, parseFloat(document.getElementById('f-price-per-kg').value) || 0);
    const revenue = Math.max(0, parseFloat(document.getElementById('f-revenue').value) || 0);
    const laborCost = round2(workers.reduce((s, w) => s + laborCostOf(w), 0));
    const itemsTotal = round2(items.reduce((s, i) => s + i.cost, 0));

    const record = {
      id: editingId ?? nextId,
      date: date || todayISO(),
      plantation_type: type,
      category: 'business',
      workers, items,
      total_workers: workers.length,
      full_days: workers.reduce((s, w) => s + w.full_days, 0),
      half_days: 0,
      daily_wage: dailyWage,
      labor_cost: laborCost,
      items_total: itemsTotal,
      yield_kg: yieldVal,
      price_per_kg: pricePerKg,
      revenue: revenue,
      cost_per_kg: yieldVal > 0 ? round2((laborCost + itemsTotal) / yieldVal) : 0,
      total_expenditure: round2(laborCost + itemsTotal)
    };

    if (editingId) {
      const idx = records.findIndex(r => r.id === editingId);
      if (idx !== -1) records[idx] = record;
      showToast(`✅ Record #${editingId} updated`, 'success');
    } else {
      record.id = nextId++;
      records.push(record);
      showToast(`✅ Business record #${record.id} saved`, 'success');
    }
    isFormDirty = false;
    resetForm();
    scheduleSave();
    refreshAll();
  } finally {
    setLoading(false);
  }
}

async function savePersonalRecord() {
  if (isLoading) return;
  const items = collectPersonalItems();
  if (items.length === 0) {
    showToast('⚠️ Add at least one personal item first', 'error');
    return;
  }
  const date = document.getElementById('p-date').value || todayISO();
  if (isFutureDate(date)) {
    showToast('⚠️ Date cannot be in the future', 'error');
    return;
  }
  setLoading(true);
  try {
    const total = round2(items.reduce((s, i) => s + i.cost, 0));
    const record = { id: editingPersonalId ?? nextPersonalId, date, category: 'personal', items, total_expenditure: total };
    if (editingPersonalId) {
      const idx = personalRecords.findIndex(r => r.id === editingPersonalId);
      if (idx !== -1) personalRecords[idx] = record;
      showToast(`✅ Personal expense #${editingPersonalId} updated`, 'success');
    } else {
      record.id = nextPersonalId++;
      personalRecords.push(record);
      showToast(`✅ Personal expense #${record.id} saved`, 'success');
    }
    isFormDirty = false;
    resetForm();
    scheduleSave();
    refreshAll();
  } finally {
    setLoading(false);
  }
}

function editRecord(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  editingPersonalId = null;
  setCategory('business');
  document.getElementById('form-title').textContent = `Editing record #${id}`;
  document.getElementById('save-btn').textContent = "Update record";
  document.getElementById('f-type').value = r.plantation_type;
  document.getElementById('f-date').value = r.date;
  document.getElementById('f-wage').value = r.daily_wage;
  document.getElementById('f-yield').value = r.yield_kg || 0;
  document.getElementById('f-price-per-kg').value = r.price_per_kg || 0;
  document.getElementById('f-revenue').value = r.revenue || 0;
  document.getElementById('worker-rows').innerHTML = '';
  document.getElementById('item-rows').innerHTML = '';
  r.workers.forEach(w => addWorkerRow(w));
  r.items.forEach(i => addItemRow(i));
  if (r.workers.length === 0) addWorkerRow();
  if (r.items.length === 0) addItemRow();
  updateTotals();
  isFormDirty = false;
  navigateTo('add');
}

function editPersonalRecord(id) {
  const r = personalRecords.find(x => x.id === id);
  if (!r) return;
  editingPersonalId = id;
  editingId = null;
  setCategory('personal');
  document.getElementById('form-title').textContent = `Editing personal expense #${id}`;
  document.getElementById('save-btn').textContent = "Update record";
  document.getElementById('p-date').value = r.date;
  document.getElementById('p-item-rows').innerHTML = '';
  r.items.forEach(i => addPersonalItemRow(i));
  if (r.items.length === 0) addPersonalItemRow();
  updatePersonalTotals();
  isFormDirty = false;
  navigateTo('add');
}

function confirmDelete(id) {
  const r = records.find(x => x.id === id);
  pendingDeleteId = id;
  pendingDeleteIsPersonal = false;
  openConfirmModal('Delete record?', `Record #${id} — ${r.plantation_type} on ${r.date} (${peso(r.total_expenditure)}) will be removed.`, executeDelete);
}

function confirmDeletePersonal(id) {
  const r = personalRecords.find(x => x.id === id);
  pendingDeleteId = id;
  pendingDeleteIsPersonal = true;
  openConfirmModal('Delete personal expense?', `Personal expense #${id} on ${r.date} (${peso(r.total_expenditure)}) will be removed.`, executeDelete);
}

function executeDelete() {
  if (pendingDeleteIsPersonal) {
    const r = personalRecords.find(x => x.id === pendingDeleteId);
    deletedRecord = { type: 'personal', record: r };
    personalRecords = personalRecords.filter(r => r.id !== pendingDeleteId);
  } else {
    const r = records.find(x => x.id === pendingDeleteId);
    deletedRecord = { type: 'business', record: r };
    records = records.filter(r => r.id !== pendingDeleteId);
  }
  scheduleSave();
  showToast(`🗑️ Deleted. <button onclick="undoDelete()">↩ Undo</button>`, 'undo', 30000);
  refreshAll();
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => { deletedRecord = null; }, 30000);
}

function undoDelete() {
  if (!deletedRecord) return;
  if (deletedRecord.type === 'personal') {
    personalRecords.push(deletedRecord.record);
  } else {
    records.push(deletedRecord.record);
  }
  scheduleSave();
  deletedRecord = null;
  clearTimeout(undoTimeout);
  refreshAll();
  showToast('↩️ Restored', 'success');
}

function getFilteredRecords() {
  const type = document.getElementById('s-type')?.value || '';
  const from = document.getElementById('s-from')?.value || '';
  const to = document.getElementById('s-to')?.value || '';
  const worker = (document.getElementById('s-worker')?.value || '').trim().toLowerCase();
  const min = parseFloat(document.getElementById('s-min-amount')?.value) || 0;
  const max = parseFloat(document.getElementById('s-max-amount')?.value) || Infinity;
  let list = [...records];
  if (type) list = list.filter(r => r.plantation_type === type);
  if (from) list = list.filter(r => r.date >= from);
  if (to) list = list.filter(r => r.date <= to);
  if (worker) list = list.filter(r => r.workers.some(w => w.name.toLowerCase().includes(worker)));
  if (min > 0) list = list.filter(r => r.total_expenditure >= min);
  if (max < Infinity) list = list.filter(r => r.total_expenditure <= max);
  list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return list;
}

function clearFilters() {
  ['s-type','s-from','s-to','s-worker','s-min-amount','s-max-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  currentPage = 1;
  renderRecords();
}

function renderRecords() {
  filteredRecords = getFilteredRecords();
  const total = filteredRecords.length;
  const pages = Math.ceil(total / RECORDS_PER_PAGE);
  if (currentPage > pages) currentPage = Math.max(1, pages);
  const start = (currentPage - 1) * RECORDS_PER_PAGE;
  const pageItems = filteredRecords.slice(start, start + RECORDS_PER_PAGE);

  const cl = document.getElementById('records-count-label');
  if (cl) cl.textContent = `(${total})`;
  const out = document.getElementById('records-table');
  if (!out) return;
  if (total === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">🌾</span>No records match.</div>`;
    return;
  }

  let html = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Yield</th><th>Revenue</th><th>Workers</th><th>Items</th><th class="num">Total</th><th>Actions</th></tr></thead><tbody>`;

  pageItems.forEach(r => {
    html += `<tr>
      <td class="num">#${r.id}</td>
      <td>${r.date}</td>
      <td><span class="tag">${r.plantation_type}</span></td>
      <td>${r.yield_kg ? r.yield_kg + ' kg' : '—'}</td>
      <td>${r.revenue ? peso(r.revenue) : '—'}</td>
      <td class="mini-list">${r.workers.map((w, wi) => `<div>${escapeHtml(w.name)} — ${escapeHtml(w.job_description)} · ${peso(laborCostOf(w))} ${w.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Unpaid</span>'}</div>`).join('') || '—'}</td>
      <td class="mini-list">${r.items.map(i => `<div>${escapeHtml(i.name)}: ${i.quantity} ${i.unit} × ${peso(i.price_per_unit)} = ${peso(i.cost)}</div>`).join('') || '—'}</td>
      <td class="num">${peso(r.total_expenditure)}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="editRecord(${r.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDelete(${r.id})">Delete</button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;

  if (pages > 1) {
    html += `<div class="pagination">`;
    html += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>›</button>`;
    html += `</div>`;
  }
  out.innerHTML = html;
}

function changePage(p) {
  const pages = Math.ceil(getFilteredRecords().length / RECORDS_PER_PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderRecords();
}

function renderBusiness() {
  const cl = document.getElementById('business-count-label');
  const rcl = document.getElementById('business-records-count-label');
  if (cl) cl.textContent = `(${records.length})`;
  if (rcl) rcl.textContent = `(${records.length})`;
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const laborTotal = records.reduce((s, r) => s + r.labor_cost, 0);
  const itemsTotal = records.reduce((s, r) => s + r.items_total, 0);

  const stats = document.getElementById('business-stats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><div class="label">Records</div><div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">Labor</div><div class="value">${peso(laborTotal)}</div></div>
      <div class="stat-card"><div class="label">Items</div><div class="value">${peso(itemsTotal)}</div></div>
      <div class="stat-card accent"><div class="label">Total</div><div class="value">${peso(total)}</div></div>
    `;
  }

  const byType = {};
  records.forEach(r => { byType[r.plantation_type] = (byType[r.plantation_type] || 0) + r.total_expenditure; });
  const bt = document.getElementById('business-by-type');
  if (bt) bt.innerHTML = barRows(byType, total);

  const out = document.getElementById('business-table');
  if (!out) return;
  if (records.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">🏭</span>No business expenses yet.</div>`;
    return;
  }
  const list = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Type</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.map(r => `<tr>
      <td class="num">#${r.id}</td>
      <td>${r.date}</td>
      <td><span class="tag">${r.plantation_type}</span></td>
      <td class="num">${peso(r.total_expenditure)}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="editRecord(${r.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDelete(${r.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderPersonal() {
  const cl = document.getElementById('personal-count-label');
  if (cl) cl.textContent = `(${personalRecords.length})`;
  const total = personalRecords.reduce((s, r) => s + r.total_expenditure, 0);
  const avg = personalRecords.length ? total / personalRecords.length : 0;
  const stats = document.getElementById('personal-stats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><div class="label">Entries</div><div class="value">${personalRecords.length}</div></div>
      <div class="stat-card accent"><div class="label">Total</div><div class="value">${peso(total)}</div></div>
      <div class="stat-card"><div class="label">Average</div><div class="value">${peso(avg)}</div></div>
    `;
  }
  const out = document.getElementById('personal-table');
  if (!out) return;
  if (personalRecords.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">👤</span>No personal expenses yet.</div>`;
    return;
  }
  const list = [...personalRecords].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Items</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.map(r => `<tr>
      <td class="num">#${r.id}</td>
      <td>${r.date}</td>
      <td class="mini-list">${r.items.map(i => `<div>${escapeHtml(i.name)}: ${i.quantity} ${i.unit} × ${peso(i.price_per_unit)} = ${peso(i.cost)}</div>`).join('')}</td>
      <td class="num">${peso(r.total_expenditure)}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="editPersonalRecord(${r.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDeletePersonal(${r.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function barRows(map, total, sortByKey = false) {
  let entries = Object.entries(map);
  entries = sortByKey ? entries.sort((a, b) => a[0].localeCompare(b[0])) : entries.sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(e => e[1])) : 1;
  if (entries.length === 0) return `<div class="empty-state">No data yet.</div>`;
  return entries.map(([k, v]) => `
    <div class="bar-row">
      <div class="label" title="${escapeHtml(k)}">${escapeHtml(k)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div>
      <div class="amt">${peso(v)}</div>
    </div>`).join('');
}

function destroyChart(name) {
  if (chartInstances[name]) { chartInstances[name].destroy(); chartInstances[name] = null; }
}

function renderCharts() {
  renderDailyChart();
  renderMonthlyChart();
  renderPlantationPie();
  renderProfitChart();
}

function renderDailyChart() {
  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { expenditure: 0, earnings: 0 };
    byDate[r.date].expenditure += r.total_expenditure;
    byDate[r.date].earnings += (r.revenue || 0);
  });
  const dates = Object.keys(byDate).sort().slice(-30);
  const label = document.getElementById('daily-chart-range-label');
  if (label) label.textContent = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'no activity yet';
  const c = document.getElementById('dailyChart');
  if (!c) return;
  destroyChart('daily');
  if (dates.length === 0) return;
  chartInstances.daily = new Chart(c.getContext('2d'), {
    data: {
      labels: dates,
      datasets: [
        { type: 'bar', label: 'Expenditure', data: dates.map(d => byDate[d].expenditure), backgroundColor: 'rgba(226,104,95,0.55)', borderColor: '#e2685f', borderWidth: 1, order: 2 },
        { type: 'line', label: 'Earnings', data: dates.map(d => byDate[d].earnings), borderColor: '#4caf82', backgroundColor: 'rgba(76,175,130,0.15)', borderWidth: 2, tension: 0.3, pointRadius: 3, fill: true, order: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e9edf5' } } },
      scales: {
        y: { ticks: { color: '#8991ab', callback: v => '₱' + v }, grid: { color: 'rgba(42,46,66,0.5)' } },
        x: { ticks: { color: '#8991ab', font: { size: 9 } } }
      }
    }
  });
}

function renderMonthlyChart() {
  const byMonth = {};
  records.forEach(r => { const m = r.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + r.total_expenditure; });
  const months = Object.keys(byMonth).sort();
  const c = document.getElementById('monthlyChart');
  if (!c || months.length === 0) return;
  destroyChart('monthly');
  chartInstances.monthly = new Chart(c.getContext('2d'), {
    type: 'bar',
    data: { labels: months, datasets: [{ label: 'Monthly Expenditure', data: months.map(m => byMonth[m]), backgroundColor: 'rgba(75,139,190,0.6)', borderColor: '#4b8bbe', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e9edf5' } } }, scales: { y: { ticks: { color: '#8991ab', callback: v => '₱' + v } }, x: { ticks: { color: '#8991ab' } } } }
  });
}

function renderPlantationPie() {
  const data = {};
  records.forEach(r => { data[r.plantation_type] = (data[r.plantation_type] || 0) + r.total_expenditure; });
  const labels = Object.keys(data);
  if (labels.length === 0) return;
  const c = document.getElementById('plantationChart');
  if (!c) return;
  destroyChart('plantation');
  chartInstances.plantation = new Chart(c.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: labels.map(l => data[l]), backgroundColor: ['#4b8bbe','#6fb1e0','#e6399b','#ff6cc4','#4caf82','#e2685f','#f5a623','#9c7bd6','#3fbfb0','#d6a24b'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#e9edf5', font: { size: 11 } } } } }
  });
}

function renderProfitChart() {
  const data = PLANTATION_TYPES.map(t => ({ type: t, profit: netSalesFor(t) })).filter(d => d.profit !== 0 || records.some(r => r.plantation_type === d.type));
  if (data.length === 0) return;
  const c = document.getElementById('profitChart');
  if (!c) return;
  destroyChart('profit');
  chartInstances.profit = new Chart(c.getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.type),
      datasets: [{
        label: 'Net Sales / Profit',
        data: data.map(d => d.profit),
        backgroundColor: data.map(d => d.profit >= 0 ? 'rgba(76,175,130,0.6)' : 'rgba(226,104,95,0.6)'),
        borderColor: data.map(d => d.profit >= 0 ? '#4caf82' : '#e2685f'),
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e9edf5' } } }, scales: { y: { ticks: { color: '#8991ab', callback: v => '₱' + v } }, x: { ticks: { color: '#8991ab', font: { size: 10 } } } } }
  });
}

function renderYieldRevenueChart() {
  const c = document.getElementById('yieldRevenueChart');
  if (!c) return;
  const data = PLANTATION_TYPES.map(type => {
    const recs = records.filter(r => r.plantation_type === type);
    const totalYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
    const ov = plantationPricing[type];
    const totalRevenue = (ov && ov.totalYield > 0) ? round2(ov.totalYield * (ov.currentPricePerKg || 0)) : round2(recs.reduce((s, r) => s + (r.revenue || 0), 0));
    return { type, totalYield, totalRevenue };
  }).filter(d => d.totalYield > 0 || d.totalRevenue > 0);
  destroyChart('yieldRevenue');
  if (data.length === 0) return;
  chartInstances.yieldRevenue = new Chart(c.getContext('2d'), {
    data: {
      labels: data.map(d => d.type),
      datasets: [
        { type: 'bar', label: 'Yield (kg)', data: data.map(d => d.totalYield), backgroundColor: 'rgba(75,139,190,0.6)', borderColor: '#4b8bbe', borderWidth: 1, yAxisID: 'yYield' },
        { type: 'bar', label: 'Gross Income (₱)', data: data.map(d => d.totalRevenue), backgroundColor: 'rgba(255,108,196,0.6)', borderColor: '#ff6cc4', borderWidth: 1, yAxisID: 'yRevenue' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e9edf5' } } },
      scales: {
        yYield: { type: 'linear', position: 'left', ticks: { color: '#8991ab', callback: v => v + ' kg' } },
        yRevenue: { type: 'linear', position: 'right', ticks: { color: '#8991ab', callback: v => '₱' + v }, grid: { display: false } },
        x: { ticks: { color: '#8991ab', font: { size: 9 } } }
      }
    }
  });
}

function renderDashboard() {
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const totalYield = records.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const totalNetSales = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
  const personalTotal = personalRecords.reduce((s, r) => s + r.total_expenditure, 0);
  const ds = document.getElementById('dashboard-stats');
  if (ds) {
    ds.innerHTML = `
      <div class="stat-card"><div class="label">Records</div><div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">Business Expenses</div><div class="value">${peso(total)}</div></div>
      <div class="stat-card good"><div class="label">Total Yield</div><div class="value">${totalYield} kg</div></div>
      <div class="stat-card ${totalNetSales >= 0 ? 'good' : 'bad'}"><div class="label">Net Sales</div><div class="value">${peso(totalNetSales)}</div></div>
      <div class="stat-card"><div class="label">Diary Entries</div><div class="value">${activityRecords.length}</div></div>
      <div class="stat-card"><div class="label">Personal Expenses</div><div class="value personal">${peso(personalTotal)}</div></div>
      <div class="stat-card"><div class="label">Combined</div><div class="value merged">${peso(total + personalTotal)}</div></div>
    `;
  }
  renderCharts();
  renderWeather();
}

function computeAlerts() {
  const alerts = [];
  const today = todayISO();
  PLANTATION_TYPES.forEach(type => {
    const { current } = computeCapitalFor(type);
    if (current < 0) alerts.push({ level: 'bad', glyph: '💸', title: `${type} capital is negative`, detail: `Current: ${peso(current)}` });
    const ns = netSalesFor(type);
    if (computeGrossSalesFor(type) > 0 && ns < 0) alerts.push({ level: 'bad', glyph: '📉', title: `${type} Net Sales is negative`, detail: `Net Sales: ${peso(ns)}` });
  });
  computeAdvanceWorkerTotals().forEach(a => {
    if (a.outstanding <= 0) return;
    const oldest = cashAdvances.filter(c => c.name === a.name && !c.repaid).sort((x, y) => x.date.localeCompare(y.date))[0];
    if (!oldest) return;
    const days = Math.floor((new Date(today) - new Date(oldest.date)) / 86400000);
    if (days >= 14) alerts.push({ level: 'warning', glyph: '💵', title: `${a.name} has an unpaid advance`, detail: `${peso(a.outstanding)} — oldest ${days} days ago` });
  });
  inventoryItems.forEach(i => {
    if (i.stock <= i.threshold) alerts.push({ level: 'warning', glyph: '📦', title: `${i.name} is low on stock`, detail: `${i.stock} ${i.unit} left` });
  });
  planningTasks.forEach(t => {
    if (!t.done && t.due_date < today) alerts.push({ level: 'warning', glyph: '🗓️', title: `"${t.title}" is overdue`, detail: `${t.plantation_type} — was due ${t.due_date}` });
  });
  return alerts;
}

function renderAlerts() {
  const alerts = computeAlerts();
  const card = document.getElementById('alerts-card');
  const listEl = document.getElementById('alerts-list');
  if (!card || !listEl) return;
  if (alerts.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';
  const cl = document.getElementById('alerts-count-label');
  if (cl) cl.textContent = `(${alerts.length})`;
  listEl.innerHTML = alerts.map(a => `
    <div class="alert-row ${a.level}">
      <span class="glyph">${a.glyph}</span>
      <div class="body"><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.detail)}</span></div>
    </div>`).join('');
}

function computeHarvestShares(plantationType) {
  const pct = harvestSharePct[plantationType] || 0;
  const gross = computeGrossSalesFor(plantationType);
  const sales = netSalesFor(plantationType);
  const pool = round2(sales * pct);
  const ownerAmount = round2(sales - pool);
  const workerDays = {};
  records.filter(r => r.plantation_type === plantationType).forEach(r => {
    r.workers.forEach(w => { const d = laborDaysOf(w); workerDays[w.name] = (workerDays[w.name] || 0) + d; });
  });
  const totalDays = Object.values(workerDays).reduce((s, d) => s + d, 0);
  const shares = Object.entries(workerDays).map(([name, days]) => {
    const proportion = totalDays > 0 ? days / totalDays : 0;
    return { name, days, proportion, share: round2(pool * proportion) };
  }).sort((a, b) => b.share - a.share);
  return { pct, gross, sales, pool, ownerAmount, totalDays, shares };
}

function renderShares() {
  const intro = document.getElementById('shares-intro-text');
  if (intro) intro.textContent = "Set what percentage of each plantation's Net Sales goes to workers as a harvest share.";

  const inp = document.getElementById('share-pct-inputs');
  if (inp) {
    inp.innerHTML = PLANTATION_TYPES.map(type => {
      const v = Math.round((harvestSharePct[type] ?? 0) * 1000) / 10;
      return `<div class="field"><label for="share-pct-${type}">${type} — Worker share (%)</label>
        <input type="number" min="0" max="100" step="0.1" class="share-pct-input" id="share-pct-${type}" data-type="${type}" value="${v}"></div>`;
    }).join('');
  }

  const active = PLANTATION_TYPES.map(t => ({ type: t, ...computeHarvestShares(t) })).filter(d => d.pct > 0);

  const sum = document.getElementById('share-summary-cards');
  if (sum) {
    sum.innerHTML = active.length === 0
      ? `<div class="empty-state"><span class="glyph">📊</span>No plantation has a share % set above 0.</div>`
      : active.map(d => `
        <div class="plantation-total-card">
          <div class="p-name">${plantationEmoji(d.type)} ${d.type} <span class="share-pct-badge">${(d.pct * 100).toFixed(0)}% to workers</span></div>
          <div class="p-total">${peso(d.pool)}</div>
          <div class="p-meta">${(d.pct * 100).toFixed(0)}% of ${peso(d.sales)} Net Sales</div>
          <div class="p-meta">Owner keeps ${peso(d.ownerAmount)}</div>
        </div>`).join('');
  }

  const out = document.getElementById('share-tables-out');
  if (!out) return;
  out.innerHTML = active.map(d => {
    const rows = d.shares.map(s => `<tr><td>${escapeHtml(s.name)}</td><td class="num">${s.days}</td><td class="num">${(s.proportion * 100).toFixed(1)}%</td><td class="num">${peso(s.share)}</td></tr>`).join('');
    return `<div class="card"><h2>${plantationEmoji(d.type)} ${d.type} — ${(d.pct * 100).toFixed(0)}% worker share</h2>
      <div class="table-wrapper"><table><thead><tr><th>Worker</th><th class="num">Days</th><th class="num">%</th><th class="num">Share</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="totals-strip">
        <div class="t">Pool<b>${peso(d.pool)}</b></div>
        <div class="t">Owner<b>${peso(d.ownerAmount)}</b></div>
      </div></div>`;
  }).join('');
}

function saveHarvestSharePcts() {
  document.querySelectorAll('.share-pct-input').forEach(inp => {
    const v = Math.min(100, Math.max(0, parseFloat(inp.value) || 0));
    harvestSharePct[inp.dataset.type] = round2(v) / 100;
  });
  scheduleSave();
  showToast('✅ Share percentages updated', 'success');
  renderShares();
}

function renderCapital() {
  const inp = document.getElementById('capital-inputs');
  if (inp) {
    inp.innerHTML = PLANTATION_TYPES.map(type => {
      const dev = DEV_PHASE_TYPES.includes(type);
      return `<div class="field"><label for="cap-${type}">${type} — Existing Capital (₱) ${dev ? '<span class="tag">🚧 In development</span>' : ''}</label>
        <input type="number" min="0" step="0.01" class="cap-existing-input" id="cap-${type}" data-type="${type}" value="${startingCapital[type] ?? 0}"></div>`;
    }).join('');
  }

  const cards = document.getElementById('capital-cards');
  let gEx = 0, gAdd = 0, gSpent = 0, gCur = 0;
  if (cards) {
    cards.innerHTML = PLANTATION_TYPES.map(type => {
      const dev = DEV_PHASE_TYPES.includes(type);
      const c = computeCapitalFor(type);
      gEx += c.existing; gAdd += c.additional; gSpent += c.spent; gCur += c.current;
      return `<div class="plantation-total-card">
        <div class="p-name">${type} ${dev ? '<span class="tag">🚧 In development</span>' : ''}</div>
        <div class="p-total" style="${c.current < 0 ? 'color:var(--bad);' : ''}">${peso(c.current)}</div>
        <div class="p-meta">Existing ${peso(c.existing)} + Additional ${peso(c.additional)} − Spent ${peso(c.spent)}</div>
      </div>`;
    }).join('');
  }

  const grand = document.getElementById('capital-grand-strip');
  if (grand) {
    grand.innerHTML = `
      <div class="t">Total Existing<b>${peso(gEx)}</b></div>
      <div class="t">Total Additional<b>${peso(gAdd)}</b></div>
      <div class="t">Total Spent<b>${peso(gSpent)}</b></div>
      <div class="t grand">Total Current<b>${peso(gCur)}</b></div>
    `;
  }

  const tbl = document.getElementById('capital-entries-table');
  if (tbl) {
    const list = [...capitalEntries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    tbl.innerHTML = list.length === 0
      ? `<div class="empty-state"><span class="glyph">💰</span>No capital entries yet.</div>`
      : `<div class="table-wrapper"><table>
          <thead><tr><th>ID</th><th>Date</th><th>Plantation</th><th>Type</th><th class="num">Amount</th><th>Note</th><th></th></tr></thead>
          <tbody>${list.map(e => `<tr>
            <td class="num">#${e.id}</td>
            <td>${e.date}</td>
            <td><span class="tag">${e.plantation_type}</span></td>
            <td>${e.kind === 'loan' ? '<span class="tag loss">Loan</span>' : '<span class="tag profit">Additional Capital</span>'}</td>
            <td class="num">${peso(e.amount)}</td>
            <td class="mini-list">${e.note ? escapeHtml(e.note) : '—'}</td>
            <td class="actions-cell"><button class="btn-danger btn-sm" onclick="confirmDeleteCapitalEntry(${e.id})">Delete</button></td>
          </tr>`).join('')}</tbody>
        </table></div>`;
  }
  const cnt = document.getElementById('capital-entries-count-label');
  if (cnt) cnt.textContent = `(${capitalEntries.length})`;
}

function saveStartingCapital() {
  document.querySelectorAll('.cap-existing-input').forEach(inp => {
    startingCapital[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  scheduleSave();
  showToast("✅ Existing Capital updated", 'success');
  renderCapital();
}

function addCapitalEntry() {
  const type = document.getElementById('cap-type').value;
  const kind = document.getElementById('cap-kind').value;
  const amount = Math.max(0, parseFloat(document.getElementById('cap-amount').value) || 0);
  const date = document.getElementById('cap-date').value || todayISO();
  const note = document.getElementById('cap-note').value.trim();
  if (amount <= 0) { showToast('⚠️ Enter an amount greater than zero', 'error'); return; }
  capitalEntries.push({ id: nextCapitalId++, plantation_type: type, kind, amount, date, note });
  document.getElementById('cap-amount').value = '';
  document.getElementById('cap-note').value = '';
  scheduleSave();
  showToast(`✅ Added ${peso(amount)} for ${type}`, 'success');
  renderCapital();
}

function confirmDeleteCapitalEntry(id) {
  const e = capitalEntries.find(c => c.id === id);
  openConfirmModal('Delete entry?', `${e.kind === 'loan' ? 'Loan' : 'Capital'} of ${peso(e.amount)} for ${e.plantation_type} will be removed.`, () => {
    capitalEntries = capitalEntries.filter(c => c.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderCapital();
  });
}

function renderAdvances() {
  const cl = document.getElementById('advances-count-label');
  if (cl) cl.textContent = `(${cashAdvances.length})`;
  const sum = document.getElementById('advance-worker-summary');
  const totals = computeAdvanceWorkerTotals();
  if (sum) {
    sum.innerHTML = totals.length === 0
      ? `<div class="empty-state"><span class="glyph">👷</span>No advances yet.</div>`
      : `<div class="table-wrapper"><table>
          <thead><tr><th>Worker</th><th class="num">Borrowed</th><th class="num">Repaid</th><th class="num">Outstanding</th></tr></thead>
          <tbody>${totals.map(t => `<tr><td>${escapeHtml(t.name)}</td><td class="num">${peso(t.borrowed)}</td><td class="num">${peso(t.repaid)}</td><td class="num">${t.outstanding > 0 ? `<span class="tag loss">${peso(t.outstanding)}</span>` : peso(0)}</td></tr>`).join('')}</tbody>
        </table></div>`;
  }
  const tbl = document.getElementById('advances-table');
  if (!tbl) return;
  const list = [...cashAdvances].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  tbl.innerHTML = list.length === 0
    ? `<div class="empty-state"><span class="glyph">💵</span>No advances yet.</div>`
    : `<div class="table-wrapper"><table>
        <thead><tr><th>ID</th><th>Date</th><th>Worker</th><th>Plantation</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(a => `<tr>
          <td class="num">#${a.id}</td>
          <td>${a.date}</td>
          <td>${escapeHtml(a.name)}</td>
          <td>${a.plantation_type ? `<span class="tag">${a.plantation_type}</span>` : '—'}</td>
          <td class="num">${peso(a.amount)}</td>
          <td>${a.repaid ? '<span class="tag profit">Repaid</span>' : '<span class="tag loss">Outstanding</span>'}</td>
          <td class="actions-cell">
            <button class="btn-ghost btn-sm" onclick="toggleAdvanceRepaid(${a.id})">${a.repaid ? 'Mark unpaid' : 'Mark repaid'}</button>
            <button class="btn-danger btn-sm" onclick="confirmDeleteAdvance(${a.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`;
}

function saveAdvance() {
  const name = document.getElementById('adv-name').value.trim();
  const amount = Math.max(0, parseFloat(document.getElementById('adv-amount').value) || 0);
  const date = document.getElementById('adv-date').value || todayISO();
  const type = document.getElementById('adv-type').value;
  const note = document.getElementById('adv-note').value.trim();
  if (!name) { showToast('⚠️ Enter worker name', 'error'); return; }
  if (amount <= 0) { showToast('⚠️ Enter amount', 'error'); return; }
  cashAdvances.push({ id: nextAdvanceId++, name, amount, date, plantation_type: type, note, repaid: false });
  ['adv-name','adv-amount','adv-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  scheduleSave();
  showToast(`✅ Advance for ${name} recorded`, 'success');
  renderAdvances();
}

function toggleAdvanceRepaid(id) {
  const idx = cashAdvances.findIndex(a => a.id === id);
  if (idx === -1) return;
  cashAdvances[idx].repaid = !cashAdvances[idx].repaid;
  scheduleSave();
  renderAdvances();
}

function confirmDeleteAdvance(id) {
  const a = cashAdvances.find(x => x.id === id);
  openConfirmModal('Delete advance?', `${peso(a.amount)} for ${a.name} will be removed.`, () => {
    cashAdvances = cashAdvances.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderAdvances();
  });
}

function renderInventory() {
  const cl = document.getElementById('inventory-count-label');
  if (cl) cl.textContent = `(${inventoryItems.length})`;
  const out = document.getElementById('inventory-table');
  if (!out) return;
  if (inventoryItems.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">📦</span>No items tracked yet.</div>`;
    return;
  }
  const list = [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name));
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Item</th><th class="num">Stock</th><th class="num">Reorder at</th><th>Supplier</th><th></th></tr></thead>
    <tbody>${list.map(i => {
      const low = i.stock <= i.threshold;
      return `<tr>
        <td>${escapeHtml(i.name)} ${low ? '<span class="tag loss">⚠ Reorder</span>' : ''}</td>
        <td class="num">${i.stock} ${i.unit}</td>
        <td class="num">${i.threshold} ${i.unit}</td>
        <td>${i.supplier ? escapeHtml(i.supplier) : '—'}</td>
        <td class="actions-cell"><button class="btn-danger btn-sm" onclick="confirmDeleteInventoryItem(${i.id})">Delete</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function saveInventoryItem() {
  const name = document.getElementById('inv-name').value.trim();
  const unit = document.getElementById('inv-unit').value;
  const stock = Math.max(0, parseFloat(document.getElementById('inv-stock').value) || 0);
  const threshold = Math.max(0, parseFloat(document.getElementById('inv-threshold').value) || 0);
  const supplier = document.getElementById('inv-supplier').value.trim();
  if (!name) { showToast('⚠️ Enter an item name', 'error'); return; }
  const i = inventoryItems.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i !== -1) {
    inventoryItems[i] = { ...inventoryItems[i], name, unit, stock, threshold, supplier };
  } else {
    inventoryItems.push({ id: nextInventoryId++, name, unit, stock, threshold, supplier });
  }
  ['inv-name','inv-stock','inv-threshold','inv-supplier'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  scheduleSave();
  showToast(`✅ Inventory updated for ${name}`, 'success');
  renderInventory();
}

function confirmDeleteInventoryItem(id) {
  const it = inventoryItems.find(x => x.id === id);
  openConfirmModal('Delete item?', `"${it.name}" will be removed.`, () => {
    inventoryItems = inventoryItems.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderInventory();
  });
}

function renderProducts() {
  const cl = document.getElementById('products-count-label');
  if (cl) cl.textContent = `(${products.length})`;
  const out = document.getElementById('products-table');
  if (!out) return;
  if (products.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">🛍️</span>No products yet.</div>`;
    return;
  }
  const list = [...products].sort((a, b) => a.name.localeCompare(b.name));
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Product</th><th>Plantation</th><th class="num">Price</th><th class="num">Stock</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(p => `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${p.plantation_type ? `<span class="tag">${p.plantation_type}</span>` : '—'}</td>
      <td class="num">${peso(p.price)} / ${p.unit}</td>
      <td class="num">${p.stock} ${p.unit}</td>
      <td>${p.active ? '<span class="tag profit">Available</span>' : '<span class="tag loss">Hidden</span>'}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDeleteProduct(${p.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const plantation = document.getElementById('prod-plantation').value;
  const unit = document.getElementById('prod-unit').value;
  const price = Math.max(0, parseFloat(document.getElementById('prod-price').value) || 0);
  const stock = Math.max(0, parseFloat(document.getElementById('prod-stock').value) || 0);
  const active = document.getElementById('prod-active').value === '1';
  const description = document.getElementById('prod-description').value.trim();
  if (!name) { showToast('⚠️ Enter a product name', 'error'); return; }
  if (price <= 0) { showToast('⚠️ Enter a price', 'error'); return; }

  let photo = pendingProductPhoto;
  if (!photo && editingProductId) {
    const existing = products.find(p => p.id === editingProductId);
    photo = existing ? existing.photo : null;
  }

  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx !== -1) products[idx] = { ...products[idx], name, plantation_type: plantation, unit, price, stock, active, description, photo };
    showToast(`✅ Product updated`, 'success');
  } else {
    products.push({ id: nextProductId++, name, plantation_type: plantation, unit, price, stock, active, description, photo });
    showToast(`✅ ${name} added`, 'success');
  }
  cancelEditProduct();
  scheduleSave();
  renderProducts();
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('product-form-title').textContent = `✏️ Editing ${p.name}`;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-plantation').value = p.plantation_type || '';
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-stock').value = p.stock;
  document.getElementById('prod-active').value = p.active ? '1' : '0';
  document.getElementById('prod-description').value = p.description || '';
  pendingProductPhoto = null;
  document.getElementById('prod-photo-preview').innerHTML = p.photo ? `<img class="journal-photo-preview-thumb" src="${p.photo}" alt="">` : '';
  document.getElementById('prod-save-btn').textContent = 'Update product';
  document.getElementById('prod-cancel-btn').style.display = '';
  navigateTo('products');
}

function cancelEditProduct() {
  editingProductId = null;
  pendingProductPhoto = null;
  document.getElementById('product-form-title').textContent = '🛍️ Add a product';
  ['prod-name','prod-price','prod-stock','prod-description'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('prod-active').value = '1';
  document.getElementById('prod-photo').value = '';
  document.getElementById('prod-photo-preview').innerHTML = '';
  document.getElementById('prod-save-btn').textContent = '+ Add product';
  document.getElementById('prod-cancel-btn').style.display = 'none';
}

function confirmDeleteProduct(id) {
  const p = products.find(x => x.id === id);
  openConfirmModal('Delete product?', `"${p.name}" will be removed.`, () => {
    products = products.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderProducts();
  });
}

async function renderOrders() {
  const out = document.getElementById('orders-table');
  if (!out) return;
  out.innerHTML = `<div class="empty-state"><span class="glyph">⏳</span>Loading orders…</div>`;

  let list = [];
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    list = Array.isArray(data.orders) ? data.orders : [];
  } catch (err) {
    console.warn('Failed to load orders:', err);
    out.innerHTML = `<div class="empty-state"><span class="glyph">⚠️</span>Could not load orders. Check your connection.</div>`;
    return;
  }

  if (list.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">🧾</span>No orders yet. When customers order from your Shop tab, they'll appear here.</div>`;
    return;
  }

  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Contact</th><th>Items</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(o => `
      <tr>
        <td class="num">#${o.id}</td>
        <td>${o.date}</td>
        <td>${escapeHtml(o.customer_name)}<div style="color:var(--faint);font-size:11px;">${escapeHtml(o.address || '')}</div></td>
        <td>${escapeHtml(o.cellphone || '')}</td>
        <td class="mini-list">${(o.items || []).map(i => `<div>${escapeHtml(i.name)} × ${i.qty}</div>`).join('')}</td>
        <td class="num">${peso(o.total)}</td>
        <td>${o.status === 'fulfilled'
          ? '<span class="tag profit">Fulfilled</span>'
          : o.status === 'cancelled'
            ? '<span class="tag loss">Cancelled</span>'
            : '<span class="tag warning">Pending</span>'}</td>
        <td class="actions-cell">
          ${o.status !== 'fulfilled' ? `<button class="btn-ghost btn-sm" onclick="setOrderStatus(${o.id}, 'fulfilled')">Fulfill</button>` : ''}
          ${o.status !== 'cancelled' ? `<button class="btn-ghost btn-sm" onclick="setOrderStatus(${o.id}, 'cancelled')">Cancel</button>` : ''}
          <button class="btn-danger btn-sm" onclick="confirmDeleteOrder(${o.id})">Delete</button>
        </td>
      </tr>
    `).join('')}</tbody>
  </table></div>`;
}

async function setOrderStatus(id, status) {
  try {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(`✅ Order #${id} marked ${status}`, 'success');
    renderOrders();
  } catch (err) {
    showToast('⚠️ Could not update order: ' + err.message, 'error');
  }
}

function confirmDeleteOrder(id) {
  openConfirmModal('Delete order?', `Order #${id} will be permanently removed.`, async () => {
    try {
      const res = await fetch('/api/orders?id=' + id, { method: 'DELETE' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('🗑️ Order deleted', 'success');
      renderOrders();
    } catch (err) {
      showToast('⚠️ Could not delete order: ' + err.message, 'error');
    }
  });
}

function computePayroll() {
  const from = document.getElementById('pr-from').value;
  const to = document.getElementById('pr-to').value;
  const type = document.getElementById('pr-type').value;
  if (!from || !to) { showToast('⚠️ Pick both dates', 'error'); return; }
  let recs = records.filter(r => r.date >= from && r.date <= to);
  if (type) recs = recs.filter(r => r.plantation_type === type);

  const workerData = {};
  recs.forEach(r => {
    r.workers.forEach(w => {
      if (w.paid) return;
      if (!workerData[w.name]) workerData[w.name] = { unpaidGross: 0 };
      workerData[w.name].unpaidGross += laborCostOf(w);
    });
  });

  const advMap = {};
  computeAdvanceWorkerTotals().forEach(a => { advMap[a.name] = a.outstanding; });
  const rows = Object.entries(workerData).map(([name, d]) => {
    const deduction = Math.min(d.unpaidGross, advMap[name] || 0);
    return { name, unpaidGross: round2(d.unpaidGross), deduction: round2(deduction), net: round2(d.unpaidGross - deduction) };
  }).sort((a, b) => b.unpaidGross - a.unpaidGross);

  payrollPreview = { from, to, type, rows };
  const card = document.getElementById('payroll-preview-card');
  const rl = document.getElementById('payroll-preview-range');
  const out = document.getElementById('payroll-preview-table');
  if (rl) rl.textContent = `(${from} → ${to}${type ? ' · ' + type : ''})`;
  if (rows.length === 0) {
    if (card) card.style.display = '';
    out.innerHTML = `<div class="empty-state">No unpaid labor in this period.</div>`;
    return;
  }
  if (card) card.style.display = '';
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Worker</th><th class="num">Unpaid</th><th class="num">Advance deducted</th><th class="num">Net pay</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${peso(r.unpaidGross)}</td>
      <td class="num">${r.deduction > 0 ? `<span class="tag loss">${peso(r.deduction)}</span>` : peso(0)}</td>
      <td class="num"><strong>${peso(r.net)}</strong></td>
    </tr>`).join('')}</tbody>
  </table></div>
  <div class="totals-strip">
    <div class="t">Total unpaid<b>${peso(rows.reduce((s, r) => s + r.unpaidGross, 0))}</b></div>
    <div class="t">Total deducted<b>${peso(rows.reduce((s, r) => s + r.deduction, 0))}</b></div>
    <div class="t grand">Total net<b>${peso(rows.reduce((s, r) => s + r.net, 0))}</b></div>
  </div>`;
}

function savePayslips() {
  if (!payrollPreview || payrollPreview.rows.length === 0) {
    showToast('⚠️ Compute payroll first', 'error');
    return;
  }
  const { from, to, type, rows } = payrollPreview;
  const issued = todayISO();
  rows.forEach(r => {
    payslips.push({ id: nextPayslipId++, worker: r.name, periodStart: from, periodEnd: to, plantation_type: type || null, gross: r.unpaidGross, deducted: r.deduction, net: r.net, issued_date: issued });
  });
  rows.filter(r => r.deduction > 0).forEach(r => {
    let rem = r.deduction;
    cashAdvances.filter(a => a.name === r.name && !a.repaid).forEach(a => {
      if (rem <= 0) return;
      if (a.amount <= rem) { a.repaid = true; rem -= a.amount; }
    });
  });
  rows.forEach(r => {
    records.forEach(rec => {
      if (rec.date < from || rec.date > to) return;
      if (type && rec.plantation_type !== type) return;
      rec.workers.forEach(w => { if (w.name === r.name && !w.paid) w.paid = true; });
    });
  });
  document.getElementById('payroll-preview-card').style.display = 'none';
  payrollPreview = null;
  scheduleSave();
  showToast(`✅ ${rows.length} payslip(s) saved`, 'success');
  renderPayrollHistory();
  refreshAll();
}

function renderPayrollHistory() {
  const cl = document.getElementById('payslip-history-count-label');
  if (cl) cl.textContent = `(${payslips.length})`;
  const out = document.getElementById('payslip-history-table');
  if (!out) return;
  if (payslips.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">🧾</span>No payslips yet.</div>`;
    return;
  }
  const list = [...payslips].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Worker</th><th>Period</th><th>Plantation</th><th class="num">Net</th><th>Issued</th></tr></thead>
    <tbody>${list.map(p => `<tr>
      <td>${escapeHtml(p.worker)}</td>
      <td>${p.periodStart} → ${p.periodEnd}</td>
      <td>${p.plantation_type ? `<span class="tag">${p.plantation_type}</span>` : 'All'}</td>
      <td class="num"><strong>${peso(p.net)}</strong></td>
      <td>${p.issued_date}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderPlanning() {
  const cl = document.getElementById('planning-count-label');
  if (cl) cl.textContent = `(${planningTasks.length})`;
  const today = todayISO();
  const tbl = document.getElementById('planning-table');
  if (tbl) {
    const list = [...planningTasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
    tbl.innerHTML = list.length === 0
      ? `<div class="empty-state"><span class="glyph">🗓️</span>No tasks yet.</div>`
      : `<div class="table-wrapper"><table>
          <thead><tr><th></th><th>Task</th><th>Plantation</th><th>Due</th><th></th></tr></thead>
          <tbody>${list.map(t => {
            const overdue = !t.done && t.due_date < today;
            return `<tr style="${t.done ? 'opacity:.5;' : ''}">
              <td><input type="checkbox" ${t.done ? 'checked' : ''} onchange="togglePlanningDone(${t.id})"></td>
              <td>${escapeHtml(t.title)} ${overdue ? '<span class="tag loss">Overdue</span>' : ''}</td>
              <td><span class="tag">${t.plantation_type}</span></td>
              <td>${t.due_date}</td>
              <td class="actions-cell"><button class="btn-danger btn-sm" onclick="confirmDeletePlanningTask(${t.id})">Delete</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`;
  }

  const bm = document.getElementById('budget-month-label');
  if (bm) bm.textContent = `(${todayISO().slice(0, 7)})`;
  const bi = document.getElementById('budget-inputs');
  if (bi) {
    bi.innerHTML = PLANTATION_TYPES.map(type => `
      <div class="field"><label for="budget-${type}">${type} — Budget (₱)</label>
        <input type="number" min="0" step="0.01" class="budget-input" id="budget-${type}" data-type="${type}" value="${monthlyBudgets[type] ?? 0}"></div>`).join('');
  }
}

function addPlanningTask() {
  const title = document.getElementById('plan-title').value.trim();
  const type = document.getElementById('plan-type').value;
  const date = document.getElementById('plan-date').value;
  const note = document.getElementById('plan-note').value.trim();
  if (!title) { showToast('⚠️ Enter a task', 'error'); return; }
  if (!date) { showToast('⚠️ Pick a due date', 'error'); return; }
  planningTasks.push({ id: nextPlanningId++, title, plantation_type: type, due_date: date, note, done: false });
  ['plan-title','plan-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  scheduleSave();
  showToast(`✅ Task added`, 'success');
  renderPlanning();
}

function togglePlanningDone(id) {
  const idx = planningTasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  planningTasks[idx].done = !planningTasks[idx].done;
  scheduleSave();
  renderPlanning();
}

function confirmDeletePlanningTask(id) {
  const t = planningTasks.find(x => x.id === id);
  openConfirmModal('Delete task?', `"${t.title}" will be removed.`, () => {
    planningTasks = planningTasks.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderPlanning();
  });
}

function saveBudgets() {
  document.querySelectorAll('.budget-input').forEach(inp => {
    monthlyBudgets[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  scheduleSave();
  showToast('✅ Budgets updated', 'success');
}

function updateLoanPreview() {
  const p = Math.max(0, parseFloat(document.getElementById('loan-principal').value) || 0);
  const r = Math.max(0, parseFloat(document.getElementById('loan-rate').value) || 0);
  const out = document.getElementById('loan-preview');
  if (!out) return;
  if (p <= 0) { out.innerHTML = ''; return; }
  const { interestAmount, totalPayable } = computeLoanTotals({ principal: p, interestRate: r });
  out.innerHTML = `Interest: <b>${peso(interestAmount)}</b> &nbsp;·&nbsp; Total: <b>${peso(totalPayable)}</b>`;
}

function renderLoans() {
  const cl = document.getElementById('loans-count-label');
  if (cl) cl.textContent = `(${lenderLoans.length})`;
  const sum = document.getElementById('loan-lender-summary');
  if (sum) {
    const byLender = {};
    lenderLoans.forEach(l => {
      const { totalPayable } = computeLoanTotals(l);
      if (!byLender[l.lender]) byLender[l.lender] = { totalPayable: 0, outstanding: 0, count: 0 };
      byLender[l.lender].totalPayable += totalPayable;
      byLender[l.lender].outstanding += l.paid ? 0 : totalPayable;
      byLender[l.lender].count += 1;
    });
    const entries = Object.entries(byLender).sort((a, b) => b[1].outstanding - a[1].outstanding);
    sum.innerHTML = entries.length === 0
      ? `<div class="empty-state"><span class="glyph">💳</span>No loans yet.</div>`
      : `<div class="table-wrapper"><table>
          <thead><tr><th>Lender</th><th class="num">Count</th><th class="num">Total payable</th><th class="num">Still owed</th></tr></thead>
          <tbody>${entries.map(([l, t]) => `<tr><td>${escapeHtml(l)}</td><td class="num">${t.count}</td><td class="num">${peso(t.totalPayable)}</td><td class="num">${t.outstanding > 0 ? `<span class="tag loss">${peso(t.outstanding)}</span>` : peso(0)}</td></tr>`).join('')}</tbody>
        </table></div>`;
  }
  const tbl = document.getElementById('loans-table');
  if (!tbl) return;
  if (lenderLoans.length === 0) {
    tbl.innerHTML = `<div class="empty-state"><span class="glyph">💳</span>No loans yet.</div>`;
    return;
  }
  const list = [...lenderLoans].sort((a, b) => b.date.localeCompare(a.date));
  tbl.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Date</th><th>Lender</th><th class="num">Principal</th><th class="num">Rate</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(l => {
      const { totalPayable } = computeLoanTotals(l);
      return `<tr>
        <td>${l.date}</td>
        <td>${escapeHtml(l.lender)}</td>
        <td class="num">${peso(l.principal)}</td>
        <td class="num">${l.interestRate}%</td>
        <td class="num"><strong>${peso(totalPayable)}</strong></td>
        <td>${l.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Outstanding</span>'}</td>
        <td class="actions-cell">
          <button class="btn-ghost btn-sm" onclick="toggleLoanPaid(${l.id})">${l.paid ? 'Mark unpaid' : 'Mark paid'}</button>
          <button class="btn-danger btn-sm" onclick="confirmDeleteLoan(${l.id})">Delete</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function saveLoan() {
  const lender = document.getElementById('loan-lender').value.trim();
  const principal = Math.max(0, parseFloat(document.getElementById('loan-principal').value) || 0);
  const rate = Math.max(0, parseFloat(document.getElementById('loan-rate').value) || 0);
  const date = document.getElementById('loan-date').value || todayISO();
  const type = document.getElementById('loan-type').value;
  const note = document.getElementById('loan-note').value.trim();
  if (!lender) { showToast('⚠️ Enter lender name', 'error'); return; }
  if (principal <= 0) { showToast('⚠️ Enter principal', 'error'); return; }
  lenderLoans.push({ id: nextLoanId++, lender, principal, interestRate: rate, date, plantation_type: type, note, paid: false });
  ['loan-lender','loan-principal','loan-rate','loan-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('loan-preview').innerHTML = '';
  scheduleSave();
  showToast(`✅ Loan from ${lender} recorded`, 'success');
  renderLoans();
}

function toggleLoanPaid(id) {
  const idx = lenderLoans.findIndex(l => l.id === id);
  if (idx === -1) return;
  lenderLoans[idx].paid = !lenderLoans[idx].paid;
  scheduleSave();
  renderLoans();
}

function confirmDeleteLoan(id) {
  const l = lenderLoans.find(x => x.id === id);
  openConfirmModal('Delete loan?', `Loan from ${l.lender} (${peso(l.principal)}) will be removed.`, () => {
    lenderLoans = lenderLoans.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderLoans();
  });
}

function renderCrossLinks(currentType) {
  const idx = PLANTATION_ORDER.findIndex(p => p.type === currentType);
  if (idx === -1) return;
  const prev = idx > 0 ? PLANTATION_ORDER[idx - 1] : null;
  const next = idx < PLANTATION_ORDER.length - 1 ? PLANTATION_ORDER[idx + 1] : null;
  const strip = document.getElementById('plantation-nav-strip');
  if (!strip) return;
  const prevHtml = prev ? `<a class="nav-prev" href="${prev.file}">← ${prev.type}</a>` : `<span class="nav-prev disabled">← Start of list</span>`;
  const nextHtml = next ? `<a class="nav-next" href="${next.file}">${next.type} →</a>` : `<span class="nav-next disabled">End of list →</span>`;
  strip.innerHTML = `${prevHtml}<a class="nav-index" href="index.html">${idx + 1} / ${PLANTATION_ORDER.length}</a>${nextHtml}`;
}

function showPlantationDetail(type) {
  selectedPlantationType = type;
  const ov = plantationPricing[type];
  document.getElementById('pd-in-yield').value = ov ? ov.totalYield : '';
  document.getElementById('pd-in-price').value = ov ? ov.pricePerKg : '';
  document.getElementById('pd-in-current-price').value = ov ? ov.currentPricePerKg : '';
  updatePlantationPricingPreview();
  pendingPlantationPhoto = null;
  pendingPlantationVideoFile = null;
  document.getElementById('pd-photo-file').value = '';
  document.getElementById('pd-video-file').value = '';
  const m = plantationMedia[type];
  document.getElementById('pd-photo-preview').innerHTML = m && m.photo ? `<img class="journal-photo-preview-thumb" src="${m.photo}" alt="">` : '';
  document.getElementById('pd-video-preview').innerHTML = m && m.video ? `<video class="journal-video-preview-thumb" src="${m.video}" controls playsinline preload="metadata"></video>` : '';
  cancelEditSale();
  renderPlantationDetail(type);
  renderPlantationSales(type);
}

function renderPlantationDetail(type) {
  const recs = records.filter(r => r.plantation_type === type).sort((a, b) => a.date.localeCompare(b.date));
  const laborCost = recs.reduce((s, r) => s + r.labor_cost, 0);
  const itemsCost = recs.reduce((s, r) => s + r.items_total, 0);
  const totalExpenditure = round2(laborCost + itemsCost);
  const ov = plantationPricing[type];
  const usingOverride = !!(ov && ov.totalYield > 0);
  const recYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const recIncome = round2(recs.reduce((s, r) => s + (r.revenue || 0), 0));
  let totalYield, pricePerKgDisplay, totalGrossIncome;
  if (usingOverride) {
    totalYield = ov.totalYield;
    pricePerKgDisplay = ov.pricePerKg || 0;
    totalGrossIncome = round2(ov.totalYield * (ov.currentPricePerKg || 0));
  } else {
    totalYield = recYield;
    pricePerKgDisplay = totalYield > 0 ? round2(recIncome / totalYield) : 0;
    totalGrossIncome = recIncome;
  }
  const auto = computeGrossSalesFor(type);
  const net = round2(totalGrossIncome - totalExpenditure);
  const costPerKg = totalYield > 0 ? round2(totalExpenditure / totalYield) : 0;

  document.getElementById('pd-title').innerHTML = `${plantationEmoji(type)} ${escapeHtml(type)} <span class="n">plantation detail</span>`;

  const m = plantationMedia[type];
  const mediaOut = document.getElementById('pd-media-display');
  if (mediaOut) {
    if (m && (m.photo || m.video)) {
      mediaOut.innerHTML = `
        ${m.photo ? `<img class="journal-photo" src="${m.photo}" alt="">` : ''}
        ${m.video ? `<video class="journal-video-native" src="${m.video}" controls playsinline preload="metadata"></video>` : ''}
        ${m.video ? `<div class="offline-video-badge">📴 Plays offline — saved on this device</div>` : ''}
        <div style="font-size:10.5px;color:var(--faint);margin-bottom:10px;">Updated ${m.updated_at}</div>
      `;
    } else {
      mediaOut.innerHTML = '';
    }
  }

  document.getElementById('pd-stats').innerHTML = `
    <div class="stat-card good"><div class="label">Total Yield</div><div class="value">${totalYield} kg</div>${costPerKg > 0 ? `<div class="sub">cost/kg: ${peso(costPerKg)}</div>` : ''}</div>
    <div class="stat-card"><div class="label">Price per kg</div><div class="value">${peso(pricePerKgDisplay)}</div></div>
    <div class="stat-card accent"><div class="label">Total Expenditure</div><div class="value">${peso(totalExpenditure)}</div><div class="sub">labor ${peso(laborCost)} + items ${peso(itemsCost)}</div></div>
    <div class="stat-card ${net >= 0 ? 'good' : 'bad'}"><div class="label">Gross Income</div><div class="value">${peso(totalGrossIncome)}</div></div>
  `;

  document.getElementById('pd-formula').innerHTML =
    `Net Income = ${peso(totalGrossIncome)} − ${peso(totalExpenditure)} = <b class="${net < 0 ? 'neg' : ''}">${peso(net)}</b>` +
    ` &nbsp;·&nbsp; Gross Sales (auto): <b>${peso(auto)}</b> <span style="color:var(--faint)">(${grossSalesSourceLabelFor(type)})</span>`;

  const itemRows = recs.flatMap(r => r.items.map(i => ({ ...i, date: r.date, record_id: r.id })));
  const itemsOut = document.getElementById('pd-items-table');
  document.getElementById('pd-items-count-label').textContent = `(${itemRows.length})`;
  itemsOut.innerHTML = itemRows.length === 0
    ? `<div class="empty-state">No items purchased yet.</div>`
    : `<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Cost</th></tr></thead><tbody>${itemRows.map(i => `<tr><td>${i.date}</td><td>${escapeHtml(i.name)}</td><td class="num">${i.quantity}</td><td>${i.unit}</td><td class="num">${peso(i.cost)}</td></tr>`).join('')}</tbody></table></div>`;

  const recOut = document.getElementById('pd-records-table');
  document.getElementById('pd-records-count-label').textContent = `(${recs.length})`;
  recOut.innerHTML = recs.length === 0
    ? `<div class="empty-state">No records yet.</div>`
    : `<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Date</th><th>Yield</th><th class="num">Income</th><th class="num">Workers</th><th class="num">Total</th></tr></thead><tbody>${[...recs].sort((a,b) => b.date.localeCompare(a.date)).map(r => `<tr><td class="num">#${r.id}</td><td>${r.date}</td><td>${r.yield_kg ? r.yield_kg + ' kg' : '—'}</td><td class="num">${r.revenue ? peso(r.revenue) : '—'}</td><td class="num">${r.workers.length}</td><td class="num">${peso(r.total_expenditure)}</td></tr>`).join('')}</tbody></table></div>`;

  const byMonth = {};
  recs.forEach(r => {
    const mm = r.date.slice(0, 7);
    if (!byMonth[mm]) byMonth[mm] = { expenditure: 0, income: 0 };
    byMonth[mm].expenditure += r.total_expenditure;
    byMonth[mm].income += (r.revenue || 0);
  });
  const months = Object.keys(byMonth).sort();
  const rl = document.getElementById('pd-chart-range-label');
  if (rl) rl.textContent = months.length ? `${months[0]} → ${months[months.length - 1]}` : 'no activity yet';
  const c = document.getElementById('pdChart');
  if (c) {
    destroyChart('pd');
    if (months.length > 0) {
      chartInstances.pd = new Chart(c.getContext('2d'), {
        data: {
          labels: months,
          datasets: [
            { type: 'bar', label: 'Expenditure', data: months.map(m => byMonth[m].expenditure), backgroundColor: 'rgba(226,104,95,0.55)', borderColor: '#e2685f', borderWidth: 1 },
            { type: 'line', label: 'Net Income', data: months.map(m => round2(byMonth[m].income - byMonth[m].expenditure)), borderColor: '#4caf82', backgroundColor: 'rgba(76,175,130,0.15)', borderWidth: 2, tension: 0.3, pointRadius: 3, fill: true }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e9edf5' } } }, scales: { y: { ticks: { color: '#8991ab', callback: v => '₱' + v } }, x: { ticks: { color: '#8991ab', font: { size: 9 } } } } }
      });
    }
  }
}

function renderPlantationSales(type) {
  const sales = plantationSales.filter(s => s.plantation_type === type).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const totalSales = round2(sales.reduce((s, x) => s + x.total, 0));
  const totalQty = round2(sales.reduce((s, x) => s + x.quantity, 0));
  const cnt = document.getElementById('pd-sales-count-label');
  if (cnt) cnt.textContent = `(${sales.length})`;
  const strip = document.getElementById('sale-totals-strip');
  if (strip) strip.innerHTML = `
    <div class="t">Sales<b>${sales.length}</b></div>
    <div class="t">Total qty<b>${totalQty} kg</b></div>
    <div class="t grand">Total Sales<b>${peso(totalSales)}</b></div>`;
  const out = document.getElementById('pd-sales-table');
  if (!out) return;
  out.innerHTML = sales.length === 0
    ? `<div class="empty-state"><span class="glyph">🛒</span>No sales yet.</div>`
    : `<div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Customer</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${sales.map(s => `<tr>
          <td>${s.date}</td>
          <td>${escapeHtml(s.customer_name)}</td>
          <td class="num">${s.quantity} kg</td>
          <td class="num">${peso(s.price_per_unit)}</td>
          <td class="num"><strong>${peso(s.total)}</strong></td>
          <td class="actions-cell">
            <button class="btn-ghost btn-sm" onclick="editSale(${s.id})">Edit</button>
            <button class="btn-danger btn-sm" onclick="confirmDeleteSale(${s.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`;
}

function updateSalePreview() {
  const q = Math.max(0, parseFloat(document.getElementById('sale-quantity').value) || 0);
  const p = Math.max(0, parseFloat(document.getElementById('sale-price').value) || 0);
  const out = document.getElementById('sale-preview');
  if (!out) return;
  if (q <= 0 || p <= 0) { out.innerHTML = ''; return; }
  out.innerHTML = `Total = ${q} kg × ${peso(p)} = <b>${peso(round2(q * p))}</b>`;
}

function saveSale() {
  const customer = document.getElementById('sale-customer').value.trim();
  const location = document.getElementById('sale-location').value.trim();
  const cellphone = document.getElementById('sale-cellphone').value.trim();
  const quantity = Math.max(0, parseFloat(document.getElementById('sale-quantity').value) || 0);
  const price = Math.max(0, parseFloat(document.getElementById('sale-price').value) || 0);
  const date = document.getElementById('sale-date').value || todayISO();
  if (!customer) { showToast('⚠️ Enter customer name', 'error'); return; }
  if (quantity <= 0) { showToast('⚠️ Enter quantity', 'error'); return; }
  if (price <= 0) { showToast('⚠️ Enter price', 'error'); return; }
  const total = round2(quantity * price);
  if (editingSaleId) {
    const idx = plantationSales.findIndex(s => s.id === editingSaleId);
    if (idx !== -1) plantationSales[idx] = { ...plantationSales[idx], customer_name: customer, location, cellphone, quantity, price_per_unit: price, total, date };
    showToast(`✅ Sale updated`, 'success');
  } else {
    plantationSales.push({ id: nextSaleId++, plantation_type: selectedPlantationType, customer_name: customer, location, cellphone, quantity, price_per_unit: price, total, date });
    showToast(`✅ Sale recorded — ${peso(total)}`, 'success');
  }
  cancelEditSale();
  scheduleSave();
  renderPlantationSales(selectedPlantationType);
  renderPlantationDetail(selectedPlantationType);
}

function editSale(id) {
  const s = plantationSales.find(x => x.id === id);
  if (!s) return;
  editingSaleId = id;
  document.getElementById('sale-customer').value = s.customer_name;
  document.getElementById('sale-location').value = s.location || '';
  document.getElementById('sale-cellphone').value = s.cellphone || '';
  document.getElementById('sale-quantity').value = s.quantity;
  document.getElementById('sale-price').value = s.price_per_unit;
  document.getElementById('sale-date').value = s.date;
  updateSalePreview();
  document.getElementById('sale-save-btn').textContent = 'Update sale';
  document.getElementById('sale-cancel-btn').style.display = '';
}

function cancelEditSale() {
  editingSaleId = null;
  ['sale-customer','sale-location','sale-cellphone','sale-quantity','sale-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sale-date').value = todayISO();
  document.getElementById('sale-preview').innerHTML = '';
  document.getElementById('sale-save-btn').textContent = '+ Record sale';
  document.getElementById('sale-cancel-btn').style.display = 'none';
}

function confirmDeleteSale(id) {
  const s = plantationSales.find(x => x.id === id);
  openConfirmModal('Delete sale?', `${s.quantity} kg to ${s.customer_name} (${peso(s.total)}) will be removed.`, () => {
    plantationSales = plantationSales.filter(x => x.id !== id);
    scheduleSave();
    showToast('🗑️ Deleted', 'success');
    renderPlantationSales(selectedPlantationType);
    renderPlantationDetail(selectedPlantationType);
  });
}

function updatePlantationPricingPreview() {
  const y = Math.max(0, parseFloat(document.getElementById('pd-in-yield').value) || 0);
  const cp = Math.max(0, parseFloat(document.getElementById('pd-in-current-price').value) || 0);
  const out = document.getElementById('pd-pricing-preview');
  if (!out) return;
  if (y <= 0) { out.innerHTML = ''; return; }
  out.innerHTML = `Gross Income = ${y} kg × ${peso(cp)} = <b>${peso(round2(y * cp))}</b>`;
}

function savePlantationPricingOverride() {
  const y = Math.max(0, parseFloat(document.getElementById('pd-in-yield').value) || 0);
  const p = Math.max(0, parseFloat(document.getElementById('pd-in-price').value) || 0);
  const cp = Math.max(0, parseFloat(document.getElementById('pd-in-current-price').value) || 0);
  if (y <= 0) { showToast('⚠️ Enter Total Yield', 'error'); return; }
  plantationPricing[selectedPlantationType] = { totalYield: y, pricePerKg: p, currentPricePerKg: cp };
  scheduleSave();
  showToast(`✅ Saved`, 'success');
  renderPlantationDetail(selectedPlantationType);
}

function clearPlantationPricingOverride() {
  delete plantationPricing[selectedPlantationType];
  ['pd-in-yield','pd-in-price','pd-in-current-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('pd-pricing-preview').innerHTML = '';
  scheduleSave();
  showToast('↩️ Cleared', 'success');
  renderPlantationDetail(selectedPlantationType);
}

async function savePlantationMedia() {
  const existing = plantationMedia[selectedPlantationType] || {};
  const photo = pendingPlantationPhoto !== null ? pendingPlantationPhoto : (existing.photo || null);
  let video = existing.video || null;
  if (pendingPlantationVideoFile) {
    setLoading(true);
    try {
      showToast('⬆️ Uploading video…', 'info', 4000);
      const old = video;
      video = await uploadToBlob(pendingPlantationVideoFile, 'plantation');
      if (old) await deleteBlob(old);
    } catch (e) {
      console.error(e);
      showToast('⚠️ Video upload failed: ' + e.message, 'error', 5000);
      setLoading(false);
      return;
    }
    setLoading(false);
  }
  if (!photo && !video) { showToast('⚠️ Choose a photo or video', 'error'); return; }
  plantationMedia[selectedPlantationType] = { photo, video, updated_at: todayISO() };
  scheduleSave();
  showToast('✅ Saved', 'success');
  pendingPlantationPhoto = null;
  pendingPlantationVideoFile = null;
  document.getElementById('pd-photo-file').value = '';
  document.getElementById('pd-video-file').value = '';
  document.getElementById('pd-photo-preview').innerHTML = '';
  document.getElementById('pd-video-preview').innerHTML = '';
  renderPlantationDetail(selectedPlantationType);
}

async function clearPlantationMedia() {
  const m = plantationMedia[selectedPlantationType];
  if (m && m.video) await deleteBlob(m.video);
  delete plantationMedia[selectedPlantationType];
  pendingPlantationPhoto = null;
  pendingPlantationVideoFile = null;
  document.getElementById('pd-photo-file').value = '';
  document.getElementById('pd-video-file').value = '';
  document.getElementById('pd-photo-preview').innerHTML = '';
  document.getElementById('pd-video-preview').innerHTML = '';
  scheduleSave();
  showToast('🗑️ Removed', 'success');
  renderPlantationDetail(selectedPlantationType);
}

function renderActivities() {
  const cl = document.getElementById('activity-count-label');
  if (cl) cl.textContent = `(${activityRecords.length})`;
  const out = document.getElementById('activity-records');
  if (!out) return;
  if (activityRecords.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">📅</span>No diary entries yet.</div>`;
    return;
  }
  const list = [...activityRecords].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = list.map(a => `
    <div style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px dashed var(--border);">
      <h3 style="margin-bottom:6px;">${a.date}${a.plantation_type ? ` <span class="tag">${a.plantation_type}</span>` : ''}</h3>
      ${a.image ? `<img class="journal-photo" src="${a.image}" alt="">` : ''}
      ${a.video ? `<video class="journal-video-native" src="${a.video}" controls playsinline preload="metadata"></video>` : ''}
      ${a.video ? `<div class="offline-video-badge">📴 Plays offline — stored on Blob</div>` : ''}
      ${a.youtube_url ? youtubeEmbedHtml(a.youtube_url) : ''}
      <p>${escapeHtml(a.description).replace(/\n/g, '<br>')}</p>
      <div class="btn-row" style="margin-top:0;">
        <button class="btn-ghost btn-sm" onclick="editActivity(${a.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteActivity(${a.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function youtubeEmbedHtml(url) {
  const id = extractYouTubeId(url);
  return id ? `<div class="journal-video-wrap"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen loading="lazy"></iframe></div>` : '';
}

async function saveActivity() {
  const date = document.getElementById('activity-date').value || todayISO();
  const description = document.getElementById('activity-description').value.trim();
  const plantation = document.getElementById('activity-plantation').value;
  const yt = document.getElementById('activity-youtube').value.trim();
  if (!description) { showToast('⚠️ Write an entry', 'error'); return; }
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }

  const existing = editingActivityId ? activityRecords.find(a => a.id === editingActivityId) : null;
  let video = existing ? existing.video : null;
  if (pendingActivityVideoFile) {
    setLoading(true);
    try {
      showToast('⬆️ Uploading video…', 'info', 4000);
      const old = video;
      video = await uploadToBlob(pendingActivityVideoFile, 'journal');
      if (old) await deleteBlob(old);
    } catch (e) {
      console.error(e);
      showToast('⚠️ Video upload failed: ' + e.message, 'error', 5000);
      setLoading(false);
      return;
    }
    setLoading(false);
  }
  const image = pendingActivityPhoto !== null ? pendingActivityPhoto : (existing ? existing.image : null);

  const entry = { id: editingActivityId || nextActivityId++, date, description, plantation_type: plantation, image, video, youtube_url: yt || null };
  if (editingActivityId) {
    const idx = activityRecords.findIndex(a => a.id === editingActivityId);
    if (idx !== -1) activityRecords[idx] = { ...activityRecords[idx], ...entry };
  } else {
    activityRecords.push(entry);
  }
  clearActivityForm();
  scheduleSave();
  showToast(`✅ Diary entry saved`, 'success');
  renderActivities();
}

function editActivity(id) {
  const a = activityRecords.find(x => x.id === id);
  if (!a) return;
  editingActivityId = id;
  document.getElementById('activity-date').value = a.date;
  document.getElementById('activity-plantation').value = a.plantation_type || '';
  document.getElementById('activity-description').value = a.description;
  document.getElementById('activity-youtube').value = a.youtube_url || '';
  pendingActivityPhoto = null;
  pendingActivityVideoFile = null;
  document.getElementById('activity-photo').value = '';
  document.getElementById('activity-photo-preview').innerHTML = a.image ? `<img class="journal-photo-preview-thumb" src="${a.image}" alt="">` : '';
  document.getElementById('activity-video-file').value = '';
  document.getElementById('activity-video-file-preview').innerHTML = a.video ? `<video class="journal-video-preview-thumb" src="${a.video}" controls playsinline preload="metadata"></video>` : '';
  document.getElementById('activity-save-btn').textContent = 'Update entry';
  document.getElementById('activity-cancel-btn').style.display = '';
  navigateTo('activities');
}

function clearActivityForm() {
  editingActivityId = null;
  pendingActivityPhoto = null;
  pendingActivityVideoFile = null;
  ['activity-description','activity-youtube'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('activity-photo').value = '';
  document.getElementById('activity-photo-preview').innerHTML = '';
  document.getElementById('activity-video-file').value = '';
  document.getElementById('activity-video-file-preview').innerHTML = '';
  document.getElementById('activity-save-btn').textContent = 'Save entry';
  document.getElementById('activity-cancel-btn').style.display = 'none';
}

async function deleteActivity(id) {
  const a = activityRecords.find(x => x.id === id);
  if (!a) return;
  if (!confirm('Delete this diary entry?')) return;
  activityRecords = activityRecords.filter(x => x.id !== id);
  if (editingActivityId === id) clearActivityForm();
  if (a.video) await deleteBlob(a.video);
  scheduleSave();
  showToast('🗑️ Deleted', 'success');
  renderActivities();
}

function populateQuickDates() {
  const dates = [...new Set(records.map(r => r.date))].sort();
  const sel = document.getElementById('d-quick');
  if (!sel) return;
  sel.innerHTML = `<option value="">Jump to a recorded date…</option>` + dates.map(d => `<option value="${d}">${d} (${records.filter(r => r.date === d).length})</option>`).join('');
}

function pickQuickDate() {
  const v = document.getElementById('d-quick').value;
  if (v) { document.getElementById('d-date').value = v; renderDateSummary(); }
}

function renderDateSummary() {
  const date = document.getElementById('d-date').value;
  const out = document.getElementById('date-summary-out');
  if (!out) return;
  if (!date) { out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">📅</span>Pick a date.</div></div>`; return; }
  const recs = records.filter(r => r.date === date);
  const acts = activityRecords.filter(a => a.date === date);
  if (recs.length === 0 && acts.length === 0) {
    out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">📭</span>Nothing for ${date}.</div></div>`;
    return;
  }
  const laborTotal = recs.reduce((s, r) => s + r.labor_cost, 0);
  const itemsTotal = recs.reduce((s, r) => s + r.items_total, 0);
  const grand = laborTotal + itemsTotal;
  const totalYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const totalRevenue = recs.reduce((s, r) => s + (r.revenue || 0), 0);
  out.innerHTML = `
    <div class="card"><h2>Summary for ${date}</h2>
      <div class="grid cols-4">
        <div class="stat-card"><div class="label">Records</div><div class="value">${recs.length}</div></div>
        <div class="stat-card"><div class="label">Diary</div><div class="value">${acts.length}</div></div>
        <div class="stat-card"><div class="label">Labor</div><div class="value">${peso(laborTotal)}</div></div>
        <div class="stat-card accent"><div class="label">Total</div><div class="value">${peso(grand)}</div></div>
        ${totalYield > 0 ? `<div class="stat-card good"><div class="label">Yield</div><div class="value">${totalYield} kg</div></div>` : ''}
        ${totalRevenue > 0 ? `<div class="stat-card good"><div class="label">Revenue</div><div class="value">${peso(totalRevenue)}</div></div>` : ''}
      </div>
    </div>
    ${acts.length > 0 ? `<div class="card essay"><h2>Diary</h2>${acts.map(a => `<h3>${a.date}</h3><p>${escapeHtml(a.description).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
  `;
}

function populateQuickWorkers() {
  const names = [...new Set(records.flatMap(r => r.workers.map(w => w.name)))].sort();
  const sel = document.getElementById('w-quick');
  if (!sel) return;
  sel.innerHTML = `<option value="">Jump to a worker…</option>` + names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
}

function pickQuickWorker() {
  const v = document.getElementById('w-quick').value;
  if (v) { document.getElementById('w-name').value = v; renderWorkerHistory(); }
}

function renderWorkerHistory() {
  const q = (document.getElementById('w-name').value || '').trim().toLowerCase();
  const out = document.getElementById('worker-history-out');
  if (!out) return;
  if (!q) { out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">👷</span>Enter a worker name.</div></div>`; return; }
  const entries = [];
  records.forEach(r => r.workers.forEach((w, wi) => {
    if (w.name.toLowerCase().includes(q)) {
      entries.push({ date: r.date, record_id: r.id, name: w.name, job: w.job_description, full: w.full_days, wage: w.daily_wage, cost: laborCostOf(w), paid: !!w.paid });
    }
  }));
  if (entries.length === 0) { out.innerHTML = `<div class="card"><div class="empty-state">No records found.</div></div>`; return; }
  const totalLabor = entries.reduce((s, e) => s + e.cost, 0);
  const totalPaid = entries.filter(e => e.paid).reduce((s, e) => s + e.cost, 0);
  const totalUnpaid = totalLabor - totalPaid;
  out.innerHTML = `
    <div class="card"><h2>${escapeHtml(entries[0].name)} — history</h2>
      <div class="grid cols-4">
        <div class="stat-card"><div class="label">Dates</div><div class="value">${new Set(entries.map(e => e.date)).size}</div></div>
        <div class="stat-card"><div class="label">Full days</div><div class="value">${entries.reduce((s, e) => s + e.full, 0)}</div></div>
        <div class="stat-card good"><div class="label">Paid</div><div class="value">${peso(totalPaid)}</div></div>
        <div class="stat-card bad"><div class="label">Outstanding</div><div class="value">${peso(totalUnpaid)}</div></div>
      </div>
    </div>
    <div class="card"><h2>Details</h2>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Job</th><th class="num">Days</th><th class="num">Cost</th><th>Status</th></tr></thead>
        <tbody>${entries.map(e => `<tr><td>${e.date}</td><td>${escapeHtml(e.job)}</td><td class="num">${e.full}</td><td class="num">${peso(e.cost)}</td><td>${e.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Unpaid</span>'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

function renderReports() {
  const ns = document.getElementById('net-sales-inputs');
  if (ns) {
    ns.innerHTML = PLANTATION_TYPES.map(type => {
      const auto = computeGrossSalesFor(type);
      const net = netSalesFor(type);
      return `<div class="field">
        <label for="ns-${type}">${type} — Manual fallback Gross Sales</label>
        <input type="number" min="0" step="0.01" class="ns-input" id="ns-${type}" data-type="${type}" value="${grossSales[type] ?? 0}">
        <div class="net-sales-readout">Using: <b>${peso(auto)}</b> (${grossSalesSourceLabelFor(type)}) · Net: <b class="${net < 0 ? 'neg' : ''}">${peso(net)}</b></div>
      </div>`;
    }).join('');
  }

  const pt = document.getElementById('plantation-totals');
  if (pt) {
    const today = todayISO();
    pt.innerHTML = PLANTATION_TYPES.map(type => {
      const recs = records.filter(r => r.plantation_type === type);
      const total = recs.reduce((s, r) => s + r.total_expenditure, 0);
      const gross = computeGrossSalesFor(type);
      const net = netSalesFor(type);
      const totalYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
      const dates = recs.map(r => r.date).sort();
      const range = dates.length ? `${dates[0]} → ${today}` : `No records yet`;
      return `<div class="plantation-total-card">
        <div class="p-name">${type}</div>
        <div class="p-total">${peso(total)}</div>
        <div class="p-meta">${recs.length} records · ${totalYield} kg</div>
        <div class="p-range">${range}</div>
        <div class="p-profit ${net >= 0 ? 'pos' : 'neg'}">Gross ${peso(gross)} − Exp ${peso(total)} = <strong>${peso(net)}</strong></div>
      </div>`;
    }).join('');
  }

  const sc = document.getElementById('stat-cards');
  if (sc) {
    const total = records.reduce((s, r) => s + r.total_expenditure, 0);
    const totalLabor = records.reduce((s, r) => s + r.labor_cost, 0);
    const totalItems = records.reduce((s, r) => s + r.items_total, 0);
    const totalGross = PLANTATION_TYPES.reduce((s, t) => s + computeGrossSalesFor(t), 0);
    const totalNet = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
    const totalYield = records.reduce((s, r) => s + (r.yield_kg || 0), 0);
    sc.innerHTML = `
      <div class="stat-card"><div class="label">Records</div><div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">Labor</div><div class="value">${peso(totalLabor)}</div></div>
      <div class="stat-card"><div class="label">Items</div><div class="value">${peso(totalItems)}</div></div>
      <div class="stat-card accent"><div class="label">Expenditure</div><div class="value">${peso(total)}</div></div>
      <div class="stat-card"><div class="label">Gross Sales</div><div class="value">${peso(totalGross)}</div></div>
      <div class="stat-card ${totalNet >= 0 ? 'good' : 'bad'}"><div class="label">Net Sales</div><div class="value">${peso(totalNet)}</div></div>
      <div class="stat-card"><div class="label">Yield</div><div class="value">${totalYield} kg</div></div>
    `;
  }

  const bt = document.getElementById('report-by-type');
  if (bt) {
    const m = {};
    records.forEach(r => { m[r.plantation_type] = (m[r.plantation_type] || 0) + r.total_expenditure; });
    bt.innerHTML = barRows(m, 0);
  }
  const bm = document.getElementById('report-by-month');
  if (bm) {
    const m = {};
    records.forEach(r => { const k = r.date.slice(0, 7); m[k] = (m[k] || 0) + r.total_expenditure; });
    bm.innerHTML = barRows(m, 0, true);
  }
  const tw = document.getElementById('report-top-workers');
  if (tw) {
    const w = {};
    records.forEach(r => r.workers.forEach(x => { w[x.name] = (w[x.name] || 0) + laborCostOf(x); }));
    tw.innerHTML = barRows(w, 0);
  }
  const ti = document.getElementById('report-top-items');
  if (ti) {
    const t = {};
    records.forEach(r => r.items.forEach(i => { t[i.name] = (t[i.name] || 0) + i.cost; }));
    ti.innerHTML = barRows(t, 0);
  }

  renderCharts();
  renderYieldRevenueChart();
}

function saveNetSales() {
  document.querySelectorAll('.ns-input').forEach(inp => {
    grossSales[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  scheduleSave();
  showToast('✅ Saved', 'success');
  renderReports();
}

function downloadCSV(rows, filename) {
  const csv = rows.map(row => row.map(c => {
    const s = String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (records.length === 0) { showToast('📭 No records', 'error'); return; }
  const rows = [["ID","Date","Plantation","Worker","Job","Days","Wage","Paid","Labor","Items Total","Total Expenditure","Yield","Revenue"]];
  records.forEach(r => {
    if (r.workers.length) {
      r.workers.forEach(w => rows.push([r.id, r.date, r.plantation_type, w.name, w.job_description, w.full_days, w.daily_wage, w.paid ? 'Paid' : 'Unpaid', round2(laborCostOf(w)), r.items_total, r.total_expenditure, r.yield_kg || 0, r.revenue || 0]));
    } else {
      rows.push([r.id, r.date, r.plantation_type, '', '', 0, r.daily_wage, '', 0, r.items_total, r.total_expenditure, r.yield_kg || 0, r.revenue || 0]);
    }
  });
  downloadCSV(rows, 'business_export.csv');
  showToast('✅ CSV exported', 'success');
}

function exportPersonalCSV() {
  if (personalRecords.length === 0) { showToast('📭 No personal', 'error'); return; }
  const rows = [["ID","Date","Item","Qty","Unit","Price","Cost"]];
  personalRecords.forEach(r => r.items.forEach(i => rows.push([r.id, r.date, i.name, i.quantity, i.unit, i.price_per_unit, i.cost])));
  downloadCSV(rows, 'personal_export.csv');
  showToast('✅ CSV exported', 'success');
}

function exportBackup() {
  const data = { version: 3, exported: new Date().toISOString(), ...collectState() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valley-creeks-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Backup downloaded', 'success');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      applyState(data);
      scheduleSave();
      refreshAll();
      showToast('✅ Backup restored', 'success');
    } catch (err) {
      showToast('⚠️ Invalid backup: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function exportPDFReport() {
  if (typeof window.jspdf === 'undefined') { showToast('⚠️ PDF library loading', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Valley and Creeks Farm — P&L Report', 14, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Generated ${todayISO()}`, 14, y); y += 10;
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const totalGross = PLANTATION_TYPES.reduce((s, t) => s + computeGrossSalesFor(t), 0);
  const totalNet = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
  doc.setFont('helvetica', 'bold'); doc.text('Overview', 14, y); y += 6;
  doc.setFont('helvetica', 'normal');
  [`Business expenditure: ${peso(total)}`, `Total Gross Sales: ${peso(totalGross)}`, `Total Net Sales: ${peso(totalNet)}`].forEach(l => { doc.text(l, 14, y); y += 6; });
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.text('By plantation', 14, y); y += 6;
  doc.setFont('helvetica', 'normal');
  PLANTATION_TYPES.forEach(type => {
    const spent = expenditureFor(type);
    const gross = computeGrossSalesFor(type);
    if (spent === 0 && gross === 0) return;
    doc.text(`${type}: ${peso(spent)} spent · ${peso(gross)} gross · ${peso(netSalesFor(type))} net`, 14, y);
    y += 6;
    if (y > 270) { doc.addPage(); y = 16; }
  });
  doc.save(`valley-creeks-report-${todayISO()}.pdf`);
  showToast('✅ PDF exported', 'success');
}

const WEATHER_CODE_MAP = {
  0: ['☀️','Clear'], 1: ['🌤️','Mostly clear'], 2: ['⛅','Partly cloudy'], 3: ['☁️','Overcast'],
  45: ['🌫️','Fog'], 48: ['🌫️','Rime fog'],
  51: ['🌦️','Light drizzle'], 53: ['🌦️','Drizzle'], 55: ['🌧️','Dense drizzle'],
  61: ['🌦️','Light rain'], 63: ['🌧️','Rain'], 65: ['🌧️','Heavy rain'],
  71: ['🌨️','Light snow'], 73: ['🌨️','Snow'], 75: ['❄️','Heavy snow'],
  80: ['🌦️','Showers'], 81: ['🌧️','Showers'], 82: ['⛈️','Violent showers'],
  95: ['⛈️','Thunderstorm'], 96: ['⛈️','T-storm + hail'], 99: ['⛈️','Severe t-storm']
};
function weatherCodeInfo(c) { return WEATHER_CODE_MAP[c] || ['🌡️','Unknown']; }

function useMyLocationForWeather() {
  if (!navigator.geolocation) { showToast('⚠️ Location unavailable', 'error'); return; }
  showToast('📍 Getting location…', 'info');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    document.getElementById('wx-lat').value = pos.coords.latitude.toFixed(4);
    document.getElementById('wx-lon').value = pos.coords.longitude.toFixed(4);
    await saveWeatherLocation();
  }, (err) => showToast('⚠️ ' + err.message, 'error'), { timeout: 10000 });
}

async function saveWeatherLocation() {
  const lat = parseFloat(document.getElementById('wx-lat').value);
  const lon = parseFloat(document.getElementById('wx-lon').value);
  if (isNaN(lat) || isNaN(lon)) { showToast('⚠️ Enter valid coordinates', 'error'); return; }
  weatherLocation = { lat, lon };
  localStorage.setItem('vc-weather-loc', JSON.stringify(weatherLocation));
  await fetchWeather();
}

async function fetchWeather() {
  if (!weatherLocation || !navigator.onLine) { renderWeather(); return; }
  try {
    const { lat, lon } = weatherLocation;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    weatherCache = { data: await res.json(), fetched_at: new Date().toISOString() };
    localStorage.setItem('vc-weather-cache', JSON.stringify(weatherCache));
  } catch (e) { console.warn('Weather fetch failed:', e); }
  renderWeather();
}

function renderWeather() {
  const out = document.getElementById('weather-out');
  const label = document.getElementById('weather-updated-label');
  if (!out) return;
  if (!weatherLocation) {
    if (label) label.textContent = '';
    out.innerHTML = `<div class="empty-state"><span class="glyph">📍</span>Set coordinates or tap "Use my location".</div>`;
    return;
  }
  if (!weatherCache || !weatherCache.data) {
    if (label) label.textContent = '';
    out.innerHTML = `<div class="empty-state"><span class="glyph">🌡️</span>Fetching…</div>`;
    return;
  }
  const stale = !navigator.onLine;
  if (label) label.textContent = stale ? `offline — cached` : `updated ${new Date(weatherCache.fetched_at).toLocaleString()}`;
  const cur = weatherCache.data.current;
  const daily = weatherCache.data.daily;
  const [em, dsc] = weatherCodeInfo(cur.weather_code);
  let html = `<div class="plantation-total-card" style="margin-bottom:14px;">
    <div class="p-name">Current</div>
    <div class="p-total">${em} ${Math.round(cur.temperature_2m)}°C</div>
    <div class="p-meta">${dsc} · ${cur.relative_humidity_2m}% · ${Math.round(cur.wind_speed_10m)} km/h</div>
  </div><div class="grid cols-4">`;
  for (let i = 0; i < daily.time.length; i++) {
    const [e, d] = weatherCodeInfo(daily.weather_code[i]);
    const day = i === 0 ? 'Today' : new Date(daily.time[i]).toLocaleDateString(undefined, { weekday: 'short' });
    html += `<div class="stat-card"><div class="label">${day}</div><div class="value" style="font-size:22px;">${e}</div><div class="sub">${d}</div><div class="sub">${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°C</div><div class="sub">💧 ${daily.precipitation_probability_max[i]}%</div></div>`;
  }
  html += `</div>`;
  out.innerHTML = html;
}

function wirePlantationFileInputs() {
  const photoInput = document.getElementById('pd-photo-file');
  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const f = photoInput.files && photoInput.files[0];
      const preview = document.getElementById('pd-photo-preview');
      if (!f) { pendingPlantationPhoto = null; if (preview) preview.innerHTML = ''; return; }
      if (!f.type.startsWith('image/')) { showToast('⚠️ Choose an image', 'error'); photoInput.value = ''; return; }
      const r = new FileReader();
      r.onload = (e) => {
        pendingPlantationPhoto = e.target.result;
        if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingPlantationPhoto}" alt="">`;
      };
      r.readAsDataURL(f);
    });
  }
  const videoInput = document.getElementById('pd-video-file');
  if (videoInput) {
    videoInput.addEventListener('change', () => {
      const f = videoInput.files && videoInput.files[0];
      const preview = document.getElementById('pd-video-preview');
      if (!f) { pendingPlantationVideoFile = null; if (preview) preview.innerHTML = ''; return; }
      if (!f.type.startsWith('video/')) { showToast('⚠️ Choose a video', 'error'); videoInput.value = ''; return; }
      if (f.size > MAX_VIDEO_BYTES) { showToast(`⚠️ File too large (max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024 / 1024)}GB)`, 'error'); videoInput.value = ''; return; }
      pendingPlantationVideoFile = f;
      if (preview) {
        const url = URL.createObjectURL(f);
        preview.innerHTML = `<video class="journal-video-preview-thumb" src="${url}" controls playsinline preload="metadata"></video>`;
      }
    });
  }
}

function wireActivityFileInputs() {
  const photoInput = document.getElementById('activity-photo');
  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const f = photoInput.files && photoInput.files[0];
      const preview = document.getElementById('activity-photo-preview');
      if (!f) { pendingActivityPhoto = null; if (preview) preview.innerHTML = ''; return; }
      const r = new FileReader();
      r.onload = (e) => { pendingActivityPhoto = e.target.result; if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingActivityPhoto}" alt="">`; };
      r.readAsDataURL(f);
    });
  }
  const videoInput = document.getElementById('activity-video-file');
  if (videoInput) {
    videoInput.addEventListener('change', () => {
      const f = videoInput.files && videoInput.files[0];
      const preview = document.getElementById('activity-video-file-preview');
      if (!f) { pendingActivityVideoFile = null; if (preview) preview.innerHTML = ''; return; }
      if (f.size > MAX_VIDEO_BYTES) { showToast(`⚠️ File too large`, 'error'); videoInput.value = ''; return; }
      pendingActivityVideoFile = f;
      if (preview) {
        const url = URL.createObjectURL(f);
        preview.innerHTML = `<video class="journal-video-preview-thumb" src="${url}" controls playsinline preload="metadata"></video>`;
      }
    });
  }
}

function wireProductFileInput() {
  const p = document.getElementById('prod-photo');
  if (!p) return;
  p.addEventListener('change', () => {
    const f = p.files && p.files[0];
    const preview = document.getElementById('prod-photo-preview');
    if (!f) { pendingProductPhoto = null; if (preview) preview.innerHTML = ''; return; }
    const r = new FileReader();
    r.onload = (e) => { pendingProductPhoto = e.target.result; if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingProductPhoto}" alt="">`; };
    r.readAsDataURL(f);
  });
}

function refreshAll() {
  if (ownerUnlocked) {
    const badge = document.getElementById('record-count-badge');
    if (badge) badge.textContent = `${records.length} business · ${personalRecords.length} personal · ${activityRecords.length} diary`;
  }
  const active = document.querySelector('.view.active')?.id?.replace('view-', '');
  if (active === 'records') renderRecords();
  if (active === 'reports') renderReports();
  if (active === 'bydate') { populateQuickDates(); renderDateSummary(); }
  if (active === 'workers') populateQuickWorkers();
  if (active === 'business') renderBusiness();
  if (active === 'personal') renderPersonal();
  if (active === 'shares') renderShares();
  if (active === 'capital') renderCapital();
  if (active === 'advances') renderAdvances();
  if (active === 'loans') renderLoans();
  if (active === 'inventory') renderInventory();
  if (active === 'products') renderProducts();
  if (active === 'orders') renderOrders();
  if (active === 'payroll') renderPayrollHistory();
  if (active === 'planning') renderPlanning();
  if (active === 'activities') renderActivities();
  if (active === 'plantation-detail' && selectedPlantationType) {
    renderPlantationDetail(selectedPlantationType);
    renderPlantationSales(selectedPlantationType);
  }
  if (active === 'dashboard') { renderDashboard(); renderAlerts(); }

  if (IS_PLANTATION_PAGE && selectedPlantationType) {
    renderPlantationDetail(selectedPlantationType);
    renderPlantationSales(selectedPlantationType);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  ownerPinHash = localStorage.getItem(OWNER_PIN_KEY) || null;
  ownerUnlocked = localStorage.getItem(OWNER_UNLOCKED_KEY) === '1' || IS_PLANTATION_PAGE;

  populateTypeDropdowns();
  populatePlantationSubmenu();

  ['f-date','p-date','d-date','cap-date','adv-date','plan-date','loan-date','activity-date','sale-date']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });
  ['pr-from','pr-to'].forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });

  addWorkerRow(); addItemRow(); addPersonalItemRow();
  wireActivityFileInputs();
  wireProductFileInput();
  wirePlantationFileInputs();

  const wl = localStorage.getItem('vc-weather-loc');
  if (wl) try { weatherLocation = JSON.parse(wl); } catch(e) {}
  const wc = localStorage.getItem('vc-weather-cache');
  if (wc) try { weatherCache = JSON.parse(wc); } catch(e) {}
  if (weatherLocation) {
    const la = document.getElementById('wx-lat'); if (la) la.value = weatherLocation.lat;
    const lo = document.getElementById('wx-lon'); if (lo) lo.value = weatherLocation.lon;
  }

  applyLockUI();

  await loadFromServer();

  if (IS_PLANTATION_PAGE) {
    selectedPlantationType = PRESELECTED_PLANTATION;
    showPlantationDetail(PRESELECTED_PLANTATION);
    renderCrossLinks(PRESELECTED_PLANTATION);
    const pb = document.getElementById('print-plantation-btn');
    if (pb) pb.removeEventListener('click', printPlantationReport);
    if (pb) pb.addEventListener('click', printPlantationReport);
  } else {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        navigateTo(tab.dataset.view);
        refreshAll();
      });
    });
    document.querySelectorAll('.sidebar-link[data-view], .hamburger-dropdown a[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const v = link.getAttribute('data-view');
        if (!v) return;
        navigateTo(v);
        document.getElementById('hamburgerDropdown').classList.remove('open');
        refreshAll();
      });
    });
    const hb = document.getElementById('hamburgerBtn');
    if (hb) hb.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('hamburgerDropdown');
      const open = dd.classList.toggle('open');
      hb.setAttribute('aria-expanded', open);
    });
    const home = document.getElementById('homeBtn');
    if (home) home.onclick = () => navigateTo('dashboard');
    const oal = document.getElementById('owner-access-link');
    if (oal) oal.onclick = handleOwnerAccessClick;
    const oalm = document.getElementById('owner-access-link-mobile');
    if (oalm) oalm.onclick = handleOwnerAccessClick;
    refreshAll();
  }

  const cno = document.getElementById('confirm-no');
  if (cno) cno.onclick = () => document.getElementById('confirm-modal').classList.remove('open');

  ['owner-gate-pin','owner-gate-pin-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitOwnerGate(); });
  });

  setInterval(() => { if (isFormDirty) { } }, AUTO_SAVE_INTERVAL);
});

function buildPrintReport(type) {
  const recs = records.filter(r => r.plantation_type === type).sort((a, b) => a.date.localeCompare(b.date));
  const laborCost = recs.reduce((s, r) => s + r.labor_cost, 0);
  const itemsCost = recs.reduce((s, r) => s + r.items_total, 0);
  const totalExpenditure = round2(laborCost + itemsCost);
  const ov = plantationPricing[type];
  const usingOverride = !!(ov && ov.totalYield > 0);
  const recYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const recIncome = round2(recs.reduce((s, r) => s + (r.revenue || 0), 0));
  let totalYield, totalGrossIncome, pricePerKgDisplay;
  if (usingOverride) {
    totalYield = ov.totalYield;
    pricePerKgDisplay = ov.pricePerKg || 0;
    totalGrossIncome = round2(ov.totalYield * (ov.currentPricePerKg || 0));
  } else {
    totalYield = recYield;
    pricePerKgDisplay = totalYield > 0 ? round2(recIncome / totalYield) : 0;
    totalGrossIncome = recIncome;
  }
  const netIncome = round2(totalGrossIncome - totalExpenditure);
  const grossSales = computeGrossSalesFor(type);
  const netSales = netSalesFor(type);
  const sales = plantationSales.filter(s => s.plantation_type === type).sort((a, b) => a.date.localeCompare(b.date));
  const itemRows = recs.flatMap(r => r.items.map(i => ({ ...i, date: r.date })));
  const workerMap = {};
  recs.forEach(r => r.workers.forEach(w => {
    if (!workerMap[w.name]) workerMap[w.name] = { days: 0, cost: 0, jobs: new Set() };
    workerMap[w.name].days += laborDaysOf(w);
    workerMap[w.name].cost += laborCostOf(w);
    workerMap[w.name].jobs.add(w.job_description);
  }));
  const dateRange = recs.length ? `${recs[0].date} → ${recs[recs.length - 1].date}` : '— no records yet —';

  return `
    <div class="print-report">
      <h1>${plantationEmoji(type)} ${escapeHtml(type)}</h1>
      <p class="print-sub">Valley and Creeks Farm · Plantation Report · Records ${recs.length} · ${dateRange} · Printed ${todayISO()}</p>

      <div class="print-section">
        <h2>Key Figures</h2>
        <div class="print-kpis">
          <div class="print-kpi"><div class="k-label">Total Yield</div><div class="k-value">${totalYield} kg</div></div>
          <div class="print-kpi"><div class="k-label">Price per kg</div><div class="k-value">${peso(pricePerKgDisplay)}</div></div>
          <div class="print-kpi"><div class="k-label">Total Gross Income</div><div class="k-value">${peso(totalGrossIncome)}</div></div>
          <div class="print-kpi"><div class="k-label">Total Expenditure</div><div class="k-value">${peso(totalExpenditure)}</div></div>
          <div class="print-kpi"><div class="k-label">Net Income</div><div class="k-value">${peso(netIncome)}</div></div>
          <div class="print-kpi"><div class="k-label">Gross Sales (Reports)</div><div class="k-value">${peso(grossSales)}</div></div>
          <div class="print-kpi"><div class="k-label">Net Sales</div><div class="k-value">${peso(netSales)}</div></div>
          <div class="print-kpi"><div class="k-label">Cost / kg</div><div class="k-value">${totalYield > 0 ? peso(round2(totalExpenditure / totalYield)) : '—'}</div></div>
        </div>
      </div>

      <div class="print-section">
        <h2>Expenditure Breakdown</h2>
        <table><tbody>
          <tr><td>Labor cost</td><td class="num">${peso(laborCost)}</td></tr>
          <tr><td>Items cost</td><td class="num">${peso(itemsCost)}</td></tr>
          <tr><td><strong>Total expenditure</strong></td><td class="num"><strong>${peso(totalExpenditure)}</strong></td></tr>
        </tbody></table>
      </div>

      ${Object.keys(workerMap).length > 0 ? `
      <div class="print-section">
        <h2>Workers</h2>
        <table><thead><tr><th>Worker</th><th>Job(s)</th><th class="num">Labor-days</th><th class="num">Cost</th></tr></thead><tbody>
          ${Object.entries(workerMap).sort((a, b) => b[1].cost - a[1].cost).map(([n, i]) => `
            <tr><td>${escapeHtml(n)}</td><td>${escapeHtml([...i.jobs].join(', '))}</td><td class="num">${i.days}</td><td class="num">${peso(i.cost)}</td></tr>
          `).join('')}
        </tbody></table>
      </div>` : ''}

      ${itemRows.length > 0 ? `
      <div class="print-section">
        <h2>Items Purchased</h2>
        <table><thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Cost</th></tr></thead><tbody>
          ${itemRows.map(i => `<tr><td>${i.date}</td><td>${escapeHtml(i.name)}</td><td class="num">${i.quantity}</td><td>${i.unit}</td><td class="num">${peso(i.cost)}</td></tr>`).join('')}
        </tbody></table>
      </div>` : ''}

      ${sales.length > 0 ? `
      <div class="print-section">
        <h2>Sales History</h2>
        <table><thead><tr><th>Date</th><th>Customer</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>
          ${sales.map(s => `<tr><td>${s.date}</td><td>${escapeHtml(s.customer_name)}</td><td class="num">${s.quantity}</td><td class="num">${peso(s.price_per_unit)}</td><td class="num">${peso(s.total)}</td></tr>`).join('')}
          <tr><td colspan="4"><strong>Total</strong></td><td class="num"><strong>${peso(sales.reduce((s, x) => s + x.total, 0))}</strong></td></tr>
        </tbody></table>
      </div>` : ''}

      ${recs.length > 0 ? `
      <div class="print-section">
        <h2>All Harvest Records</h2>
        <table><thead><tr><th>ID</th><th>Date</th><th class="num">Yield</th><th class="num">Income</th><th class="num">Workers</th><th class="num">Expenditure</th></tr></thead><tbody>
          ${[...recs].sort((a, b) => b.date.localeCompare(a.date)).map(r => `<tr><td>#${r.id}</td><td>${r.date}</td><td class="num">${r.yield_kg || 0}</td><td class="num">${peso(r.revenue || 0)}</td><td class="num">${r.workers.length}</td><td class="num">${peso(r.total_expenditure)}</td></tr>`).join('')}
        </tbody></table>
      </div>` : ''}

      <div class="print-footer">
        Valley and Creeks Farm · Plantation Ledger · Glenn Junsay Pansensoy<br>
        Generated ${todayISO()}
      </div>
    </div>
  `;
}

function printPlantationReport() {
  if (!selectedPlantationType) return;
  document.body.classList.add('plantations-printing');
  const existing = document.getElementById('print-report-host');
  if (existing) existing.remove();
  const host = document.createElement('div');
  host.id = 'print-report-host';
  host.className = 'card print-mode-card';
  host.innerHTML = buildPrintReport(selectedPlantationType);
  const section = document.getElementById('view-plantation-detail');
  section.insertBefore(host, section.firstChild);
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('plantations-printing');
      host.remove();
    }, 500);
  }, 100);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ Service worker registered:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 New version ready — reload to apply.');
              showToast('🔄 Update ready — refresh to apply', 'info', 6000);
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

console.log('🌱 Valley and Creeks Farm initialized');
