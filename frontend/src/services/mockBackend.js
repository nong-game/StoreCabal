// In-browser mock of Code.gs (same actions / same FIFO rules) backed by localStorage.
// Demo logins:  admin / admin1234   |   supplier1 / supplier1234   |   supplier2 / supplier1234
const KEY = 'cabal.mockdb.v5';
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let uidSeq = 0;
const uid = (p) => `${p}-${Date.now().toString(36).toUpperCase()}${(uidSeq++).toString(36).toUpperCase()}`;
const now = () => new Date().toISOString();

const GAME_NAME = 'CABAL Revolution';

const DEFAULT_SETTINGS = {
  shop_title: 'CABAL Revolution Shop',
  shop_subtitle: 'เช็กสต็อกไอเทม CABAL Revolution พร้อมส่งแบบเรียลไทม์ จากผู้ฝากขายในเกม',
  notice_text: 'สนใจชิ้นไหน กดดูรายละเอียดแล้วคัดลอกข้อความส่งให้แอดมินได้เลย',
  contact_facebook: '',
  contact_line: '',
  contact_discord: ''
};

function defaultMedia() {
  const ts = now();
  return [
    {
      media_id: 'M-DEMO1',
      title: 'CABAL Revolution · สินค้าพร้อมส่ง',
      caption: 'เช็กจำนวน +11 / +12 ที่มีในคิวตอนนี้ได้ทันที สินค้าอัปเดตตรงจากคลัง',
      tag: 'CABAL Revolution',
      image_url: './game/kv1.webp',
      sort_order: 1,
      is_active: true,
      created_at: ts
    },
    {
      media_id: 'M-DEMO2',
      title: 'Alz · Core · ใบกันแตก · รถ RW3',
      caption: 'รวมสต็อกผู้ฝากขายหลายร้านในที่เดียว พร้อมโอนในเกมทันทีหลังยืนยันออเดอร์',
      tag: 'สินค้าแนะนำ',
      image_url: './game/feature1.webp',
      sort_order: 2,
      is_active: true,
      created_at: ts
    },
    {
      media_id: 'M-DEMO3',
      title: 'เตรียมพร้อมลุย Mission War',
      caption: 'แอดมินสามารถอัปโหลดภาพแคปหน้าจอไอเทม หรือแบนเนอร์โปรโมชั่นมาเพิ่มได้ในเมนู "หน้าร้าน"',
      tag: 'Mission War',
      image_url: './game/kv2.webp',
      sort_order: 3,
      is_active: true,
      created_at: ts
    }
  ];
}

