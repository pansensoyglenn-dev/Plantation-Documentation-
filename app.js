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
const UNDO_TIMEOUT = 30000;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024;

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

const DB_NAME = 'PlantationLedgerProDB';
const DB_VERSION = 3;

const STORAGE_KEY = "plantation-records-pro-v3";
const PERSONAL_STORAGE_KEY = "plantation-personal-pro-v3";
const SALES_STORAGE_KEY = "plantation-net-sales-pro-v3";
const DRAFT_KEY = "plantation-draft-pro-v3";
const CAPITAL_STORAGE_KEY = "plantation-capital-pro-v3";
const ADVANCE_STORAGE_KEY = "plantation-advances-pro-v3";
const INVENTORY_STORAGE_KEY = "plantation-inventory-pro-v3";
const PAYSLIP_STORAGE_KEY = "plantation-payslips-pro-v3";
const PLANNING_STORAGE_KEY = "plantation-planning-pro-v3";
const BUDGET_STORAGE_KEY = "plantation-budgets-pro-v3";
const WEATHER_STORAGE_KEY = "plantation-weather-cache-v3";
const WEATHER_LOCATION_KEY = "plantation-weather-location-v3";
const HARVEST_SHARE_STORAGE_KEY = "plantation-harvest-share-pct-v3";
const PRODUCTS_STORAGE_KEY = "plantation-products-v3";
const ORDERS_STORAGE_KEY = "plantation-orders-v3";
const LOAN_STORAGE_KEY = "plantation-lender-loans-v3";
const PLANTATION_PRICING_KEY = "plantation-pricing-override-v3";
const PLANTATION_MEDIA_KEY = "plantation-media-v3";
const PLANTATION_SALES_KEY = "plantation-sales-v3";

const MAIZE_MIGRATION_KEY = 'migrated-maize-sections-v1';
const LEGACY_MAIZE_NAME = 'Maize Production';
const NEW_MAIZE_RIGHT_BANK = 'Maize Production — Right Bank';

const OWNER_WHATSAPP = "639757841228";
const OWNER_PHONE_DISPLAY = "0975 784 1228";
const OWNER_EMAIL = "pansensoyglenn150@gmail.com";

const PUBLIC_VIEWS = ['about', 'shop'];
const OWNER_PIN_KEY = 'owner-pin-hash-v1';
const OWNER_UNLOCKED_KEY = 'valley-creeks-owner-unlocked';

let db = null;
let dbReady = false;
let useFallback = false;
let records = [];
let personalRecords = [];
let grossSales = {};
let startingCapital = {};
let capitalEntries = [];
let cashAdvances = [];
let harvestSharePct = {};
let lenderLoans = [];
let plantationPricing = {};
let plantationMedia = {};
let plantationSales = [];
let activityRecords = [];
let inventoryItems = [];
let payslips = [];
let planningTasks = [];
let monthlyBudgets = {};
let products = [];
let orders = [];

let nextId = 1, nextPersonalId = 1, nextCapitalId = 1, nextAdvanceId = 1;
let nextLoanId = 1, nextSaleId = 1, nextActivityId = 1, nextInventoryId = 1;
let nextPayslipId = 1, nextPlanningId = 1, nextProductId = 1, nextOrderId = 1;

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
let ownerPinHash = null, ownerUnlocked = false;
let pendingNavigationTarget = null;
let lastWorkerHistoryEntries = [];
let lastWorkerHistoryName = '';
let cart = {};

const mediaObjectUrlCache = new Map();

function peso(n) {
  return "₱" + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round2(n) { return Math.round(n * 100) / 100; }
function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
function isFutureDate(dateStr) {
  if (!dateStr) return false;
  return dateStr > todayISO();
}
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
function laborCostOf(w) { return (w.full_days + (w.half_days || 0) * 0.5) * w.daily_wage; }
function laborDaysOf(w) { return w.full_days + (w.half_days || 0) * 0.5; }
function expenditureFor(type) {
  return records.filter(r => r.plantation_type === type).reduce((s, r) => s + r.total_expenditure, 0);
}
function unitOptionsHtml(selected) {
  return UNIT_OPTIONS.map(u =>
    `<option value="${u.value}" ${selected === u.value ? 'selected' : ''}>${u.label}</option>`
  ).join('');
}

function plantationEmoji(type) {
  const map = {
    "Coconut Plantation": "🥥", "Lanzones Plantation": "🫐", "Durian Plantation": "🌰",
    "Maize Production — Right Bank": "🌽", "Maize Production — Left Bank": "🌽", "Maize Production — Upper Valley": "🌽",
    "String Beans Plantation": "🫛", "Tomato Plantation": "🍅", "Potato Plantation": "🥔",
    "Squash Production": "🎃", "Eggplant Farming": "🍆", "Zucchini Plantation": "🥒",
    "Rambutan Plantation": "🍒", "Peanut Production": "🥜", "Tuber Farming": "🍠",
    "Basil Production": "🌿", "Cilantro Farming": "🌱", "Lettuce Production": "🥬"
  };
  return map[type] || "🌴";
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
function setLoading(loading) {
  isLoading = loading;
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('open', loading);
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
function markDirty() {
  isFormDirty = true;
  const dot = document.getElementById('auto-save-dot');
  if (dot) dot.className = 'dot saving';
  const t = document.getElementById('auto-save-text');
  if (t) t.textContent = 'Unsaved changes';
}
function updateAutoSaveIndicator() {
  const dot = document.getElementById('auto-save-dot');
  const text = document.getElementById('auto-save-text');
  if (!dot || !text) return;
  if (isFormDirty) { dot.className = 'dot saving'; text.textContent = 'Unsaved changes'; }
  else { dot.className = 'dot'; text.textContent = 'Auto-save'; }
}

function videoBlockHtml(value, opts = {}) {
  if (!value) return '';

  const cls = opts.cls || 'journal-video-native';
  const badge = opts.badge !== false;

  if (value.startsWith('http') || value.startsWith('data:')) {
    return `
      <video class="${cls}" controls playsinline preload="metadata" src="${escapeHtml(value)}"></video>
      ${badge ? `<div class="offline-video-badge">🌐 Stored on Blob · needs internet</div>` : ''}
    `;
  }

  if (value.startsWith('blobref:')) {
    const id = 'v-' + Math.random().toString(36).slice(2, 9);
    setTimeout(async () => {
      const el = document.getElementById(id);
      if (!el) return;
      const src = await resolveVideoSrc(value);
      if (src) {
        const video = document.createElement('video');
        video.className = cls;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = src;
        el.replaceWith(video);
      } else {
        el.innerHTML = `
          <div style="padding:20px;text-align:center;background:var(--panel-alt);border:1px dashed var(--border);border-radius:var(--radius);">
            <div style="font-size:28px;margin-bottom:6px;">🎬</div>
            <div style="font-size:13px;color:var(--muted);">This video was uploaded on a different device, or the local copy was cleared.</div>
            <div style="font-size:11.5px;color:var(--faint);margin-top:4px;">Re-upload it to see it again.</div>
          </div>`;
      }
    }, 0);

    return `
      <div id="${id}" style="margin:10px 0;">
        <div style="padding:30px;text-align:center;background:var(--panel-alt);border:1px solid var(--border);border-radius:var(--radius);">
          <div style="width:24px;height:24px;margin:0 auto;border:3px solid var(--border);border-top:3px solid var(--fuchsia-bright);border-radius:50%;animation:spin .8s linear infinite;"></div>
          <div style="font-size:12px;color:var(--muted);margin-top:8px;">Loading video…</div>
        </div>
      </div>
      ${badge ? `<div class="offline-video-badge">📴 Local Blob — plays on this device</div>` : ''}
    `;
  }

  return '';
}

function generateMediaKeyId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'm' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}
async function resolveVideoSrc(value) {
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  if (value.startsWith('blobref:')) {
    const key = value.slice('blobref:'.length);
    if (mediaObjectUrlCache.has(key)) return mediaObjectUrlCache.get(key);
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value) {
        const url = URL.createObjectURL(res.value);
        mediaObjectUrlCache.set(key, url);
        return url;
      }
    } catch (e) {
      console.warn('Failed to load video blob for', key, e);
    }
  }
  return null;
}
async function deleteVideoBlobIfAny(value) {
  if (value && value.startsWith('blobref:')) {
    const key = value.slice('blobref:'.length);
    mediaObjectUrlCache.delete(key);
    try { await window.storage.delete(key); } catch (e) { }
  }
}

// --- FIXED OPEN DB & STORAGE LOGIC ---
function openDB() {
  return new Promise((resolve) => {
    if (useFallback) return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (ev) => {
        const database = ev.target.result;
        if (!database.objectStoreNames.contains('records')) {
          database.createObjectStore('records', { keyPath: 'key' });
        }
      };
      request.onsuccess = (ev) => {
        db = ev.target.result;
        dbReady = true;
        resolve(db);
      };
      request.onerror = (ev) => {
        console.warn('IndexedDB error, falling back to localStorage:', ev.target.error);
        useFallback = true;
        dbReady = true;
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported, falling back:', e);
      useFallback = true;
      dbReady = true;
      resolve(null);
    }
  });
}

window.storage = {
  get: async (key, parse = true) => {
    if (!dbReady) await openDB();
    if (useFallback || !db) {
      const val = localStorage.getItem(key);
      if (!val) return null;
      if (parse) { try { return { value: JSON.parse(val) }; } catch(e) { return null; } }
      return { value: val };
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('records', 'readonly');
        const store = tx.objectStore('records');
        const req = store.get(key);
        req.onsuccess = () => {
          const result = req.result;
          resolve(result ? { value: result.value } : null);
        };
        req.onerror = () => {
          useFallback = true;
          const val = localStorage.getItem(key);
          resolve(val ? { value: val } : null);
        };
      } catch (e) {
        useFallback = true;
        const val = localStorage.getItem(key);
        resolve(val ? { value: val } : null);
      }
    });
  },
  set: async (key, value, parse = true) => {
    if (!dbReady) await openDB();
    if (useFallback || !db) {
      localStorage.setItem(key, value);
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => {
          useFallback = true;
          localStorage.setItem(key, value);
          resolve();
        };
      } catch (e) {
        useFallback = true;
        localStorage.setItem(key, value);
        resolve();
      }
    });
  },
  delete: async (key) => {
    if (!dbReady) await openDB();
    if (useFallback || !db) {
      localStorage.removeItem(key);
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => {
          useFallback = true;
          localStorage.removeItem(key);
          resolve();
        };
      } catch (e) {
        useFallback = true;
        localStorage.removeItem(key);
        resolve();
      }
    });
  }
};

async function seedDataIfEmpty() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (!res || !res.value) {
      console.log('🌱 Initializing empty business records store.');
      records = [];
      nextId = 1;
      await saveToStorage();
    }

    const res2 = await window.storage.get(PERSONAL_STORAGE_KEY, false);
    if (!res2 || !res2.value) {
      console.log('🌱 Initializing empty personal records store.');
      personalRecords = [];
      nextPersonalId = 1;
      await savePersonalToStorage();
    }

    const res3 = await window.storage.get(SALES_STORAGE_KEY, false);
    if (!res3 || !res3.value) {
      grossSales = {};
      await saveSalesToStorage();
    }

    const res4 = await window.storage.get(CAPITAL_STORAGE_KEY, false);
    if (!res4 || !res4.value) {
      console.log('🌱 Seeding starting capital.');
      startingCapital = { ...DEFAULT_STARTING_CAPITAL };
      await saveCapitalToStorage();
    }

    const res5 = await window.storage.get(ADVANCE_STORAGE_KEY, false);
    if (!res5 || !res5.value) {
      cashAdvances = [];
      nextAdvanceId = 1;
      await saveAdvancesToStorage();
    }
  } catch (e) {
    console.warn('Seed data check failed:', e);
  }
}

