// API service layer. Same contract for Apps Script and the in-browser mock,
// so swapping to Node + Sheets API later only changes `transport`.
import { mockCall } from './mockBackend.js';

const API_URL = (import.meta.env.VITE_API_URL || '').trim();
export const IS_MOCK = !API_URL;

const TOKEN_KEY = 'cabal.token';
export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
  set: (t) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
};

export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

// Apps Script web apps do not answer CORS preflight → send JSON as text/plain (a "simple" request).
async function httpTransport(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'HTTP');
  return res.json();
}

let onUnauthorized = () => {};

// in-flight request counter → <TopProgress/>
let inFlight = 0;
const loadingListeners = new Set();
const emitLoading = () => loadingListeners.forEach((fn) => fn(inFlight));
export const onLoadingChange = (fn) => { loadingListeners.add(fn); fn(inFlight); return () => loadingListeners.delete(fn); };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function call(action, payload = {}) {
  const body = { action, payload, token: tokenStore.get() };
  let json;
  inFlight++; emitLoading();
  try {
    json = IS_MOCK ? await mockCall(body) : await httpTransport(body);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'NETWORK');
  } finally {
    inFlight--; emitLoading();
  }
  if (!json.ok) {
    if (json.code === 'UNAUTHORIZED' && action !== 'login') onUnauthorized();
    throw new ApiError(json.error || 'เกิดข้อผิดพลาด', json.code);
  }
  return json.data;
}

// Tiny read cache for rarely-changing lists: each Apps Script round trip costs ~1.5 s, so tab switches reuse it.
const memo = new Map();
const cached = (key, fn, ttl = 60000) => {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.v);
  return fn().then((v) => { memo.set(key, { v, t: Date.now() }); return v; });
};
const bust = (...keys) => (r) => { keys.forEach((k) => memo.delete(k)); return r; };
export const clearApiCache = () => memo.clear();

export const api = {
  login: (username, password) => call('login', { username, password }),
  me: () => call('me'),
  changePassword: (old_password, new_password) => call('change_password', { old_password, new_password }),
  masterItems: () => cached('items', () => call('master_items')),
  variants: () => cached('variants', () => call('variants'), 20000),

  // supplier
  supplierDashboard: () => call('supplier_dashboard'),
  addStock: (data) => call('add_stock', data).then(bust('variants')),
  myStock: () => call('my_stock'),
  withdraw: (stock_uids) => call('withdraw', { stock_uids }).then(bust('variants')),
  enqueue: (stock_uids) => call('enqueue', { stock_uids }).then(bust('variants')),
  unqueue: (stock_uids) => call('unqueue', { stock_uids }).then(bust('variants')),

  // admin
  adminOverview: () => call('admin_overview'),
  fifoPreview: (data) => call('fifo_preview', data),
  fifoConfirm: (data) => call('fifo_confirm', data).then(bust('variants')),
  queueBoard: () => call('queue_board'),
  queueMove: (lot_id, direction) => call('queue_move', { lot_id, direction }),
  lotUpdate: (lot_id, keep) => call('lot_update', { lot_id, keep }),
  orderList: () => call('order_list'),
  orderUpdate: (stock_uids, to) => call('order_update', { stock_uids, to }).then(bust('variants')),
  itemUpsert: (data) => call('item_upsert', data).then(bust('items')),
  itemToggle: (item_id, is_active) => call('item_toggle', { item_id, is_active }).then(bust('items')),
  userList: () => call('user_list'),
  userCreate: (data) => call('user_create', data),
  userUpdate: (data) => call('user_update', data),
  logsList: (limit = 200) => call('logs_list', { limit })
};