function seed() {
  const t0 = Date.now() - 1000 * 60 * 60 * 24;
  const users = [
    { user_id: 'U-ADMIN', username: 'admin', password: 'admin1234', shop_name: 'Admin', role: 'admin', status: 'active', created_at: now() },
    { user_id: 'U-S1', username: 'supplier1', password: 'supplier1234', shop_name: 'ร้านมังกรทอง', role: 'supplier', status: 'active', created_at: now() },
    { user_id: 'U-S2', username: 'supplier2', password: 'supplier1234', shop_name: 'ร้านเทพเจ้า', role: 'supplier', status: 'active', created_at: now() }
  ];
  const items = [];
  [
    ['Alz', 'Currency', false, 'สกุลเงินหลักสำหรับซื้อขายในเกม', 'M'],
    ['Upgrade Core', 'Material', false, 'หินอัปเกรดอุปกรณ์', 'ก้อน'],
    ['Safeguard (ใบกันแตก)', 'Material', false, 'ใบป้องกันไอเทมแตกเวลาตีบวก', 'ใบ'],
    ['รถ RW3 EX 2 (มีออปชั่น)', 'Vehicle', true, 'มอเตอร์ไซค์ยอดนิยม เลือกระดับ EX และ + ได้', 'คัน'],
    ['Weapon / Armor (มีออปชั่น)', 'Equipment', true, 'อาวุธและชุดเกราะคัดออปชั่น', 'ชิ้น']
  ].forEach(([item_name, category, has_custom_option, description, unit], j) =>
    items.push({ item_id: `I-${j + 1}`, item_name, category, server: GAME_NAME, has_custom_option, is_active: true, image_url: '', description, unit }));
  const stock = [];
  let n = 0;
  const add = (supplier_id, item_id, server, count, note = '', stocked = false) => {
    const lot = stocked ? '' : uid('LOT');
    for (let k = 0; k < count; k++) {
      const ts = new Date(t0 + n++ * 60000).toISOString();
      stock.push({ stock_uid: uid('STK'), item_id, server, supplier_id, custom_note: note, price_cost: 0, status: stocked ? 'STOCKED' : 'AVAILABLE', created_at: ts, updated_at: ts, order_ref: '', lot_id: lot, queued_at: stocked ? '' : ts });
    }
  };
  add('U-S1', 'I-3', GAME_NAME, 3); add('U-S2', 'I-3', GAME_NAME, 4); add('U-S1', 'I-3', GAME_NAME, 2);
  add('U-S2', 'I-2', GAME_NAME, 5); add('U-S1', 'I-1', GAME_NAME, 2);
  add('U-S1', 'I-4', GAME_NAME, 1, 'EX 2 +12'); add('U-S2', 'I-4', GAME_NAME, 1, 'ex 2 +12');
  add('U-S2', 'I-4', GAME_NAME, 1, 'EX 2 +11'); add('U-S1', 'I-4', GAME_NAME, 1, 'EX 2 +12');
  add('U-S2', 'I-3', GAME_NAME, 3);
  add('U-S1', 'I-1', GAME_NAME, 11, '', true); // 11 pieces sitting in the warehouse, not queued
  return { users, items, stock, logs: [], media: defaultMedia(), settings: { ...DEFAULT_SETTINGS } };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw);
      let dirty = false;
      if (!Array.isArray(db.media)) { db.media = defaultMedia(); dirty = true; }
      if (!db.settings) { db.settings = { ...DEFAULT_SETTINGS }; dirty = true; }
      if (db.settings.shop_title === 'Cabal Stock Shop') { db.settings.shop_title = DEFAULT_SETTINGS.shop_title; dirty = true; }
      if (db.settings.shop_subtitle === 'เช็กสต็อกไอเทมพร้อมส่งแบบเรียลไทม์ จากผู้ฝากขายในเซิร์ฟเวอร์') { db.settings.shop_subtitle = DEFAULT_SETTINGS.shop_subtitle; dirty = true; }
      (db.items || []).forEach((it) => {
        if (it.image_url === undefined) { it.image_url = ''; dirty = true; }
        if (it.description === undefined) { it.description = ''; dirty = true; }
        if (it.server === 'Server 1') { it.server = GAME_NAME; dirty = true; }
        if (!it.unit) {
          const n = String(it.item_name || '').toLowerCase();
          it.unit = /\balz\b/.test(n) ? 'M' : /safeguard|ใบกันแตก/.test(n) ? 'ใบ' : /rw3|blue|รถ|bike/.test(n) ? 'คัน' : /core/.test(n) ? 'ก้อน' : 'ชิ้น';
          dirty = true;
        }
      });
      (db.stock || []).forEach((s) => {
        if (s.server === 'Server 1') { s.server = GAME_NAME; dirty = true; }
      });
      if (dirty) save(db);
      return db;
    }
  } catch { /* fall through */ }
  const db = seed(); save(db); return db;
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { throw new E('พื้นที่จัดเก็บรูปในเบราว์เซอร์เต็ม กรุณาลบรูปเก่าหรือลดขนาดรูป'); }
}
export function resetMock() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

