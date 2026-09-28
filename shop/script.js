'use strict';

const OWNER_WHATSAPP = "639757841228";
const OWNER_EMAIL = "pansensoyglenn150@gmail.com";
const CART_KEY = 'vc-shop-cart-v2';
const CATALOG_CACHE_KEY = 'vc-shop-catalog-cache-v2';

let products = [];
let cart = {};

function peso(n) {
  return "₱" + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function round2(n) { return Math.round(n * 100) / 100; }
function escapeHtml(t) {
  if (t === null || t === undefined) return '';
  const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML;
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function showToast(msg, type = 'info', duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.className = 'toast';
  if (type === 'error') t.classList.add('error');
  if (type === 'success') t.classList.add('success');
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), duration);
}
function plantationEmoji(type) {
  const m = {
    "Coconut Plantation": "🥥", "Lanzones Plantation": "🫐", "Durian Plantation": "🌰",
    "Maize Production — Right Bank": "🌽", "Maize Production — Left Bank": "🌽", "Maize Production — Upper Valley": "🌽",
    "String Beans Plantation": "🫛", "Tomato Plantation": "🍅", "Potato Plantation": "🥔",
    "Squash Production": "🎃", "Eggplant Farming": "🍆", "Zucchini Plantation": "🥒",
    "Rambutan Plantation": "🍒", "Peanut Production": "🥜", "Tuber Farming": "🍠"
  };
  return m[type] || "🌿";
}

async function loadCatalog() {
  const cached = localStorage.getItem(CATALOG_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.products)) {
        products = parsed.products;
        renderShop();
      }
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    products = Array.isArray(data.products) ? data.products : [];
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
      products,
      fetched_at: Date.now()
    }));
    renderShop();
    document.getElementById('loading-overlay').classList.remove('open');
  } catch (err) {
    console.warn('Catalog fetch failed:', err);
    if (products.length === 0) {
      const card = document.getElementById('shop-status-card');
      if (card) {
        card.innerHTML = `<h2>Couldn't load products</h2>
          <p style="color:var(--muted);font-size:13px;">Check your internet connection and refresh. If this persists, contact the farm directly at 0975 784 1228.</p>`;
      }
    } else {
      showToast('📴 Offline — showing last cached catalog', 'info', 3500);
    }
    document.getElementById('loading-overlay').classList.remove('open');
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) cart = JSON.parse(raw) || {};
  } catch (e) { cart = {}; }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
}
function cartTotal() {
  return round2(Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === parseInt(id, 10));
    return sum + (p ? p.price * qty : 0);
  }, 0));
}
function changeCartQty(productId, delta) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const current = cart[productId] || 0;
  const maxStock = (p.stock === undefined) ? Infinity : p.stock;
  const next = Math.max(0, Math.min(maxStock, current + delta));
  if (next === 0) delete cart[productId];
  else cart[productId] = next;
  saveCart();
  renderShop();
}

function renderShop() {
  const loadingCard = document.getElementById('shop-status-card');
  const productsCard = document.getElementById('shop-products-card');
  const grid = document.getElementById('shop-product-grid');
  const countLabel = document.getElementById('shop-count-label');

  if (loadingCard) loadingCard.style.display = 'none';
  if (productsCard) productsCard.style.display = '';
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="glyph">🛒</span>Nothing available to order right now — check back soon.</div>`;
    if (countLabel) countLabel.textContent = '(0)';
  } else {
    if (countLabel) countLabel.textContent = `(${products.length})`;
    grid.innerHTML = products.map(p => {
      const qty = cart[p.id] || 0;
      return `
        <div class="product-card">
          ${p.photo
            ? `<img class="product-photo" src="${escapeHtml(p.photo)}" alt="${escapeHtml(p.name)}">`
            : `<div class="product-photo product-photo-placeholder">${plantationEmoji(p.plantation_type || '')}</div>`}
          <div class="product-name">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="product-desc">${escapeHtml(p.description)}</div>` : ''}
          <div class="product-price">${peso(p.price)} <span class="product-unit">/ ${escapeHtml(p.unit)}</span></div>
          <div class="product-stock">${p.stock !== undefined ? p.stock + ' ' + p.unit + ' available' : 'Available'}</div>
          <div class="qty-stepper">
            <button class="btn-ghost btn-sm" onclick="changeCartQty(${p.id}, -1)" aria-label="Decrease">−</button>
            <span class="qty-value">${qty}</span>
            <button class="btn-ghost btn-sm" onclick="changeCartQty(${p.id}, 1)" aria-label="Increase">+</button>
          </div>
        </div>`;
    }).join('');
  }
  renderCart();
}