async function saveToStorage() {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify({ records, nextId }), false);
    return true;
  } catch (e) { console.error('Save error:', e); return false; }
}
async function savePersonalToStorage() {
  try { await window.storage.set(PERSONAL_STORAGE_KEY, JSON.stringify({ records: personalRecords, nextId: nextPersonalId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveSalesToStorage() {
  try { await window.storage.set(SALES_STORAGE_KEY, JSON.stringify(grossSales), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveCapitalToStorage() {
  try { await window.storage.set(CAPITAL_STORAGE_KEY, JSON.stringify({ startingCapital, capitalEntries, nextCapitalId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveAdvancesToStorage() {
  try { await window.storage.set(ADVANCE_STORAGE_KEY, JSON.stringify({ advances: cashAdvances, nextId: nextAdvanceId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveHarvestSharePctsToStorage() {
  try { await window.storage.set(HARVEST_SHARE_STORAGE_KEY, JSON.stringify(harvestSharePct), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveInventoryToStorage() {
  try { await window.storage.set(INVENTORY_STORAGE_KEY, JSON.stringify({ items: inventoryItems, nextId: nextInventoryId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function savePayslipsToStorage() {
  try { await window.storage.set(PAYSLIP_STORAGE_KEY, JSON.stringify({ payslips, nextId: nextPayslipId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function savePlanningToStorage() {
  try { await window.storage.set(PLANNING_STORAGE_KEY, JSON.stringify({ tasks: planningTasks, nextId: nextPlanningId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveBudgetsToStorage() {
  try { await window.storage.set(BUDGET_STORAGE_KEY, JSON.stringify(monthlyBudgets), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveLoansToStorage() {
  try { await window.storage.set(LOAN_STORAGE_KEY, JSON.stringify({ loans: lenderLoans, nextId: nextLoanId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function savePlantationPricingToStorage() {
  try { await window.storage.set(PLANTATION_PRICING_KEY, JSON.stringify(plantationPricing), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function savePlantationMediaToStorage() {
  try { await window.storage.set(PLANTATION_MEDIA_KEY, JSON.stringify(plantationMedia), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function savePlantationSalesToStorage() {
  try { await window.storage.set(PLANTATION_SALES_KEY, JSON.stringify({ sales: plantationSales, nextId: nextSaleId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveProductsToStorage() {
  try { await window.storage.set(PRODUCTS_STORAGE_KEY, JSON.stringify({ products, nextId: nextProductId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function saveOrdersToStorage() {
  try { await window.storage.set(ORDERS_STORAGE_KEY, JSON.stringify({ orders, nextId: nextOrderId }), false); return true; }
  catch (e) { console.error(e); return false; }
}
async function loadRecords() {
  setLoading(true);
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (res && res.value) {
      const parsed = JSON.parse(res.value);
      records = parsed.records || [];
      nextId = parsed.nextId || (records.length ? Math.max(...records.map(r => r.id)) + 1 : 1);
    }
  } catch (e) { console.warn('Failed to load records:', e); records = []; nextId = 1; }

  try {
    const res2 = await window.storage.get(PERSONAL_STORAGE_KEY, false);
    if (res2 && res2.value) {
      const parsed2 = JSON.parse(res2.value);
      personalRecords = parsed2.records || [];
      nextPersonalId = parsed2.nextId || (personalRecords.length ? Math.max(...personalRecords.map(r => r.id)) + 1 : 1);
    }
  } catch (e) { personalRecords = []; nextPersonalId = 1; }

  try {
    const res3 = await window.storage.get(SALES_STORAGE_KEY, false);
    if (res3 && res3.value) grossSales = JSON.parse(res3.value) || {};
  } catch (e) { grossSales = {}; }

  setLoading(false);
  refreshAll();
}
async function loadCapitalAndAdvances() {
  try {
    const res = await window.storage.get(CAPITAL_STORAGE_KEY, false);
    if (res && res.value) {
      const parsed = JSON.parse(res.value);
      startingCapital = parsed.startingCapital || {};
      capitalEntries = parsed.capitalEntries || [];
      nextCapitalId = parsed.nextCapitalId || (capitalEntries.length ? Math.max(...capitalEntries.map(c => c.id)) + 1 : 1);
    }
  } catch (e) { console.warn('Failed to load capital:', e); }
  let needsSave = false;
  PLANTATION_TYPES.forEach(type => {
    if (startingCapital[type] === undefined) { startingCapital[type] = DEFAULT_STARTING_CAPITAL[type] ?? 0; needsSave = true; }
  });
  if (needsSave) await saveCapitalToStorage();

  try {
    const res2 = await window.storage.get(ADVANCE_STORAGE_KEY, false);
    if (res2 && res2.value) {
      const parsed2 = JSON.parse(res2.value);
      cashAdvances = parsed2.advances || [];
      nextAdvanceId = parsed2.nextId || (cashAdvances.length ? Math.max(...cashAdvances.map(a => a.id)) + 1 : 1);
    }
  } catch (e) { cashAdvances = []; nextAdvanceId = 1; }
}
async function loadHarvestSharePcts() {
  try {
    const res = await window.storage.get(HARVEST_SHARE_STORAGE_KEY, false);
    if (res && res.value) harvestSharePct = JSON.parse(res.value) || {};
  } catch (e) { harvestSharePct = {}; }
  let needsSave = false;
  PLANTATION_TYPES.forEach(type => {
    if (harvestSharePct[type] === undefined) { harvestSharePct[type] = DEFAULT_HARVEST_SHARE_PCT[type] ?? 0; needsSave = true; }
  });
  if (needsSave) await saveHarvestSharePctsToStorage();
}
async function loadExtras() {
  try {
    const res = await window.storage.get(INVENTORY_STORAGE_KEY, false);
    if (res && res.value) { const p = JSON.parse(res.value); inventoryItems = p.items || []; nextInventoryId = p.nextId || (inventoryItems.length ? Math.max(...inventoryItems.map(i => i.id)) + 1 : 1); }
  } catch (e) {}
  try {
    const res2 = await window.storage.get(PAYSLIP_STORAGE_KEY, false);
    if (res2 && res2.value) { const p = JSON.parse(res2.value); payslips = p.payslips || []; nextPayslipId = p.nextId || (payslips.length ? Math.max(...payslips.map(p => p.id)) + 1 : 1); }
  } catch (e) {}
  try {
    const res3 = await window.storage.get(PLANNING_STORAGE_KEY, false);
    if (res3 && res3.value) { const p = JSON.parse(res3.value); planningTasks = p.tasks || []; nextPlanningId = p.nextId || (planningTasks.length ? Math.max(...planningTasks.map(t => t.id)) + 1 : 1); }
  } catch (e) {}
  try {
    const res4 = await window.storage.get(BUDGET_STORAGE_KEY, false);
    if (res4 && res4.value) monthlyBudgets = JSON.parse(res4.value) || {};
  } catch (e) {}
}
async function loadLoans() {
  try {
    const res = await window.storage.get(LOAN_STORAGE_KEY, false);
    if (res && res.value) { const p = JSON.parse(res.value); lenderLoans = p.loans || []; nextLoanId = p.nextId || (lenderLoans.length ? Math.max(...lenderLoans.map(l => l.id)) + 1 : 1); }
  } catch (e) { lenderLoans = []; nextLoanId = 1; }
}
async function loadPlantationPricing() {
  try {
    const res = await window.storage.get(PLANTATION_PRICING_KEY, false);
    if (res && res.value) plantationPricing = JSON.parse(res.value) || {};
  } catch (e) { plantationPricing = {}; }
}
async function loadPlantationMedia() {
  try {
    const res = await window.storage.get(PLANTATION_MEDIA_KEY, false);
    if (res && res.value) plantationMedia = JSON.parse(res.value) || {};
  } catch (e) { plantationMedia = {}; }
}
async function loadPlantationSales() {
  try {
    const res = await window.storage.get(PLANTATION_SALES_KEY, false);
    if (res && res.value) { const p = JSON.parse(res.value); plantationSales = p.sales || []; nextSaleId = p.nextId || (plantationSales.length ? Math.max(...plantationSales.map(s => s.id)) + 1 : 1); }
  } catch (e) { plantationSales = []; nextSaleId = 1; }
}
async function loadWeatherSettings() {
  try {
    const res = await window.storage.get(WEATHER_LOCATION_KEY, false);
    if (res && res.value) weatherLocation = JSON.parse(res.value);
  } catch (e) { weatherLocation = null; }
  try {
    const res2 = await window.storage.get(WEATHER_STORAGE_KEY, false);
    if (res2 && res2.value) weatherCache = JSON.parse(res2.value);
  } catch (e) { weatherCache = null; }
  if (weatherLocation) {
    const latEl = document.getElementById('wx-lat');
    const lonEl = document.getElementById('wx-lon');
    if (latEl) latEl.value = weatherLocation.lat;
    if (lonEl) lonEl.value = weatherLocation.lon;
  }
}
async function loadActivities() {
  try {
    const res = await window.storage.get('activity-records', false);
    if (res && res.value) { const p = JSON.parse(res.value); activityRecords = p.records || []; nextActivityId = p.nextId || (activityRecords.length ? Math.max(...activityRecords.map(a => a.id)) + 1 : 1); }
  } catch (e) { activityRecords = []; nextActivityId = 1; }
}
async function loadProducts() {
  try {
    const res = await window.storage.get(PRODUCTS_STORAGE_KEY, false);
    if (res && res.value) { const p = JSON.parse(res.value); products = p.products || []; nextProductId = p.nextId || (products.length ? Math.max(...products.map(p => p.id)) + 1 : 1); }
  } catch (e) { products = []; nextProductId = 1; }
}
async function loadOrders() {
  try {
    const res = await window.storage.get(ORDERS_STORAGE_KEY, false);
    if (res && res.value) { const p = JSON.parse(res.value); orders = p.orders || []; nextOrderId = p.nextId || (orders.length ? Math.max(...orders.map(o => o.id)) + 1 : 1); }
  } catch (e) { orders = []; nextOrderId = 1; }
}
async function loadOwnerPin() {
  try {
    const res = await window.storage.get(OWNER_PIN_KEY, false);
    if (res && res.value) ownerPinHash = res.value;
  } catch (e) { ownerPinHash = null; }
  ownerUnlocked = localStorage.getItem(OWNER_UNLOCKED_KEY) === '1';
  applyLockUI();
}

async function migrateLegacyMaizeData() {
  try {
    const already = await window.storage.get(MAIZE_MIGRATION_KEY, false);
    if (already && already.value === '1') return;
  } catch (e) {}

  let touched = false;
  records.forEach(r => { if (r.plantation_type === LEGACY_MAIZE_NAME) { r.plantation_type = NEW_MAIZE_RIGHT_BANK; touched = true; } });
  if (touched) await saveToStorage();

  if (startingCapital[LEGACY_MAIZE_NAME] !== undefined) {
    startingCapital[NEW_MAIZE_RIGHT_BANK] = startingCapital[LEGACY_MAIZE_NAME];
    delete startingCapital[LEGACY_MAIZE_NAME];
    await saveCapitalToStorage();
  }
  try { await window.storage.set(MAIZE_MIGRATION_KEY, '1', false); } catch (e) {}
}

function isPrivateView(v) { return !PUBLIC_VIEWS.includes(v); }
async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function applyLockUI() {
  document.body.classList.toggle('owner-locked', !ownerUnlocked);
  const link = document.getElementById('owner-access-link');
  const linkMobile = document.getElementById('owner-access-link-mobile');
  const label = ownerUnlocked ? '🔓 Lock app' : '🔒 Owner Login';
  if (link) link.textContent = label;
  if (linkMobile) linkMobile.textContent = label;
  const si = document.getElementById('global-search-input');
  if (si) {
    si.disabled = !ownerUnlocked;
    si.placeholder = ownerUnlocked ? '🔍 Search everything…' : '🔒 Owner login required to search';
  }
  const badge = document.getElementById('record-count-badge');
  if (badge && !ownerUnlocked) badge.textContent = 'Valley and Creeks Farm';
  const statsCard = document.getElementById('vertical-ag-stats');
  if (statsCard && !ownerUnlocked) {
    statsCard.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:20px;"><span class="glyph">🔒</span>Farm statistics are only visible to the owner. <a href="#" onclick="event.preventDefault();openOwnerGate();" style="color:var(--blue-bright);">Log in</a> to view them.</div>`;
  }
  const footer = document.querySelector('.bottom-indicators');
  if (footer) footer.style.display = ownerUnlocked ? '' : 'none';
}
function openOwnerGate() {
  const title = document.getElementById('owner-gate-title');
  const text = document.getElementById('owner-gate-text');
  const confirmField = document.getElementById('owner-gate-confirm-field');
  const pinInput = document.getElementById('owner-gate-pin');
  const confirmInput = document.getElementById('owner-gate-pin-confirm');
  document.getElementById('owner-gate-error').style.display = 'none';
  pinInput.value = '';
  confirmInput.value = '';
  if (!ownerPinHash) {
    title.textContent = '🔐 Set an Owner PIN';
    text.textContent = 'No PIN is set yet on this device. Choose one now to protect your business data.';
    confirmField.style.display = '';
  } else {
    title.textContent = '🔒 Owner Login';
    text.textContent = 'Enter your PIN to access the farm management dashboard.';
    confirmField.style.display = 'none';
  }
  document.getElementById('owner-gate-modal').classList.add('open');
  pinInput.focus();
}
function closeOwnerGate() {
  document.getElementById('owner-gate-modal').classList.remove('open');
  pendingNavigationTarget = null;
}
async function submitOwnerGate() {
  const pin = document.getElementById('owner-gate-pin').value;
  if (!pin || pin.length < 4) { showToast('⚠️ PIN must be at least 4 characters', 'error'); return; }
  if (!ownerPinHash) {
    const confirmPin = document.getElementById('owner-gate-pin-confirm').value;
    if (pin !== confirmPin) {
      document.getElementById('owner-gate-error').textContent = "PINs don't match. Try again.";
      document.getElementById('owner-gate-error').style.display = '';
      return;
    }
    ownerPinHash = await sha256Hex(pin);
    try { await window.storage.set(OWNER_PIN_KEY, ownerPinHash, false); }
    catch (e) { showToast('⚠️ Failed to save PIN', 'error'); return; }
    showToast('✅ Owner PIN set — keep it somewhere safe', 'success');
  } else {
    const hash = await sha256Hex(pin);
    if (hash !== ownerPinHash) {
      document.getElementById('owner-gate-error').textContent = "That PIN doesn't match. Try again.";
      document.getElementById('owner-gate-error').style.display = '';
      return;
    }
  }
  ownerUnlocked = true;
  localStorage.setItem(OWNER_UNLOCKED_KEY, '1');
  applyLockUI();
  document.getElementById('owner-gate-modal').classList.remove('open');
  const target = pendingNavigationTarget || 'dashboard';
  pendingNavigationTarget = null;
  navigateTo(target);
  refreshAll();
}
function lockApp() {
  ownerUnlocked = false;
  localStorage.removeItem(OWNER_UNLOCKED_KEY);
  applyLockUI();
  navigateTo('shop');
  showToast('🔒 Locked — private tabs are hidden again', 'success');
}
function handleOwnerAccessClick() {
  if (ownerUnlocked) lockApp(); else openOwnerGate();
}

function plantationSalesTotalFor(type) {
  return round2(plantationSales.filter(s => s.plantation_type === type).reduce((s, x) => s + x.total, 0));
}
function computeGrossSalesFor(type) {
  const salesTotal = plantationSalesTotalFor(type);
  if (salesTotal > 0) return salesTotal;
  const override = plantationPricing[type];
  if (override && override.totalYield > 0) {
    return round2(override.totalYield * (override.currentPricePerKg || 0));
  }
  return grossSales[type] || 0;
}
function grossSalesSourceLabelFor(type) {
  if (plantationSalesTotalFor(type) > 0) return 'from Sell Produce sales';
  const override = plantationPricing[type];
  if (override && override.totalYield > 0) return 'from Encoded Yield & Pricing';
  if ((grossSales[type] || 0) > 0) return 'manual fallback';
  return 'not set yet';
}
function netSalesFor(type) {
  return round2(computeGrossSalesFor(type) - expenditureFor(type));
}
function computeCapitalFor(type) {
  const existing = startingCapital[type] || 0;
  const entries = capitalEntries.filter(c => c.plantation_type === type);
  const additional = entries.reduce((s, c) => s + c.amount, 0);
  const spent = records.filter(r => r.plantation_type === type).reduce((s, r) => s + r.total_expenditure, 0);
  return { existing, additional, entries, spent, current: round2(existing + additional - spent) };
}
function computeAdvanceWorkerTotals() {
  const totals = {};
  cashAdvances.forEach(a => {
    if (!totals[a.name]) totals[a.name] = { borrowed: 0, repaid: 0 };
    totals[a.name].borrowed += a.amount;
    if (a.repaid) totals[a.name].repaid += a.amount;
  });
  return Object.entries(totals).map(([name, t]) => ({
    name, borrowed: t.borrowed, repaid: t.repaid, outstanding: round2(t.borrowed - t.repaid)
  })).sort((a, b) => b.outstanding - a.outstanding);
}
function computeLoanTotals(loan) {
  const interest = round2(loan.principal * (loan.interestRate / 100));
  return { interestAmount: interest, totalPayable: round2(loan.principal + interest) };
}
function computeHarvestShares(plantationType) {
  const pct = harvestSharePct[plantationType] || 0;
  const gross = computeGrossSalesFor(plantationType);
  const sales = netSalesFor(plantationType);
  const pool = round2(sales * pct);
  const ownerAmount = round2(sales - pool);
  const workerDays = {};
  records.filter(r => r.plantation_type === plantationType).forEach(r => {
    r.workers.forEach(w => {
      const days = laborDaysOf(w);
      if (!workerDays[w.name]) workerDays[w.name] = 0;
      workerDays[w.name] += days;
    });
  });
  const totalDays = Object.values(workerDays).reduce((s, d) => s + d, 0);
  const shares = Object.entries(workerDays).map(([name, days]) => {
    const proportion = totalDays > 0 ? days / totalDays : 0;
    return { name, days, proportion, share: round2(pool * proportion) };
  }).sort((a, b) => b.share - a.share);
  return { pct, gross, sales, pool, ownerAmount, totalDays, shares };
}
function computeItemPurchaseTally() {
  const tally = {};
  const addFrom = (list) => {
    list.forEach(r => {
      r.items.forEach(i => {
        if (!i.name) return;
        const key = i.name.trim().toLowerCase();
        if (!key) return;
        if (!tally[key]) tally[key] = { name: i.name.trim(), count: 0, totalQty: 0, totalCost: 0, units: {} };
        tally[key].count += 1;
        tally[key].totalQty += (i.quantity || 0);
        tally[key].totalCost += (i.cost || 0);
        const u = i.unit || '';
        tally[key].units[u] = (tally[key].units[u] || 0) + (i.quantity || 0);
      });
    });
  };
  addFrom(records);
  addFrom(personalRecords);
  return Object.values(tally).sort((a, b) => b.count - a.count || b.totalCost - a.totalCost);
}
function computeTopItem() {
  const arr = computeItemPurchaseTally();
  return arr.length ? arr[0] : null;
}
function barRows(map, total, sortByKey = false) {
  let entries = Object.entries(map);
  entries = sortByKey ? entries.sort((a, b) => a[0].localeCompare(b[0])) : entries.sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(e => e[1])) : 1;
  if (entries.length === 0) return `<div class="empty-state">No data yet.</div>`;
  return entries.map(([key, val]) => `
    <div class="bar-row">
      <div class="label" title="${escapeHtml(key)}">${escapeHtml(key)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(val / max * 100).toFixed(1)}%"></div></div>
      <div class="amt">${peso(val)}</div>
    </div>`).join('');
}
let _blobClient = null;
async function getBlobClient() {
  if (!_blobClient) {
    _blobClient = await import('https://esm.sh/@vercel/blob@0.27.0/client');
  }
  return _blobClient;
}

async function uploadToBlob(file, pathnamePrefix) {
  const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `${pathnamePrefix}/${Date.now()}-${safeName}`;
  const multipart = file.size > 100 * 1024 * 1024;

  const { upload } = await getBlobClient();

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    contentType: file.type || 'video/mp4',
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
function enhancePlantationSelect(id) {
  const select = document.getElementById(id);
  if (!select || select.dataset.customized === '1') return;
  select.dataset.customized = '1';

  const wrap = document.createElement('div');
  wrap.className = 'custom-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  select.style.position = 'absolute';
  select.style.opacity = '0';
  select.style.pointerEvents = 'none';
  select.style.height = '1px';
  select.style.width = '1px';
  select.style.overflow = 'hidden';
  select.tabIndex = -1;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-select-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  wrap.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');
  wrap.appendChild(menu);

  function refreshLabel() {
    btn.textContent = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '';
  }
  function buildMenu() {
    menu.innerHTML = '';
    [...select.options].forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-select-option' + (idx === select.selectedIndex ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.textContent = opt.text;
      item.onclick = () => {
        select.selectedIndex = idx;
        refreshLabel();
        menu.classList.remove('open');
        btn.classList.remove('open');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      menu.appendChild(item);
    });
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains('open');
    document.querySelectorAll('.custom-select-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.custom-select-btn.open').forEach(b => b.classList.remove('open'));
    if (willOpen) { buildMenu(); menu.classList.add('open'); btn.classList.add('open'); }
  };
  select._refreshCustomLabel = refreshLabel;
  refreshLabel();
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-wrap')) {
    document.querySelectorAll('.custom-select-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.custom-select-btn.open').forEach(b => b.classList.remove('open'));
  }
});
function populatePlantationSubmenu() {
  const out = document.getElementById('plantation-submenu');
  const sidebarOut = document.getElementById('sidebar-plantation-submenu');
  const itemsHtml = PLANTATION_TYPES.map(type =>
    `<a class="submenu-item" data-plantation="${escapeHtml(type)}">${plantationEmoji(type)} ${type}</a>`
  ).join('');
  if (out) out.innerHTML = itemsHtml;
  if (sidebarOut) {
    sidebarOut.innerHTML = PLANTATION_TYPES.map(type =>
      `<a class="sidebar-link submenu-item" data-plantation="${escapeHtml(type)}">${plantationEmoji(type)} ${type}</a>`
    ).join('');
  }
  document.querySelectorAll('#plantation-submenu a.submenu-item, #sidebar-plantation-submenu a.submenu-item').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const type = this.getAttribute('data-plantation');
      showPlantationDetail(type);
      document.getElementById('hamburgerDropdown').classList.remove('open');
      document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
      document.querySelectorAll('.hamburger-dropdown a, .sidebar-link').forEach(a => a.classList.remove('active'));
      document.querySelectorAll(`[data-plantation="${type.replace(/"/g, '\\"')}"]`).forEach(a => a.classList.add('active'));
    });
  });
}
function syncNavActiveStates(viewName) {
  document.querySelectorAll('.hamburger-dropdown a[data-view], .sidebar-link[data-view]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName);
  });
}

function workerRowTemplate(id, w = {}) {
  const paymentPeriod = w.payment_period || "daily";
  const isPaid = !!w.paid;
  return `
  <div class="dyn-row worker-row" data-row-id="${id}" role="listitem">
    <div><label for="w-name-${id}">Name</label><input type="text" id="w-name-${id}" class="w-name" value="${escapeHtml(w.name || '')}" placeholder="Worker name" required onchange="markDirty()"></div>
    <div><label for="w-job-${id}">Job</label><input type="text" id="w-job-${id}" class="w-job" value="${escapeHtml(w.job_description || '')}" placeholder="e.g. Harvesting" onchange="markDirty()"></div>
    <div><label for="w-full-${id}">Days</label><input type="number" id="w-full-${id}" class="w-full" value="${w.full_days ?? 0}" min="0" step="0.5" oninput="updateTotals();markDirty()"></div>
    <div><label for="w-period-${id}">Payment</label>
      <select id="w-period-${id}" class="w-period" onchange="updateTotals();markDirty()">
        <option value="daily" ${paymentPeriod === 'daily' ? 'selected' : ''}>Daily</option>
        <option value="weekly" ${paymentPeriod === 'weekly' ? 'selected' : ''}>Weekly</option>
        <option value="monthly" ${paymentPeriod === 'monthly' ? 'selected' : ''}>Monthly</option>
      </select>
    </div>
    <div><label for="w-wage-${id}">Wage (₱)</label><input type="number" id="w-wage-${id}" class="w-wage" value="${w.daily_wage ?? DEFAULT_WAGE}" min="0" step="0.01" oninput="updateTotals();markDirty()"></div>
    <div><label for="w-paid-${id}">Paid?</label><button type="button" id="w-paid-${id}" class="paid-toggle-btn w-paid ${isPaid ? 'is-paid' : ''}" data-paid="${isPaid ? '1' : '0'}" onclick="toggleWorkerRowPaid(this)">${isPaid ? '✓ Paid' : 'Unpaid'}</button></div>
    <button class="remove-btn" onclick="removeRow(this)" title="Remove worker" aria-label="Remove worker">✕</button>
  </div>`;
}
function itemRowTemplate(id, it = {}) {
  return `
  <div class="dyn-row item-row" data-row-id="${id}" role="listitem">
    <div><label for="i-name-${id}">Item</label><input type="text" id="i-name-${id}" class="i-name" value="${escapeHtml(it.name || '')}" placeholder="e.g. Fertilizer" required onchange="markDirty()"></div>
    <div><label for="i-qty-${id}">Qty</label><input type="number" id="i-qty-${id}" class="i-qty" value="${it.quantity ?? 0}" min="0" step="0.01" oninput="updateItemCost(this);markDirty()"></div>
    <div><label for="i-unit-${id}">Unit</label>
      <select id="i-unit-${id}" class="i-unit" onchange="updateItemCost(this);markDirty()">${unitOptionsHtml(it.unit)}</select>
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
      <select id="pi-unit-${id}" class="pi-unit" onchange="updatePersonalItemCost(this);markDirty()">${unitOptionsHtml(it.unit)}</select>
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
  const title = document.getElementById('form-title');
  if (title) title.textContent = cat === 'business'
    ? (editingId ? `Editing record #${editingId}` : "Record a day's expenditure")
    : (editingPersonalId ? `Editing personal expense #${editingPersonalId}` : "Record a personal expense");
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
  updateAutoSaveIndicator();
  const pd = document.getElementById('p-date'); if (pd) pd.value = todayISO();
  const pir = document.getElementById('p-item-rows'); if (pir) pir.innerHTML = '';
  addPersonalItemRow();
  updatePersonalTotals();
  localStorage.removeItem(DRAFT_KEY);
}
function confirmClearForm() {
  if (!isFormDirty && !editingId && !editingPersonalId) { resetForm(); return; }
  openConfirmModal('Clear form?', 'You have unsaved changes. Are you sure you want to clear the form?', () => {
    resetForm();
    showToast('Form cleared', 'info');
  });
}

async function saveRecord() {
  if (isLoading) return;
  if (currentCategory === 'personal') return savePersonalRecord();

  const workers = collectWorkers();
  const items = collectItems();
  if (workers.length === 0 && items.length === 0) {
    showToast('⚠️ Add at least one worker or item first', 'error'); return;
  }
  const date = document.getElementById('f-date').value;
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }

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
    await saveToStorage();
    isFormDirty = false;
    resetForm();
    refreshAll();
  } finally { setLoading(false); }
}
async function savePersonalRecord() {
  if (isLoading) return;
  const items = collectPersonalItems();
  if (items.length === 0) { showToast('⚠️ Add at least one personal item first', 'error'); return; }
  const date = document.getElementById('p-date').value || todayISO();
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }
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
    await savePersonalToStorage();
    isFormDirty = false;
    resetForm();
    refreshAll();
  } finally { setLoading(false); }
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
  document.getElementById('f-type')._refreshCustomLabel?.();
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
  updateAutoSaveIndicator();
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
  updateAutoSaveIndicator();
  navigateTo('add');
}
function confirmDelete(id) {
  const r = records.find(x => x.id === id);
  pendingDeleteId = id;
  pendingDeleteIsPersonal = false;
  openConfirmModal('Delete record?', `Record #${id} — ${r.plantation_type} on ${r.date} (${peso(r.total_expenditure)}) will be permanently removed.`, executeDelete);
}
function confirmDeletePersonal(id) {
  const r = personalRecords.find(x => x.id === id);
  pendingDeleteId = id;
  pendingDeleteIsPersonal = true;
  openConfirmModal('Delete personal expense?', `Personal expense #${id} on ${r.date} (${peso(r.total_expenditure)}) will be permanently removed.`, executeDelete);
}
async function executeDelete() {
  setLoading(true);
  if (pendingDeleteIsPersonal) {
    const r = personalRecords.find(x => x.id === pendingDeleteId);
    deletedRecord = { type: 'personal', record: r };
    personalRecords = personalRecords.filter(x => x.id !== pendingDeleteId);
    await savePersonalToStorage();
    showToast(`🗑️ Personal expense #${pendingDeleteId} deleted. <button onclick="undoDelete()">↩ Undo</button>`, 'undo', UNDO_TIMEOUT);
  } else {
    const r = records.find(x => x.id === pendingDeleteId);
    deletedRecord = { type: 'business', record: r };
    records = records.filter(x => x.id !== pendingDeleteId);
    await saveToStorage();
    showToast(`🗑️ Record #${pendingDeleteId} deleted. <button onclick="undoDelete()">↩ Undo</button>`, 'undo', UNDO_TIMEOUT);
  }
  setLoading(false);
  refreshAll();
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => { deletedRecord = null; }, UNDO_TIMEOUT);
}
async function undoDelete() {
  if (!deletedRecord) return;
  if (deletedRecord.type === 'personal') {
    personalRecords.push(deletedRecord.record);
    await savePersonalToStorage();
  } else {
    records.push(deletedRecord.record);
    await saveToStorage();
  }
  deletedRecord = null;
  clearTimeout(undoTimeout);
  refreshAll();
  showToast('↩️ Restored', 'success');
}
async function toggleRecordWorkerPaid(recordId, workerIndex) {
  const rec = records.find(r => r.id === recordId);
  if (!rec || !rec.workers[workerIndex]) return;
  rec.workers[workerIndex].paid = !rec.workers[workerIndex].paid;
  const ok = await saveToStorage();
  if (ok) {
    showToast(rec.workers[workerIndex].paid ? `✅ Marked ${rec.workers[workerIndex].name} as paid` : `↩️ Marked ${rec.workers[workerIndex].name} as unpaid`, 'success');
    refreshAll();
  }
}
function clearFilters() {
  ['s-type','s-from','s-to','s-worker','s-min-amount','s-max-amount'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  currentPage = 1;
  renderRecords();
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
    out.innerHTML = `<div class="empty-state"><span class="glyph">🌾</span>No records match — try a new record or clear filters.</div>`;
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
      <td class="mini-list">${r.workers.map(w => `<div>${escapeHtml(w.name)} — ${escapeHtml(w.job_description)} · ${peso(laborCostOf(w))} ${w.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Unpaid</span>'}</div>`).join('') || '—'}</td>
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
    for (let i = 1; i <= pages; i++) html += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
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
      <td class="mini-list">${r.items.map(i => `<div>${escapeHtml(i.name)}: ${i.quantity} ${i.unit} × ${peso(i.price_per_unit)} = ${peso(i.cost)}</div>`).join('') || '—'}</td>
      <td class="num">${peso(r.total_expenditure)}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="editPersonalRecord(${r.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDeletePersonal(${r.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
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

function renderDashboard() {
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const totalYield = records.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const totalNetSales = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
  const personalTotal = personalRecords.reduce((s, r) => s + r.total_expenditure, 0);
  const ds = document.getElementById('dashboard-stats');
  if (ds) {
    ds.innerHTML = `
      <div class="stat-card"><div class="label">Total Business Records</div><div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">Total Business Expenses</div><div class="value">${peso(total)}</div></div>
      <div class="stat-card good"><div class="label">Total Yield</div><div class="value">${totalYield} kg</div></div>
      <div class="stat-card ${totalNetSales >= 0 ? 'good' : 'bad'}"><div class="label">Net Sales / Profit</div><div class="value">${peso(totalNetSales)}</div></div>
      <div class="stat-card"><div class="label">Diary Entries</div><div class="value">${activityRecords.length}</div></div>
      <div class="stat-card"><div class="label">Total Personal Expenses</div><div class="value personal">${peso(personalTotal)}</div></div>
      <div class="stat-card"><div class="label">Total Business and Personal Expenses</div><div class="value merged">${peso(total + personalTotal)}</div></div>
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
  lenderLoans.filter(l => !l.paid).forEach(l => {
    const daysOld = Math.floor((new Date(today) - new Date(l.date)) / 86400000);
    if (daysOld >= 30) {
      const totals = computeLoanTotals(l);
      alerts.push({ level: 'warning', glyph: '💳', title: `Loan from ${l.lender} is still unpaid`, detail: `${peso(totals.totalPayable)} owed, borrowed ${daysOld} days ago` });
    }
  });
  inventoryItems.forEach(i => {
    if (i.stock <= i.threshold) alerts.push({ level: 'warning', glyph: '📦', title: `${i.name} is low on stock`, detail: `${i.stock} ${i.unit} left` });
  });
  planningTasks.forEach(t => {
    if (!t.done && t.due_date < today) alerts.push({ level: 'warning', glyph: '🗓️', title: `"${t.title}" is overdue`, detail: `${t.plantation_type} — was due ${t.due_date}` });
  });
  const unpaidTotal = {};
  records.forEach(r => r.workers.forEach(w => { if (!w.paid) unpaidTotal[w.name] = (unpaidTotal[w.name] || 0) + laborCostOf(w); }));
  Object.entries(unpaidTotal).forEach(([name, amt]) => {
    if (amt > 0) alerts.push({ level: 'warning', glyph: '🧾', title: `${name} has unpaid labor`, detail: `${peso(amt)} in logged work is not yet marked paid` });
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

function renderSharePctInputs() {
  const introEl = document.getElementById('shares-intro-text');
  if (introEl) introEl.textContent = "Set what percentage of each plantation's Net Sales goes to workers as a harvest share — the remainder stays with you as the owner.";
  const out = document.getElementById('share-pct-inputs');
  if (!out) return;
  out.innerHTML = PLANTATION_TYPES.map(type => {
    const pctValue = Math.round((harvestSharePct[type] ?? 0) * 1000) / 10;
    return `<div class="field"><label for="share-pct-${type}">${type} — Worker share (%)</label>
      <input type="number" min="0" max="100" step="0.1" class="share-pct-input" id="share-pct-${type}" data-type="${type}" value="${pctValue}"></div>`;
  }).join('');
}
async function saveHarvestSharePcts() {
  document.querySelectorAll('.share-pct-input').forEach(inp => {
    const pctPercent = Math.min(100, Math.max(0, parseFloat(inp.value) || 0));
    harvestSharePct[inp.dataset.type] = round2(pctPercent) / 100;
  });
  const ok = await saveHarvestSharePctsToStorage();
  if (ok) { showToast('✅ Worker share percentages updated', 'success'); renderShares(); }
}
function renderShareTable(elId, plantationType) {
  const { pct, gross, sales, pool, ownerAmount, totalDays, shares } = computeHarvestShares(plantationType);
  const out = document.getElementById(elId);
  if (!out) return;
  if (gross === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🌴</span>No Gross Sales recorded yet.</div>`; return; }
  if (sales <= 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🌴</span>Net Sales is ${peso(sales)} — no share pool until positive.</div>`; return; }
  if (shares.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">👷</span>No worker labor-days logged yet.</div>`; return; }
  out.innerHTML = `
    <div class="table-wrapper"><table>
      <thead><tr><th>Worker</th><th class="num">Labor-days</th><th class="num">% of pool</th><th class="num">Share (₱)</th></tr></thead>
      <tbody>${shares.map(s => `<tr><td>${escapeHtml(s.name)}</td><td class="num">${s.days}</td><td class="num">${(s.proportion * 100).toFixed(1)}%</td><td class="num">${peso(s.share)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="totals-strip">
      <div class="t">Gross Sales<b>${peso(gross)}</b></div>
      <div class="t">Net Sales<b>${peso(sales)}</b></div>
      <div class="t">Workers' pool (${(pct * 100).toFixed(0)}%)<b>${peso(pool)}</b></div>
      <div class="t">Owner's share<b>${peso(ownerAmount)}</b></div>
      <div class="t">Total labor-days<b>${totalDays}</b></div>
      <div class="t grand">Sum of worker shares<b>${peso(shares.reduce((s, x) => s + x.share, 0))}</b></div>
    </div>`;
}
function renderShares() {
  renderSharePctInputs();
  const active = PLANTATION_TYPES.map(type => ({ type, ...computeHarvestShares(type) })).filter(d => d.pct > 0);
  const summaryOut = document.getElementById('share-summary-cards');
  if (summaryOut) {
    summaryOut.innerHTML = active.length === 0
      ? `<div class="empty-state"><span class="glyph">📊</span>No plantation currently has a worker share percentage set above 0%.</div>`
      : active.map(d => `
        <div class="plantation-total-card">
          <div class="p-name">${plantationEmoji(d.type)} ${d.type} <span class="share-pct-badge">${(d.pct * 100).toFixed(0)}% to workers</span></div>
          <div class="p-total">${peso(d.pool)}</div>
          <div class="p-meta">${(d.pct * 100).toFixed(0)}% of ${peso(d.sales)} Net Sales</div>
          <div class="p-meta">Owner keeps ${peso(d.ownerAmount)}</div>
        </div>`).join('');
  }
  const tablesOut = document.getElementById('share-tables-out');
  if (!tablesOut) return;
  tablesOut.innerHTML = active.map(d => {
    const safeId = 'share-table-' + d.type.replace(/[^a-zA-Z0-9]+/g, '-');
    return `<div class="card"><h2>${plantationEmoji(d.type)} ${d.type} — ${(d.pct * 100).toFixed(0)}% worker share</h2><div id="${safeId}"></div></div>`;
  }).join('');
  active.forEach(d => {
    const safeId = 'share-table-' + d.type.replace(/[^a-zA-Z0-9]+/g, '-');
    renderShareTable(safeId, d.type);
  });
}
function renderCapitalInputs() {
  const out = document.getElementById('capital-inputs');
  if (!out) return;
  out.innerHTML = PLANTATION_TYPES.map(type => {
    const isDev = DEV_PHASE_TYPES.includes(type);
    return `<div class="field"><label for="cap-${type}">${type} — Existing Capital (₱) ${isDev ? '<span class="tag">🚧 In development</span>' : ''}</label>
      <input type="number" min="0" step="0.01" class="cap-existing-input" id="cap-${type}" data-type="${type}" value="${startingCapital[type] ?? 0}"></div>`;
  }).join('');
}
async function saveStartingCapital() {
  document.querySelectorAll('.cap-existing-input').forEach(inp => {
    startingCapital[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  const ok = await saveCapitalToStorage();
  if (ok) { showToast("✅ Existing Capital updated", 'success'); renderCapital(); }
}
function renderCapitalCards() {
  const out = document.getElementById('capital-cards');
  if (!out) return;
  let gEx = 0, gAdd = 0, gSpent = 0, gCur = 0;
  out.innerHTML = PLANTATION_TYPES.map(type => {
    const isDev = DEV_PHASE_TYPES.includes(type);
    const c = computeCapitalFor(type);
    gEx += c.existing; gAdd += c.additional; gSpent += c.spent; gCur += c.current;
    return `<div class="plantation-total-card">
      <div class="p-name">${type} ${isDev ? '<span class="tag">🚧 In development</span>' : ''}</div>
      <div class="p-total" style="${c.current < 0 ? 'color:var(--bad);' : ''}">${peso(c.current)}</div>
      <div class="p-meta">Existing ${peso(c.existing)} + Additional ${peso(c.additional)} − Spent ${peso(c.spent)}</div>
    </div>`;
  }).join('');
  const grand = document.getElementById('capital-grand-strip');
  if (grand) grand.innerHTML = `
    <div class="t">Total Existing<b>${peso(gEx)}</b></div>
    <div class="t">Total Additional<b>${peso(gAdd)}</b></div>
    <div class="t">Total Spent<b>${peso(gSpent)}</b></div>
    <div class="t grand">Total Current<b>${peso(gCur)}</b></div>`;
}
async function addCapitalEntry() {
  const type = document.getElementById('cap-type').value;
  const kind = document.getElementById('cap-kind').value;
  const amount = Math.max(0, parseFloat(document.getElementById('cap-amount').value) || 0);
  const date = document.getElementById('cap-date').value || todayISO();
  const note = document.getElementById('cap-note').value.trim();
  if (amount <= 0) { showToast('⚠️ Enter an amount greater than zero', 'error'); return; }
  capitalEntries.push({ id: nextCapitalId++, plantation_type: type, kind, amount, date, note });
  const ok = await saveCapitalToStorage();
  if (ok) {
    showToast(`✅ ${kind === 'loan' ? 'Loan' : 'Additional capital'} of ${peso(amount)} added for ${type}`, 'success');
    document.getElementById('cap-amount').value = '';
    document.getElementById('cap-note').value = '';
    renderCapital();
  }
}
function confirmDeleteCapitalEntry(id) {
  const e = capitalEntries.find(c => c.id === id);
  openConfirmModal('Delete this entry?', `${e.kind === 'loan' ? 'Loan' : 'Capital'} of ${peso(e.amount)} for ${e.plantation_type} will be removed.`, async () => {
    capitalEntries = capitalEntries.filter(c => c.id !== id);
    await saveCapitalToStorage();
    showToast('🗑️ Entry deleted', 'success');
    renderCapital();
  });
}
function renderCapitalEntriesTable() {
  const cnt = document.getElementById('capital-entries-count-label');
  if (cnt) cnt.textContent = `(${capitalEntries.length})`;
  const out = document.getElementById('capital-entries-table');
  if (!out) return;
  if (capitalEntries.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">💰</span>No additional capital or loans logged yet.</div>`; return; }
  const list = [...capitalEntries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = `<div class="table-wrapper"><table>
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
function renderCapital() {
  renderCapitalInputs();
  renderCapitalCards();
  renderCapitalEntriesTable();
}

async function saveAdvance() {
  const name = document.getElementById('adv-name').value.trim();
  const amount = Math.max(0, parseFloat(document.getElementById('adv-amount').value) || 0);
  const date = document.getElementById('adv-date').value || todayISO();
  const type = document.getElementById('adv-type').value;
  const note = document.getElementById('adv-note').value.trim();
  if (!name) { showToast('⚠️ Enter worker name', 'error'); return; }
  if (amount <= 0) { showToast('⚠️ Enter amount', 'error'); return; }
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }

  let ok = false;
  if (editingAdvanceId) {
    const idx = cashAdvances.findIndex(a => a.id === editingAdvanceId);
    if (idx !== -1) {
      cashAdvances[idx] = { ...cashAdvances[idx], name, amount, date, plantation_type: type, note };
      ok = await saveAdvancesToStorage();
      if (ok) showToast(`✅ Cash advance #${editingAdvanceId} updated`, 'success');
    }
  } else {
    cashAdvances.push({ id: nextAdvanceId++, name, amount, date, plantation_type: type, note, repaid: false });
    ok = await saveAdvancesToStorage();
    if (ok) showToast(`✅ Cash advance for ${name} recorded`, 'success');
  }
  if (ok) { cancelEditAdvance(); renderAdvances(); }
}
function editAdvance(id) {
  const a = cashAdvances.find(x => x.id === id);
  if (!a) return;
  editingAdvanceId = id;
  document.getElementById('adv-name').value = a.name;
  document.getElementById('adv-amount').value = a.amount;
  document.getElementById('adv-date').value = a.date;
  document.getElementById('adv-type').value = a.plantation_type || '';
  document.getElementById('adv-note').value = a.note || '';
  document.getElementById('adv-save-btn').textContent = 'Update cash advance';
  document.getElementById('adv-cancel-btn').style.display = '';
}
function cancelEditAdvance() {
  editingAdvanceId = null;
  ['adv-name','adv-amount','adv-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('adv-date').value = todayISO();
  document.getElementById('adv-type').value = '';
  document.getElementById('adv-save-btn').textContent = '+ Add cash advance';
  document.getElementById('adv-cancel-btn').style.display = 'none';
}
async function toggleAdvanceRepaid(id) {
  const idx = cashAdvances.findIndex(a => a.id === id);
  if (idx === -1) return;
  cashAdvances[idx].repaid = !cashAdvances[idx].repaid;
  await saveAdvancesToStorage();
  showToast(cashAdvances[idx].repaid ? '✅ Marked as repaid' : '↩️ Marked as outstanding', 'success');
  renderAdvances();
}
function confirmDeleteAdvance(id) {
  const a = cashAdvances.find(x => x.id === id);
  openConfirmModal('Delete cash advance?', `${peso(a.amount)} for ${a.name} will be removed.`, async () => {
    cashAdvances = cashAdvances.filter(x => x.id !== id);
    await saveAdvancesToStorage();
    showToast('🗑️ Cash advance deleted', 'success');
    renderAdvances();
  });
}
function renderAdvanceWorkerSummary() {
  const out = document.getElementById('advance-worker-summary');
  if (!out) return;
  const totals = computeAdvanceWorkerTotals();
  if (totals.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">👷</span>No cash advances logged yet.</div>`; return; }
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Worker</th><th class="num">Borrowed</th><th class="num">Repaid</th><th class="num">Outstanding</th></tr></thead>
    <tbody>${totals.map(t => `<tr>
      <td>${escapeHtml(t.name)}</td>
      <td class="num">${peso(t.borrowed)}</td>
      <td class="num">${peso(t.repaid)}</td>
      <td class="num">${t.outstanding > 0 ? `<span class="tag loss">${peso(t.outstanding)}</span>` : peso(t.outstanding)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function renderAdvances() {
  const cl = document.getElementById('advances-count-label');
  if (cl) cl.textContent = `(${cashAdvances.length})`;
  renderAdvanceWorkerSummary();
  const out = document.getElementById('advances-table');
  if (!out) return;
  if (cashAdvances.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">💵</span>No cash advances logged yet.</div>`; return; }
  const list = [...cashAdvances].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Worker</th><th>Plantation</th><th class="num">Amount</th><th>Note</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(a => `<tr>
      <td class="num">#${a.id}</td>
      <td>${a.date}</td>
      <td>${escapeHtml(a.name)}</td>
      <td>${a.plantation_type ? `<span class="tag">${a.plantation_type}</span>` : '—'}</td>
      <td class="num">${peso(a.amount)}</td>
      <td class="mini-list">${a.note ? escapeHtml(a.note) : '—'}</td>
      <td>${a.repaid ? '<span class="tag profit">Repaid</span>' : '<span class="tag loss">Outstanding</span>'}</td>
      <td class="actions-cell">
        <button class="btn-ghost btn-sm" onclick="toggleAdvanceRepaid(${a.id})">${a.repaid ? 'Mark unpaid' : 'Mark repaid'}</button>
        <button class="btn-ghost btn-sm" onclick="editAdvance(${a.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="confirmDeleteAdvance(${a.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function saveInventoryItem() {
  const name = document.getElementById('inv-name').value.trim();
  const unit = document.getElementById('inv-unit').value;
  const stock = Math.max(0, parseFloat(document.getElementById('inv-stock').value) || 0);
  const threshold = Math.max(0, parseFloat(document.getElementById('inv-threshold').value) || 0);
  const supplier = document.getElementById('inv-supplier').value.trim();
  if (!name) { showToast('⚠️ Enter an item name', 'error'); return; }
  const i = inventoryItems.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i !== -1) inventoryItems[i] = { ...inventoryItems[i], name, unit, stock, threshold, supplier };
  else inventoryItems.push({ id: nextInventoryId++, name, unit, stock, threshold, supplier });
  const ok = await saveInventoryToStorage();
  if (ok) {
    showToast(`✅ Inventory updated for ${name}`, 'success');
    ['inv-name','inv-stock','inv-threshold','inv-supplier'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderInventory();
  }
}
function editInventoryItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('inv-name').value = item.name;
  document.getElementById('inv-unit').value = item.unit;
  document.getElementById('inv-stock').value = item.stock;
  document.getElementById('inv-threshold').value = item.threshold;
  document.getElementById('inv-supplier').value = item.supplier || '';
}
function confirmDeleteInventoryItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  openConfirmModal('Delete inventory item?', `"${item.name}" will be removed.`, async () => {
    inventoryItems = inventoryItems.filter(i => i.id !== id);
    await saveInventoryToStorage();
    showToast('🗑️ Inventory item deleted', 'success');
    renderInventory();
  });
}
function renderInventory() {
  const cl = document.getElementById('inventory-count-label');
  if (cl) cl.textContent = `(${inventoryItems.length})`;
  const out = document.getElementById('inventory-table');
  if (!out) return;
  if (inventoryItems.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">📦</span>No inventory items tracked yet.</div>`; return; }
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
        <td class="actions-cell">
          <button class="btn-ghost btn-sm" onclick="editInventoryItem(${i.id})">Edit</button>
          <button class="btn-danger btn-sm" onclick="confirmDeleteInventoryItem(${i.id})">Delete</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
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
    r.workers.forEach((w, wi) => {
      if (!workerData[w.name]) workerData[w.name] = { gross: 0, alreadyPaid: 0, unpaidGross: 0, unpaidEntries: [] };
      const cost = laborCostOf(w);
      workerData[w.name].gross += cost;
      if (w.paid) workerData[w.name].alreadyPaid += cost;
      else {
        workerData[w.name].unpaidGross += cost;
        workerData[w.name].unpaidEntries.push({ recordId: r.id, workerIndex: wi });
      }
    });
  });
  const advMap = {};
  computeAdvanceWorkerTotals().forEach(a => advMap[a.name] = a.outstanding);
  const rows = Object.entries(workerData).map(([name, d]) => {
    const deduction = Math.min(d.unpaidGross, advMap[name] || 0);
    return {
      name, gross: round2(d.gross), alreadyPaid: round2(d.alreadyPaid),
      unpaidGross: round2(d.unpaidGross), deduction: round2(deduction),
      net: round2(d.unpaidGross - deduction), unpaidEntries: d.unpaidEntries
    };
  }).filter(r => r.unpaidGross > 0).sort((a, b) => b.unpaidGross - a.unpaidGross);
  payrollPreview = { from, to, type, rows };
  const card = document.getElementById('payroll-preview-card');
  const rl = document.getElementById('payroll-preview-range');
  const out = document.getElementById('payroll-preview-table');
  if (rl) rl.textContent = `(${from} → ${to}${type ? ' · ' + type : ''})`;
  if (rows.length === 0) {
    if (card) card.style.display = '';
    if (out) out.innerHTML = `<div class="empty-state">No unpaid labor in this period.</div>`;
    return;
  }
  if (card) card.style.display = '';
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Worker</th><th class="num">Already paid</th><th class="num">Unpaid</th><th class="num">Advance deducted</th><th class="num">Net pay</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${r.alreadyPaid > 0 ? `<span class="tag profit">${peso(r.alreadyPaid)}</span>` : peso(0)}</td>
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
async function savePayslips() {
  if (!payrollPreview || payrollPreview.rows.length === 0) { showToast('⚠️ Compute payroll first', 'error'); return; }
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
    r.unpaidEntries.forEach(ue => {
      const rec = records.find(x => x.id === ue.recordId);
      if (rec && rec.workers[ue.workerIndex]) rec.workers[ue.workerIndex].paid = true;
    });
  });
  await saveToStorage();
  await savePayslipsToStorage();
  await saveAdvancesToStorage();
  showToast(`✅ ${rows.length} payslip(s) saved`, 'success');
  document.getElementById('payroll-preview-card').style.display = 'none';
  payrollPreview = null;
  renderPayrollHistory();
  renderAdvances();
  refreshAll();
}
function renderPayrollHistory() {
  const cl = document.getElementById('payslip-history-count-label');
  if (cl) cl.textContent = `(${payslips.length})`;
  const out = document.getElementById('payslip-history-table');
  if (!out) return;
  if (payslips.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🧾</span>No payslips yet.</div>`; return; }
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

async function addPlanningTask() {
  const title = document.getElementById('plan-title').value.trim();
  const type = document.getElementById('plan-type').value;
  const date = document.getElementById('plan-date').value;
  const note = document.getElementById('plan-note').value.trim();
  if (!title) { showToast('⚠️ Enter a task', 'error'); return; }
  if (!date) { showToast('⚠️ Pick a due date', 'error'); return; }
  planningTasks.push({ id: nextPlanningId++, title, plantation_type: type, due_date: date, note, done: false });
  await savePlanningToStorage();
  showToast(`✅ Task "${title}" added`, 'success');
  document.getElementById('plan-title').value = '';
  document.getElementById('plan-note').value = '';
  renderPlanning();
}
async function togglePlanningDone(id) {
  const idx = planningTasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  planningTasks[idx].done = !planningTasks[idx].done;
  await savePlanningToStorage();
  renderPlanning();
}
function confirmDeletePlanningTask(id) {
  const t = planningTasks.find(x => x.id === id);
  openConfirmModal('Delete task?', `"${t.title}" will be removed.`, async () => {
    planningTasks = planningTasks.filter(x => x.id !== id);
    await savePlanningToStorage();
    showToast('🗑️ Task deleted', 'success');
    renderPlanning();
  });
}
function renderPlanningTable() {
  const cl = document.getElementById('planning-count-label');
  if (cl) cl.textContent = `(${planningTasks.length})`;
  const out = document.getElementById('planning-table');
  if (!out) return;
  if (planningTasks.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🗓️</span>No tasks logged yet.</div>`; return; }
  const today = todayISO();
  const list = [...planningTasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th></th><th>Task</th><th>Plantation</th><th>Due date</th><th>Note</th><th></th></tr></thead>
    <tbody>${list.map(t => {
      const overdue = !t.done && t.due_date < today;
      return `<tr style="${t.done ? 'opacity:.5;' : ''}">
        <td><input type="checkbox" ${t.done ? 'checked' : ''} onchange="togglePlanningDone(${t.id})"></td>
        <td>${escapeHtml(t.title)} ${overdue ? '<span class="tag loss">Overdue</span>' : ''}</td>
        <td><span class="tag">${t.plantation_type}</span></td>
        <td>${t.due_date}</td>
        <td class="mini-list">${t.note ? escapeHtml(t.note) : '—'}</td>
        <td class="actions-cell"><button class="btn-danger btn-sm" onclick="confirmDeletePlanningTask(${t.id})">Delete</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}
function currentMonthKey() { return todayISO().slice(0, 7); }
function renderBudgetInputs() {
  const label = document.getElementById('budget-month-label');
  if (label) label.textContent = `(${currentMonthKey()})`;
  const out = document.getElementById('budget-inputs');
  if (!out) return;
  out.innerHTML = PLANTATION_TYPES.map(type => `<div class="field"><label for="budget-${type}">${type} — Monthly budget (₱)</label>
    <input type="number" min="0" step="0.01" class="budget-input" id="budget-${type}" data-type="${type}" value="${monthlyBudgets[type] ?? 0}"></div>`).join('');
}
async function saveBudgets() {
  document.querySelectorAll('.budget-input').forEach(inp => {
    monthlyBudgets[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  const ok = await saveBudgetsToStorage();
  if (ok) { showToast('✅ Budgets updated', 'success'); renderBudgetComparison(); }
}
function renderBudgetComparison() {
  const month = currentMonthKey();
  const out = document.getElementById('budget-comparison');
  if (!out) return;
  const rows = PLANTATION_TYPES.filter(t => (monthlyBudgets[t] || 0) > 0).map(type => {
    const actual = records.filter(r => r.plantation_type === type && r.date.startsWith(month)).reduce((s, r) => s + r.total_expenditure, 0);
    const budget = monthlyBudgets[type] || 0;
    const pct = budget > 0 ? (actual / budget * 100) : 0;
    return { type, budget, actual, pct };
  });
  if (rows.length === 0) { out.innerHTML = `<div class="empty-state">Set a monthly budget above to see comparisons.</div>`; return; }
  out.innerHTML = rows.map(r => `<div class="bar-row">
    <div class="label" title="${r.type}">${r.type}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, r.pct).toFixed(1)}%; ${r.pct > 100 ? 'background:var(--bad);' : ''}"></div></div>
    <div class="amt">${peso(r.actual)} / ${peso(r.budget)}</div>
  </div>`).join('');
}
function renderPlanning() {
  renderBudgetInputs();
  renderBudgetComparison();
  renderPlanningTable();
}

function updateLoanPreview() {
  const p = Math.max(0, parseFloat(document.getElementById('loan-principal').value) || 0);
  const r = Math.max(0, parseFloat(document.getElementById('loan-rate').value) || 0);
  const out = document.getElementById('loan-preview');
  if (!out) return;
  if (p <= 0) { out.innerHTML = ''; return; }
  const { interestAmount, totalPayable } = computeLoanTotals({ principal: p, interestRate: r });
  out.innerHTML = `Interest: <b>${peso(interestAmount)}</b> · Total: <b>${peso(totalPayable)}</b>`;
}
async function saveLoan() {
  const lender = document.getElementById('loan-lender').value.trim();
  const principal = Math.max(0, parseFloat(document.getElementById('loan-principal').value) || 0);
  const rate = Math.max(0, parseFloat(document.getElementById('loan-rate').value) || 0);
  const date = document.getElementById('loan-date').value || todayISO();
  const type = document.getElementById('loan-type').value;
  const note = document.getElementById('loan-note').value.trim();
  if (!lender) { showToast('⚠️ Enter lender name', 'error'); return; }
  if (principal <= 0) { showToast('⚠️ Enter principal', 'error'); return; }
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }
  let ok = false;
  if (editingLoanId) {
    const idx = lenderLoans.findIndex(l => l.id === editingLoanId);
    if (idx !== -1) {
      lenderLoans[idx] = { ...lenderLoans[idx], lender, principal, interestRate: rate, date, plantation_type: type, note };
      ok = await saveLoansToStorage();
      if (ok) showToast(`✅ Loan #${editingLoanId} updated`, 'success');
    }
  } else {
    lenderLoans.push({ id: nextLoanId++, lender, principal, interestRate: rate, date, plantation_type: type, note, paid: false });
    ok = await saveLoansToStorage();
    if (ok) showToast(`✅ Loan from ${lender} recorded`, 'success');
  }
  if (ok) { cancelEditLoan(); renderLoans(); }
}
function editLoan(id) {
  const l = lenderLoans.find(x => x.id === id);
  if (!l) return;
  editingLoanId = id;
  document.getElementById('loan-lender').value = l.lender;
  document.getElementById('loan-principal').value = l.principal;
  document.getElementById('loan-rate').value = l.interestRate;
  document.getElementById('loan-date').value = l.date;
  document.getElementById('loan-type').value = l.plantation_type || '';
  document.getElementById('loan-note').value = l.note || '';
  document.getElementById('loan-save-btn').textContent = 'Update loan';
  document.getElementById('loan-cancel-btn').style.display = '';
  updateLoanPreview();
}
function cancelEditLoan() {
  editingLoanId = null;
  ['loan-lender','loan-principal','loan-rate','loan-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('loan-date').value = todayISO();
  document.getElementById('loan-type').value = '';
  document.getElementById('loan-save-btn').textContent = '+ Add loan';
  document.getElementById('loan-cancel-btn').style.display = 'none';
  const out = document.getElementById('loan-preview');
  if (out) out.innerHTML = '';
}
async function toggleLoanPaid(id) {
  const idx = lenderLoans.findIndex(l => l.id === id);
  if (idx === -1) return;
  lenderLoans[idx].paid = !lenderLoans[idx].paid;
  await saveLoansToStorage();
  showToast(lenderLoans[idx].paid ? '✅ Marked as paid' : '↩️ Marked as outstanding', 'success');
  renderLoans();
}
function confirmDeleteLoan(id) {
  const l = lenderLoans.find(x => x.id === id);
  openConfirmModal('Delete loan?', `Loan from ${l.lender} (${peso(l.principal)}) will be removed.`, async () => {
    lenderLoans = lenderLoans.filter(x => x.id !== id);
    await saveLoansToStorage();
    showToast('🗑️ Loan deleted', 'success');
    renderLoans();
  });
}
function renderLoanLenderSummary() {
  const out = document.getElementById('loan-lender-summary');
  if (!out) return;
  const byLender = {};
  lenderLoans.forEach(l => {
    const { totalPayable } = computeLoanTotals(l);
    if (!byLender[l.lender]) byLender[l.lender] = { totalPayable: 0, outstanding: 0, count: 0 };
    byLender[l.lender].totalPayable += totalPayable;
    byLender[l.lender].outstanding += l.paid ? 0 : totalPayable;
    byLender[l.lender].count += 1;
  });
  const entries = Object.entries(byLender).sort((a, b) => b[1].outstanding - a[1].outstanding);
  if (entries.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">💳</span>No loans yet.</div>`; return; }
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Lender</th><th class="num">Count</th><th class="num">Total payable</th><th class="num">Still owed</th></tr></thead>
    <tbody>${entries.map(([l, t]) => `<tr>
      <td>${escapeHtml(l)}</td>
      <td class="num">${t.count}</td>
      <td class="num">${peso(t.totalPayable)}</td>
      <td class="num">${t.outstanding > 0 ? `<span class="tag loss">${peso(t.outstanding)}</span>` : peso(0)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function renderLoans() {
  const cl = document.getElementById('loans-count-label');
  if (cl) cl.textContent = `(${lenderLoans.length})`;
  renderLoanLenderSummary();
  const out = document.getElementById('loans-table');
  if (!out) return;
  if (lenderLoans.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">💳</span>No loans yet.</div>`; return; }
  const list = [...lenderLoans].sort((a, b) => b.date.localeCompare(a.date));
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Lender</th><th class="num">Principal</th><th class="num">Rate</th><th class="num">Total payable</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(l => {
      const { totalPayable } = computeLoanTotals(l);
      return `<tr>
        <td class="num">#${l.id}</td>
        <td>${l.date}</td>
        <td>${escapeHtml(l.lender)}</td>
        <td class="num">${peso(l.principal)}</td>
        <td class="num">${l.interestRate}%</td>
        <td class="num"><strong>${peso(totalPayable)}</strong></td>
        <td>${l.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Outstanding</span>'}</td>
        <td class="actions-cell">
          <button class="btn-ghost btn-sm" onclick="toggleLoanPaid(${l.id})">${l.paid ? 'Mark unpaid' : 'Mark paid'}</button>
          <button class="btn-ghost btn-sm" onclick="editLoan(${l.id})">Edit</button>
          <button class="btn-danger btn-sm" onclick="confirmDeleteLoan(${l.id})">Delete</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function showPlantationDetail(type) {
  if (!ownerUnlocked) { pendingNavigationTarget = 'plantation-detail'; openOwnerGate(); return; }
  selectedPlantationType = type;
  const override = plantationPricing[type];
  document.getElementById('pd-in-yield').value = override ? override.totalYield : '';
  document.getElementById('pd-in-price').value = override ? override.pricePerKg : '';
  document.getElementById('pd-in-current-price').value = override ? override.currentPricePerKg : '';
  updatePlantationPricingPreview();
  pendingPlantationPhoto = null;
  pendingPlantationVideoFile = null;
  document.getElementById('pd-photo-file').value = '';
  document.getElementById('pd-video-file').value = '';
  const media = plantationMedia[type];
  document.getElementById('pd-photo-preview').innerHTML = media && media.photo ? `<img class="journal-photo-preview-thumb" src="${media.photo}" alt="Current photo">` : '';
  const videoPreviewEl = document.getElementById('pd-video-preview');
  if (videoPreviewEl) {
    if (media && media.video) {
      videoPreviewEl.innerHTML = `<video class="journal-video-preview-thumb" controls playsinline preload="metadata" src="${escapeHtml(media.video)}"></video>`;
    } else {
      videoPreviewEl.innerHTML = '';
    }
  }
  cancelEditSale();
  renderPlantationDetail(type);
  renderPlantationSales(type);
  navigateTo('plantation-detail');
}

function renderPlantationDetail(type) {
  if (!type) return;
  const recs = records.filter(r => r.plantation_type === type).sort((a, b) => a.date.localeCompare(b.date));
  const laborCost = recs.reduce((s, r) => s + r.labor_cost, 0);
  const itemsCost = recs.reduce((s, r) => s + r.items_total, 0);
  const totalExpenditure = round2(laborCost + itemsCost);
  const override = plantationPricing[type];
  const usingOverride = !!(override && override.totalYield > 0);
  const recordedYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const recordedGrossIncome = round2(recs.reduce((s, r) => s + (r.revenue || 0), 0));
  let totalYield, pricePerKgDisplay, totalGrossIncome;
  if (usingOverride) {
    totalYield = override.totalYield;
    pricePerKgDisplay = override.pricePerKg || 0;
    totalGrossIncome = round2(override.totalYield * (override.currentPricePerKg || 0));
  } else {
    totalYield = recordedYield;
    pricePerKgDisplay = totalYield > 0 ? round2(recordedGrossIncome / totalYield) : 0;
    totalGrossIncome = recordedGrossIncome;
  }
  const autoGrossSales = computeGrossSalesFor(type);
  const netIncome = round2(totalGrossIncome - totalExpenditure);
  const costPct = totalGrossIncome > 0 ? round2((totalExpenditure / totalGrossIncome) * 100) : 0;
  const costPerKg = totalYield > 0 ? round2(totalExpenditure / totalYield) : 0;
  const titleEl = document.getElementById('pd-title');
  if (titleEl) titleEl.innerHTML = `${plantationEmoji(type)} ${escapeHtml(type)} <span class="n">plantation detail</span>`;
  const media = plantationMedia[type];
  const mediaOut = document.getElementById('pd-media-display');
  if (mediaOut) {
    if (media && (media.photo || media.video)) {
      mediaOut.innerHTML = `
        ${media.photo ? `<img class="journal-photo" src="${media.photo}" alt="${escapeHtml(type)} photo">` : ''}
        ${media.video ? videoBlockHtml(media.video, { cls: 'journal-video-native' }) : ''}
        <div style="font-size:10.5px;color:var(--faint);margin-bottom:10px;">Updated ${media.updated_at}</div>
      `;
    } else {
      mediaOut.innerHTML = '';
    }
  }
  const statsEl = document.getElementById('pd-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card good"><div class="label">Total Yield / Quantity</div><div class="value">${totalYield} kg</div>${costPerKg > 0 ? `<div class="sub">cost/kg: ${peso(costPerKg)}</div>` : ''}${usingOverride ? '<div class="sub">✏️ encoded value</div>' : ''}</div>
      <div class="stat-card"><div class="label">Price per kg</div><div class="value">${peso(pricePerKgDisplay)}</div><div class="sub">${usingOverride ? 'encoded value' : 'blended across all harvests'}</div></div>
      <div class="stat-card accent"><div class="label">Total Expenditure</div><div class="value">${peso(totalExpenditure)}</div><div class="sub">labor ${peso(laborCost)} + items ${peso(itemsCost)}</div></div>
      <div class="stat-card ${netIncome >= 0 ? 'good' : 'bad'}"><div class="label">Total Gross Income</div><div class="value">${peso(totalGrossIncome)}</div></div>
    `;
  }
  const formulaEl = document.getElementById('pd-formula');
  if (formulaEl) {
    formulaEl.innerHTML =
      `Net Income = ${peso(totalGrossIncome)} − ${peso(totalExpenditure)} = <b class="${netIncome < 0 ? 'neg' : ''}">${peso(netIncome)}</b>` +
      ` · Cost share: <b>${costPct}%</b>` +
      `<div style="margin-top:6px;">Gross Sales feeding the Reports tab: <b>${peso(autoGrossSales)}</b> <span style="color:var(--faint)">(${grossSalesSourceLabelFor(type)})</span></div>`;
  }
  const itemRows = recs.flatMap(r => r.items.map(i => ({ ...i, date: r.date, record_id: r.id })));
  const itemsOut = document.getElementById('pd-items-table');
  const icl = document.getElementById('pd-items-count-label');
  if (icl) icl.textContent = `(${itemRows.length})`;
  if (itemsOut) {
    itemsOut.innerHTML = itemRows.length === 0 ? `<div class="empty-state">No items purchased yet.</div>` : `
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Cost</th><th>Record</th></tr></thead>
        <tbody>${itemRows.map(i => `<tr><td>${i.date}</td><td>${escapeHtml(i.name)}</td><td class="num">${i.quantity}</td><td>${i.unit}</td><td class="num">${peso(i.cost)}</td><td>#${i.record_id}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }
  const recOut = document.getElementById('pd-records-table');
  const rcl = document.getElementById('pd-records-count-label');
  if (rcl) rcl.textContent = `(${recs.length})`;
  if (recOut) {
    recOut.innerHTML = recs.length === 0 ? `<div class="empty-state">No records yet.</div>` : `
      <div class="table-wrapper"><table>
        <thead><tr><th>ID</th><th>Date</th><th>Yield</th><th class="num">Income</th><th class="num">Workers</th><th class="num">Total</th></tr></thead>
        <tbody>${[...recs].sort((a, b) => b.date.localeCompare(a.date)).map(r => `<tr><td class="num">#${r.id}</td><td>${r.date}</td><td>${r.yield_kg ? r.yield_kg + ' kg' : '—'}</td><td class="num">${r.revenue ? peso(r.revenue) : '—'}</td><td class="num">${r.workers.length}</td><td class="num">${peso(r.total_expenditure)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }
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
function updatePlantationPricingPreview() {
  const y = Math.max(0, parseFloat(document.getElementById('pd-in-yield').value) || 0);
  const cp = Math.max(0, parseFloat(document.getElementById('pd-in-current-price').value) || 0);
  const out = document.getElementById('pd-pricing-preview');
  if (!out) return;
  if (y <= 0) { out.innerHTML = ''; return; }
  out.innerHTML = `Gross Income = ${y} kg × ${peso(cp)} = <b>${peso(round2(y * cp))}</b>`;
}
async function savePlantationPricingOverride() {
  if (!selectedPlantationType) return;
  const y = Math.max(0, parseFloat(document.getElementById('pd-in-yield').value) || 0);
  const p = Math.max(0, parseFloat(document.getElementById('pd-in-price').value) || 0);
  const cp = Math.max(0, parseFloat(document.getElementById('pd-in-current-price').value) || 0);
  if (y <= 0) { showToast('⚠️ Enter Total Yield', 'error'); return; }
  plantationPricing[selectedPlantationType] = { totalYield: y, pricePerKg: p, currentPricePerKg: cp };
  const ok = await savePlantationPricingToStorage();
  if (ok) { showToast('✅ Saved', 'success'); renderPlantationDetail(selectedPlantationType); }
}
async function clearPlantationPricingOverride() {
  if (!selectedPlantationType) return;
  delete plantationPricing[selectedPlantationType];
  const ok = await savePlantationPricingToStorage();
  if (ok) {
    ['pd-in-yield','pd-in-price','pd-in-current-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('pd-pricing-preview').innerHTML = '';
    showToast('↩️ Cleared', 'success');
    renderPlantationDetail(selectedPlantationType);
  }
}

function updateSalePreview() {
  const q = Math.max(0, parseFloat(document.getElementById('sale-quantity').value) || 0);
  const p = Math.max(0, parseFloat(document.getElementById('sale-price').value) || 0);
  const out = document.getElementById('sale-preview');
  if (!out) return;
  if (q <= 0 || p <= 0) { out.innerHTML = ''; return; }
  out.innerHTML = `Total = ${q} kg × ${peso(p)} = <b>${peso(round2(q * p))}</b>`;
}
async function saveSale() {
  if (!selectedPlantationType) return;
  const customer = document.getElementById('sale-customer').value.trim();
  const location = document.getElementById('sale-location').value.trim();
  const cellphone = document.getElementById('sale-cellphone').value.trim();
  const quantity = Math.max(0, parseFloat(document.getElementById('sale-quantity').value) || 0);
  const price = Math.max(0, parseFloat(document.getElementById('sale-price').value) || 0);
  const date = document.getElementById('sale-date').value || todayISO();
  if (!customer) { showToast('⚠️ Enter customer name', 'error'); return; }
  if (quantity <= 0) { showToast('⚠️ Enter quantity', 'error'); return; }
  if (price <= 0) { showToast('⚠️ Enter price', 'error'); return; }
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }
  const total = round2(quantity * price);
  let ok = false;
  if (editingSaleId) {
    const idx = plantationSales.findIndex(s => s.id === editingSaleId);
    if (idx !== -1) {
      plantationSales[idx] = { ...plantationSales[idx], customer_name: customer, location, cellphone, quantity, price_per_unit: price, total, date };
      ok = await savePlantationSalesToStorage();
      if (ok) showToast(`✅ Sale updated`, 'success');
    }
  } else {
    plantationSales.push({
      id: nextSaleId++, plantation_type: selectedPlantationType,
      customer_name: customer, location, cellphone, quantity,
      price_per_unit: price, total, date
    });
    ok = await savePlantationSalesToStorage();
    if (ok) showToast(`✅ Sale to ${customer} recorded — ${peso(total)}`, 'success');
  }
  if (ok) { cancelEditSale(); renderPlantationSales(selectedPlantationType); renderPlantationDetail(selectedPlantationType); }
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
  const sp = document.getElementById('sale-preview');
  if (sp) sp.innerHTML = '';
  document.getElementById('sale-save-btn').textContent = '+ Record sale';
  document.getElementById('sale-cancel-btn').style.display = 'none';
}
function confirmDeleteSale(id) {
  const s = plantationSales.find(x => x.id === id);
  openConfirmModal('Delete sale?', `${s.quantity} kg to ${s.customer_name} (${peso(s.total)}) will be removed.`, async () => {
    plantationSales = plantationSales.filter(x => x.id !== id);
    await savePlantationSalesToStorage();
    showToast('🗑️ Sale deleted', 'success');
    renderPlantationSales(selectedPlantationType);
    renderPlantationDetail(selectedPlantationType);
  });
}
function renderPlantationSales(type) {
  if (!type) return;
  const sales = plantationSales.filter(s => s.plantation_type === type).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const totalSales = round2(sales.reduce((s, x) => s + x.total, 0));
  const totalQty = round2(sales.reduce((s, x) => s + x.quantity, 0));
  const cnt = document.getElementById('pd-sales-count-label');
  if (cnt) cnt.textContent = `(${sales.length})`;
  const strip = document.getElementById('sale-totals-strip');
  if (strip) strip.innerHTML = `
    <div class="t">Sales recorded<b>${sales.length}</b></div>
    <div class="t">Total quantity sold<b>${totalQty} kg</b></div>
    <div class="t grand">Total Sales<b>${peso(totalSales)}</b></div>`;
  const out = document.getElementById('pd-sales-table');
  if (!out) return;
  out.innerHTML = sales.length === 0
    ? `<div class="empty-state"><span class="glyph">🛒</span>No sales logged yet.</div>`
    : `<div class="table-wrapper"><table>
        <thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Location</th><th>Cellphone</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${sales.map(s => `<tr>
          <td class="num">#${s.id}</td>
          <td>${s.date}</td>
          <td>${escapeHtml(s.customer_name)}</td>
          <td>${s.location ? escapeHtml(s.location) : '—'}</td>
          <td>${s.cellphone ? escapeHtml(s.cellphone) : '—'}</td>
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

async function savePlantationMedia() {
  if (!selectedPlantationType) return;
  const existing = plantationMedia[selectedPlantationType] || {};
  const photo = pendingPlantationPhoto !== null ? pendingPlantationPhoto : (existing.photo || null);
  let video = existing.video || null;
  if (pendingPlantationVideoFile) {
    setLoading(true);
    try {
      showToast('⬆️ Uploading video…', 'info', 4000);
      const old = video;
      video = await uploadToBlob(pendingPlantationVideoFile, 'plantation');
      if (old && old.startsWith('blobref:')) await deleteVideoBlobIfAny(old);
      else if (old) await deleteBlob(old);
    } catch (e) {
      console.error(e);
      showToast('⚠️ Video upload failed: ' + e.message, 'error', 5000);
      setLoading(false);
      return;
    }
    setLoading(false);
  }
  if (!photo && !video) { showToast('⚠️ Choose a photo or video first', 'error'); return; }
  plantationMedia[selectedPlantationType] = { photo, video, updated_at: todayISO() };
  const ok = await savePlantationMediaToStorage();
  if (ok) {
    showToast(`✅ Photo/video saved for ${selectedPlantationType}`, 'success');
    pendingPlantationPhoto = null;
    pendingPlantationVideoFile = null;
    ['pd-photo-file','pd-video-file'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['pd-photo-preview','pd-video-preview'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    renderPlantationDetail(selectedPlantationType);
  }
}
async function clearPlantationMedia() {
  if (!selectedPlantationType) return;
  const existing = plantationMedia[selectedPlantationType];
  if (existing && existing.video) {
    if (existing.video.startsWith('blobref:')) await deleteVideoBlobIfAny(existing.video);
    else if (existing.video.startsWith('http')) await deleteBlob(existing.video);
  }
  delete plantationMedia[selectedPlantationType];
  const ok = await savePlantationMediaToStorage();
  if (ok) {
    pendingPlantationPhoto = null;
    pendingPlantationVideoFile = null;
    ['pd-photo-file','pd-video-file'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['pd-photo-preview','pd-video-preview'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    showToast('🗑️ Photo and video removed', 'success');
    renderPlantationDetail(selectedPlantationType);
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function youtubeEmbedHtml(url) {
  const id = extractYouTubeId(url);
  if (!id) return '';
  return `<div class="journal-video-wrap"><iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" allowfullscreen loading="lazy"></iframe></div>`;
}
async function saveActivity() {
  const date = document.getElementById('activity-date').value || todayISO();
  const description = document.getElementById('activity-description').value.trim();
  const plantation = document.getElementById('activity-plantation').value;
  const youtubeUrlRaw = document.getElementById('activity-youtube').value.trim();
  if (!description) { showToast('⚠️ Please write a diary entry first', 'error'); return; }
  if (isFutureDate(date)) { showToast('⚠️ Date cannot be in the future', 'error'); return; }
  if (youtubeUrlRaw && !extractYouTubeId(youtubeUrlRaw)) { showToast('⚠️ Invalid YouTube link', 'error'); return; }

  setLoading(true);
  try {
    const existing = editingActivityId ? activityRecords.find(a => a.id === editingActivityId) : null;

    let video = existing ? existing.video : null;
    if (pendingActivityVideoFile) {
      showToast('⬆️ Uploading video…', 'info', 4000);
      const old = video;
      video = await uploadToBlob(pendingActivityVideoFile, 'journal');
      if (old && old.startsWith('blobref:')) await deleteVideoBlobIfAny(old);
      else if (old && old.startsWith('http')) await deleteBlob(old);
    }

    const image = pendingActivityPhoto !== null ? pendingActivityPhoto : (existing ? existing.image : null);

    const entry = {
      id: editingActivityId || nextActivityId++,
      date, description, plantation_type: plantation,
      image, video, youtube_url: youtubeUrlRaw || null
    };

    if (editingActivityId) {
      const idx = activityRecords.findIndex(a => a.id === editingActivityId);
      if (idx !== -1) activityRecords[idx] = { ...activityRecords[idx], ...entry };
      showToast('✅ Diary entry updated', 'success');
    } else {
      activityRecords.push(entry);
      showToast(`✅ Diary entry saved for ${date}`, 'success');
    }

    await window.storage.set('activity-records', JSON.stringify({ records: activityRecords, nextId: nextActivityId }), false);
    clearActivityForm();
    renderActivities();
  } catch (e) {
    console.error(e);
    showToast('⚠️ Failed to save diary entry: ' + e.message, 'error', 5000);
  }
  setLoading(false);
}
function editActivity(id) {
  const a = activityRecords.find(x => x.id === id);
  if (!a) return;
  editingActivityId = id;
  document.getElementById('activity-date').value = a.date;
  document.getElementById('activity-plantation').value = a.plantation_type || '';
  document.getElementById('activity-plantation')._refreshCustomLabel?.();
  document.getElementById('activity-description').value = a.description;
  document.getElementById('activity-youtube').value = a.youtube_url || '';
  const photoInput = document.getElementById('activity-photo');
  if (photoInput) photoInput.value = '';
  pendingActivityPhoto = null;
  const photoPreview = document.getElementById('activity-photo-preview');
  if (photoPreview) photoPreview.innerHTML = a.image ? `<img class="journal-photo-preview-thumb" src="${a.image}" alt="Current photo">` : '';
  const videoInput = document.getElementById('activity-video-file');
  if (videoInput) videoInput.value = '';
  pendingActivityVideoFile = null;
  const videoPreview = document.getElementById('activity-video-file-preview');
  if (videoPreview) {
    if (a.video) {
      videoPreview.innerHTML = `<video class="journal-video-preview-thumb" controls playsinline preload="metadata" src="${escapeHtml(a.video)}"></video>`;
    } else {
      videoPreview.innerHTML = '';
    }
  }
  document.getElementById('activity-save-btn').textContent = 'Update entry';
  document.getElementById('activity-cancel-btn').style.display = '';
  navigateTo('activities');
}
function clearActivityForm() {
  editingActivityId = null;
  pendingActivityPhoto = null;
  pendingActivityVideoFile = null;
  ['activity-description','activity-youtube'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const photoInput = document.getElementById('activity-photo');
  if (photoInput) photoInput.value = '';
  const photoPreview = document.getElementById('activity-photo-preview');
  if (photoPreview) photoPreview.innerHTML = '';
  const videoInput = document.getElementById('activity-video-file');
  if (videoInput) videoInput.value = '';
  const videoPreview = document.getElementById('activity-video-file-preview');
  if (videoPreview) videoPreview.innerHTML = '';
  document.getElementById('activity-save-btn').textContent = 'Save entry';
  document.getElementById('activity-cancel-btn').style.display = 'none';
}
function renderActivities() {
  const out = document.getElementById('activity-records');
  const cl = document.getElementById('activity-count-label');
  if (cl) cl.textContent = `(${activityRecords.length})`;
  if (!out) return;
  if (activityRecords.length === 0) {
    out.innerHTML = `<div class="empty-state"><span class="glyph">📅</span>No diary entries yet. Write your first entry above.</div>`;
    return;
  }
  const list = [...activityRecords].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = list.map(a => `
    <div style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px dashed var(--border);">
      <h3 style="margin-bottom:6px;">${a.date}${a.plantation_type ? ` <span class="tag" style="text-transform:none;letter-spacing:0;">${a.plantation_type}</span>` : ''}</h3>
      ${a.image ? `<img class="journal-photo" src="${a.image}" alt="Journal photo for ${a.date}">` : ''}
      ${a.video ? videoBlockHtml(a.video) : ''}
      ${a.youtube_url ? youtubeEmbedHtml(a.youtube_url) : ''}
      <p>${escapeHtml(a.description).replace(/\n/g, '<br>')}</p>
      <div class="btn-row" style="margin-top:0;">
        <button class="btn-ghost btn-sm" onclick="editActivity(${a.id})">Edit entry</button>
        <button class="btn-danger btn-sm" onclick="deleteActivity(${a.id})">Delete entry</button>
      </div>
    </div>
  `).join('');
}
async function deleteActivity(id) {
  if (!confirm('Delete this diary entry?')) return;
  const entry = activityRecords.find(a => a.id === id);
  activityRecords = activityRecords.filter(a => a.id !== id);
  if (editingActivityId === id) clearActivityForm();
  await window.storage.set('activity-records', JSON.stringify({ records: activityRecords, nextId: nextActivityId }), false);
  if (entry && entry.video) {
    if (entry.video.startsWith('blobref:')) await deleteVideoBlobIfAny(entry.video);
    else if (entry.video.startsWith('http')) await deleteBlob(entry.video);
  }
  renderActivities();
  showToast('🗑️ Diary entry deleted', 'success');
}

function populateQuickDates() {
  const dates = [...new Set(records.map(r => r.date))].sort();
  const sel = document.getElementById('d-quick');
  if (!sel) return;
  sel.innerHTML = `<option value="">Jump to a recorded date…</option>` +
    dates.map(d => `<option value="${d}">${d} (${records.filter(r => r.date === d).length} record(s))</option>`).join('');
}
function pickQuickDate() {
  const v = document.getElementById('d-quick').value;
  if (v) { document.getElementById('d-date').value = v; renderDateSummary(); }
}
function renderDateSummary() {
  const date = document.getElementById('d-date').value;
  const out = document.getElementById('date-summary-out');
  if (!out) return;
  if (!date) { out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">📅</span>Please select a date.</div></div>`; return; }
  const recs = records.filter(r => r.date === date);
  const acts = activityRecords.filter(a => a.date === date);
  if (recs.length === 0 && acts.length === 0) {
    const dates = [...new Set(records.map(r => r.date))].sort();
    out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">📭</span>Nothing for ${date}.
      ${dates.length ? `<div style="margin-top:8px;font-size:12.5px;">Try: ${dates.slice(0, 5).join(', ')}</div>` : ''}
    </div></div>`;
    return;
  }
  const laborTotal = recs.reduce((s, r) => s + r.labor_cost, 0);
  const itemsTotal = recs.reduce((s, r) => s + r.items_total, 0);
  const grand = laborTotal + itemsTotal;
  const totalYield = recs.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const totalRevenue = recs.reduce((s, r) => s + (r.revenue || 0), 0);
  const workerMap = {};
  recs.forEach(r => {
    r.workers.forEach(w => {
      if (!workerMap[w.name]) workerMap[w.name] = { job: w.job_description, full: 0, half: 0, cost: 0, records: [] };
      workerMap[w.name].full += w.full_days;
      workerMap[w.name].half += w.half_days || 0;
      workerMap[w.name].cost += laborCostOf(w);
      workerMap[w.name].records.push(r.id);
    });
  });
  const itemRows = recs.flatMap(r => r.items.map(i => ({ ...i, plantation: r.plantation_type, record_id: r.id })));
  out.innerHTML = `
    <div class="card"><h2>Summary for ${date}</h2>
      <div class="grid cols-4">
        <div class="stat-card"><div class="label">Business Records</div><div class="value">${recs.length}</div></div>
        <div class="stat-card"><div class="label">Diary Entries</div><div class="value">${acts.length}</div></div>
        <div class="stat-card"><div class="label">Labor cost</div><div class="value">${peso(laborTotal)}</div></div>
        <div class="stat-card accent"><div class="label">Total expenditure</div><div class="value">${peso(grand)}</div></div>
        ${totalYield > 0 ? `<div class="stat-card good"><div class="label">Total Yield</div><div class="value">${totalYield} kg</div></div>` : ''}
        ${totalRevenue > 0 ? `<div class="stat-card good"><div class="label">Total Revenue</div><div class="value">${peso(totalRevenue)}</div></div>` : ''}
      </div>
    </div>
    ${acts.length > 0 ? `<div class="card essay"><h2>Diary entries <span class="n">(${acts.length})</span></h2>
      ${acts.map(a => `<h3>${a.date}${a.plantation_type ? ` <span class="tag" style="text-transform:none;letter-spacing:0;">${a.plantation_type}</span>` : ''}</h3><p>${escapeHtml(a.description).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
    <div class="card"><h2>Items purchased <span class="n">(${itemRows.length})</span></h2>
      ${itemRows.length === 0 ? `<div class="empty-state">None purchased on this date.</div>` : `
      <div class="table-wrapper"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price/unit</th><th>Plantation</th><th>Record</th><th class="num">Cost</th></tr></thead>
      <tbody>${itemRows.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${peso(i.price_per_unit)}</td><td><span class="tag">${i.plantation}</span></td><td>#${i.record_id}</td><td class="num">${peso(i.cost)}</td></tr>`).join('')}</tbody></table></div>`}
    </div>
    <div class="card"><h2>Workers / labor <span class="n">(${Object.keys(workerMap).length})</span></h2>
      ${Object.keys(workerMap).length === 0 ? `<div class="empty-state">No workers logged on this date.</div>` : `
      <div class="table-wrapper"><table><thead><tr><th>Name</th><th>Job</th><th class="num">Full days</th><th class="num">Half days</th><th class="num">Labor cost</th><th>Records</th></tr></thead>
      <tbody>${Object.entries(workerMap).sort((a, b) => a[0].localeCompare(b[0])).map(([name, info]) => `
        <tr><td>${escapeHtml(name)}</td><td>${escapeHtml(info.job)}</td><td class="num">${info.full}</td><td class="num">${info.half}</td>
        <td class="num">${peso(info.cost)}</td><td class="mini-list">${info.records.map(id => `#${id}`).join(', ')}</td></tr>`).join('')}</tbody></table></div>`}
    </div>`;
}

function populateQuickWorkers() {
  const names = [...new Set(records.flatMap(r => r.workers.map(w => w.name)))].sort((a, b) => a.localeCompare(b));
  const sel = document.getElementById('w-quick');
  if (!sel) return;
  sel.innerHTML = `<option value="">Jump to a known worker…</option>` + names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
}
function pickQuickWorker() {
  const v = document.getElementById('w-quick').value;
  if (v) { document.getElementById('w-name').value = v; renderWorkerHistory(); }
}
function renderWorkerHistory() {
  const q = (document.getElementById('w-name').value || '').trim().toLowerCase();
  const out = document.getElementById('worker-history-out');
  if (!out) return;
  if (!q) { out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">👷</span>Enter a worker name to search.</div></div>`; return; }
  const entries = [];
  records.forEach(r => {
    r.workers.forEach((w, wi) => {
      if (w.name.toLowerCase().includes(q)) {
        entries.push({
          date: r.date, record_id: r.id, worker_index: wi, name: w.name,
          job: w.job_description, full: w.full_days, half: w.half_days || 0,
          wage: w.daily_wage, cost: laborCostOf(w),
          payment_period: w.payment_period || "daily", paid: !!w.paid
        });
      }
    });
  });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) { out.innerHTML = `<div class="card"><div class="empty-state"><span class="glyph">👷</span>No records found.</div></div>`; return; }
  lastWorkerHistoryEntries = entries;
  lastWorkerHistoryName = entries[0].name;
  const totalLabor = entries.reduce((s, e) => s + e.cost, 0);
  const totalFull = entries.reduce((s, e) => s + e.full, 0);
  const totalHalf = entries.reduce((s, e) => s + e.half, 0);
  const paidEntries = entries.filter(e => e.paid);
  const unpaidEntries = entries.filter(e => !e.paid);
  const totalPaid = paidEntries.reduce((s, e) => s + e.cost, 0);
  const totalUnpaid = unpaidEntries.reduce((s, e) => s + e.cost, 0);
  const unpaidDates = unpaidEntries.map(e => e.date);
  const advanceInfo = computeAdvanceWorkerTotals().find(a => a.name === entries[0].name);
  const outstandingAdvance = advanceInfo ? advanceInfo.outstanding : 0;
  const advanceDeduction = round2(Math.min(totalUnpaid, outstandingAdvance));
  const netDue = round2(totalUnpaid - advanceDeduction);
  out.innerHTML = `
    <div class="card"><h2>${escapeHtml(entries[0].name)} — employment history</h2>
      <div class="grid cols-4">
        <div class="stat-card"><div class="label">Dates worked</div><div class="value">${new Set(entries.map(e => e.date)).size}</div></div>
        <div class="stat-card"><div class="label">Full days</div><div class="value">${totalFull}</div></div>
        <div class="stat-card"><div class="label">Half days</div><div class="value">${totalHalf}</div></div>
        <div class="stat-card accent"><div class="label">Total labor cost</div><div class="value">${peso(totalLabor)}</div></div>
      </div>
    </div>
    <div class="card"><h2>💰 Total Payment</h2>
      <div class="grid cols-3">
        <div class="stat-card good"><div class="label">Total paid</div><div class="value">${peso(totalPaid)}</div><div class="sub">${paidEntries.length} date(s)</div></div>
        <div class="stat-card bad"><div class="label">Total outstanding</div><div class="value">${peso(totalUnpaid)}</div><div class="sub">${unpaidEntries.length} date(s)</div></div>
        <div class="stat-card accent"><div class="label">Grand total</div><div class="value">${peso(totalLabor)}</div></div>
      </div>
      ${outstandingAdvance > 0 ? `
      <div class="grid cols-2" style="margin-top:12px;">
        <div class="stat-card"><div class="label">Cash advance deducted</div><div class="value" style="color:var(--warning);">− ${peso(advanceDeduction)}</div></div>
        <div class="stat-card good"><div class="label">Net amount due</div><div class="value">${peso(netDue)}</div></div>
      </div>` : ''}
      <div class="net-sales-readout" style="margin-top:10px;">
        ${unpaidDates.length ? `Unpaid dates: <b class="neg">${unpaidDates.join(', ')}</b>` : `All logged work for this worker is marked paid.`}
      </div>
      <div class="btn-row"><button class="btn-primary btn-sm" onclick="printWorkerPaymentReceipt()">🖨️ Print Receipt</button></div>
    </div>
    <div class="card"><h2>Details by date</h2>
      <div class="table-wrapper"><table>
        <thead><tr><th>Date</th><th>Record</th><th>Job description</th><th class="num">Days</th><th class="num">Payment</th><th class="num">Daily wage</th><th class="num">Labor cost</th><th>Status</th><th></th></tr></thead>
        <tbody>${entries.map(e => `
          <tr><td>${e.date}</td><td>#${e.record_id}</td><td>${escapeHtml(e.job)}</td>
          <td class="num">${e.full}</td><td class="num">${e.payment_period}</td><td class="num">${peso(e.wage)}</td><td class="num">${peso(e.cost)}</td>
          <td>${e.paid ? '<span class="tag profit">Paid</span>' : '<span class="tag loss">Unpaid</span>'}</td>
          <td class="actions-cell"><button class="btn-ghost btn-sm" onclick="toggleRecordWorkerPaid(${e.record_id}, ${e.worker_index});renderWorkerHistory();">${e.paid ? 'Mark unpaid' : 'Mark paid'}</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}
function printWorkerPaymentReceipt() {
  if (!lastWorkerHistoryEntries.length) { showToast('⚠️ Search for a worker first', 'error'); return; }
  const entries = lastWorkerHistoryEntries;
  const name = lastWorkerHistoryName;
  const totalLabor = entries.reduce((s, e) => s + e.cost, 0);
  const totalPaid = entries.filter(e => e.paid).reduce((s, e) => s + e.cost, 0);
  const totalUnpaid = totalLabor - totalPaid;
  const advanceInfo = computeAdvanceWorkerTotals().find(a => a.name === name);
  const outstandingAdvance = advanceInfo ? advanceInfo.outstanding : 0;
  const advanceDeduction = round2(Math.min(totalUnpaid, outstandingAdvance));
  const netDue = round2(totalUnpaid - advanceDeduction);
  const html = `<div class="receipt-print">
    <div class="header">
      <h2>🌿 Cool Misty Farm</h2>
      <p>Valley and Creeks Plantation</p>
      <p>Worker Payment Receipt</p>
    </div>
    <div class="line"></div>
    <div class="row"><span>Worker:</span><span><strong>${escapeHtml(name)}</strong></span></div>
    <div class="row"><span>Dates worked:</span><span>${[...new Set(entries.map(e => e.date))].length}</span></div>
    <div class="line"></div>
    ${entries.map(e => `<div class="row"><span>${e.date} (${escapeHtml(e.job)})</span><span>${peso(e.cost)} ${e.paid ? '✓' : '(unpaid)'}</span></div>`).join('')}
    <div class="line"></div>
    <div class="row"><span>Total paid:</span><span>${peso(totalPaid)}</span></div>
    <div class="row"><span>Total outstanding:</span><span>${peso(totalUnpaid)}</span></div>
    ${advanceDeduction > 0 ? `<div class="row"><span>Cash advance deducted:</span><span>− ${peso(advanceDeduction)}</span></div>` : ''}
    <div class="row total"><span>${advanceDeduction > 0 ? 'Net Amount Due' : 'Grand Total'}:</span><span>${peso(advanceDeduction > 0 ? netDue : totalLabor)}</span></div>
    <div class="footer"><p>Generated: ${todayISO()}</p><p>Thank you for your hard work! 🌱</p></div>
  </div>
  <div class="btn-row" style="justify-content:center;"><button class="btn-primary" onclick="window.print()">🖨️ Print</button></div>`;
  const existing = document.getElementById('worker-receipt-display');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'worker-receipt-display';
  div.className = 'card';
  div.innerHTML = html;
  document.getElementById('worker-history-out').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
}

function renderNetSalesInputs() {
  const out = document.getElementById('net-sales-inputs');
  if (!out) return;
  out.innerHTML = PLANTATION_TYPES.map(type => {
    const auto = computeGrossSalesFor(type);
    const ns = netSalesFor(type);
    const sourceLabel = grossSalesSourceLabelFor(type);
    return `<div class="field">
      <label for="ns-${type}">${type} — Manual fallback Gross Sales (₱)</label>
      <input type="number" min="0" step="0.01" class="ns-input" id="ns-${type}" data-type="${type}" value="${grossSales[type] ?? 0}">
      <div class="net-sales-readout">In use: <b>${peso(auto)}</b> (${sourceLabel}) · Net: <b class="${ns < 0 ? 'neg' : ''}">${peso(ns)}</b></div>
    </div>`;
  }).join('');
}
async function saveNetSales() {
  document.querySelectorAll('.ns-input').forEach(inp => {
    grossSales[inp.dataset.type] = Math.max(0, parseFloat(inp.value) || 0);
  });
  const ok = await saveSalesToStorage();
  if (ok) { showToast("✅ Manual fallback Gross Sales updated", 'success'); renderReports(); }
}
function renderPlantationTotals() {
  const out = document.getElementById('plantation-totals');
  if (!out) return;
  const today = todayISO();
  out.innerHTML = PLANTATION_TYPES.map(type => {
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
      <div class="p-meta">${recs.length} record(s) · ${totalYield} kg</div>
      <div class="p-range">${range}</div>
      <div class="p-profit ${net >= 0 ? 'pos' : 'neg'}">Gross ${peso(gross)} − Exp ${peso(total)} = <strong>${peso(net)}</strong></div>
      ${totalYield > 0 ? `<div class="p-meta">Cost per kg: ${peso(round2(total / totalYield))}</div>` : ''}
    </div>`;
  }).join('');
}
function renderReports() {
  renderNetSalesInputs();
  renderPlantationTotals();
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const totalLabor = records.reduce((s, r) => s + r.labor_cost, 0);
  const totalItems = records.reduce((s, r) => s + r.items_total, 0);
  const avg = records.length ? total / records.length : 0;
  const totalGross = PLANTATION_TYPES.reduce((s, t) => s + computeGrossSalesFor(t), 0);
  const totalNet = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
  const totalYield = records.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const sc = document.getElementById('stat-cards');
  if (sc) {
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
  if (bt) { const m = {}; records.forEach(r => { m[r.plantation_type] = (m[r.plantation_type] || 0) + r.total_expenditure; }); bt.innerHTML = barRows(m, 0); }
  const bm = document.getElementById('report-by-month');
  if (bm) { const m = {}; records.forEach(r => { const k = r.date.slice(0, 7); m[k] = (m[k] || 0) + r.total_expenditure; }); bm.innerHTML = barRows(m, 0, true); }
  const tw = document.getElementById('report-top-workers');
  if (tw) { const w = {}; records.forEach(r => r.workers.forEach(x => { w[x.name] = (w[x.name] || 0) + laborCostOf(x); })); tw.innerHTML = barRows(w, 0); }
  const ti = document.getElementById('report-top-items');
  if (ti) { const t = {}; records.forEach(r => r.items.forEach(i => { t[i.name] = (t[i.name] || 0) + i.cost; })); ti.innerHTML = barRows(t, 0); }
  renderCharts();
  renderYieldRevenueChart();
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

const WEATHER_CODE_MAP = {
  0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Dense drizzle'],
  61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
  80: ['🌦️', 'Light showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Violent showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'T-storm + hail'], 99: ['⛈️', 'Severe t-storm']
};
function weatherCodeInfo(c) { return WEATHER_CODE_MAP[c] || ['🌡️', 'Unknown']; }
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
  try { await window.storage.set(WEATHER_LOCATION_KEY, JSON.stringify(weatherLocation), false); } catch (e) {}
  await fetchWeather();
}
async function fetchWeather() {
  if (!weatherLocation || !navigator.onLine) { renderWeather(); return; }
  try {
    const { lat, lon } = weatherLocation;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    weatherCache = { data: await res.json(), fetched_at: new Date().toISOString(), lat, lon };
    try { await window.storage.set(WEATHER_STORAGE_KEY, JSON.stringify(weatherCache), false); } catch (e) {}
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
window.addEventListener('online', () => { if (weatherLocation) fetchWeather(); });

async function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const plantation = document.getElementById('prod-plantation').value;
  const unit = document.getElementById('prod-unit').value;
  const price = Math.max(0, parseFloat(document.getElementById('prod-price').value) || 0);
  const stock = Math.max(0, parseFloat(document.getElementById('prod-stock').value) || 0);
  const active = document.getElementById('prod-active').value === '1';
  const description = document.getElementById('prod-description').value.trim();
  if (!name) { showToast('⚠️ Enter a product name', 'error'); return; }
  if (price <= 0) { showToast('⚠️ Enter a price greater than zero', 'error'); return; }
  const photo = pendingProductPhoto !== null ? pendingProductPhoto :
    (editingProductId ? (products.find(p => p.id === editingProductId)?.photo || null) : null);
  let ok = false;
  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, plantation_type: plantation, unit, price, stock, active, description, photo };
      ok = await saveProductsToStorage();
      if (ok) showToast(`✅ Product updated`, 'success');
    }
  } else {
    products.push({ id: nextProductId++, name, plantation_type: plantation, unit, price, stock, active, description, photo });
    ok = await saveProductsToStorage();
    if (ok) showToast(`✅ ${name} added`, 'success');
  }
  if (ok) { cancelEditProduct(); renderProducts(); renderShop(); }
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
  const photoInput = document.getElementById('prod-photo');
  const preview = document.getElementById('prod-photo-preview');
  if (photoInput) photoInput.value = '';
  pendingProductPhoto = null;
  if (preview) preview.innerHTML = p.photo ? `<img class="journal-photo-preview-thumb" src="${p.photo}" alt="Current photo">` : '';
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
  const photoInput = document.getElementById('prod-photo'); if (photoInput) photoInput.value = '';
  const preview = document.getElementById('prod-photo-preview'); if (preview) preview.innerHTML = '';
  document.getElementById('prod-save-btn').textContent = '+ Add product';
  document.getElementById('prod-cancel-btn').style.display = 'none';
}
function confirmDeleteProduct(id) {
  const p = products.find(x => x.id === id);
  openConfirmModal('Delete product?', `"${p.name}" will be removed.`, async () => {
    products = products.filter(x => x.id !== id);
    await saveProductsToStorage();
    showToast('🗑️ Product deleted', 'success');
    renderProducts();
    renderShop();
  });
}
function renderProducts() {
  const cl = document.getElementById('products-count-label');
  if (cl) cl.textContent = `(${products.length})`;
  const out = document.getElementById('products-table');
  if (!out) return;
  if (products.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🛍️</span>No products yet.</div>`; return; }
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

function renderShop() {
  const grid = document.getElementById('shop-product-grid');
  if (!grid) return;
  const available = products.filter(p => p.active && p.stock > 0);
  if (available.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="glyph">🛒</span>Nothing available to order right now.</div>`;
  } else {
    grid.innerHTML = available.map(p => {
      const qty = cart[p.id] || 0;
      return `<div class="product-card">
        ${p.photo ? `<img class="product-photo" src="${p.photo}" alt="${escapeHtml(p.name)}">` : `<div class="product-photo product-photo-placeholder">${plantationEmoji(p.plantation_type || '')}</div>`}
        <div class="product-name">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="product-desc">${escapeHtml(p.description)}</div>` : ''}
        <div class="product-price">${peso(p.price)} <span class="product-unit">/ ${p.unit}</span></div>
        <div class="product-stock">${p.stock} ${p.unit} available</div>
        <div class="qty-stepper">
          <button class="btn-ghost btn-sm" onclick="changeCartQty(${p.id}, -1)">−</button>
          <span class="qty-value">${qty}</span>
          <button class="btn-ghost btn-sm" onclick="changeCartQty(${p.id}, 1)">+</button>
        </div>
      </div>`;
    }).join('');
  }
  renderCart();
}
function changeCartQty(productId, delta) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const current = cart[productId] || 0;
  const next = Math.max(0, Math.min(p.stock, current + delta));
  if (next === 0) delete cart[productId];
  else cart[productId] = next;
  renderShop();
}
function cartTotal() {
  return round2(Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === parseInt(id, 10));
    return sum + (p ? p.price * qty : 0);
  }, 0));
}
function renderCart() {
  const itemsOut = document.getElementById('cart-items');
  const countLabel = document.getElementById('cart-count-label');
  const totalsStrip = document.getElementById('cart-totals-strip');
  const checkoutCard = document.getElementById('checkout-card');
  if (!itemsOut) return;
  const entries = Object.entries(cart).map(([id, qty]) => ({ product: products.find(x => x.id === parseInt(id, 10)), qty }))
    .filter(e => e.product);
  if (countLabel) countLabel.textContent = `(${entries.reduce((s, e) => s + e.qty, 0)} item(s))`;
  if (entries.length === 0) {
    itemsOut.innerHTML = `<div class="empty-state"><span class="glyph">🧺</span>Your cart is empty.</div>`;
    if (totalsStrip) totalsStrip.style.display = 'none';
    if (checkoutCard) checkoutCard.style.display = 'none';
    return;
  }
  itemsOut.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Subtotal</th><th></th></tr></thead>
    <tbody>${entries.map(e => `<tr>
      <td>${escapeHtml(e.product.name)}</td>
      <td class="num">${e.qty} ${e.product.unit}</td>
      <td class="num">${peso(e.product.price)}</td>
      <td class="num">${peso(round2(e.product.price * e.qty))}</td>
      <td class="actions-cell"><button class="btn-danger btn-sm" onclick="changeCartQty(${e.product.id}, -${e.qty})">Remove</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  const gt = document.getElementById('cart-grand-total');
  if (gt) gt.textContent = peso(cartTotal());
  if (totalsStrip) totalsStrip.style.display = '';
  if (checkoutCard) checkoutCard.style.display = '';
}
async function placeOrder(method) {
  const entries = Object.entries(cart).map(([id, qty]) => ({ product: products.find(x => x.id === parseInt(id, 10)), qty }))
    .filter(e => e.product);
  if (entries.length === 0) { showToast('⚠️ Your cart is empty', 'error'); return; }
  const name = document.getElementById('order-name').value.trim();
  const cellphone = document.getElementById('order-cellphone').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const notes = document.getElementById('order-notes').value.trim();
  if (!name) { showToast('⚠️ Enter your full name', 'error'); return; }
  if (!cellphone) { showToast('⚠️ Enter your cellphone number', 'error'); return; }
  if (!address) { showToast('⚠️ Enter your delivery address', 'error'); return; }
  const order = {
    id: nextOrderId++, date: todayISO(), customer_name: name, cellphone, address, notes,
    items: entries.map(e => ({ product_id: e.product.id, name: e.product.name, unit: e.product.unit, qty: e.qty, price: e.product.price })),
    total: cartTotal(), status: 'pending'
  };
  orders.push(order);
  await saveOrdersToStorage();
  renderOrders();
  const lines = [
    `🌾 New order — Valley and Creeks Farm`, ``,
    `Customer: ${order.customer_name}`,
    `Cellphone: ${order.cellphone}`,
    `Address: ${order.address}`,
    order.notes ? `Notes: ${order.notes}` : null, ``,
    `Items:`,
    ...order.items.map(i => `- ${i.name}: ${i.qty} ${i.unit} × ${peso(i.price)} = ${peso(round2(i.qty * i.price))}`),
    ``, `Order total: ${peso(order.total)}`, `Order date: ${order.date}`
  ].filter(Boolean);
  const message = lines.join('\n');
  if (method === 'email') {
    const subject = encodeURIComponent(`New order from ${name} — Valley and Creeks Farm`);
    const body = encodeURIComponent(message);
    window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  } else {
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${text}`, '_blank', 'noopener');
  }
  showToast(`✅ Order ready — check the ${method === 'email' ? 'email' : 'WhatsApp'} window`, 'success', 5000);
  cart = {};
  document.getElementById('order-name').value = '';
  document.getElementById('order-cellphone').value = '';
  document.getElementById('order-address').value = '';
  document.getElementById('order-notes').value = '';
  renderShop();
}

async function setOrderStatus(id, status) {
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return;
  orders[idx].status = status;
  await saveOrdersToStorage();
  renderOrders();
  showToast(`✅ Order #${id} marked ${status}`, 'success');
}
function confirmDeleteOrder(id) {
  openConfirmModal('Delete order log?', `Order #${id} will be removed.`, async () => {
    orders = orders.filter(o => o.id !== id);
    await saveOrdersToStorage();
    showToast('🗑️ Order deleted', 'success');
    renderOrders();
  });
}
function renderOrders() {
  const out = document.getElementById('orders-table');
  if (!out) return;
  if (orders.length === 0) { out.innerHTML = `<div class="empty-state"><span class="glyph">🧾</span>No orders logged on this device yet.</div>`; return; }
  const list = [...orders].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  out.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Contact</th><th>Items</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(o => `<tr>
      <td class="num">#${o.id}</td>
      <td>${o.date}</td>
      <td>${escapeHtml(o.customer_name)}<div style="color:var(--faint);font-size:11px;">${escapeHtml(o.address)}</div></td>
      <td>${escapeHtml(o.cellphone)}</td>
      <td class="mini-list">${o.items.map(i => `<div>${escapeHtml(i.name)} × ${i.qty}</div>`).join('')}</td>
      <td class="num">${peso(o.total)}</td>
      <td>${o.status === 'fulfilled' ? '<span class="tag profit">Fulfilled</span>' : o.status === 'cancelled' ? '<span class="tag loss">Cancelled</span>' : '<span class="tag warning">Pending</span>'}</td>
      <td class="actions-cell">
        ${o.status !== 'fulfilled' ? `<button class="btn-ghost btn-sm" onclick="setOrderStatus(${o.id}, 'fulfilled')">Fulfill</button>` : ''}
        ${o.status !== 'cancelled' ? `<button class="btn-ghost btn-sm" onclick="setOrderStatus(${o.id}, 'cancelled')">Cancel</button>` : ''}
        <button class="btn-danger btn-sm" onclick="confirmDeleteOrder(${o.id})">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
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
  if (personalRecords.length === 0) { showToast('📭 No personal expenses', 'error'); return; }
  const rows = [["ID","Date","Item","Qty","Unit","Price","Cost"]];
  personalRecords.forEach(r => r.items.forEach(i => rows.push([r.id, r.date, i.name, i.quantity, i.unit, i.price_per_unit, i.cost])));
  downloadCSV(rows, 'personal_export.csv');
  showToast('✅ CSV exported', 'success');
}
function exportBackup() {
  const data = {
    version: 3, exported: new Date().toISOString(),
    records, personalRecords, grossSales, startingCapital, capitalEntries,
    cashAdvances, harvestSharePct, lenderLoans, plantationPricing, plantationSales,
    activityRecords, inventoryItems, payslips, planningTasks, monthlyBudgets,
    products, orders,
    nextId, nextPersonalId, nextCapitalId, nextAdvanceId, nextLoanId, nextSaleId,
    nextActivityId, nextInventoryId, nextPayslipId, nextPlanningId, nextProductId, nextOrderId
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantation_backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Full backup downloaded', 'success');
}
function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.records || !data.personalRecords) { showToast('⚠️ Invalid backup', 'error'); return; }
      setLoading(true);
      records = data.records || [];
      personalRecords = data.personalRecords || [];
      grossSales = data.grossSales || {};
      startingCapital = data.startingCapital || startingCapital;
      capitalEntries = data.capitalEntries || capitalEntries;
      cashAdvances = data.cashAdvances || cashAdvances;
      harvestSharePct = data.harvestSharePct || harvestSharePct;
      lenderLoans = data.lenderLoans || lenderLoans;
      plantationPricing = data.plantationPricing || plantationPricing;
      plantationSales = data.plantationSales || plantationSales;
      activityRecords = data.activityRecords || activityRecords;
      inventoryItems = data.inventoryItems || inventoryItems;
      payslips = data.payslips || payslips;
      planningTasks = data.planningTasks || planningTasks;
      monthlyBudgets = data.monthlyBudgets || monthlyBudgets;
      products = data.products || products;
      orders = data.orders || orders;
      nextId = data.nextId || (records.length ? Math.max(...records.map(r => r.id)) + 1 : 1);
      nextPersonalId = data.nextPersonalId || (personalRecords.length ? Math.max(...personalRecords.map(r => r.id)) + 1 : 1);
      nextCapitalId = data.nextCapitalId || nextCapitalId;
      nextAdvanceId = data.nextAdvanceId || nextAdvanceId;
      nextLoanId = data.nextLoanId || nextLoanId;
      nextSaleId = data.nextSaleId || (plantationSales.length ? Math.max(...plantationSales.map(s => s.id)) + 1 : 1);
      nextActivityId = data.nextActivityId || (activityRecords.length ? Math.max(...activityRecords.map(a => a.id)) + 1 : 1);
      nextInventoryId = data.nextInventoryId || nextInventoryId;
      nextPayslipId = data.nextPayslipId || nextPayslipId;
      nextPlanningId = data.nextPlanningId || nextPlanningId;
      nextProductId = data.nextProductId || (products.length ? Math.max(...products.map(p => p.id)) + 1 : 1);
      nextOrderId = data.nextOrderId || (orders.length ? Math.max(...orders.map(o => o.id)) + 1 : 1);
      PLANTATION_TYPES.forEach(t => {
        if (startingCapital[t] === undefined) startingCapital[t] = DEFAULT_STARTING_CAPITAL[t] ?? 0;
        if (harvestSharePct[t] === undefined) harvestSharePct[t] = DEFAULT_HARVEST_SHARE_PCT[t] ?? 0;
      });
      await saveToStorage();
      await savePersonalToStorage();
      await saveSalesToStorage();
      await saveCapitalToStorage();
      await saveAdvancesToStorage();
      await saveHarvestSharePctsToStorage();
      await saveLoansToStorage();
      await savePlantationPricingToStorage();
      await savePlantationSalesToStorage();
      await saveInventoryToStorage();
      await savePayslipsToStorage();
      await savePlanningToStorage();
      await saveBudgetsToStorage();
      await saveProductsToStorage();
      await saveOrdersToStorage();
      await window.storage.set('activity-records', JSON.stringify({ records: activityRecords, nextId: nextActivityId }), false);
      setLoading(false);
      refreshAll();
      showToast(`✅ Backup restored`, 'success');
    } catch (err) {
      setLoading(false);
      showToast('⚠️ Failed to import: ' + err.message, 'error');
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

function saveDraft() {
  if (!isFormDirty && !editingId && !editingPersonalId) return;
  const draft = {
    category: currentCategory,
    type: document.getElementById('f-type')?.value,
    date: document.getElementById('f-date')?.value,
    wage: document.getElementById('f-wage')?.value,
    yield: document.getElementById('f-yield')?.value,
    pricePerKg: document.getElementById('f-price-per-kg')?.value,
    revenue: document.getElementById('f-revenue')?.value,
    workers: collectWorkers(),
    items: collectItems(),
    personalDate: document.getElementById('p-date')?.value,
    personalItems: collectPersonalItems(),
    editingId, editingPersonalId
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  const dot = document.getElementById('auto-save-dot');
  if (dot) dot.className = 'dot';
  const t = document.getElementById('auto-save-text');
  if (t) t.textContent = 'Draft saved';
}
function checkDraft() {
  const draftData = localStorage.getItem(DRAFT_KEY);
  if (!draftData) return;
  try {
    const draft = JSON.parse(draftData);
    const hasContent = draft.workers?.length > 0 || draft.items?.length > 0 || draft.personalItems?.length > 0;
    if (hasContent) showToast('💾 Draft found. Click "Load draft" to restore.', 'info', 4000);
  } catch (e) {}
}
function loadDraft() {
  const draftData = localStorage.getItem(DRAFT_KEY);
  if (!draftData) { showToast('📭 No draft found', 'info'); return; }
  try {
    const draft = JSON.parse(draftData);
    if (draft.category === 'personal') {
      setCategory('personal');
      if (draft.personalDate) document.getElementById('p-date').value = draft.personalDate;
      document.getElementById('p-item-rows').innerHTML = '';
      draft.personalItems?.forEach(i => addPersonalItemRow(i));
      if (draft.personalItems?.length === 0) addPersonalItemRow();
      updatePersonalTotals();
      if (draft.editingPersonalId) {
        editingPersonalId = draft.editingPersonalId;
        document.getElementById('form-title').textContent = `Editing personal expense #${draft.editingPersonalId}`;
        document.getElementById('save-btn').textContent = "Update record";
      }
    } else {
      setCategory('business');
      if (draft.type) { document.getElementById('f-type').value = draft.type; document.getElementById('f-type')._refreshCustomLabel?.(); }
      if (draft.date) document.getElementById('f-date').value = draft.date;
      if (draft.wage) document.getElementById('f-wage').value = draft.wage;
      if (draft.yield) document.getElementById('f-yield').value = draft.yield;
      if (draft.pricePerKg) document.getElementById('f-price-per-kg').value = draft.pricePerKg;
      if (draft.revenue) document.getElementById('f-revenue').value = draft.revenue;
      document.getElementById('worker-rows').innerHTML = '';
      document.getElementById('item-rows').innerHTML = '';
      draft.workers?.forEach(w => addWorkerRow(w));
      draft.items?.forEach(i => addItemRow(i));
      if (draft.workers?.length === 0) addWorkerRow();
      if (draft.items?.length === 0) addItemRow();
      updateTotals();
      if (draft.editingId) {
        editingId = draft.editingId;
        document.getElementById('form-title').textContent = `Editing record #${draft.editingId}`;
        document.getElementById('save-btn').textContent = "Update record";
      }
    }
    isFormDirty = false;
    updateAutoSaveIndicator();
    showToast('✅ Draft loaded', 'success');
  } catch (e) {
    showToast('⚠️ Failed to load draft', 'error');
  }
}

function updateBottomIndicators() {
  const businessTotal = records.reduce((s, r) => s + r.total_expenditure, 0);
  const personalTotal = personalRecords.reduce((s, r) => s + r.total_expenditure, 0);
  const bbt = document.getElementById('bottom-business-total'); if (bbt) bbt.textContent = peso(businessTotal);
  const bpt = document.getElementById('bottom-personal-total'); if (bpt) bpt.textContent = peso(personalTotal);
  const bmt = document.getElementById('bottom-merged-total'); if (bmt) bmt.textContent = peso(businessTotal + personalTotal);
  const topItem = computeTopItem();
  const bti = document.getElementById('bottom-top-item'); if (bti) bti.textContent = topItem ? topItem.name : '—';
  const btis = document.getElementById('bottom-top-item-sub');
  if (btis) btis.textContent = topItem ? `${topItem.count}× purchased · ${peso(topItem.totalCost)}` : 'no purchases yet';
}
function buildGlobalSearchIndex(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  records.forEach(r => {
    const haystack = `${r.plantation_type} ${r.date} ${r.workers.map(w => w.name).join(' ')} ${r.workers.map(w => w.job_description).join(' ')} ${r.items.map(i => i.name).join(' ')}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ group: 'Business record', icon: '📋', label: `#${r.id} · ${r.plantation_type} · ${r.date}`, sub: `${peso(r.total_expenditure)}`, action: () => editRecord(r.id) });
    }
  });
  personalRecords.forEach(r => {
    const haystack = `${r.date} ${r.items.map(i => i.name).join(' ')}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ group: 'Personal expense', icon: '👤', label: `#${r.id} · ${r.date}`, sub: `${peso(r.total_expenditure)}`, action: () => editPersonalRecord(r.id) });
    }
  });
  activityRecords.forEach(a => {
    const haystack = `${a.date} ${a.plantation_type || ''} ${a.description}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ group: 'Diary entry', icon: '📔', label: `${a.date}${a.plantation_type ? ' · ' + a.plantation_type : ''}`, sub: a.description.slice(0, 70), action: () => editActivity(a.id) });
    }
  });
  cashAdvances.forEach(a => {
    if (`${a.name} ${a.note || ''}`.toLowerCase().includes(q)) {
      results.push({ group: 'Cash advance', icon: '💵', label: `${a.name} · ${peso(a.amount)}`, sub: `${a.date}`, action: () => { navigateTo('advances'); renderAdvances(); } });
    }
  });
  lenderLoans.forEach(l => {
    if (`${l.lender} ${l.note || ''}`.toLowerCase().includes(q)) {
      results.push({ group: 'Lender loan', icon: '💳', label: `${l.lender} · ${peso(l.principal)}`, sub: `${l.date}`, action: () => { navigateTo('loans'); renderLoans(); } });
    }
  });
  inventoryItems.forEach(i => {
    if (`${i.name} ${i.supplier || ''}`.toLowerCase().includes(q)) {
      results.push({ group: 'Inventory', icon: '📦', label: i.name, sub: `${i.stock} ${i.unit} on hand`, action: () => { navigateTo('inventory'); renderInventory(); } });
    }
  });
  plantationSales.forEach(s => {
    if (`${s.customer_name} ${s.location || ''} ${s.plantation_type}`.toLowerCase().includes(q)) {
      results.push({ group: 'Sale', icon: '🛒', label: `${s.customer_name} · ${peso(s.total)}`, sub: `${s.plantation_type} · ${s.date}`, action: () => showPlantationDetail(s.plantation_type) });
    }
  });
  const seen = new Set();
  records.forEach(r => r.workers.forEach(w => {
    const key = w.name.toLowerCase();
    if (key.includes(q) && !seen.has(key)) {
      seen.add(key);
      results.push({ group: 'Worker', icon: '👷', label: w.name, sub: 'View employment history', action: () => { navigateTo('workers'); document.getElementById('w-name').value = w.name; renderWorkerHistory(); } });
    }
  }));
  PLANTATION_TYPES.forEach(type => {
    if (type.toLowerCase().includes(q)) {
      results.push({ group: 'Plantation', icon: plantationEmoji(type), label: type, sub: `${peso(expenditureFor(type))} total`, action: () => showPlantationDetail(type) });
    }
  });
  return results.slice(0, 40);
}
function renderGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const menu = document.getElementById('global-search-results');
  if (!input || !menu) return;
  const query = input.value;
  if (!query.trim()) { menu.classList.remove('open'); menu.innerHTML = ''; return; }
  const results = buildGlobalSearchIndex(query);
  if (results.length === 0) {
    menu.innerHTML = `<div class="custom-select-option" style="cursor:default;">No matches for "${escapeHtml(query)}"</div>`;
    menu.classList.add('open');
    return;
  }
  let lastGroup = null;
  menu.innerHTML = results.map((r, idx) => {
    const groupHeader = r.group !== lastGroup ? `<div class="submenu-label" style="border-top:${idx === 0 ? 'none' : '1px solid var(--border)'};">${r.icon} ${r.group.toUpperCase()}</div>` : '';
    lastGroup = r.group;
    return `${groupHeader}<div class="custom-select-option" data-result-idx="${idx}">
      <div style="font-weight:600;">${escapeHtml(r.label)}</div>
      <div style="color:var(--faint);font-size:11px;margin-top:2px;">${escapeHtml(r.sub)}</div>
    </div>`;
  }).join('');
  menu.querySelectorAll('[data-result-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-result-idx'), 10);
      results[idx].action();
      menu.classList.remove('open');
      input.value = '';
    });
  });
  menu.classList.add('open');
}

function navigateTo(viewName) {
  if (isPrivateView(viewName) && !ownerUnlocked) {
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
  if (viewName === 'records') renderRecords();
  else if (viewName === 'reports') renderReports();
  else if (viewName === 'bydate') { populateQuickDates(); renderDateSummary(); }
  else if (viewName === 'workers') populateQuickWorkers();
  else if (viewName === 'business') renderBusiness();
  else if (viewName === 'personal') renderPersonal();
  else if (viewName === 'shares') renderShares();
  else if (viewName === 'capital') renderCapital();
  else if (viewName === 'advances') renderAdvances();
  else if (viewName === 'loans') renderLoans();
  else if (viewName === 'inventory') renderInventory();
  else if (viewName === 'products') renderProducts();
  else if (viewName === 'shop') renderShop();
  else if (viewName === 'orders') renderOrders();
  else if (viewName === 'payroll') renderPayrollHistory();
  else if (viewName === 'planning') renderPlanning();
  else if (viewName === 'activities') renderActivities();
  else if (viewName === 'dashboard') { renderDashboard(); renderAlerts(); }
  else if (viewName === 'add') checkDraft();
}
function switchToAccountTab() { navigateTo('business'); }

function refreshAll() {
  if (ownerUnlocked) {
    const badge = document.getElementById('record-count-badge');
    if (badge) badge.textContent = `${records.length} business · ${personalRecords.length} personal · ${activityRecords.length} diary`;
  }
  const activeView = document.querySelector('.view.active')?.id?.replace('view-', '');
  if (activeView === 'records') renderRecords();
  if (activeView === 'reports') renderReports();
  if (activeView === 'bydate') { populateQuickDates(); renderDateSummary(); }
  if (activeView === 'workers') populateQuickWorkers();
  if (activeView === 'business') renderBusiness();
  if (activeView === 'personal') renderPersonal();
  if (activeView === 'shares') renderShares();
  if (activeView === 'capital') renderCapital();
  if (activeView === 'advances') renderAdvances();
  if (activeView === 'loans') renderLoans();
  if (activeView === 'inventory') renderInventory();
  if (activeView === 'products') renderProducts();
  if (activeView === 'shop') renderShop();
  if (activeView === 'orders') renderOrders();
  if (activeView === 'payroll') renderPayrollHistory();
  if (activeView === 'planning') renderPlanning();
  if (activeView === 'activities') renderActivities();
  if (activeView === 'plantation-detail' && selectedPlantationType) { renderPlantationDetail(selectedPlantationType); renderPlantationSales(selectedPlantationType); }
  if (activeView === 'dashboard') { renderDashboard(); renderAlerts(); }
  if (ownerUnlocked) updateBottomIndicators();
  if (!ownerUnlocked) return;
  const total = records.reduce((s, r) => s + r.total_expenditure, 0);
  const totalYield = records.reduce((s, r) => s + (r.yield_kg || 0), 0);
  const totalNetSales = PLANTATION_TYPES.reduce((s, t) => s + netSalesFor(t), 0);
  const personalTotal = personalRecords.reduce((s, r) => s + r.total_expenditure, 0);
  const mergedTotal = total + personalTotal;
  const stats = document.getElementById('vertical-ag-stats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><div class="label">📋 Total Records</div><div class="value">${records.length}</div></div>
      <div class="stat-card"><div class="label">📔 Diary Entries</div><div class="value">${activityRecords.length}</div></div>
      <div class="stat-card"><div class="label">💰 Total Business Expenses</div><div class="value">${peso(total)}</div></div>
      <div class="stat-card good"><div class="label">🌾 Total Yield</div><div class="value">${totalYield} kg</div></div>
      <div class="stat-card ${totalNetSales >= 0 ? 'good' : 'bad'}"><div class="label">📈 Net Sales</div><div class="value">${peso(totalNetSales)}</div></div>
      <div class="stat-card"><div class="label">👤 Total Personal Expenses</div><div class="value personal">${peso(personalTotal)}</div></div>
      <div class="stat-card"><div class="label">📊 Total Business and Personal Expenses</div><div class="value merged">${peso(mergedTotal)}</div></div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  ownerPinHash = null;
  ownerUnlocked = localStorage.getItem(OWNER_UNLOCKED_KEY) === '1';

  populateTypeDropdowns();
  populatePlantationSubmenu();
  syncNavActiveStates('about');
  ['f-type', 's-type', 'cap-type', 'adv-type', 'pr-type', 'plan-type', 'activity-plantation', 'loan-type']
    .forEach(enhancePlantationSelect);

  ['f-date','p-date','d-date','cap-date','adv-date','plan-date','loan-date','activity-date','sale-date']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });
  ['pr-from','pr-to'].forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });
  const loanType = document.getElementById('loan-type');
  if (loanType) loanType.innerHTML = `<option value="">— none —</option>` + PLANTATION_TYPES.map(t => `<option>${t}</option>`).join('');

  addWorkerRow();
  addItemRow();
  addPersonalItemRow();

  const photoInput = document.getElementById('activity-photo');
  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      const preview = document.getElementById('activity-photo-preview');
      if (!file) { pendingActivityPhoto = null; if (preview) preview.innerHTML = ''; return; }
      if (!file.type.startsWith('image/')) { showToast('⚠️ Please choose an image file', 'error'); photoInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingActivityPhoto = e.target.result;
        if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingActivityPhoto}" alt="Photo preview">`;
      };
      reader.readAsDataURL(file);
    });
  }
  const videoInput = document.getElementById('activity-video-file');
  if (videoInput) {
    videoInput.addEventListener('change', () => {
      const file = videoInput.files && videoInput.files[0];
      const preview = document.getElementById('activity-video-file-preview');
      if (!file) { pendingActivityVideoFile = null; if (preview) preview.innerHTML = ''; return; }
      if (!file.type.startsWith('video/')) { showToast('⚠️ Please choose a video file', 'error'); videoInput.value = ''; return; }
      if (file.size > MAX_VIDEO_BYTES) { showToast(`⚠️ Video too large (max ~${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB)`, 'error', 5000); videoInput.value = ''; return; }
      pendingActivityVideoFile = file;
      if (preview) { const url = URL.createObjectURL(file); preview.innerHTML = `<video class="journal-video-preview-thumb" src="${url}" controls playsinline preload="metadata"></video>`; }
    });
  }
  const pdPhotoInput = document.getElementById('pd-photo-file');
  if (pdPhotoInput) {
    pdPhotoInput.addEventListener('change', () => {
      const file = pdPhotoInput.files && pdPhotoInput.files[0];
      const preview = document.getElementById('pd-photo-preview');
      if (!file) { pendingPlantationPhoto = null; if (preview) preview.innerHTML = ''; return; }
      if (!file.type.startsWith('image/')) { showToast('⚠️ Please choose an image file', 'error'); pdPhotoInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingPlantationPhoto = e.target.result;
        if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingPlantationPhoto}" alt="Photo preview">`;
      };
      reader.readAsDataURL(file);
    });
  }
  const pdVideoInput = document.getElementById('pd-video-file');
  if (pdVideoInput) {
    pdVideoInput.addEventListener('change', () => {
      const file = pdVideoInput.files && pdVideoInput.files[0];
      const preview = document.getElementById('pd-video-preview');
      if (!file) { pendingPlantationVideoFile = null; if (preview) preview.innerHTML = ''; return; }
      if (!file.type.startsWith('video/')) { showToast('⚠️ Please choose a video file', 'error'); pdVideoInput.value = ''; return; }
      if (file.size > MAX_VIDEO_BYTES) { showToast(`⚠️ Video too large`, 'error', 5000); pdVideoInput.value = ''; return; }
      pendingPlantationVideoFile = file;
      if (preview) { const url = URL.createObjectURL(file); preview.innerHTML = `<video class="journal-video-preview-thumb" src="${url}" controls playsinline preload="metadata"></video>`; }
    });
  }
  const prodPhotoInput = document.getElementById('prod-photo');
  if (prodPhotoInput) {
    prodPhotoInput.addEventListener('change', () => {
      const file = prodPhotoInput.files && prodPhotoInput.files[0];
      const preview = document.getElementById('prod-photo-preview');
      if (!file) { pendingProductPhoto = null; if (preview) preview.innerHTML = ''; return; }
      if (!file.type.startsWith('image/')) { showToast('⚠️ Please choose an image file', 'error'); prodPhotoInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingProductPhoto = e.target.result;
        if (preview) preview.innerHTML = `<img class="journal-photo-preview-thumb" src="${pendingProductPhoto}" alt="Product photo preview">`;
      };
      reader.readAsDataURL(file);
    });
  }

  document.querySelectorAll('.sidebar-link[data-view], .hamburger-dropdown a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      const v = link.getAttribute('data-view');
      if (!v) return;
      e.preventDefault();
      navigateTo(v);
      const dropdown = document.getElementById('hamburgerDropdown');
      const btn = document.getElementById('hamburgerBtn');
      if (dropdown) dropdown.classList.remove('open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });
  const hb = document.getElementById('hamburgerBtn');
  if (hb) hb.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('hamburgerDropdown');
    const open = dd.classList.toggle('open');
    hb.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('hamburgerDropdown');
    const btn = document.getElementById('hamburgerBtn');
    if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  const home = document.getElementById('homeBtn');
  if (home) home.onclick = () => navigateTo('dashboard');
  const oal = document.getElementById('owner-access-link');
  if (oal) oal.onclick = handleOwnerAccessClick;
  const oalm = document.getElementById('owner-access-link-mobile');
  if (oalm) oalm.onclick = handleOwnerAccessClick;
  const cno = document.getElementById('confirm-no');
  if (cno) cno.onclick = () => document.getElementById('confirm-modal').classList.remove('open');
  ['owner-gate-pin','owner-gate-pin-confirm'].forEach(id => {
    = const el = document.getElementById(id);
    if ( nullel) el.addEventListener('keydown', (;
e) => { if (e.key === 'Enter') submitOwnerGate(); });
     });

  const si = document.getElementById('global-search-input');
  const sm si = document.getElementById('global-search-results');
  if.addEventListener(' (si && sm) {
    let debounceTimerinput', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderGlobalSearch, 120);
    });
    si.addEventListener('focus', () => { if (si.value.trim()) renderGlobalSearch(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#global-search-wrap')) sm.classList.remove('open'); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'f') {
      const searchInput = document.getElementById('s-worker');
      if (searchInput) { e.preventDefault(); searchInput.focus(); }
    }
    if (e.key === 'Escape') {
      const active = document.activeElement;
      if (active && ['s-worker','s-type','s-from','s-to','s-min-amount','s-max-amount'].includes(active.id)) clearFilters();
    }
  });

  applyLockUI();

  // FIXED: Removed the fatal `return` so the app doesn't crash if IndexedDB fails
  try {
    await openDB();
  } catch (e) {
    console.warn('IndexedDB check failed, continuing with fallback:', e);
  }

  await seedDataIfEmpty();
  await loadRecords();
  await loadCapitalAndAdvances();
  await loadHarvestSharePcts();
  await loadExtras();
  await loadLoans();
  await loadPlantationPricing();
  await loadPlantationMedia();
  await loadPlantationSales();
  await loadWeatherSettings();
  await loadActivities();
  await loadProducts();
  await loadOrders();
  await loadOwnerPin();
  await migrateLegacyMaizeData();
  refreshAll();
  fetchWeather();

  autoSaveTimer = setInterval(() => { if (isFormDirty) saveDraft(); }, AUTO_SAVE_INTERVAL);
  window.addEventListener('beforeunload', (e) => {
    if (isFormDirty) {
      saveDraft();
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. They have been saved as a draft.';
    }
  });
});

console.log('🌱 Valley and Creeks Farm initialized v3');