class E extends Error { constructor(m, code = 'BAD_REQUEST') { super(m); this.code = code; } }
const qfifo = (a, b) => { const x = a.queued_at || a.created_at; const y = b.queued_at || b.created_at; return x < y ? -1 : x > y ? 1 : a._i - b._i; };
const fifo = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a._i - b._i);
const norm = (n) => String(n ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const vkey = (s) => `${s.item_id}|${norm(s.custom_note)}`;
const sorted = (db, item_id, variant) =>
  db.stock.map((s, _i) => ({ ...s, _i })).filter((s) => s.status === 'AVAILABLE' && (!item_id || s.item_id === item_id) && (variant == null || norm(s.custom_note) === norm(variant))).sort(qfifo);
const log = (db, stock_uid, action, actor_id, note, ts = now()) => db.logs.push({ log_id: uid('L'), stock_uid, action, actor_id, timestamp: ts, note });
const pub = ({ password, ...u }) => u;
const shop = (db, id) => db.users.find((u) => u.user_id === id)?.shop_name || id;
const clean = ({ _i, ...s }) => s;
/** A queue slot = one LOT. pos[stock_uid] = slot number inside its (item+variant) queue; total[key] = number of lots */
function lotPositions(db) {
  const g = {}; const pos = {}; const key = {};
  sorted(db).forEach((s) => {
    const k = vkey(s); const lot = s.lot_id || s.stock_uid; const e = (g[k] ||= { idx: {}, n: 0 });
    if (e.idx[lot] === undefined) e.idx[lot] = e.n++;
    pos[s.stock_uid] = e.idx[lot] + 1; key[s.stock_uid] = k;
  });
  return { pos, key, total: (k) => g[k]?.n || 0 };
}

function auth(db, token, roles) {
  let p;
  try { p = JSON.parse(atob(token || '')); } catch { throw new E('Unauthorized', 'UNAUTHORIZED'); }
  const u = db.users.find((x) => x.user_id === p.uid);
  if (!u || p.exp < Date.now() || u.status !== 'active') throw new E('Unauthorized', 'UNAUTHORIZED');
  if (roles && !roles.includes(u.role)) throw new E('Forbidden', 'FORBIDDEN');
  return u;
}

function plan(db, p, withCandidates) {
  const qty = Math.floor(Number(p.qty));
  if (!(qty >= 1)) throw new E('จำนวนไม่ถูกต้อง');
  const item = db.items.find((i) => i.item_id === p.item_id);
  if (!item) throw new E('ไม่พบไอเทม', 'NOT_FOUND');
  const variant = String(p.variant || '').trim();
  const itemAvail = sorted(db, item.item_id);
  const avail = item.has_custom_option ? sorted(db, item.item_id, variant) : itemAvail;
  const qpos = lotPositions(db).pos;
  let picked; let manual = false;
  if (p.stock_uids?.length) {
    if (!item.has_custom_option) throw new E('เลือกชิ้นเจาะจงได้เฉพาะไอเทมที่มีออปชั่นเฉพาะ');
    if (p.stock_uids.length !== qty) throw new E('จำนวนที่เลือกไม่ตรงกับจำนวนที่สั่ง');
    picked = p.stock_uids.map((u) => itemAvail.find((a) => a.stock_uid === u) || (() => { throw new E(`ชิ้น ${u} ไม่อยู่ในสถานะ AVAILABLE แล้ว`, 'CONFLICT'); })());
    manual = true;
  } else picked = avail.slice(0, qty);
  const dec = (s) => ({ ...clean(s), shop_name: shop(db, s.supplier_id), queue_position: qpos[s.stock_uid] || 0 });
  const bs = {};
  picked.forEach((s) => { const n = shop(db, s.supplier_id); bs[n] = (bs[n] || 0) + 1; });
  const out = { item, variant, qty, available: avail.length, shortfall: Math.max(0, qty - picked.length), manual, picked: picked.map(dec),
    by_supplier: Object.entries(bs).map(([shop_name, count]) => ({ shop_name, count })), _raw: picked };
  if (withCandidates && item.has_custom_option) out.candidates = itemAvail.map(dec);
  return out;
}

const H = {
  login(db, p) {
    const u = db.users.find((x) => x.username.toLowerCase() === String(p.username || '').trim().toLowerCase());
    if (!u || u.password !== p.password) throw new E('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'BAD_CREDENTIALS');
    if (u.status !== 'active') throw new E('บัญชีถูกระงับ', 'SUSPENDED');
    return { token: btoa(JSON.stringify({ uid: u.user_id, exp: Date.now() + 12 * 3600e3 })), user: pub(u) };
  },
  me: (db, p, a) => pub(a),
  change_password(db, p, a) {
    if (String(p.new_password || '').length < 8) throw new E('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (a.password !== p.old_password) throw new E('รหัสผ่านเดิมไม่ถูกต้อง');
    a.password = p.new_password; return { changed: true };
  },
  variants(db, p, a) {
    const out = {};
    sorted(db).forEach((s) => {
      const l = (out[s.item_id] ||= {}); const k = norm(s.custom_note);
      const v = (l[k] ||= { variant: s.custom_note, count: 0, suppliers: {}, _lots: new Set() }); v.count++; v._lots.add(s.lot_id || s.stock_uid);
      if (a.role === 'admin') { const n = shop(db, s.supplier_id); v.suppliers[n] = (v.suppliers[n] || 0) + 1; }
    });
    return Object.fromEntries(Object.entries(out).map(([id, l]) => [id, Object.values(l).map(({ _lots, ...v }) => ({ ...v, lots: _lots.size }))]));
  },
  master_items: (db, p, a) => db.items.filter((i) => a.role === 'admin' || i.is_active),

  supplier_dashboard(db, p, a) {
    const counts = { STOCKED: 0, AVAILABLE: 0, RESERVED: 0, SOLD: 0, WITHDRAWN: 0 };
    const mine = db.stock.filter((s) => s.supplier_id === a.user_id);
    mine.forEach((s) => { counts[s.status]++; });
    return { counts, total: mine.length, sold_cost_value: mine.filter((s) => s.status === 'SOLD').reduce((x, s) => x + s.price_cost, 0) };
  },
  add_stock(db, p, a) {
    const qty = Math.floor(Number(p.qty));
    if (!(qty >= 1) || qty > 200) throw new E('จำนวนต้องอยู่ระหว่าง 1-200');
    const item = db.items.find((i) => i.item_id === p.item_id);
    if (!item || !item.is_active) throw new E('ไม่พบไอเทมหรือถูกปิดใช้งาน');
    let note = String(p.custom_note || '').trim();
    if (!item.has_custom_option) note = '';
    const enqueue = p.enqueue === true; const lot = enqueue ? uid('LOT') : '';
    const base = Date.now(); const created = [];
    for (let i = 0; i < qty; i++) {
      const ts = new Date(base + i).toISOString(); const id = uid('STK');
      db.stock.push({ stock_uid: id, item_id: item.item_id, server: item.server, supplier_id: a.user_id, custom_note: note,
        price_cost: 0, status: enqueue ? 'AVAILABLE' : 'STOCKED', created_at: ts, updated_at: ts, order_ref: '', lot_id: lot, queued_at: enqueue ? ts : '' });
      log(db, id, 'ADD', a.user_id, `${enqueue ? 'ลงและเข้าคิว' : 'ลงคลัง'} ${i + 1}/${qty}`, ts); created.push(id);
    }
    return { created };
  },
  my_stock(db, p, a) {
    const lp = lotPositions(db);
    return db.stock.map((s, _i) => ({ ...s, _i })).filter((s) => s.supplier_id === a.user_id).sort((x, y) => -fifo(x, y)).map((s) => {
      const pos = s.status === 'AVAILABLE' ? lp.pos[s.stock_uid] : null;
      const it = db.items.find((i) => i.item_id === s.item_id);
      return { ...clean(s), item_name: it?.item_name || s.item_id, unit: it?.unit || 'ชิ้น',
        queue_position: pos || null, queue_total: pos ? lp.total(lp.key[s.stock_uid]) : null };
    });
  },
  enqueue(db, p, a) {
    const uids = p.stock_uids || []; if (!uids.length) throw new E('ไม่ได้ระบุรายการ');
    let first = null;
    uids.forEach((u) => {
      const s = db.stock.find((x) => x.stock_uid === u);
      if (!s || s.supplier_id !== a.user_id) throw new E(`ไม่พบรายการ ${u}`, 'NOT_FOUND');
      if (s.status !== 'STOCKED') throw new E(`${u} ไม่ได้อยู่ในคลัง (สถานะ ${s.status})`, 'CONFLICT');
      if (!first) first = s; else if (vkey(s) !== vkey(first)) throw new E('ล็อตเดียวกันต้องเป็นไอเทมและรุ่นเดียวกัน');
    });
    const base = Date.now(); const lot = uid('LOT');
    uids.forEach((u, i) => {
      const s = db.stock.find((x) => x.stock_uid === u); const ts = new Date(base + i).toISOString();
      s.status = 'AVAILABLE'; s.lot_id = lot; s.queued_at = ts; s.updated_at = ts;
      log(db, u, 'ADD', a.user_id, `เข้าคิวขาย ล็อต ${lot} (${uids.length} ชิ้น = 1 คิว)`, ts);
    });
    return { lot_id: lot, count: uids.length };
  },
  unqueue(db, p, a) {
    const uids = p.stock_uids || []; if (!uids.length) throw new E('ไม่ได้ระบุรายการ');
    uids.forEach((u) => {
      const s = db.stock.find((x) => x.stock_uid === u);
      if (!s || s.supplier_id !== a.user_id) throw new E(`ไม่พบรายการ ${u}`, 'NOT_FOUND');
      if (s.status !== 'AVAILABLE') throw new E(`${u} ไม่ได้อยู่ในคิว (สถานะ ${s.status})`, 'CONFLICT');
    });
    const ts = now();
    uids.forEach((u) => { const s = db.stock.find((x) => x.stock_uid === u); s.status = 'STOCKED'; s.lot_id = ''; s.queued_at = ''; s.updated_at = ts; log(db, u, 'WITHDRAW', a.user_id, 'ออกจากคิว กลับเข้าคลัง', ts); });
    return { unqueued: uids };
  },
  withdraw(db, p, a) {
    const uids = p.stock_uids || [];
    uids.forEach((u) => {
      const s = db.stock.find((x) => x.stock_uid === u);
      if (!s || s.supplier_id !== a.user_id) throw new E(`ไม่พบรายการ ${u}`, 'NOT_FOUND');
      if (s.status !== 'AVAILABLE' && s.status !== 'STOCKED') throw new E(`ถอนได้เฉพาะของในคลัง/รอขาย (${u} คือ ${s.status})`, 'CONFLICT');
    });
    const ts = now();
    uids.forEach((u) => { const s = db.stock.find((x) => x.stock_uid === u); s.status = 'WITHDRAWN'; s.updated_at = ts; log(db, u, 'WITHDRAW', a.user_id, 'Supplier ถอนของออก', ts); });
    return { withdrawn: uids };
  },

  admin_overview(db) {
    const rows = db.items.map((i) => ({ ...i, STOCKED: 0, AVAILABLE: 0, RESERVED: 0, SOLD: 0, WITHDRAWN: 0, suppliers: {} }));
    db.stock.forEach((s) => {
      const r = rows.find((x) => x.item_id === s.item_id); if (!r) return;
      r[s.status]++;
      if (s.status === 'AVAILABLE') { const n = shop(db, s.supplier_id); r.suppliers[n] = (r.suppliers[n] || 0) + 1; }
    });
    const servers = {}; rows.forEach((r) => { servers[r.server] = (servers[r.server] || 0) + r.AVAILABLE; });
    const sum = (k) => rows.reduce((x, r) => x + r[k], 0);
    return { rows, available_by_server: servers, totals: { STOCKED: sum('STOCKED'), AVAILABLE: sum('AVAILABLE'), RESERVED: sum('RESERVED'), SOLD: sum('SOLD') } };
  },
  fifo_preview(db, p) { const { _raw, ...rest } = plan(db, p, true); return rest; },
  fifo_confirm(db, p, a) {
    let ref = String(p.order_ref || '').trim().slice(0, 80);
    const target = p.mark === 'SOLD' ? 'SOLD' : 'RESERVED';
    const { _raw, ...pl } = plan(db, p, false);
    if (pl.shortfall > 0) throw new E(`สต็อกไม่พอ: มี ${pl.available} ต้องการ ${pl.qty}`, 'INSUFFICIENT');
    if (!ref) { const d = new Date(); const z = (n) => String(n).padStart(2, '0');
      ref = `${pl.item.item_name}${pl.variant ? ` ${pl.variant}` : ''} ${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`.slice(0, 80); }
    const ts = now();
    _raw.forEach((r) => {
      const s = db.stock.find((x) => x.stock_uid === r.stock_uid);
      s.status = target; s.updated_at = ts; s.order_ref = ref;
      log(db, s.stock_uid, target === 'SOLD' ? 'SOLD' : 'RESERVE', a.user_id, `order ${ref}${pl.manual ? ' (เลือกเจาะจง)' : ' (FIFO)'}`, ts);
    });
    return { order_ref: ref, status: target, picked: pl.picked, by_supplier: pl.by_supplier };
  },
  queue_board(db) {
    const item = (id) => db.items.find((i) => i.item_id === id) || {};
    const queues = new Map();
    sorted(db).forEach((s) => {
      const k = vkey(s); const it = item(s.item_id);
      if (!queues.has(k)) queues.set(k, { key: k, item_id: s.item_id, item_name: it.item_name || s.item_id, category: it.category || '', unit: it.unit || 'ชิ้น', has_custom_option: !!it.has_custom_option, variant: s.custom_note || '', pieces: 0, lots: [] });
      const q = queues.get(k); const lid = s.lot_id || s.stock_uid;
      let L = q.lots.find((x) => x.lot_id === lid);
      if (!L) { L = { lot_id: lid, supplier_id: s.supplier_id, shop_name: shop(db, s.supplier_id), count: 0, queued_at: s.queued_at || s.created_at, uids: [] }; q.lots.push(L); }
      L.count++; L.uids.push(s.stock_uid); q.pieces++;
    });
    const res = new Map();
    db.stock.filter((s) => s.status === 'RESERVED').forEach((s) => {
      const k = `${s.order_ref}|${vkey(s)}|${s.supplier_id}`;
      if (!res.has(k)) res.set(k, { key: k, order_ref: s.order_ref, item_name: item(s.item_id).item_name || s.item_id, variant: s.custom_note || '', shop_name: shop(db, s.supplier_id), count: 0, uids: [], updated_at: s.updated_at });
      const r = res.get(k); r.count++; r.uids.push(s.stock_uid);
    });
    return { queues: [...queues.values()], reserved: [...res.values()] };
  },
  queue_move(db, p, a) {
    const lotOf = (s) => s.lot_id || s.stock_uid;
    const mine = sorted(db).filter((s) => lotOf(s) === p.lot_id);
    if (!mine.length) throw new E('ไม่พบล็อตนี้ในคิว (อาจถูกขาย/ย้ายไปแล้ว)', 'CONFLICT');
    const key = vkey(mine[0]); const lots = []; const idx = {};
    sorted(db).filter((s) => vkey(s) === key).forEach((s) => { const l = lotOf(s); if (idx[l] === undefined) { idx[l] = lots.length; lots.push([]); } lots[idx[l]].push(s); });
    const i = idx[p.lot_id]; const writes = []; const t = (s) => Date.parse(s.queued_at || s.created_at);
    const place = (lot, start) => lot.forEach((s, k) => writes.push([s.stock_uid, new Date(start + k).toISOString()]));
    if (p.direction === 'up' || p.direction === 'down') {
      const x = p.direction === 'up' ? i - 1 : i; const y = x + 1;
      if (x < 0 || y >= lots.length) throw new E('ย้ายต่อไม่ได้แล้ว');
      const t0 = t(lots[x][0]); place(lots[y], t0); place(lots[x], t0 + lots[y].length);
    } else if (p.direction === 'top') { if (i === 0) throw new E('อยู่หัวคิวแล้ว'); place(lots[i], t(lots[0][0]) - lots[i].length - 1); }
    else if (p.direction === 'bottom') { if (i === lots.length - 1) throw new E('อยู่ท้ายคิวแล้ว'); const last = lots[lots.length - 1]; place(lots[i], Math.max(Date.now(), t(last[last.length - 1]) + 1)); }
    else throw new E('direction ไม่ถูกต้อง');
    const ts = now();
    writes.forEach(([u, q]) => { const s = db.stock.find((x) => x.stock_uid === u); s.queued_at = q; s.updated_at = ts; });
    log(db, mine[0].stock_uid, 'ADD', a.user_id, `Admin ย้ายล็อต ${p.lot_id} ${p.direction}`, ts);
    return { moved: p.lot_id };
  },
  lot_update(db, p, a) {
    const keep = Math.floor(Number(p.keep));
    const pieces = sorted(db).filter((s) => (s.lot_id || s.stock_uid) === p.lot_id);
    if (!pieces.length) throw new E('ไม่พบล็อตนี้ในคิว (อาจถูกขาย/ย้ายไปแล้ว)', 'CONFLICT');
    if (!(keep >= 0) || keep >= pieces.length) throw new E(`ลดจำนวนได้อย่างเดียว (0 - ${pieces.length - 1})`);
    const ts = now(); const out = pieces.slice(keep);
    out.forEach((r) => { const s = db.stock.find((x) => x.stock_uid === r.stock_uid); s.status = 'STOCKED'; s.lot_id = ''; s.queued_at = ''; s.updated_at = ts; log(db, s.stock_uid, 'WITHDRAW', a.user_id, 'Admin นำออกจากคิว คืนคลังพ่อค้า', ts); });
    return { returned: out.length, kept: keep };
  },
  order_list(db) {
    return db.stock.map((s, _i) => ({ ...s, _i })).filter((s) => s.status === 'RESERVED' || (s.status === 'SOLD' && s.order_ref))
      .sort((x, y) => -fifo(x, y)).slice(0, 500)
      .map((s) => ({ ...clean(s), item_name: db.items.find((i) => i.item_id === s.item_id)?.item_name, shop_name: shop(db, s.supplier_id) }));
  },
  order_update(db, p, a) {
    if (!['SOLD', 'AVAILABLE'].includes(p.to)) throw new E('สถานะปลายทางไม่ถูกต้อง');
    const uids = p.stock_uids || [];
    uids.forEach((u) => {
      const s = db.stock.find((x) => x.stock_uid === u);
      if (!s) throw new E(`ไม่พบ ${u}`, 'NOT_FOUND');
      if (s.status !== 'RESERVED') throw new E(`${u} ไม่ได้อยู่ในสถานะ RESERVED`, 'CONFLICT');
    });
    const ts = now();
    uids.forEach((u) => {
      const s = db.stock.find((x) => x.stock_uid === u); const ref = s.order_ref;
      s.status = p.to; s.updated_at = ts; if (p.to === 'AVAILABLE') s.order_ref = '';
      log(db, u, p.to === 'SOLD' ? 'SOLD' : 'ADD', a.user_id, p.to === 'SOLD' ? `ยืนยันขาย order ${ref}` : `ยกเลิกจอง order ${ref} (คืนคิวเดิม)`, ts);
    });
    return { updated: uids, status: p.to };
  },
  public_catalog(db) {
    const avail = db.stock.filter((s) => s.status === 'AVAILABLE');
    const counts = {}; const variants = {};
    avail.forEach((s) => {
      counts[s.item_id] = (counts[s.item_id] || 0) + 1;
      const k = norm(s.custom_note);
      const map = (variants[s.item_id] ||= {});
      const v = (map[k] ||= { variant: s.custom_note || '', count: 0 });
      v.count++;
    });
    const catalog = db.items.filter((i) => i.is_active).map((it) => {
      const list = variants[it.item_id] ? Object.values(variants[it.item_id]).sort((a, b) => b.count - a.count || a.variant.localeCompare(b.variant)) : [];
      return {
        item_id: it.item_id,
        item_name: it.item_name,
        category: it.category || '',
        server: it.server,
        has_custom_option: !!it.has_custom_option,
        image_url: it.image_url || '',
        description: it.description || '',
        unit: it.unit || 'ชิ้น',
        available_count: counts[it.item_id] || 0,
        variants: it.has_custom_option ? list : []
      };
    });
    const media = (db.media || []).filter((m) => m.is_active).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || (a.created_at < b.created_at ? 1 : -1));
    return {
      settings: { ...DEFAULT_SETTINGS, ...(db.settings || {}) },
      media,
      items: catalog,
      stats: { total_available: avail.length, item_types_in_stock: catalog.filter((c) => c.available_count > 0).length, total_items: catalog.length, server: GAME_NAME }
    };
  },
  item_upsert(db, p) {
    const item_name = String(p.item_name || '').trim(); const server = GAME_NAME;
    if (!item_name) throw new E('ต้องระบุชื่อไอเทม');
    const data = { item_name, category: String(p.category || '').trim(), server, has_custom_option: !!p.has_custom_option };
    if (p.image_url !== undefined) data.image_url = String(p.image_url || '').trim();
    if (p.description !== undefined) data.description = String(p.description || '').trim().slice(0, 300);
    if (p.unit !== undefined) data.unit = String(p.unit || '').trim().slice(0, 30) || 'ชิ้น';
    if (p.item_id) {
      const it = db.items.find((i) => i.item_id === p.item_id); if (!it) throw new E('ไม่พบไอเทม', 'NOT_FOUND');
      const live = db.stock.some((s) => s.item_id === it.item_id && ['AVAILABLE', 'RESERVED'].includes(s.status) && norm(s.custom_note) !== '');
      if (it.has_custom_option && !data.has_custom_option && live) throw new E('ยังมีสต็อกที่ระบุรุ่นอยู่ ปิดการแยกรุ่นไม่ได้ (ต้องขาย/ถอนของเหล่านั้นก่อน)');
      Object.assign(it, data); return it;
    }
    if (db.items.some((i) => i.item_name === item_name && i.server === server)) throw new E('มีไอเทมนี้ในเกมนี้แล้ว', 'CONFLICT');
    const row = { item_id: uid('I'), image_url: '', description: '', unit: 'ชิ้น', ...data, is_active: true }; db.items.push(row); return row;
  },
  item_toggle(db, p) {
    const it = db.items.find((i) => i.item_id === p.item_id); if (!it) throw new E('ไม่พบไอเทม', 'NOT_FOUND');
    it.is_active = !!p.is_active; return it;
  },
  media_list(db) {
    return [...(db.media || [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || (a.created_at < b.created_at ? 1 : -1));
  },
  media_upsert(db, p) {
    const title = String(p.title || '').trim().slice(0, 120);
    if (!title) throw new E('ต้องระบุหัวข้อรูปภาพ');
    const image_url = String(p.image_url || '').trim();
    if (!image_url) throw new E('กรุณาอัปโหลดรูปหรือใส่ลิงก์รูปภาพ');
    const payload = {
      title,
      caption: String(p.caption || '').trim().slice(0, 240),
      tag: String(p.tag || '').trim().slice(0, 40),
      image_url,
      sort_order: Number(p.sort_order) || 0,
      is_active: p.is_active === undefined ? true : !!p.is_active
    };
    db.media ||= [];
    if (p.media_id) {
      const m = db.media.find((x) => x.media_id === p.media_id);
      if (!m) throw new E('ไม่พบรูปโชว์นี้', 'NOT_FOUND');
      Object.assign(m, payload); return m;
    }
    const row = { media_id: uid('M'), ...payload, created_at: now() };
    db.media.push(row); return row;
  },
  media_delete(db, p) {
    const before = (db.media || []).length;
    db.media = (db.media || []).filter((x) => x.media_id !== p.media_id);
    if (db.media.length === before) throw new E('ไม่พบรูปโชว์นี้', 'NOT_FOUND');
    return { deleted: p.media_id };
  },
  storefront_settings_save(db, p) {
    db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
    Object.keys(DEFAULT_SETTINGS).forEach((k) => {
      if (p[k] !== undefined) db.settings[k] = String(p[k] || '').trim().slice(0, 300);
    });
    return db.settings;
  },
  user_list: (db) => db.users.map(pub),
  user_create(db, p) {
    const username = String(p.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw new E('username: a-z 0-9 _ . - ยาว 3-30 ตัว');
    if (String(p.password || '').length < 8) throw new E('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    if (!String(p.shop_name || '').trim()) throw new E('ต้องระบุชื่อร้าน/ผู้ฝากขาย');
    if (db.users.some((u) => u.username === username)) throw new E('username นี้ถูกใช้แล้ว', 'CONFLICT');
    const u = { user_id: uid('U'), username, password: p.password, shop_name: p.shop_name.trim(), role: p.role === 'admin' ? 'admin' : 'supplier', status: 'active', created_at: now() };
    db.users.push(u); return pub(u);
  },
  user_update(db, p, a) {
    const u = db.users.find((x) => x.user_id === p.user_id); if (!u) throw new E('ไม่พบผู้ใช้', 'NOT_FOUND');
    if (p.status) {
      if (u.user_id === a.user_id && p.status !== 'active') throw new E('ระงับบัญชีตัวเองไม่ได้');
      u.status = p.status;
    }
    if (p.shop_name) u.shop_name = p.shop_name;
    if (p.new_password) { if (p.new_password.length < 8) throw new E('รหัสผ่านอย่างน้อย 8 ตัวอักษร'); u.password = p.new_password; }
    return pub(u);
  },
  logs_list(db, p) {
    return db.logs.slice(-(Number(p.limit) || 200)).reverse().map((l) => ({ ...l, actor_name: db.users.find((u) => u.user_id === l.actor_id)?.username || l.actor_id }));
  }
};

const ROLES = {
  me: ['admin', 'supplier'], change_password: ['admin', 'supplier'], master_items: ['admin', 'supplier'], variants: ['admin', 'supplier'],
  supplier_dashboard: ['supplier'], add_stock: ['supplier'], my_stock: ['supplier'], withdraw: ['supplier'], enqueue: ['supplier'], unqueue: ['supplier']
};

const PUBLIC_ACTIONS = new Set(['login', 'public_catalog']);

export async function mockCall({ action, payload, token }) {
  await delay();
  try {
    const fn = H[action]; if (!fn) throw new E('Unknown action', 'NOT_FOUND');
    const db = load();
    const roles = PUBLIC_ACTIONS.has(action) ? null : (ROLES[action] || ['admin']);
    const actor = roles ? auth(db, token, roles) : null;
    const data = fn(db, payload || {}, actor);
    save(db);
    return { ok: true, data: JSON.parse(JSON.stringify(data)) };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code || 'INTERNAL' };
  }
}