function renderCart() {
  const itemsOut = document.getElementById('cart-items');
  const countLabel = document.getElementById('cart-count-label');
  const totalsStrip = document.getElementById('cart-totals-strip');
  const checkoutCard = document.getElementById('checkout-card');
  const cartCard = document.getElementById('cart-card');
  if (!itemsOut) return;

  const entries = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(x => x.id === parseInt(id, 10)), qty }))
    .filter(e => e.product);

  const totalQty = entries.reduce((s, e) => s + e.qty, 0);
  if (countLabel) countLabel.textContent = `(${totalQty} item${totalQty !== 1 ? 's' : ''})`;

  if (entries.length === 0) {
    if (cartCard) cartCard.style.display = 'none';
    if (checkoutCard) checkoutCard.style.display = 'none';
    itemsOut.innerHTML = '';
    return;
  }

  if (cartCard) cartCard.style.display = '';
  if (checkoutCard) checkoutCard.style.display = '';
  if (totalsStrip) totalsStrip.style.display = '';

  itemsOut.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Subtotal</th><th></th></tr></thead>
    <tbody>${entries.map(e => `
      <tr>
        <td>${escapeHtml(e.product.name)}</td>
        <td class="num">${e.qty} ${escapeHtml(e.product.unit)}</td>
        <td class="num">${peso(e.product.price)}</td>
        <td class="num">${peso(round2(e.product.price * e.qty))}</td>
        <td class="actions-cell"><button class="btn-danger btn-sm" onclick="changeCartQty(${e.product.id}, -${e.qty})" aria-label="Remove">Remove</button></td>
      </tr>
    `).join('')}</tbody>
  </table></div>`;

  const grandEl = document.getElementById('cart-grand-total');
  if (grandEl) grandEl.textContent = peso(cartTotal());
}

function formatOrderMessage(order) {
  const lines = [
    `🌾 New order — Valley and Creeks Farm`,
    ``,
    order.id ? `Order #: ${order.id}` : null,
    `Customer: ${order.customer_name}`,
    `Cellphone: ${order.cellphone}`,
    `Address: ${order.address}`,
    order.notes ? `Notes: ${order.notes}` : null,
    ``,
    `Items:`,
    ...order.items.map(i => `- ${i.name}: ${i.qty} ${i.unit} × ${peso(i.price)} = ${peso(round2(i.qty * i.price))}`),
    ``,
    `Order total: ${peso(order.total)}`,
    `Order date: ${order.date}`
  ].filter(Boolean);
  return lines.join('\n');
}

async function placeOrder(method) {
  const entries = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(x => x.id === parseInt(id, 10)), qty }))
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
    date: todayISO(),
    customer_name: name,
    cellphone, address, notes,
    items: entries.map(e => ({
      product_id: e.product.id,
      name: e.product.name,
      unit: e.product.unit,
      qty: e.qty,
      price: e.product.price
    })),
    total: cartTotal()
  };

  let savedOrderId = null;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    if (res.ok) {
      const data = await res.json();
      savedOrderId = data.order && data.order.id;
      order.id = savedOrderId;
    } else {
      console.warn('Order POST returned', res.status);
    }
  } catch (err) {
    console.warn('Order POST failed — continuing with WhatsApp only:', err);
  }

  const message = formatOrderMessage(order);
  if (method === 'email') {
    const subject = encodeURIComponent(`New order from ${name} — Valley and Creeks Farm${savedOrderId ? ' (#' + savedOrderId + ')' : ''}`);
    const body = encodeURIComponent(message);
    window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  } else {
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${OWNER_WHATSAPP}?text=${text}`, '_blank', 'noopener');
  }

  if (savedOrderId) {
    showToast(`✅ Order #${savedOrderId} sent to the farm`, 'success', 5000);
  } else {
    showToast(`✅ Order ready — send it from the ${method === 'email' ? 'email' : 'WhatsApp'} window`, 'success', 5000);
  }

  cart = {};
  saveCart();
  document.getElementById('order-name').value = '';
  document.getElementById('order-cellphone').value = '';
  document.getElementById('order-address').value = '';
  document.getElementById('order-notes').value = '';
  renderShop();
}

window.changeCartQty = changeCartQty;
window.placeOrder = placeOrder;

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadCatalog();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js', { scope: '/' })
      .then(reg => console.log('✅ Shop SW registered:', reg.scope))
      .catch(err => console.warn('Shop SW registration failed:', err));
  });
}
