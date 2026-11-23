/* Frugea B2B — clickable MVP (no backend; state lives in localStorage). */
const STORE_KEY = 'frugea_demo_v1';
const FLOW = [
  { key: 'received', label: 'Received' },
  { key: 'processing', label: 'In process' },
  { key: 'out', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];
const STATUS_LABEL = { received: 'Received', processing: 'In process', out: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

let db = load();
const ui = { q: '', cat: 'all', sort: 'name', adminOrderFilter: 'all' };

/* ---------- storage ---------- */
// Data is shared across tabs (localStorage); the logged-in role is per tab (sessionStorage),
// so you can keep a customer tab and an admin tab open side by side.
const SESSION_KEY = 'frugea_demo_session';
function load() {
  let data = null;
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) data = JSON.parse(raw); } catch (e) { /* ignore */ }
  data = data || seedData();
  try { data.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { data.session = null; }
  return data;
}
function save() {
  try {
    const { session, ...rest } = db;
    localStorage.setItem(STORE_KEY, JSON.stringify(rest));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) { /* ignore */ }
}

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '€' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtDT = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const uid = p => p + Math.random().toString(36).slice(2, 9);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c');
const product = id => db.products.find(p => p.id === id);
const customer = id => db.customers.find(c => c.id === id);
const driver = id => db.drivers.find(d => d.id === id);
const priceOf = p => p.offerPrice ?? p.price;
const me = () => db.session?.role === 'customer' ? customer(db.session.customerId) : null;
const currentPoint = () => { const c = me(); return c && (c.points.find(p => p.id === db.session.pointId) || c.points[0]); };
const cart = () => (db.carts[db.session.customerId] ||= []);
const favs = () => (db.favorites[db.session.customerId] ||= []);
const orderTotals = items => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const vat = subtotal * db.vat;
  return { subtotal, vat, total: subtotal + vat };
};
const badge = st => `<span class="badge ${st}">${esc(STATUS_LABEL[st] || st)}</span>`;

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
function modal(html) {
  $('#modal-root').innerHTML = `<div class="modal-bg" data-action="close-modal-bg"><div class="modal">${html}</div></div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function go(hash) { location.hash = hash; }

/* ---------- search ---------- */
function searchProducts(q, cat) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  return db.products
    .filter(p => p.active)
    .filter(p => cat === 'all' || (cat === 'offers' ? p.offerPrice : cat === 'new' ? p.isNew : p.cat === cat))
    .map(p => {
      const catName = db.categories.find(c => c.id === p.cat)?.name || '';
      const hay = norm([p.name, p.sku, catName, p.tags, p.origin].join(' '));
      const name = norm(p.name);
      let score = 0;
      for (const t of tokens) {
        if (name.startsWith(t)) score += 5;
        else if (name.includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
        else if (t.length > 3 && hay.includes(t.slice(0, -1))) score += 0.5; // tolerate a typo/plural at the end
        else return null;
      }
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => tokens.length && b.score !== a.score ? b.score - a.score
      : ui.sort === 'price' ? priceOf(a.p) - priceOf(b.p) : a.p.name.localeCompare(b.p.name))
    .map(x => x.p);
}

/* ---------- router ---------- */
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  return { name: parts[0] || '', arg: parts[1], arg2: parts[2] };
}

function render() {
  const r = route();
  if (!db.session) { $('#app').innerHTML = viewLogin(); return; }
  if (db.session.role === 'admin') {
    if (r.name !== 'admin' && r.name !== 'invoice') return go('#/admin');
  } else if (r.name === 'admin' || !r.name) return go('#/shop');

  if (r.name === 'invoice') { $('#app').innerHTML = viewInvoice(r.arg); return; }

  const content = db.session.role === 'admin' ? adminView(r) : customerView(r);
  $('#app').innerHTML = shell(r, content);
  window.scrollTo(0, 0);
}

/* ---------- shell ---------- */
function shell(r, content) {
  const isAdmin = db.session.role === 'admin';
  const key = isAdmin ? (r.arg || 'dashboard') : r.name;
  const cartCount = isAdmin ? 0 : cart().reduce((s, i) => s + i.qty, 0);
  const newOrders = db.orders.filter(o => o.status === 'received').length;
  const openProblems = db.problems.filter(p => p.status === 'open').length;

  const items = isAdmin ? [
    ['dashboard', '#/admin', '📊', 'Dashboard'],
    ['orders', '#/admin/orders', '📦', 'Orders', newOrders],
    ['products', '#/admin/products', '🥜', 'Products'],
    ['customers', '#/admin/customers', '🏪', 'Customers'],
    ['problems', '#/admin/problems', '⚠️', 'Problems', openProblems],
    ['posts', '#/admin/posts', '📰', 'Website / CMS'],
  ] : [
    ['shop', '#/shop', '🛍️', 'Products'],
    ['buy-again', '#/buy-again', '🔁', 'Buy Again'],
    ['cart', '#/cart', '🛒', 'Cart', cartCount],
    ['orders', '#/orders', '📦', 'My Orders'],
    ['news', '#/news', '📰', 'News & Offers'],
    ['account', '#/account', '👤', 'My Account'],
    ['help', '#/help', '💬', 'Help'],
  ];
  const matchKey = k => k === key || (k === 'orders' && key === 'order');
  const links = items.map(([k, href, ico, label, n]) =>
    `<a href="${href}" class="${matchKey(k) ? 'active' : ''}"><span class="ico">${ico}</span>${label}${n ? `<span class="badge count">${n}</span>` : ''}</a>`).join('');

  const c = me();
  const topbar = isAdmin ? '' : `
    <div class="topbar no-print">
      <div class="point-pill">📍 Ordering for:
        <select data-change="set-point">${c.points.map(p => `<option value="${p.id}" ${p.id === currentPoint().id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      </div>
      <div class="spacer"></div>
      <a class="btn sm" href="#/cart">🛒 ${cartCount} item${cartCount === 1 ? '' : 's'}</a>
    </div>`;

  return `
  <div class="shell">
    <aside class="sidebar">
      <div class="logo">Frugea<span>.</span></div>
      <div class="role-tag">${isAdmin ? 'Admin panel' : esc(c.business)}</div>
      <nav class="nav">${links}</nav>
      <div class="sidebar-foot">
        <button class="btn sm block" data-action="logout">Switch user / Log out</button>
        <button class="btn sm block danger" style="margin-top:6px" data-action="reset">Reset demo data</button>
      </div>
    </aside>
    <main class="main">${topbar}${content}</main>
    <nav class="mobile-tabs">${items.map(([k, href, ico, label, n]) =>
      `<a href="${href}" class="${matchKey(k) ? 'active' : ''}"><span class="ico">${ico}</span>${{ 'Buy Again': 'Reorder', 'My Orders': 'Orders', 'News & Offers': 'News', 'My Account': 'Account', 'Website / CMS': 'CMS' }[label] || label}${n ? `<span class="badge count">${n}</span>` : ''}</a>`).join('')}
      <a href="#" data-action="logout"><span class="ico">↩️</span>Exit</a>
    </nav>
    ${isAdmin ? '' : `<a class="fab-wa" target="_blank" rel="noopener" href="https://wa.me/${db.company.whatsapp}?text=${encodeURIComponent('Hello Frugea, this is ' + c.business + '.')}">💬 <span class="lbl">WhatsApp us</span></a>`}
  </div>`;
}

/* ---------- login ---------- */
function viewLogin() {
  return `
  <div class="login"><div class="card">
    <div class="logo">Frugea<span>.</span></div>
    <p class="muted">B2B ordering portal — demo</p>
    <p class="small muted" style="margin-top:20px">Pick a role to explore:</p>
    <button class="btn primary block" data-action="login" data-cust="c1">🏪 Customer: Market Ana (3 stores)</button>
    <button class="btn block" data-action="login" data-cust="c2">☕ Customer: Café Lumi (1 location)</button>
    <button class="btn green block" data-action="login-admin">🛠️ Frugea Admin panel</button>
    <p class="small muted" style="margin-top:20px">Tip: open the admin in a second tab to see orders arrive live.</p>
  </div></div>`;
}

/* ================= CUSTOMER ================= */
function customerView(r) {
  switch (r.name) {
    case 'shop': return viewShop();
    case 'buy-again': return viewBuyAgain();
    case 'cart': return viewCart();
    case 'orders': return viewOrders();
    case 'order': return viewOrder(r.arg);
    case 'news': return viewNews();
    case 'account': return viewAccount();
    case 'help': return viewHelp();
    default: return viewShop();
  }
}

function productCard(p) {
  const fav = favs().includes(p.id);
  return `
  <div class="product">
    <div class="thumb">${p.emoji}
      <div class="badges">${p.isNew ? '<span class="badge new">NEW</span>' : ''}${p.offerPrice ? '<span class="badge offer">OFFER</span>' : ''}</div>
      <button class="icon-btn fav" title="Favorite" data-action="fav" data-id="${p.id}">${fav ? '❤️' : '🤍'}</button>
    </div>
    <div class="body">
      <div class="name">${esc(p.name)}</div>
      <div class="small muted">${esc(p.pack)} · ${esc(p.sku)}${p.origin ? ' · ' + esc(p.origin) : ''}</div>
      <div class="price">${money(priceOf(p))}${p.offerPrice ? `<s>${money(p.price)}</s>` : ''} <span class="small muted" style="font-weight:500">excl. VAT</span></div>
      <div class="add-row">
        <div class="qty"><button data-action="step" data-d="-1">−</button><input type="number" min="1" value="1" data-qty="${p.id}"><button data-action="step" data-d="1">+</button></div>
        <button class="btn primary sm" style="flex:1" data-action="add" data-id="${p.id}">Add</button>
      </div>
    </div>
  </div>`;
}

function viewShop() {
  const list = searchProducts(ui.q, ui.cat);
  const chips = [['all', 'All'], ['offers', '🔥 Offers'], ['new', '✨ New'], ...db.categories.map(c => [c.id, c.emoji + ' ' + c.name])];
  return `
    <h1>Products</h1>
    <p class="muted">${db.products.filter(p => p.active).length} products · prices per pack, excl. VAT</p>
    <div class="row" style="margin-top:14px">
      <div class="search"><input id="search" placeholder="Search name, SKU, category… (e.g. 'cashew', 'bajame', 'NUT-ALM')" value="${esc(ui.q)}" data-input="search" autocomplete="off"></div>
      <select style="width:auto" data-change="sort"><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Sort: Name</option><option value="price" ${ui.sort === 'price' ? 'selected' : ''}>Sort: Price</option></select>
    </div>
    <div class="chips">${chips.map(([id, l]) => `<button class="chip ${ui.cat === id ? 'active' : ''}" data-action="cat" data-id="${id}">${esc(l)}</button>`).join('')}</div>
    <div id="product-list">${productList(list)}</div>`;
}
function productList(list) {
  return list.length ? `<div class="products">${list.map(productCard).join('')}</div>`
    : `<div class="empty"><div class="big">🔎</div>No products match “${esc(ui.q)}”.</div>`;
}

function viewBuyAgain() {
  const c = me();
  const counts = {};
  db.orders.filter(o => o.customerId === c.id && o.status !== 'cancelled')
    .forEach(o => o.items.forEach(i => { counts[i.pid] = (counts[i.pid] || 0) + i.qty; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => product(id)).filter(p => p && p.active);
  const fav = favs().map(product).filter(p => p && p.active);
  const lastOrder = db.orders.filter(o => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return `
    <div class="row"><h1>Buy Again</h1><div class="spacer"></div>
      ${lastOrder ? `<button class="btn primary" data-action="reorder" data-id="${lastOrder.id}">🔁 Repeat last order (${esc(lastOrder.no)})</button>` : ''}</div>
    <h2 style="margin-top:20px">❤️ Favorites</h2>
    ${fav.length ? `<div class="products">${fav.map(productCard).join('')}</div>` : '<p class="muted">Tap the heart on any product to save it here.</p>'}
    <h2 style="margin-top:28px">📈 You buy these most often</h2>
    ${top.length ? `<div class="products">${top.map(productCard).join('')}</div>` : '<p class="muted">No orders yet.</p>'}`;
}

function viewCart() {
  const lines = cart().map(i => ({ ...i, p: product(i.pid) })).filter(i => i.p);
  if (!lines.length) return `<h1>Cart</h1><div class="card empty"><div class="big">🛒</div>Your cart is empty.<br><br><a class="btn primary" href="#/shop">Browse products</a></div>`;
  const t = orderTotals(lines.map(i => ({ price: priceOf(i.p), qty: i.qty })));
  const pt = currentPoint();
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  return `
    <h1>Cart</h1>
    <div class="grid-2" style="grid-template-columns: 1.6fr 1fr; margin-top:16px">
      <div class="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Qty</th><th class="right">Total</th><th></th></tr></thead>
          <tbody>${lines.map(i => `
            <tr>
              <td><b>${i.p.emoji} ${esc(i.p.name)}</b><div class="small muted">${esc(i.p.pack)} · ${money(priceOf(i.p))}</div></td>
              <td><div class="qty"><button data-action="cart-qty" data-id="${i.pid}" data-d="-1">−</button><input type="number" min="1" value="${i.qty}" data-change="cart-set" data-id="${i.pid}"><button data-action="cart-qty" data-id="${i.pid}" data-d="1">+</button></div></td>
              <td class="right"><b>${money(priceOf(i.p) * i.qty)}</b></td>
              <td><button class="icon-btn" title="Remove" data-action="cart-remove" data-id="${i.pid}">🗑️</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
      <form class="card" data-form="checkout">
        <h2>Order summary</h2>
        <div class="totals" style="max-width:none">
          <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
          <div><span>VAT ${Math.round(db.vat * 100)}%</span><span>${money(t.vat)}</span></div>
          <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
        </div>
        <label>Deliver to</label>
        <div class="card" style="padding:10px 12px;box-shadow:none;background:var(--surface-2)"><b>📍 ${esc(pt.name)}</b><div class="small muted">${esc(pt.address)}</div></div>
        <label>Preferred delivery date</label>
        <input type="date" name="deliveryDate" min="${tomorrow}" value="${tomorrow}">
        <label>Note for Frugea (optional)</label>
        <textarea name="note" placeholder="e.g. deliver before 10:00"></textarea>
        <button class="btn primary block" style="margin-top:16px;padding:12px">Send order</button>
        <p class="small muted" style="text-align:center;margin:8px 0 0">No online payment — you'll receive an invoice with the delivery.</p>
      </form>
    </div>`;
}

function viewOrders() {
  const list = db.orders.filter(o => o.customerId === db.session.customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!list.length) return `<h1>My Orders</h1><div class="card empty"><div class="big">📦</div>No orders yet.</div>`;
  return `
    <h1>My Orders</h1>
    <div class="card table-wrap" style="margin-top:16px"><table>
      <thead><tr><th>Order</th><th>Date</th><th class="hide-sm">Location</th><th>Status</th><th class="right">Total</th></tr></thead>
      <tbody>${list.map(o => `
        <tr class="click" data-action="nav" data-href="#/order/${o.id}">
          <td><b>${esc(o.no)}</b></td><td>${fmtDate(o.createdAt)}</td><td class="hide-sm">${esc(o.point.name)}</td>
          <td>${badge(o.status)}</td><td class="right"><b>${money(orderTotals(o.items).total)}</b></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function tracker(o) {
  if (o.status === 'cancelled') return `<p>${badge('cancelled')}</p>`;
  const idx = FLOW.findIndex(s => s.key === o.status);
  return `<div class="tracker">${FLOW.map((s, i) => {
    const h = o.history.find(x => x.status === s.key);
    return `<div class="step ${i <= idx ? 'done' : ''}"><div class="dot">${i <= idx ? '✓' : i + 1}</div>${s.label}<span class="when">${h ? fmtDT(h.at) : ''}</span></div>`;
  }).join('')}</div>`;
}

function orderItemsTable(o) {
  const t = orderTotals(o.items);
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>SKU</th><th class="right">Price</th><th class="right">Qty</th><th class="right">Total</th></tr></thead>
      <tbody>${o.items.map(i => `<tr><td>${esc(i.name)}<div class="small muted">${esc(i.pack)}</div></td><td class="small">${esc(i.sku)}</td><td class="right">${money(i.price)}</td><td class="right">${i.qty}</td><td class="right">${money(i.price * i.qty)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="totals" style="margin-top:12px">
      <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div><span>VAT ${Math.round(db.vat * 100)}%</span><span>${money(t.vat)}</span></div>
      <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
    </div>`;
}

function viewOrder(id) {
  const o = db.orders.find(x => x.id === id && x.customerId === db.session.customerId);
  if (!o) return `<div class="empty">Order not found.</div>`;
  const probs = db.problems.filter(p => p.orderId === o.id);
  const d = driver(o.driverId);
  return `
    <a href="#/orders" class="small">← My Orders</a>
    <div class="row" style="margin-top:8px"><h1>Order ${esc(o.no)}</h1>${badge(o.status)}<div class="spacer"></div>
      <a class="btn" href="#/invoice/${o.id}">🧾 Invoice</a>
      <button class="btn" data-action="reorder" data-id="${o.id}">🔁 Order again</button>
      <button class="btn danger" data-action="report" data-id="${o.id}">⚠️ Report a problem</button>
    </div>
    <p class="muted">Placed ${fmtDT(o.createdAt)} · 📍 ${esc(o.point.name)}, ${esc(o.point.address)}${o.deliveryDate ? ' · requested for ' + fmtDate(o.deliveryDate) : ''}</p>
    <div class="card">${tracker(o)}${o.status === 'out' && d ? `<p class="small" style="text-align:center">🚚 On the way with <b>${esc(d.name)}</b></p>` : ''}</div>
    <div class="card">${orderItemsTable(o)}${o.note ? `<p class="small muted">Note: ${esc(o.note)}</p>` : ''}</div>
    ${probs.length ? `<div class="card"><h2>Reported problems</h2>${probs.map(problemBlock).join('<hr style="border:0;border-top:1px solid var(--border)">')}</div>` : ''}`;
}
function problemBlock(p) {
  return `<div style="padding:6px 0"><div class="row"><b>${esc(p.type)}</b> ${badge(p.status)}<span class="small muted">${fmtDT(p.createdAt)}</span></div>
    <p style="margin:6px 0">${esc(p.text)}</p>${p.reply ? `<p class="small" style="margin:0"><b>Frugea:</b> ${esc(p.reply)}</p>` : ''}</div>`;
}

function viewNews() {
  const posts = db.posts.filter(p => p.published).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<h1>News & Offers</h1><p class="muted">Published by Frugea from the admin panel.</p>
    ${posts.length ? posts.map(p => `<div class="card post ${p.type}" style="margin-top:16px">
      <div class="row"><span class="badge ${p.type === 'offer' ? 'offer' : 'new'}">${p.type === 'offer' ? 'OFFER' : 'NEWS'}</span><span class="small muted">${fmtDate(p.createdAt)}</span></div>
      <h2 style="margin:8px 0 4px">${esc(p.title)}</h2><p style="margin:0;white-space:pre-line">${esc(p.body)}</p></div>`).join('') : '<div class="empty">Nothing yet.</div>'}`;
}

function viewAccount() {
  const c = me();
  return `
    <h1>My Account</h1>
    <div class="grid-2" style="margin-top:16px">
      <form class="card" data-form="account">
        <h2>Business details</h2>
        <label>Business name</label><input name="business" value="${esc(c.business)}" required>
        <label>NIPT / Tax ID</label><input name="nipt" value="${esc(c.nipt)}">
        <label>Contact person</label><input name="contact" value="${esc(c.contact)}">
        <label>Phone</label><input name="phone" value="${esc(c.phone)}">
        <label>Email</label><input name="email" type="email" value="${esc(c.email)}">
        <button class="btn primary" style="margin-top:16px">Save</button>
      </form>
      <div class="card">
        <h2>Delivery locations</h2>
        <p class="small muted">Choose which location you're ordering for from the top bar.</p>
        ${c.points.map(p => `<div class="card" style="box-shadow:none;padding:12px;margin-top:10px">
          <div class="row"><b>📍 ${esc(p.name)}</b>${p.id === currentPoint().id ? '<span class="badge delivered">Active</span>' : `<button class="btn sm" data-action="pick-point" data-id="${p.id}">Order for this</button>`}
          <div class="spacer"></div>${c.points.length > 1 ? `<button class="icon-btn" title="Remove" data-action="del-point" data-id="${p.id}">🗑️</button>` : ''}</div>
          <div class="small muted">${esc(p.address)}</div></div>`).join('')}
        <form data-form="add-point" style="margin-top:14px">
          <label>Add a location</label>
          <input name="name" placeholder="Name (e.g. Market Ana — Lezhë)" required>
          <input name="address" placeholder="Address" required style="margin-top:6px">
          <button class="btn" style="margin-top:8px">+ Add location</button>
        </form>
      </div>
    </div>`;
}

function viewHelp() {
  const ph = db.company.phone;
  return `
    <h1>Help & Contact</h1>
    <p class="muted">Talk to a Frugea representative — no forms.</p>
    <div class="grid-2" style="margin-top:16px">
      <a class="card" href="tel:${ph.replace(/\s/g, '')}" style="text-align:center;color:inherit"><div style="font-size:40px">📞</div><h2>Call us</h2><p class="muted">${esc(ph)}<br>Mon–Sat 08:00–18:00</p></a>
      <a class="card" target="_blank" rel="noopener" href="https://wa.me/${db.company.whatsapp}" style="text-align:center;color:inherit"><div style="font-size:40px">💬</div><h2>WhatsApp</h2><p class="muted">Usually replies within minutes</p></a>
    </div>
    <div class="card"><h3>Problem with an order?</h3><p class="muted" style="margin:0">Open the order in <a href="#/orders">My Orders</a> and tap <b>Report a problem</b>.</p></div>`;
}

/* ---------- invoice (printable) ---------- */
function viewInvoice(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o || (db.session.role === 'customer' && o.customerId !== db.session.customerId)) return '<div class="empty">Invoice not found.</div>';
  const c = customer(o.customerId);
  return `
    <div style="padding:16px">
      <div class="no-print row" style="max-width:820px;margin:0 auto 12px"><a class="btn" href="${db.session.role === 'admin' ? '#/admin/order/' : '#/order/'}${o.id}">← Back</a><div class="spacer"></div><button class="btn primary" onclick="window.print()">🖨️ Print / Save as PDF</button></div>
      <div class="invoice card">
        <div class="row" style="align-items:flex-start">
          <div><div class="logo" style="padding:0">Frugea<span>.</span></div><div class="small">Dry fruits & nuts wholesale<br>Tirana, Albania · ${esc(db.company.phone)}</div></div>
          <div class="spacer"></div>
          <div class="right"><h1>INVOICE</h1><div class="small">No. INV-${esc(o.no.replace('FR-', ''))}<br>Order ${esc(o.no)}<br>Date ${fmtDate(o.createdAt)}</div></div>
        </div>
        <div class="grid-2" style="margin:28px 0">
          <div><div class="small muted">BILL TO</div><b>${esc(c.business)}</b><br>NIPT ${esc(c.nipt)}<br>${esc(c.contact)} · ${esc(c.phone)}</div>
          <div><div class="small muted">DELIVER TO</div><b>${esc(o.point.name)}</b><br>${esc(o.point.address)}</div>
        </div>
        ${orderItemsTable(o)}
        <p class="small muted" style="margin-top:32px">Payment on delivery / bank transfer as agreed. Demo document — not a fiscal invoice.</p>
      </div>
    </div>`;
}

/* ================= ADMIN ================= */
function adminView(r) {
  switch (r.arg) {
    case 'orders': return adminOrders();
    case 'order': return adminOrder(r.arg2);
    case 'products': return adminProducts();
    case 'customers': return adminCustomers();
    case 'problems': return adminProblems();
    case 'posts': return adminPosts();
    default: return adminDashboard();
  }
}

function adminOrdersTable(list) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Order</th><th>Customer / location</th><th class="hide-sm">Placed</th><th>Status</th><th class="hide-sm">Driver</th><th class="right">Total</th></tr></thead>
    <tbody>${list.map(o => `<tr class="click" data-action="nav" data-href="#/admin/order/${o.id}">
      <td><b>${esc(o.no)}</b></td><td>${esc(customer(o.customerId)?.business)}<div class="small muted">${esc(o.point.name)}</div></td>
      <td class="hide-sm small">${fmtDT(o.createdAt)}</td><td>${badge(o.status)}</td><td class="hide-sm small">${esc(driver(o.driverId)?.name || '—')}</td>
      <td class="right"><b>${money(orderTotals(o.items).total)}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function adminDashboard() {
  const sorted = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const month = new Date().toISOString().slice(0, 7);
  const revenue = db.orders.filter(o => o.createdAt.slice(0, 7) === month && o.status !== 'cancelled').reduce((s, o) => s + orderTotals(o.items).total, 0);
  const kpis = [
    ['New orders', db.orders.filter(o => o.status === 'received').length, '#/admin/orders'],
    ['In process / on the road', db.orders.filter(o => o.status === 'processing' || o.status === 'out').length, '#/admin/orders'],
    ['Revenue this month', money(revenue), '#/admin/orders'],
    ['Open problems', db.problems.filter(p => p.status === 'open').length, '#/admin/problems'],
  ];
  return `<h1>Dashboard</h1><p class="muted">Today, ${fmtDate(new Date().toISOString())}</p>
    <div class="grid-4" style="margin:16px 0">${kpis.map(([l, v, h]) => `<a class="card kpi" href="${h}" style="color:inherit"><div class="val">${v}</div><div class="lbl">${l}</div></a>`).join('')}</div>
    <div class="card"><div class="row"><h2 style="margin:0">Latest orders</h2><div class="spacer"></div><a href="#/admin/orders" class="small">All orders →</a></div>${adminOrdersTable(sorted.slice(0, 6))}</div>`;
}

function adminOrders() {
  const f = ui.adminOrderFilter;
  const list = db.orders.filter(o => f === 'all' || o.status === f).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filters = [['all', 'All'], ...FLOW.map(s => [s.key, s.label]), ['cancelled', 'Cancelled']];
  return `<h1>Orders</h1>
    <div class="chips">${filters.map(([k, l]) => `<button class="chip ${f === k ? 'active' : ''}" data-action="order-filter" data-id="${k}">${l} (${k === 'all' ? db.orders.length : db.orders.filter(o => o.status === k).length})</button>`).join('')}</div>
    <div class="card">${list.length ? adminOrdersTable(list) : '<div class="empty">No orders.</div>'}</div>`;
}

function adminOrder(id) {
  const o = db.orders.find(x => x.id === id);
  if (!o) return '<div class="empty">Order not found.</div>';
  const c = customer(o.customerId);
  const idx = FLOW.findIndex(s => s.key === o.status);
  const next = FLOW[idx + 1];
  const probs = db.problems.filter(p => p.orderId === o.id);
  return `
    <a href="#/admin/orders" class="small">← Orders</a>
    <div class="row" style="margin-top:8px"><h1>${esc(o.no)}</h1>${badge(o.status)}<div class="spacer"></div>
      <a class="btn" href="#/invoice/${o.id}">🧾 Invoice</a></div>
    <p class="muted">${esc(c.business)} · placed ${fmtDT(o.createdAt)}</p>
    <div class="card">${tracker(o)}
      <div class="row" style="justify-content:center;margin-top:12px">
        ${next && o.status !== 'cancelled' ? `<button class="btn primary" data-action="advance" data-id="${o.id}">Move to “${next.label}” →</button>` : ''}
        ${o.status !== 'delivered' && o.status !== 'cancelled' ? `<button class="btn danger" data-action="cancel-order" data-id="${o.id}">Cancel order</button>` : ''}
      </div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card">
        <h2>Delivery</h2>
        <p style="margin:0"><b>📍 ${esc(o.point.name)}</b><br>${esc(o.point.address)}</p>
        <p class="small">👤 ${esc(c.contact)} · ${esc(c.phone)}${o.deliveryDate ? `<br>📅 Requested: ${fmtDate(o.deliveryDate)}` : ''}${o.note ? `<br>📝 ${esc(o.note)}` : ''}</p>
        <label>Assigned driver</label>
        <select data-change="assign-driver" data-id="${o.id}"><option value="">— not assigned —</option>${db.drivers.map(d => `<option value="${d.id}" ${o.driverId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        ${o.driverId ? `<a class="btn wa block" style="margin-top:10px" target="_blank" rel="noopener" href="${driverWaLink(o)}">💬 Send delivery to ${esc(driver(o.driverId).name)} on WhatsApp</a>` : ''}
      </div>
      <div class="card"><h2>Problems</h2>${probs.length ? probs.map(problemBlock).join('') : '<p class="muted">None reported.</p>'}</div>
    </div>
    <div class="card">${orderItemsTable(o)}</div>`;
}
function driverWaLink(o) {
  const d = driver(o.driverId); const c = customer(o.customerId);
  const text = `Delivery ${o.no}\n${c.business}\n📍 ${o.point.name}, ${o.point.address}\n📞 ${c.contact} ${c.phone}\n\n` +
    o.items.map(i => `• ${i.qty} × ${i.name} (${i.pack})`).join('\n') + (o.note ? `\n\nNote: ${o.note}` : '');
  return `https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

function adminProducts() {
  return `<div class="row"><h1>Products</h1><div class="spacer"></div><button class="btn primary" data-action="edit-product">+ New product</button></div>
    <div class="card table-wrap" style="margin-top:16px"><table>
      <thead><tr><th>Product</th><th class="hide-sm">Category</th><th class="right">Price</th><th class="right hide-sm">Stock</th><th>Status</th><th></th></tr></thead>
      <tbody>${db.products.map(p => `<tr>
        <td><b>${p.emoji} ${esc(p.name)}</b> ${p.isNew ? '<span class="badge new">NEW</span>' : ''} ${p.offerPrice ? '<span class="badge offer">OFFER</span>' : ''}<div class="small muted">${esc(p.sku)} · ${esc(p.pack)}</div></td>
        <td class="hide-sm">${esc(db.categories.find(c => c.id === p.cat)?.name)}</td>
        <td class="right">${money(priceOf(p))}${p.offerPrice ? `<div class="small muted"><s>${money(p.price)}</s></div>` : ''}</td>
        <td class="right hide-sm">${p.stock}</td>
        <td><button class="badge ${p.active ? 'delivered' : 'cancelled'}" style="border:0" data-action="toggle-product" data-id="${p.id}">${p.active ? 'Visible' : 'Hidden'}</button></td>
        <td class="right"><button class="btn sm" data-action="edit-product" data-id="${p.id}">Edit</button></td></tr>`).join('')}</tbody>
    </table></div>`;
}
function productForm(p) {
  p = p || { id: '', sku: '', name: '', cat: db.categories[0].id, emoji: '🥜', pack: '5 kg bag', price: '', offerPrice: null, isNew: true, stock: 100, origin: '', tags: '' };
  return `<form data-form="product" data-id="${p.id}">
    <h2>${p.id ? 'Edit product' : 'New product'}</h2>
    <div class="grid-2" style="gap:0 12px">
      <div><label>Name</label><input name="name" value="${esc(p.name)}" required></div>
      <div><label>SKU</label><input name="sku" value="${esc(p.sku)}" required></div>
      <div><label>Category</label><select name="cat">${db.categories.map(c => `<option value="${c.id}" ${p.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div><label>Icon (emoji — photo upload in real build)</label><input name="emoji" value="${esc(p.emoji)}"></div>
      <div><label>Pack</label><input name="pack" value="${esc(p.pack)}"></div>
      <div><label>Origin</label><input name="origin" value="${esc(p.origin)}"></div>
      <div><label>Price € (excl. VAT)</label><input name="price" type="number" step="0.01" min="0" value="${p.price}" required></div>
      <div><label>Offer price € (empty = none)</label><input name="offerPrice" type="number" step="0.01" min="0" value="${p.offerPrice ?? ''}"></div>
      <div><label>Stock (packs)</label><input name="stock" type="number" min="0" value="${p.stock}"></div>
      <div><label>Search keywords (other languages)</label><input name="tags" value="${esc(p.tags)}"></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isNew" style="width:auto" ${p.isNew ? 'checked' : ''}> Mark as NEW</label>
    <div class="actions">${p.id ? `<button type="button" class="btn danger" data-action="delete-product" data-id="${p.id}">Delete</button><div class="spacer"></div>` : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Save</button></div>
  </form>`;
}

function adminCustomers() {
  return `<h1>Customers</h1><div class="card table-wrap" style="margin-top:16px"><table>
    <thead><tr><th>Business</th><th class="hide-sm">Contact</th><th>Locations</th><th class="right">Orders</th><th class="right">Lifetime</th></tr></thead>
    <tbody>${db.customers.map(c => {
      const os = db.orders.filter(o => o.customerId === c.id && o.status !== 'cancelled');
      return `<tr><td><b>${esc(c.business)}</b><div class="small muted">NIPT ${esc(c.nipt)}</div></td><td class="hide-sm">${esc(c.contact)}<div class="small muted">${esc(c.phone)}</div></td>
        <td class="small">${c.points.map(p => esc(p.name)).join('<br>')}</td><td class="right">${os.length}</td><td class="right">${money(os.reduce((s, o) => s + orderTotals(o.items).total, 0))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function adminProblems() {
  const list = [...db.problems].sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
  return `<h1>Reported problems</h1>
    ${list.length ? list.map(p => {
      const o = db.orders.find(x => x.id === p.orderId);
      return `<div class="card" style="margin-top:16px"><div class="row"><b>${esc(customer(p.customerId)?.business)}</b> · <a href="#/admin/order/${p.orderId}">${esc(o?.no)}</a><div class="spacer"></div>${badge(p.status)}</div>
        ${problemBlock(p)}
        ${p.status === 'open' ? `<form data-form="resolve" data-id="${p.id}" class="row"><input name="reply" placeholder="Reply to customer…" style="flex:1" required><button class="btn green">Resolve</button></form>` : ''}</div>`;
    }).join('') : '<div class="card empty">No problems reported 🎉</div>'}`;
}

function adminPosts() {
  const list = [...db.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="row"><h1>Website / CMS</h1><div class="spacer"></div><button class="btn primary" data-action="edit-post">+ New post</button></div>
    <p class="muted">Posts and offers you publish here appear for customers under “News & Offers” (and on the public website in the full build). Publishing can also trigger a WhatsApp broadcast in phase 2.</p>
    ${list.map(p => `<div class="card post ${p.type}" style="margin-top:16px"><div class="row"><span class="badge ${p.type === 'offer' ? 'offer' : 'new'}">${p.type.toUpperCase()}</span>
      <span class="badge ${p.published ? 'delivered' : ''}">${p.published ? 'Published' : 'Draft'}</span><span class="small muted">${fmtDate(p.createdAt)}</span><div class="spacer"></div>
      <button class="btn sm" data-action="edit-post" data-id="${p.id}">Edit</button></div>
      <h2 style="margin:8px 0 4px">${esc(p.title)}</h2><p style="margin:0;white-space:pre-line" class="muted">${esc(p.body)}</p></div>`).join('')}`;
}
function postForm(p) {
  p = p || { id: '', type: 'news', title: '', body: '', published: true };
  return `<form data-form="post" data-id="${p.id}"><h2>${p.id ? 'Edit post' : 'New post'}</h2>
    <label>Type</label><select name="type"><option value="news" ${p.type === 'news' ? 'selected' : ''}>News</option><option value="offer" ${p.type === 'offer' ? 'selected' : ''}>Offer</option></select>
    <label>Title</label><input name="title" value="${esc(p.title)}" required>
    <label>Content</label><textarea name="body" rows="6" required>${esc(p.body)}</textarea>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" style="width:auto" ${p.published ? 'checked' : ''}> Published</label>
    <div class="actions">${p.id ? `<button type="button" class="btn danger" data-action="delete-post" data-id="${p.id}">Delete</button><div class="spacer"></div>` : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Save</button></div></form>`;
}

/* ================= ACTIONS ================= */
function addToCart(pid, qty) {
  const c = cart(); const line = c.find(i => i.pid === pid);
  if (line) line.qty += qty; else c.push({ pid, qty });
}
function setStatus(o, status) {
  o.status = status;
  if (!o.history.find(h => h.status === status)) o.history.push({ status, at: new Date().toISOString() });
}

const actions = {
  login(el) {
    const c = customer(el.dataset.cust);
    db.session = { role: 'customer', customerId: c.id, pointId: c.points[0].id };
    save(); go('#/shop'); render();
  },
  'login-admin'() { db.session = { role: 'admin' }; save(); go('#/admin'); render(); },
  logout() { db.session = null; save(); go('#/'); render(); },
  reset() { if (confirm('Reset all demo data?')) { const s = db.session; db = seedData(); db.session = s; save(); render(); toast('Demo data reset'); } },
  nav(el) { go(el.dataset.href); },
  cat(el) { ui.cat = el.dataset.id; render(); },
  step(el) {
    const input = el.parentElement.querySelector('input');
    input.value = Math.max(1, (parseInt(input.value, 10) || 1) + Number(el.dataset.d));
  },
  add(el) {
    const p = product(el.dataset.id);
    const qty = Math.max(1, parseInt(el.closest('.product').querySelector('[data-qty]').value, 10) || 1);
    addToCart(p.id, qty); save(); render(); toast(`Added ${qty} × ${p.name}`);
  },
  fav(el) {
    const f = favs(); const i = f.indexOf(el.dataset.id);
    if (i >= 0) f.splice(i, 1); else f.push(el.dataset.id);
    save(); render(); toast(i >= 0 ? 'Removed from favorites' : 'Added to favorites ❤️');
  },
  'cart-qty'(el) {
    const line = cart().find(i => i.pid === el.dataset.id);
    line.qty = Math.max(1, line.qty + Number(el.dataset.d)); save(); render();
  },
  'cart-remove'(el) { db.carts[db.session.customerId] = cart().filter(i => i.pid !== el.dataset.id); save(); render(); },
  reorder(el) {
    const o = db.orders.find(x => x.id === el.dataset.id);
    let n = 0;
    o.items.forEach(i => { const p = product(i.pid); if (p && p.active) { addToCart(i.pid, i.qty); n++; } });
    save(); go('#/cart'); toast(`${n} products added to cart`);
  },
  report(el) {
    modal(`<form data-form="problem" data-id="${el.dataset.id}"><h2>Report a problem</h2>
      <label>What happened?</label><select name="type"><option>Missing product</option><option>Damaged product</option><option>Wrong product</option><option>Late delivery</option><option>Invoice issue</option><option>Other</option></select>
      <label>Details</label><textarea name="text" required placeholder="Short description…"></textarea>
      <div class="actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Send</button></div></form>`);
  },
  'pick-point'(el) { db.session.pointId = el.dataset.id; save(); render(); toast('Now ordering for ' + currentPoint().name); },
  'del-point'(el) {
    const c = me(); c.points = c.points.filter(p => p.id !== el.dataset.id);
    if (db.session.pointId === el.dataset.id) db.session.pointId = c.points[0].id;
    save(); render();
  },
  'close-modal'() { closeModal(); },
  'close-modal-bg'(el, e) { if (e.target === el) closeModal(); },
  // admin
  'order-filter'(el) { ui.adminOrderFilter = el.dataset.id; render(); },
  advance(el) {
    const o = db.orders.find(x => x.id === el.dataset.id);
    const next = FLOW[FLOW.findIndex(s => s.key === o.status) + 1];
    if (next.key === 'out' && !o.driverId) return toast('Assign a driver first');
    setStatus(o, next.key); save(); render(); toast(`${o.no} → ${next.label}`);
  },
  'cancel-order'(el) {
    if (!confirm('Cancel this order?')) return;
    const o = db.orders.find(x => x.id === el.dataset.id); setStatus(o, 'cancelled'); save(); render();
  },
  'edit-product'(el) { modal(productForm(product(el.dataset.id))); },
  'delete-product'(el) {
    if (!confirm('Delete this product?')) return;
    db.products = db.products.filter(p => p.id !== el.dataset.id); save(); closeModal(); render();
  },
  'toggle-product'(el) { const p = product(el.dataset.id); p.active = !p.active; save(); render(); },
  'edit-post'(el) { modal(postForm(db.posts.find(p => p.id === el.dataset.id))); },
  'delete-post'(el) {
    if (!confirm('Delete this post?')) return;
    db.posts = db.posts.filter(p => p.id !== el.dataset.id); save(); closeModal(); render();
  },
};

const forms = {
  checkout(f) {
    const lines = cart().map(i => ({ i, p: product(i.pid) })).filter(x => x.p);
    if (!lines.length) return;
    const no = db.nextOrderNo++;
    const now = new Date().toISOString();
    const o = {
      id: 'o' + no, no: 'FR-' + no, customerId: db.session.customerId, point: { ...currentPoint() },
      items: lines.map(({ i, p }) => ({ pid: p.id, name: p.name, sku: p.sku, pack: p.pack, price: priceOf(p), qty: i.qty })),
      note: f.note.value.trim(), deliveryDate: f.deliveryDate.value, status: 'received', driverId: null, createdAt: now,
      history: [{ status: 'received', at: now }],
    };
    db.orders.push(o); db.carts[db.session.customerId] = []; save();
    go('#/order/' + o.id);
    modal(`<div style="text-align:center"><div style="font-size:56px">✅</div><h2>Order ${esc(o.no)} sent!</h2>
      <p class="muted">Frugea has received your order and will confirm it shortly. You can follow its status here.</p>
      <div class="actions" style="justify-content:center"><button class="btn primary" data-action="close-modal">OK</button></div></div>`);
  },
  problem(f) {
    db.problems.push({ id: uid('r'), orderId: f.dataset.id, customerId: db.session.customerId, type: f.type.value, text: f.text.value.trim(), status: 'open', createdAt: new Date().toISOString(), reply: '' });
    save(); closeModal(); render(); toast('Problem reported — Frugea will contact you');
  },
  account(f) {
    const c = me(); ['business', 'nipt', 'contact', 'phone', 'email'].forEach(k => { c[k] = f[k].value.trim(); });
    save(); render(); toast('Saved');
  },
  'add-point'(f) {
    const c = me(); const p = { id: uid('pt'), name: f.name.value.trim(), address: f.address.value.trim() };
    c.points.push(p); save(); render(); toast('Location added');
  },
  product(f) {
    const data = {
      name: f.name.value.trim(), sku: f.sku.value.trim(), cat: f.cat.value, emoji: f.emoji.value.trim() || '📦', pack: f.pack.value.trim(),
      origin: f.origin.value.trim(), price: parseFloat(f.price.value) || 0, offerPrice: f.offerPrice.value ? parseFloat(f.offerPrice.value) : null,
      stock: parseInt(f.stock.value, 10) || 0, tags: f.tags.value.trim(), isNew: f.isNew.checked,
    };
    if (f.dataset.id) Object.assign(product(f.dataset.id), data);
    else db.products.push({ id: uid('p'), active: true, desc: '', ...data });
    save(); closeModal(); render(); toast('Product saved');
  },
  post(f) {
    const data = { type: f.type.value, title: f.title.value.trim(), body: f.body.value.trim(), published: f.published.checked };
    if (f.dataset.id) Object.assign(db.posts.find(p => p.id === f.dataset.id), data);
    else db.posts.push({ id: uid('n'), createdAt: new Date().toISOString(), ...data });
    save(); closeModal(); render(); toast(data.published ? 'Published' : 'Saved as draft');
  },
  resolve(f) {
    const p = db.problems.find(x => x.id === f.dataset.id); p.status = 'resolved'; p.reply = f.reply.value.trim();
    save(); render(); toast('Marked as resolved');
  },
};

const changes = {
  'set-point'(el) { db.session.pointId = el.value; save(); render(); toast('Now ordering for ' + currentPoint().name); },
  sort(el) { ui.sort = el.value; render(); },
  'cart-set'(el) { const line = cart().find(i => i.pid === el.dataset.id); line.qty = Math.max(1, parseInt(el.value, 10) || 1); save(); render(); },
  'assign-driver'(el) { db.orders.find(o => o.id === el.dataset.id).driverId = el.value || null; save(); render(); toast('Driver assigned'); },
};

/* ---------- event wiring ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault();
  actions[el.dataset.action](el, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el);
});
document.addEventListener('input', e => {
  if (e.target.dataset.input === 'search') {
    ui.q = e.target.value;
    $('#product-list').innerHTML = productList(searchProducts(ui.q, ui.cat)); // re-render only the list to keep focus
  }
});
// Keep multiple open tabs (customer + admin) in sync.
window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY || !e.newValue) return;
  const session = db.session; db = JSON.parse(e.newValue); db.session = session; if (session && session.role === 'customer' && !me()) { db.session = null; }
  if (!document.querySelector('.modal')) render();
});
window.addEventListener('hashchange', render);
render();
