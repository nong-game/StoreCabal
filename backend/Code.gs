/**
 * Cabal Online – Inventory & Supplier Portal  |  Google Apps Script backend
 * ---------------------------------------------------------------------------
 * Deploy: Extensions ▸ Apps Script (bound to the Spreadsheet) ▸ paste this file
 *   1) Run setupDatabase() once (authorise, read the admin password in the log)
 *   2) Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Access: Anyone
 *   3) Put the /exec URL in frontend .env  (VITE_API_URL)
 *
 * All requests are POST with a JSON body sent as text/plain (avoids CORS preflight):
 *   { "action": "login", "payload": {...}, "token": "..." }
 * Response: { ok: true, data } | { ok: false, error, code }
 *
 * Service layers (so it can be ported to Node + Sheets API later):
 *   Db      – the only layer that touches SpreadsheetApp
 *   Auth    – password hashing, signed tokens
 *   Service – business logic (FIFO, queue position, stock mutations)
 *   Router  – action → handler map, role guard, LockService wrapper
 */

/* ============================== CONFIG ============================== */
var CONFIG = {
  TOKEN_TTL_SEC: 12 * 60 * 60,
  LOCK_WAIT_MS: 20000,
  SERVER_NAME: 'Server 1', // single-server shop: every item/stock row uses this value
  MAX_QTY_PER_ADD: 200,
  LOGIN_MAX_FAILS: 5,
  LOGIN_WINDOW_SEC: 600
};

var SCHEMA = {
  Users:               ['user_id', 'username', 'password_hash', 'shop_name', 'role', 'status', 'created_at'],
  Master_Items:        ['item_id', 'item_name', 'category', 'server', 'has_custom_option', 'is_active', 'image_url', 'description'],
  Stock_Items:         ['stock_uid', 'item_id', 'server', 'supplier_id', 'custom_note', 'price_cost', 'status', 'created_at', 'updated_at', 'order_ref', 'lot_id', 'queued_at'],
  Queue_Logs:          ['log_id', 'stock_uid', 'action', 'actor_id', 'timestamp', 'note'],
  Storefront_Media:    ['media_id', 'title', 'caption', 'tag', 'image_url', 'sort_order', 'is_active', 'created_at'],
  Storefront_Settings: ['key', 'value']
};
// Columns that must stay text (ISO timestamps / ids) so Sheets never auto-converts them
var TEXT_COLS = {
  Users: ['user_id', 'username', 'password_hash', 'created_at'],
  Master_Items: ['item_id', 'image_url', 'description'],
  Stock_Items: ['stock_uid', 'item_id', 'supplier_id', 'created_at', 'updated_at', 'order_ref', 'lot_id', 'queued_at'],
  Queue_Logs: ['log_id', 'stock_uid', 'actor_id', 'timestamp'],
  Storefront_Media: ['media_id', 'title', 'caption', 'tag', 'image_url', 'created_at'],
  Storefront_Settings: ['key', 'value']
};
var BOOL_COLS = { Master_Items: ['has_custom_option', 'is_active'], Storefront_Media: ['is_active'] };
var NUM_COLS = { Stock_Items: ['price_cost'], Storefront_Media: ['sort_order'] };

var DEFAULT_STOREFRONT_SETTINGS = {
  shop_title: 'Cabal Stock Shop',
  shop_subtitle: 'เช็กสต็อกไอเทมพร้อมส่งแบบเรียลไทม์ จากผู้ฝากขายในเซิร์ฟเวอร์',
  notice_text: 'สนใจชิ้นไหน กดดูรายละเอียดแล้วคัดลอกข้อความส่งให้แอดมินได้เลย',
  contact_facebook: '',
  contact_line: '',
  contact_discord: ''
};

var STATUS = { STOCKED: 'STOCKED', AVAILABLE: 'AVAILABLE', RESERVED: 'RESERVED', SOLD: 'SOLD', WITHDRAWN: 'WITHDRAWN' };

/* ============================== ENTRY POINTS ============================== */
function doGet() {
  return jsonOut_({ ok: true, data: { service: 'cabal-inventory', time: nowIso_() } });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return jsonOut_(Router.dispatch(body));
  } catch (err) {
    return jsonOut_(errorResponse_(err));
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(err) {
  if (err && err.isApiError) return { ok: false, error: err.message, code: err.code };
  console.error(err && err.stack ? err.stack : err);
  return { ok: false, error: 'Internal error', code: 'INTERNAL' };
}

function ApiError_(message, code) {
  var e = new Error(message);
  e.isApiError = true;
  e.code = code || 'BAD_REQUEST';
  return e;
}

/* ============================== SETUP ============================== */
/** Run once from the editor. Safe to re-run: only creates what is missing. */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    // always (re)write the header row so newly added columns (e.g. facebook_id) appear on upgrade
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    (TEXT_COLS[name] || []).forEach(function (c) {
      sh.getRange(2, headers.indexOf(c) + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
    if (sh.getMaxColumns() > headers.length) sh.deleteColumns(headers.length + 1, sh.getMaxColumns() - headers.length);
  });
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('PW_SALT')) props.setProperty('PW_SALT', Utilities.getUuid());

  if (Db.all('Users').length === 0) {
    var pw = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    Db.append('Users', [{
      user_id: 'U-' + Utilities.getUuid().slice(0, 8), username: 'admin',
      password_hash: Auth.hash(pw), shop_name: 'Admin', role: 'admin', status: 'active', created_at: nowIso_()
    }]);
    console.log('=== ADMIN CREATED ===  username: admin   password: ' + pw + '   (change it after first login)');
  }
  seedMasterItemsIfEmpty_();
  console.log('setupDatabase OK');
}

/**
 * Create an extra admin (or supplier) account from the Apps Script editor.
 * 1) Edit the three values below  2) select createAdminUser ▸ Run  3) CHANGE THE VALUES BACK/DELETE the password afterwards
 */
function createAdminUser() {
  var USERNAME = 'newadmin';          // a-z 0-9 _ . -  (3-30 chars)
  var PASSWORD = 'ChangeMe-12345';    // at least 8 chars
  var SHOP_NAME = 'Admin 2';
  var ROLE = 'admin';                 // 'admin' or 'supplier'

  var user = Service.userCreate({ username: USERNAME, password: PASSWORD, shop_name: SHOP_NAME, role: ROLE });
  console.log('Created ' + user.role + ': ' + user.username);
}

function seedMasterItemsIfEmpty_() {
  if (Db.all('Master_Items').length) return;
  var rows = [];
  [['Alz', 'Currency', false, 'สกุลเงินหลักสำหรับซื้อขายในเกม'], ['Upgrade Core', 'Material', false, 'หินอัปเกรดอุปกรณ์'], ['Safeguard (ใบกันแตก)', 'Material', false, 'ใบป้องกันไอเทมแตกเวลาตีบวก'],
   ['รถ RW3 EX 2 (มีออปชั่น)', 'Vehicle', true, 'มอเตอร์ไซค์ยอดนิยม เลือกระดับ EX และ + ได้'], ['Weapon / Armor (มีออปชั่น)', 'Equipment', true, 'อาวุธและชุดเกราะคัดออปชั่น']].forEach(function (x, j) {
    rows.push({ item_id: 'I-' + (j + 1), item_name: x[0], category: x[1], server: CONFIG.SERVER_NAME, has_custom_option: x[2], is_active: true, image_url: '', description: x[3] });
  });
  Db.append('Master_Items', rows);
}

/* ============================== DB LAYER ============================== */
var Db = {
  _mem: {},                                   // per-execution memo of raw sheet values (one getValues per sheet per request)
  CACHED: { Users: true, Master_Items: true, Storefront_Media: true, Storefront_Settings: true }, // small, read-mostly sheets are also cached across requests (60 s, cleared on every write)
  hasSheet: function (name) {
    return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  },
  sheet: function (name) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sh) throw ApiError_('Sheet "' + name + '" missing – run setupDatabase()', 'NOT_SETUP');
    return sh;
  },
  raw: function (name) {
    if (this._mem[name]) return this._mem[name];
    var cache = this.CACHED[name] ? CacheService.getScriptCache() : null, vals = null;
    if (cache) {
      var hit = cache.get('db:' + name);
      if (hit) { try { vals = JSON.parse(hit); } catch (e) { vals = null; } }
    }
    if (!vals) {
      var sh = this.sheet(name), last = sh.getLastRow(), cols = Math.min(SCHEMA[name].length, sh.getMaxColumns());
      vals = last < 2 || cols < 1 ? [] : sh.getRange(2, 1, last - 1, cols).getValues();
      if (cache) { try { cache.put('db:' + name, JSON.stringify(vals), 60); } catch (e) { /* >100KB: skip cache */ } }
    }
    this._mem[name] = vals;
    return vals;
  },
  invalidate: function (name) {
    delete this._mem[name];
    if (this.CACHED[name]) CacheService.getScriptCache().remove('db:' + name);
  },
  /** Returns array of FRESH objects (safe to mutate); each has hidden _row (1-based sheet row) */
  all: function (name) {
    var headers = SCHEMA[name], vals = this.raw(name);
    var bools = BOOL_COLS[name] || [], nums = NUM_COLS[name] || [];
    return vals.map(function (r, i) {
      var o = { _row: i + 2 };
      headers.forEach(function (h, c) {
        var v = c < r.length ? r[c] : '';
        if (bools.indexOf(h) >= 0) v = (v === true || String(v).toUpperCase() === 'TRUE');
        else if (nums.indexOf(h) >= 0) v = Number(v) || 0;
        else if (v instanceof Date) v = v.toISOString();
        o[h] = v;
      });
      return o;
    });
  },
  /** Appends many rows in ONE setValues call, preserving order */
  append: function (name, objs) {
    if (!objs.length) return;
    var sh = this.sheet(name), headers = SCHEMA[name];
    var rows = objs.map(function (o) { return headers.map(function (h) { return sanitize_(o[h]); }); });
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, headers.length).setValues(rows);
    this.invalidate(name);
  },
  /** Overwrites a whole row from object */
  writeRow: function (name, rowNo, obj) {
    var headers = SCHEMA[name];
    this.sheet(name).getRange(rowNo, 1, 1, headers.length).setValues([headers.map(function (h) { return sanitize_(obj[h]); })]);
    this.invalidate(name);
  },
  /** Deletes a single 1-based sheet row */
  deleteRow: function (name, rowNo) {
    this.sheet(name).deleteRow(rowNo);
    this.invalidate(name);
  }
};

/** Prevent spreadsheet formula injection from user supplied text */
function sanitize_(v) {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}

/* ============================== AUTH ============================== */
var _props = null;
function prop_(k) { if (!_props) _props = PropertiesService.getScriptProperties().getProperties(); return _props[k]; }

var Auth = {
  hash: function (pw) {
    var salt = prop_('PW_SALT');
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
    return Utilities.base64Encode(bytes);
  },
  sign: function (data) {
    var secret = prop_('TOKEN_SECRET');
    return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, secret));
  },
  issue: function (user) {
    var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ uid: user.user_id, exp: Date.now() + CONFIG.TOKEN_TTL_SEC * 1000 }));
    return payload + '.' + this.sign(payload);
  },
  /** Verifies token and re-reads user so suspended accounts lose access immediately */
  verify: function (token) {
    if (!token || typeof token !== 'string' || token.indexOf('.') < 0) throw ApiError_('Unauthorized', 'UNAUTHORIZED');
    var parts = token.split('.');
    if (!safeEq_(this.sign(parts[0]), parts[1])) throw ApiError_('Unauthorized', 'UNAUTHORIZED');
    var p;
    try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
    catch (e) { throw ApiError_('Unauthorized', 'UNAUTHORIZED'); }
    if (!p.exp || p.exp < Date.now()) throw ApiError_('Session expired', 'UNAUTHORIZED');
    var user = Db.all('Users').filter(function (u) { return u.user_id === p.uid; })[0];
    if (!user || user.status !== 'active') throw ApiError_('Account suspended or not found', 'UNAUTHORIZED');
    return user;
  }
};

function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function publicUser_(u) {
  return { user_id: u.user_id, username: u.username, shop_name: u.shop_name, role: u.role, status: u.status, created_at: u.created_at };
}

/* ============================== ROUTER ============================== */
var Router = {
  // action: [handler, roles, needsLock]
  routes: function () {
    return {
      login:                [Service.login, null, false],
      public_catalog:       [Service.publicCatalog, null, false],
      me:                   [Service.me, ['admin', 'supplier'], false],
      change_password:      [Service.changePassword, ['admin', 'supplier'], true],
      master_items:         [Service.masterItems, ['admin', 'supplier'], false],
      variants:             [Service.variants, ['admin', 'supplier'], false],

      supplier_dashboard:   [Service.supplierDashboard, ['supplier'], false],
      add_stock:            [Service.addStock, ['supplier'], true],
      my_stock:             [Service.myStock, ['supplier'], false],
      withdraw:             [Service.withdraw, ['supplier'], true],
      enqueue:              [Service.enqueue, ['supplier'], true],
      unqueue:              [Service.unqueue, ['supplier'], true],

      admin_overview:           [Service.adminOverview, ['admin'], false],
      fifo_preview:             [Service.fifoPreview, ['admin'], false],
      fifo_confirm:             [Service.fifoConfirm, ['admin'], true],
      queue_board:              [Service.queueBoard, ['admin'], false],
      queue_move:               [Service.queueMove, ['admin'], true],
      lot_update:               [Service.lotUpdate, ['admin'], true],
      order_list:               [Service.orderList, ['admin'], false],
      order_update:             [Service.orderUpdate, ['admin'], true],
      item_upsert:              [Service.itemUpsert, ['admin'], true],
      item_toggle:              [Service.itemToggle, ['admin'], true],
      media_list:               [Service.mediaList, ['admin'], false],
      media_upsert:             [Service.mediaUpsert, ['admin'], true],
      media_delete:             [Service.mediaDelete, ['admin'], true],
      storefront_settings_save: [Service.storefrontSettingsSave, ['admin'], true],
      user_list:                [Service.userList, ['admin'], false],
      user_create:              [Service.userCreate, ['admin'], true],
      user_update:              [Service.userUpdate, ['admin'], true],
      logs_list:                [Service.logsList, ['admin'], false]
    };
  },
  dispatch: function (body) {
    var route = this.routes()[body.action];
    if (!route) throw ApiError_('Unknown action', 'NOT_FOUND');
    var handler = route[0], roles = route[1], needsLock = route[2];
    var payload = body.payload || {};
    var actor = null;
    if (roles) {
      actor = Auth.verify(body.token);
      if (roles.indexOf(actor.role) < 0) throw ApiError_('Forbidden', 'FORBIDDEN');
    }
    var run = function () { return handler.call(Service, payload, actor); };
    return { ok: true, data: needsLock ? withLock_(run) : run() };
  }
};

/** ALL writes go through this: script-wide lock prevents race conditions between concurrent users */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_WAIT_MS)) throw ApiError_('ระบบกำลังยุ่ง กรุณาลองใหม่อีกครั้ง', 'BUSY');
  try {
    var result = fn();
    SpreadsheetApp.flush(); // make sure data is committed BEFORE releasing the lock
    return result;
  } finally {
    lock.releaseLock();
  }
}

/* ============================== SERVICE (business logic) ============================== */
var Service = {

  /* ---------- auth ---------- */
  login: function (p) {
    var username = str_(p.username).toLowerCase(), password = str_(p.password);
    if (!username || !password) throw ApiError_('กรอกชื่อผู้ใช้และรหัสผ่าน');
    var cache = CacheService.getScriptCache(), key = 'fail:' + username;
    if (Number(cache.get(key) || 0) >= CONFIG.LOGIN_MAX_FAILS) throw ApiError_('ล็อกอินผิดหลายครั้ง กรุณารอสักครู่', 'RATE_LIMIT');
    var user = Db.all('Users').filter(function (u) { return String(u.username).toLowerCase() === username; })[0];
    if (!user || !safeEq_(user.password_hash, Auth.hash(password))) {
      cache.put(key, String(Number(cache.get(key) || 0) + 1), CONFIG.LOGIN_WINDOW_SEC);
      throw ApiError_('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'BAD_CREDENTIALS');
    }
    if (user.status !== 'active') throw ApiError_('บัญชีถูกระงับ', 'SUSPENDED');
    cache.remove(key);
    return { token: Auth.issue(user), user: publicUser_(user) };
  },
  me: function (p, actor) { return publicUser_(actor); },
  changePassword: function (p, actor) {
    var np = str_(p.new_password);
    if (np.length < 8) throw ApiError_('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (!safeEq_(actor.password_hash, Auth.hash(str_(p.old_password)))) throw ApiError_('รหัสผ่านเดิมไม่ถูกต้อง');
    actor.password_hash = Auth.hash(np);
    Db.writeRow('Users', actor._row, actor);
    return { changed: true };
  },
  masterItems: function (p, actor) {
    var items = Db.all('Master_Items').map(stripRow_);
    if (actor.role !== 'admin') items = items.filter(function (i) { return i.is_active; });
    return items;
  },

  /* ---------- queue helpers ---------- */
  /** Queue order of AVAILABLE pieces: queued_at ASC (time they ENTERED the queue), then sheet row ASC. Optional variant filter. */
  availableSorted_: function (stock, itemId, variant) {
    var v = variant === undefined || variant === null ? null : normNote_(variant);
    return stock.filter(function (s) {
      return s.status === STATUS.AVAILABLE && (!itemId || s.item_id === itemId) && (v === null || normNote_(s.custom_note) === v);
    }).sort(queueCmp_);
  },
  /** A queue slot = one LOT (pieces entered together, e.g. 11 GEM = 1 slot). Queue = same item_id + same variant.
   *  map stock_uid -> {pos,total,lot}; every piece of a lot shares its lot's position; total = number of lots. */
  queueMap_: function (stock) {
    var groups = {}, map = {};
    var avail = stock.filter(function (s) { return s.status === STATUS.AVAILABLE; }).sort(queueCmp_);
    avail.forEach(function (s) {
      var k = variantKey_(s), g = groups[k] = groups[k] || { lots: [], idx: {} }, lot = s.lot_id || s.stock_uid;
      if (g.idx[lot] === undefined) { g.idx[lot] = g.lots.length; g.lots.push(lot); }
    });
    avail.forEach(function (s) {
      var g = groups[variantKey_(s)], lot = s.lot_id || s.stock_uid;
      map[s.stock_uid] = { pos: g.idx[lot] + 1, total: g.lots.length, lot: lot };
    });
    return map;
  },
  /** distinct AVAILABLE variants per custom item (used for supplier suggestions + admin picker) */
  variants: function (p, actor) {
    var users = indexBy_(Db.all('Users'), 'user_id'), out = {};
    Db.all('Stock_Items').filter(function (s) { return s.status === STATUS.AVAILABLE; }).sort(fifoCmp_).forEach(function (s) {
      var list = out[s.item_id] = out[s.item_id] || {}, k = normNote_(s.custom_note);
      var v = list[k] = list[k] || { variant: s.custom_note, count: 0, suppliers: {}, lots: {} };
      v.lots[s.lot_id || s.stock_uid] = 1;
      v.count++;
      var n = users[s.supplier_id] ? users[s.supplier_id].shop_name : s.supplier_id;
      v.suppliers[n] = (v.suppliers[n] || 0) + 1;
    });
    var res = {};
    Object.keys(out).forEach(function (id) {
      res[id] = Object.keys(out[id]).map(function (k) {
        var v = out[id][k];
        v.lots = Object.keys(v.lots).length; // number of queue slots for this variant
        if (actor.role !== 'admin') v.suppliers = {};
        return v;
      });
    });
    return res;
  },

  /* ---------- supplier ---------- */
  supplierDashboard: function (p, actor) {
    var mine = Db.all('Stock_Items').filter(function (s) { return s.supplier_id === actor.user_id; });
    var c = { STOCKED: 0, AVAILABLE: 0, RESERVED: 0, SOLD: 0, WITHDRAWN: 0 };
    var soldValue = 0;
    mine.forEach(function (s) { c[s.status] = (c[s.status] || 0) + 1; if (s.status === STATUS.SOLD) soldValue += s.price_cost; });
    return { counts: c, total: mine.length, sold_cost_value: soldValue };
  },

  addStock: function (p, actor) {
    var qty = Math.floor(Number(p.qty));
    if (!(qty >= 1) || qty > CONFIG.MAX_QTY_PER_ADD) throw ApiError_('จำนวนต้องอยู่ระหว่าง 1-' + CONFIG.MAX_QTY_PER_ADD);
    var cost = Number(p.price_cost || 0);
    if (!(cost >= 0)) throw ApiError_('ราคาทุนไม่ถูกต้อง');
    var item = Db.all('Master_Items').filter(function (i) { return i.item_id === p.item_id; })[0];
    if (!item || !item.is_active) throw ApiError_('ไม่พบไอเทมหรือถูกปิดใช้งาน');
    var note = str_(p.custom_note).slice(0, 500);
    if (!item.has_custom_option) note = ''; // variant is optional even for variant items (blank = its own queue)
    // one record per piece; created_at strictly increasing (ms offset) so FIFO order == insertion order
    var enqueue = p.enqueue === true, lot = enqueue ? newUid_('LOT') : '';   // default: just stock it, NOT in the queue
    var base = Date.now(), rows = [], logs = [];
    for (var i = 0; i < qty; i++) {
      var ts = new Date(base + i).toISOString();
      var uid = newUid_('STK');
      rows.push({
        stock_uid: uid, item_id: item.item_id, server: item.server, supplier_id: actor.user_id,
        custom_note: note, price_cost: cost, status: enqueue ? STATUS.AVAILABLE : STATUS.STOCKED, created_at: ts, updated_at: ts, order_ref: '',
        lot_id: lot, queued_at: enqueue ? ts : ''
      });
      logs.push(logRow_(uid, 'ADD', actor.user_id, (enqueue ? 'ลงและเข้าคิว ' : 'ลงคลัง ') + (i + 1) + '/' + qty, ts));
    }
    Db.append('Stock_Items', rows);
    Db.append('Queue_Logs', logs);
    return { created: rows.map(function (r) { return r.stock_uid; }) };
  },

  myStock: function (p, actor) {
    var all = Db.all('Stock_Items'), qmap = this.queueMap_(all);
    var items = {};
    Db.all('Master_Items').forEach(function (i) { items[i.item_id] = i.item_name; });
    return all.filter(function (s) { return s.supplier_id === actor.user_id; })
      .sort(function (a, b) { return -fifoCmp_(a, b); })
      .map(function (s) {
        var o = stripRow_(s);
        o.item_name = items[s.item_id] || s.item_id;
        o.queue_position = qmap[s.stock_uid] ? qmap[s.stock_uid].pos : null;
        o.queue_total = qmap[s.stock_uid] ? qmap[s.stock_uid].total : null;
        return o;
      });
  },

  withdraw: function (p, actor) {
    var uids = (Array.isArray(p.stock_uids) ? p.stock_uids : [p.stock_uid]).map(str_).filter(Boolean);
    if (!uids.length) throw ApiError_('ไม่ได้ระบุรายการ');
    var stock = Db.all('Stock_Items'), byUid = indexBy_(stock, 'stock_uid');
    // validate everything first → all-or-nothing
    uids.forEach(function (u) {
      var s = byUid[u];
      if (!s || s.supplier_id !== actor.user_id) throw ApiError_('ไม่พบรายการ ' + u, 'NOT_FOUND');
      if (s.status !== STATUS.AVAILABLE && s.status !== STATUS.STOCKED) throw ApiError_('ถอนได้เฉพาะของในคลัง/รอขาย (' + u + ' คือ ' + s.status + ')', 'CONFLICT');
    });
    var ts = nowIso_(), logs = [];
    uids.forEach(function (u) {
      var s = byUid[u]; s.status = STATUS.WITHDRAWN; s.updated_at = ts;
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(u, 'WITHDRAW', actor.user_id, 'Supplier ถอนของออก', ts));
    });
    Db.append('Queue_Logs', logs);
    return { withdrawn: uids };
  },

  /** STOCKED -> AVAILABLE. All chosen pieces enter the queue TOGETHER as ONE lot = ONE queue slot. */
  enqueue: function (p, actor) {
    var uids = (Array.isArray(p.stock_uids) ? p.stock_uids : []).map(str_).filter(Boolean);
    if (!uids.length) throw ApiError_('ไม่ได้ระบุรายการ');
    var byUid = indexBy_(Db.all('Stock_Items'), 'stock_uid'), first = null;
    uids.forEach(function (u) {
      var s = byUid[u];
      if (!s || s.supplier_id !== actor.user_id) throw ApiError_('ไม่พบรายการ ' + u, 'NOT_FOUND');
      if (s.status !== STATUS.STOCKED) throw ApiError_(u + ' ไม่ได้อยู่ในคลัง (สถานะ ' + s.status + ')', 'CONFLICT');
      if (!first) first = s;
      else if (variantKey_(s) !== variantKey_(first)) throw ApiError_('ล็อตเดียวกันต้องเป็นไอเทมและรุ่นเดียวกัน');
    });
    var base = Date.now(), lot = newUid_('LOT'), logs = [];
    uids.forEach(function (u, i) {
      var s = byUid[u], ts = new Date(base + i).toISOString();
      s.status = STATUS.AVAILABLE; s.lot_id = lot; s.queued_at = ts; s.updated_at = ts;
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(u, 'ADD', actor.user_id, 'เข้าคิวขาย ล็อต ' + lot + ' (' + uids.length + ' ชิ้น = 1 คิว)', ts));
    });
    Db.append('Queue_Logs', logs);
    return { lot_id: lot, count: uids.length };
  },

  /** AVAILABLE -> STOCKED: leave the queue (loses its place) but stay in the warehouse. */
  unqueue: function (p, actor) {
    var uids = (Array.isArray(p.stock_uids) ? p.stock_uids : []).map(str_).filter(Boolean);
    if (!uids.length) throw ApiError_('ไม่ได้ระบุรายการ');
    var byUid = indexBy_(Db.all('Stock_Items'), 'stock_uid');
    uids.forEach(function (u) {
      var s = byUid[u];
      if (!s || s.supplier_id !== actor.user_id) throw ApiError_('ไม่พบรายการ ' + u, 'NOT_FOUND');
      if (s.status !== STATUS.AVAILABLE) throw ApiError_(u + ' ไม่ได้อยู่ในคิว (สถานะ ' + s.status + ')', 'CONFLICT');
    });
    var ts = nowIso_(), logs = [];
    uids.forEach(function (u) {
      var s = byUid[u]; s.status = STATUS.STOCKED; s.lot_id = ''; s.queued_at = ''; s.updated_at = ts;
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(u, 'WITHDRAW', actor.user_id, 'ออกจากคิว กลับเข้าคลัง', ts));
    });
    Db.append('Queue_Logs', logs);
    return { unqueued: uids };
  },

  /* ---------- admin: overview ---------- */
  adminOverview: function () {
    var stock = Db.all('Stock_Items'), items = Db.all('Master_Items');
    var users = indexBy_(Db.all('Users'), 'user_id');
    var summary = {}; // key item|server
    items.forEach(function (i) {
      summary[i.item_id] = { item_id: i.item_id, item_name: i.item_name, server: i.server, category: i.category,
        has_custom_option: i.has_custom_option, is_active: i.is_active, STOCKED: 0, AVAILABLE: 0, RESERVED: 0, SOLD: 0, WITHDRAWN: 0, suppliers: {} };
    });
    stock.forEach(function (s) {
      var r = summary[s.item_id]; if (!r) return;
      r[s.status]++;
      if (s.status === STATUS.AVAILABLE) {
        var n = users[s.supplier_id] ? users[s.supplier_id].shop_name : s.supplier_id;
        r.suppliers[n] = (r.suppliers[n] || 0) + 1;
      }
    });
    var rows = Object.keys(summary).map(function (k) { return summary[k]; });
    var servers = {};
    rows.forEach(function (r) { servers[r.server] = (servers[r.server] || 0) + r.AVAILABLE; });
    return { rows: rows, available_by_server: servers, totals: {
      STOCKED: sumBy_(rows, 'STOCKED'), AVAILABLE: sumBy_(rows, 'AVAILABLE'), RESERVED: sumBy_(rows, 'RESERVED'), SOLD: sumBy_(rows, 'SOLD') } };
  },

  /* ---------- admin: FIFO fulfilment ---------- */
  /** Read-only preview. For custom-option items also returns every candidate so admin may hand-pick. */
  fifoPreview: function (p) {
    var plan = this.buildPlan_(p, Db.all('Stock_Items'), true);
    delete plan._picked_raw; // internal rows must never leave the server
    return plan;
  },

  /** Builds {picked, shortfall, candidates?}. Used by preview AND by confirm (re-run inside the lock). */
  buildPlan_: function (p, stock, withCandidates) {
    var qty = Math.floor(Number(p.qty));
    if (!(qty >= 1) || qty > 1000) throw ApiError_('จำนวนไม่ถูกต้อง');
    var item = Db.all('Master_Items').filter(function (i) { return i.item_id === p.item_id; })[0];
    if (!item) throw ApiError_('ไม่พบไอเทม', 'NOT_FOUND');
    var variant = str_(p.variant);
    var itemAvail = this.availableSorted_(stock, item.item_id);              // every AVAILABLE piece of the item
    var avail = item.has_custom_option ? this.availableSorted_(stock, item.item_id, variant) : itemAvail; // the queue being consumed
    var qmap = this.queueMap_(stock);
    var picked, manual = false;
    var manualUids = Array.isArray(p.stock_uids) ? p.stock_uids.map(str_).filter(Boolean) : [];
    if (manualUids.length) {
      if (!item.has_custom_option) throw ApiError_('เลือกชิ้นเจาะจงได้เฉพาะไอเทมที่มีออปชั่นเฉพาะ');
      if (manualUids.length !== qty) throw ApiError_('จำนวนที่เลือกไม่ตรงกับจำนวนที่สั่ง');
      var byUid = indexBy_(itemAvail, 'stock_uid');
      picked = manualUids.map(function (u) {
        if (!byUid[u]) throw ApiError_('ชิ้น ' + u + ' ไม่อยู่ในสถานะ AVAILABLE แล้ว', 'CONFLICT');
        return byUid[u];
      });
      manual = true;
    } else {
      picked = avail.slice(0, qty);
    }
    var users = indexBy_(Db.all('Users'), 'user_id');
    var decorate = function (s) {
      var o = stripRow_(s);
      o.shop_name = users[s.supplier_id] ? users[s.supplier_id].shop_name : s.supplier_id;
      o.queue_position = qmap[s.stock_uid] ? qmap[s.stock_uid].pos : 0;
      return o;
    };
    var bySupplier = {};
    picked.forEach(function (s) { var n = users[s.supplier_id] ? users[s.supplier_id].shop_name : s.supplier_id; bySupplier[n] = (bySupplier[n] || 0) + 1; });
    var out = {
      item: stripRow_(item), variant: variant, qty: qty, available: avail.length, shortfall: Math.max(0, qty - picked.length),
      manual: manual, picked: picked.map(decorate),
      by_supplier: Object.keys(bySupplier).map(function (n) { return { shop_name: n, count: bySupplier[n] }; })
    };
    if (withCandidates && item.has_custom_option) out.candidates = itemAvail.map(decorate);
    out._picked_raw = picked; // internal – stripped before returning
    return out;
  },

  fifoConfirm: function (p, actor) {
    var orderRef = str_(p.order_ref).slice(0, 80);   // optional: blank → named after what was sold
    var target = p.mark === 'SOLD' ? STATUS.SOLD : STATUS.RESERVED;
    var stock = Db.all('Stock_Items');                      // re-read INSIDE lock → fresh state
    var plan = this.buildPlan_(p, stock, false);
    if (plan.shortfall > 0) throw ApiError_('สต็อกไม่พอ: มี ' + plan.available + ' ต้องการ ' + plan.qty, 'INSUFFICIENT');
    if (!orderRef) orderRef = (plan.item.item_name + (plan.variant ? ' ' + plan.variant : '') + ' ' +
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM HH:mm:ss')).slice(0, 80);
    var ts = nowIso_(), logs = [];
    plan._picked_raw.forEach(function (s) {
      s.status = target; s.updated_at = ts; s.order_ref = orderRef;
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(s.stock_uid, target === STATUS.SOLD ? 'SOLD' : 'RESERVE', actor.user_id,
        'order ' + orderRef + (plan.manual ? ' (เลือกเจาะจง)' : ' (FIFO คิว ' + plan.picked.length + ' ชิ้น)'), ts));
    });
    Db.append('Queue_Logs', logs);
    delete plan._picked_raw;
    return { order_ref: orderRef, status: target, picked: plan.picked, by_supplier: plan.by_supplier };
  },

  /* ---------- admin: queue board ---------- */
  /** Every queue (item + variant) with its lots in order, plus all RESERVED pieces grouped per order (= jobs to close). */
  queueBoard: function () {
    var stock = Db.all('Stock_Items'), items = indexBy_(Db.all('Master_Items'), 'item_id'), users = indexBy_(Db.all('Users'), 'user_id');
    var shop = function (id) { return users[id] ? users[id].shop_name : id; };
    var queues = {}, list = [];
    stock.filter(function (s) { return s.status === STATUS.AVAILABLE; }).sort(queueCmp_).forEach(function (s) {
      var k = variantKey_(s), it = items[s.item_id] || {};
      var q = queues[k];
      if (!q) {
        q = queues[k] = { key: k, item_id: s.item_id, item_name: it.item_name || s.item_id, category: it.category || '',
          has_custom_option: !!it.has_custom_option, variant: s.custom_note || '', pieces: 0, lots: [], _idx: {} };
        list.push(q);
      }
      var lid = lotOf_(s);
      if (q._idx[lid] === undefined) {
        q._idx[lid] = q.lots.length;
        q.lots.push({ lot_id: lid, supplier_id: s.supplier_id, shop_name: shop(s.supplier_id), count: 0, queued_at: s.queued_at || s.created_at, uids: [] });
      }
      var L = q.lots[q._idx[lid]];
      L.count++; L.uids.push(s.stock_uid); q.pieces++;
    });
    list.forEach(function (q) { delete q._idx; });

    var res = {}, reserved = [];
    stock.filter(function (s) { return s.status === STATUS.RESERVED; }).sort(fifoCmp_).forEach(function (s) {
      var k = s.order_ref + '|' + variantKey_(s) + '|' + s.supplier_id, it = items[s.item_id] || {};
      var r = res[k];
      if (!r) {
        r = res[k] = { key: k, order_ref: s.order_ref, item_name: it.item_name || s.item_id, variant: s.custom_note || '',
          shop_name: shop(s.supplier_id), count: 0, uids: [], updated_at: s.updated_at };
        reserved.push(r);
      }
      r.count++; r.uids.push(s.stock_uid);
    });
    return { queues: list, reserved: reserved };
  },

  /** Re-order a queue by rewriting queued_at of the lots involved only (never touches other lots). */
  queueMove: function (p, actor) {
    var lotId = str_(p.lot_id), dir = str_(p.direction);
    var stock = Db.all('Stock_Items');
    var mine = stock.filter(function (s) { return s.status === STATUS.AVAILABLE && lotOf_(s) === lotId; });
    if (!mine.length) throw ApiError_('ไม่พบล็อตนี้ในคิว (อาจถูกขาย/ย้ายไปแล้ว)', 'CONFLICT');
    var key = variantKey_(mine[0]), lots = [], idx = {};
    stock.filter(function (s) { return s.status === STATUS.AVAILABLE && variantKey_(s) === key; }).sort(queueCmp_).forEach(function (s) {
      var l = lotOf_(s);
      if (idx[l] === undefined) { idx[l] = lots.length; lots.push([]); }
      lots[idx[l]].push(s);
    });
    var i = idx[lotId], writes = [];
    var t = function (s) { return Date.parse(s.queued_at || s.created_at); };
    var place = function (lot, start) { lot.forEach(function (s, k) { writes.push([s, new Date(start + k).toISOString()]); }); };
    if (dir === 'up' || dir === 'down') {
      var a = dir === 'up' ? i - 1 : i, b = a + 1;           // swap neighbours a,b → b first
      if (a < 0 || b >= lots.length) throw ApiError_('ย้ายต่อไม่ได้แล้ว');
      var t0 = t(lots[a][0]);
      place(lots[b], t0);
      place(lots[a], t0 + lots[b].length);                  // still earlier than the lot after b
    } else if (dir === 'top') {
      if (i === 0) throw ApiError_('อยู่หัวคิวแล้ว');
      place(lots[i], t(lots[0][0]) - lots[i].length - 1);
    } else if (dir === 'bottom') {
      if (i === lots.length - 1) throw ApiError_('อยู่ท้ายคิวแล้ว');
      var last = lots[lots.length - 1];
      place(lots[i], Math.max(Date.now(), t(last[last.length - 1]) + 1));
    } else throw ApiError_('direction ไม่ถูกต้อง');
    var now = nowIso_();
    writes.forEach(function (w) { w[0].queued_at = w[1]; w[0].updated_at = now; Db.writeRow('Stock_Items', w[0]._row, w[0]); });
    var label = { up: 'ขึ้น 1 คิว', down: 'ลง 1 คิว', top: 'ไปหัวคิว', bottom: 'ไปท้ายคิว' }[dir];
    Db.append('Queue_Logs', [logRow_(mine[0].stock_uid, 'ADD', actor.user_id, 'Admin ย้ายล็อต ' + lotId + ' ' + label + ' (' + mine.length + ' ชิ้น)', now)]);
    return { moved: lotId, direction: dir };
  },

  /** Admin shrinks a lot to `keep` pieces (0 = take the whole lot out). Removed pieces go back to the supplier's warehouse. */
  lotUpdate: function (p, actor) {
    var lotId = str_(p.lot_id), keep = Math.floor(Number(p.keep));
    var pieces = Db.all('Stock_Items').filter(function (s) { return s.status === STATUS.AVAILABLE && lotOf_(s) === lotId; }).sort(queueCmp_);
    if (!pieces.length) throw ApiError_('ไม่พบล็อตนี้ในคิว (อาจถูกขาย/ย้ายไปแล้ว)', 'CONFLICT');
    if (!(keep >= 0) || keep >= pieces.length) throw ApiError_('ลดจำนวนได้อย่างเดียว (0 - ' + (pieces.length - 1) + ')');
    var out = pieces.slice(keep), now = nowIso_(), logs = [];
    out.forEach(function (s) {
      s.status = STATUS.STOCKED; s.lot_id = ''; s.queued_at = ''; s.updated_at = now;
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(s.stock_uid, 'WITHDRAW', actor.user_id, 'Admin นำออกจากคิว คืนคลังพ่อค้า (ล็อต ' + lotId + ')', now));
    });
    Db.append('Queue_Logs', logs);
    return { returned: out.length, kept: keep };
  },

  orderList: function () {
    var users = indexBy_(Db.all('Users'), 'user_id'), items = indexBy_(Db.all('Master_Items'), 'item_id');
    return Db.all('Stock_Items').filter(function (s) { return s.status === STATUS.RESERVED || (s.status === STATUS.SOLD && s.order_ref); })
      .sort(fifoCmp_).reverse().slice(0, 500).map(function (s) {
        var o = stripRow_(s);
        o.item_name = items[s.item_id] ? items[s.item_id].item_name : s.item_id;
        o.shop_name = users[s.supplier_id] ? users[s.supplier_id].shop_name : s.supplier_id;
        return o;
      });
  },

  /** RESERVED → SOLD | AVAILABLE (release keeps original created_at ⇒ keeps its place in the queue) */
  orderUpdate: function (p, actor) {
    var to = str_(p.to);
    if ([STATUS.SOLD, STATUS.AVAILABLE].indexOf(to) < 0) throw ApiError_('สถานะปลายทางไม่ถูกต้อง');
    var uids = (Array.isArray(p.stock_uids) ? p.stock_uids : [p.stock_uid]).map(str_).filter(Boolean);
    var byUid = indexBy_(Db.all('Stock_Items'), 'stock_uid');
    uids.forEach(function (u) {
      if (!byUid[u]) throw ApiError_('ไม่พบ ' + u, 'NOT_FOUND');
      if (byUid[u].status !== STATUS.RESERVED) throw ApiError_(u + ' ไม่ได้อยู่ในสถานะ RESERVED', 'CONFLICT');
    });
    var ts = nowIso_(), logs = [];
    uids.forEach(function (u) {
      var s = byUid[u], ref = s.order_ref;
      s.status = to; s.updated_at = ts; if (to === STATUS.AVAILABLE) s.order_ref = '';
      Db.writeRow('Stock_Items', s._row, s);
      logs.push(logRow_(u, to === STATUS.SOLD ? 'SOLD' : 'ADD', actor.user_id,
        to === STATUS.SOLD ? 'ยืนยันขาย order ' + ref : 'ยกเลิกจอง order ' + ref + ' (คืนคิวเดิม)', ts));
    });
    Db.append('Queue_Logs', logs);
    return { updated: uids, status: to };
  },

  /* ---------- public storefront (walk-in customers, no auth, zero supplier PII) ---------- */
  publicCatalog: function () {
    var items = Db.all('Master_Items').filter(function (i) { return i.is_active; }).map(stripRow_);
    var avail = Db.all('Stock_Items').filter(function (s) { return s.status === STATUS.AVAILABLE; });
    var counts = {}, variants = {};
    avail.forEach(function (s) {
      counts[s.item_id] = (counts[s.item_id] || 0) + 1;
      var k = normNote_(s.custom_note);
      var map = variants[s.item_id] = variants[s.item_id] || {};
      var v = map[k] = map[k] || { variant: s.custom_note || '', count: 0 };
      v.count++;
    });
    var catalog = items.map(function (it) {
      var list = variants[it.item_id] ? Object.keys(variants[it.item_id]).map(function (k) { return variants[it.item_id][k]; }) : [];
      list.sort(function (a, b) { return b.count - a.count || a.variant.localeCompare(b.variant); });
      return {
        item_id: it.item_id,
        item_name: it.item_name,
        category: it.category || '',
        server: it.server,
        has_custom_option: !!it.has_custom_option,
        image_url: it.image_url || '',
        description: it.description || '',
        available_count: counts[it.item_id] || 0,
        variants: it.has_custom_option ? list : []
      };
    });
    var media = Db.hasSheet('Storefront_Media')
      ? Db.all('Storefront_Media').filter(function (m) { return m.is_active; }).sort(mediaCmp_).map(stripRow_)
      : [];
    var settings = readStorefrontSettings_();
    var inStockTypes = catalog.filter(function (c) { return c.available_count > 0; }).length;
    return {
      settings: settings,
      media: media,
      items: catalog,
      stats: { total_available: avail.length, item_types_in_stock: inStockTypes, total_items: catalog.length, server: CONFIG.SERVER_NAME }
    };
  },

  /* ---------- admin: master items ---------- */
  itemUpsert: function (p) {
    var name = str_(p.item_name).slice(0, 100), server = CONFIG.SERVER_NAME;
    if (!name) throw ApiError_('ต้องระบุชื่อไอเทม');
    var items = Db.all('Master_Items');
    var img = p.image_url !== undefined ? resolveImageInput_(p.image_url, 'item') : null;
    var desc = p.description !== undefined ? str_(p.description).slice(0, 300) : null;
    var data = { item_name: name, category: str_(p.category).slice(0, 50), server: server, has_custom_option: !!p.has_custom_option };
    if (p.item_id) {
      var it = items.filter(function (i) { return i.item_id === p.item_id; })[0];
      if (!it) throw ApiError_('ไม่พบไอเทม', 'NOT_FOUND');
      // turning variants OFF is only safe when no live piece carries a variant note (else its queue would merge)
      var hasVariantStock = Db.all('Stock_Items').some(function (s) {
        return s.item_id === it.item_id && (s.status === STATUS.AVAILABLE || s.status === STATUS.RESERVED) && normNote_(s.custom_note) !== '';
      });
      if (it.has_custom_option && !data.has_custom_option && hasVariantStock)
        throw ApiError_('ยังมีสต็อกที่ระบุรุ่นอยู่ ปิดการแยกรุ่นไม่ได้ (ต้องขาย/ถอนของเหล่านั้นก่อน)');
      Object.keys(data).forEach(function (k) { it[k] = data[k]; });
      if (img !== null) it.image_url = img;
      if (desc !== null) it.description = desc;
      Db.writeRow('Master_Items', it._row, it);
      return stripRow_(it);
    }
    var dup = items.some(function (i) { return i.item_name === name && i.server === server; });
    if (dup) throw ApiError_('มีไอเทมนี้ใน Server นี้แล้ว', 'CONFLICT');
    var row = { item_id: newUid_('I'), item_name: data.item_name, category: data.category, server: data.server,
      has_custom_option: data.has_custom_option, is_active: true, image_url: img || '', description: desc || '' };
    Db.append('Master_Items', [row]);
    return row;
  },
  itemToggle: function (p) {
    var it = Db.all('Master_Items').filter(function (i) { return i.item_id === p.item_id; })[0];
    if (!it) throw ApiError_('ไม่พบไอเทม', 'NOT_FOUND');
    it.is_active = !!p.is_active;
    Db.writeRow('Master_Items', it._row, it);
    return stripRow_(it);
  },

  /* ---------- admin: storefront media & settings ---------- */
  mediaList: function () {
    return Db.all('Storefront_Media').sort(mediaCmp_).map(stripRow_);
  },
  mediaUpsert: function (p) {
    var title = str_(p.title).slice(0, 120);
    if (!title) throw ApiError_('ต้องระบุหัวข้อรูปภาพ');
    var caption = str_(p.caption).slice(0, 240);
    var tag = str_(p.tag).slice(0, 40);
    var sortOrder = Number(p.sort_order);
    if (isNaN(sortOrder)) sortOrder = 0;
    var isActive = p.is_active === undefined ? true : !!p.is_active;
    var img = resolveImageInput_(p.image_url, 'showcase');
    if (!img) throw ApiError_('กรุณาอัปโหลดรูปหรือใส่ลิงก์รูปภาพ');
    var rows = Db.all('Storefront_Media');
    if (p.media_id) {
      var m = rows.filter(function (x) { return x.media_id === p.media_id; })[0];
      if (!m) throw ApiError_('ไม่พบรูปโชว์นี้', 'NOT_FOUND');
      m.title = title; m.caption = caption; m.tag = tag; m.image_url = img;
      m.sort_order = sortOrder; m.is_active = isActive;
      Db.writeRow('Storefront_Media', m._row, m);
      return stripRow_(m);
    }
    var row = {
      media_id: newUid_('M'), title: title, caption: caption, tag: tag,
      image_url: img, sort_order: sortOrder, is_active: isActive, created_at: nowIso_()
    };
    Db.append('Storefront_Media', [row]);
    return row;
  },
  mediaDelete: function (p) {
    var m = Db.all('Storefront_Media').filter(function (x) { return x.media_id === p.media_id; })[0];
    if (!m) throw ApiError_('ไม่พบรูปโชว์นี้', 'NOT_FOUND');
    Db.deleteRow('Storefront_Media', m._row);
    return { deleted: p.media_id };
  },
  storefrontSettingsSave: function (p) {
    var allowed = Object.keys(DEFAULT_STOREFRONT_SETTINGS);
    var existing = Db.all('Storefront_Settings'), byKey = indexBy_(existing, 'key');
    var toAppend = [];
    allowed.forEach(function (k) {
      if (p[k] === undefined) return;
      var val = str_(p[k]).slice(0, 300);
      if (byKey[k]) {
        byKey[k].value = val;
        Db.writeRow('Storefront_Settings', byKey[k]._row, byKey[k]);
      } else {
        toAppend.push({ key: k, value: val });
      }
    });
    if (toAppend.length) Db.append('Storefront_Settings', toAppend);
    return readStorefrontSettings_();
  },

  /* ---------- admin: users ---------- */
  userList: function () {
    return Db.all('Users').map(function (u) { return publicUser_(u); });
  },
  userCreate: function (p) {
    var username = str_(p.username).toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw ApiError_('username: a-z 0-9 _ . - ยาว 3-30 ตัว');
    if (str_(p.password).length < 8) throw ApiError_('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    var shop = str_(p.shop_name).slice(0, 80);
    if (!shop) throw ApiError_('ต้องระบุชื่อร้าน/ผู้ฝากขาย');
    var role = p.role === 'admin' ? 'admin' : 'supplier';
    if (Db.all('Users').some(function (u) { return String(u.username).toLowerCase() === username; })) throw ApiError_('username นี้ถูกใช้แล้ว', 'CONFLICT');
    var row = { user_id: newUid_('U'), username: username, password_hash: Auth.hash(str_(p.password)), shop_name: shop,
      role: role, status: 'active', created_at: nowIso_() };
    Db.append('Users', [row]);
    return publicUser_(row);
  },
  userUpdate: function (p, actor) {
    var u = Db.all('Users').filter(function (x) { return x.user_id === p.user_id; })[0];
    if (!u) throw ApiError_('ไม่พบผู้ใช้', 'NOT_FOUND');
    if (p.status) {
      if (['active', 'suspended'].indexOf(p.status) < 0) throw ApiError_('status ไม่ถูกต้อง');
      if (u.user_id === actor.user_id && p.status !== 'active') throw ApiError_('ระงับบัญชีตัวเองไม่ได้');
      u.status = p.status;
    }
    if (p.shop_name) u.shop_name = str_(p.shop_name).slice(0, 80);
    if (p.new_password) {
      if (str_(p.new_password).length < 8) throw ApiError_('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
      u.password_hash = Auth.hash(str_(p.new_password));
    }
    Db.writeRow('Users', u._row, u);
    return publicUser_(u);
  },

  logsList: function (p) {
    var limit = Math.min(Number(p.limit) || 200, 1000);
    var logs = Db.all('Queue_Logs'), users = indexBy_(Db.all('Users'), 'user_id');
    return logs.slice(-limit).reverse().map(function (l) {
      var o = stripRow_(l); o.actor_name = users[l.actor_id] ? users[l.actor_id].username : l.actor_id; return o;
    });
  }
};

/* ============================== UTIL ============================== */
function fifoCmp_(a, b) {
  if (a.created_at < b.created_at) return -1;
  if (a.created_at > b.created_at) return 1;
  return a._row - b._row;
}
function lotOf_(s) { return s.lot_id || s.stock_uid; } // legacy pieces without lot = their own lot
function queueCmp_(a, b) {
  var ka = a.queued_at || a.created_at, kb = b.queued_at || b.created_at;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return a._row - b._row;
}
function normNote_(n) { return String(n === null || n === undefined ? '' : n).toLowerCase().replace(/\s+/g, ' ').trim(); }
function variantKey_(s) { return s.item_id + '|' + normNote_(s.custom_note); }
function nowIso_() { return new Date().toISOString(); }
function newUid_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function stripRow_(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row' && k !== '_picked_raw') c[k] = o[k]; }); return c; }
function indexBy_(arr, key) { var m = {}; arr.forEach(function (x) { m[x[key]] = x; }); return m; }
function sumBy_(arr, key) { return arr.reduce(function (a, x) { return a + x[key]; }, 0); }
function logRow_(uid, action, actor, note, ts) {
  return { log_id: newUid_('L'), stock_uid: uid, action: action, actor_id: actor, timestamp: ts || nowIso_(), note: note };
}
function mediaCmp_(a, b) {
  var sa = Number(a.sort_order) || 0, sb = Number(b.sort_order) || 0;
  if (sa !== sb) return sa - sb;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}
function readStorefrontSettings_() {
  var out = {};
  Object.keys(DEFAULT_STOREFRONT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_STOREFRONT_SETTINGS[k]; });
  if (!Db.hasSheet('Storefront_Settings')) return out;
  Db.all('Storefront_Settings').forEach(function (r) {
    if (r.key && Object.prototype.hasOwnProperty.call(out, r.key)) out[r.key] = str_(r.value);
  });
  return out;
}
/** Saves base64 data URLs to Google Drive (public view link) so Sheet cells stay tiny; falls back to compact Data URL if small. */
function resolveImageInput_(raw, prefix) {
  var s = str_(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.slice(0, 1000);
  var m = s.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!m) throw ApiError_('รูปแบบรูปภาพไม่ถูกต้อง (ต้องเป็นลิงก์ http(s) หรือไฟล์รูป)');
  var mime = m[1], b64 = m[2];
  try {
    var folderName = 'CabalStock_Images';
    var it = DriveApp.getFoldersByName(folderName);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
    var ext = mime.indexOf('webp') >= 0 ? 'webp' : mime.indexOf('png') >= 0 ? 'png' : 'jpg';
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, (prefix || 'img') + '-' + Date.now() + '.' + ext);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (err) {
    if (s.length <= 45000) return s;
    throw ApiError_('ไม่สามารถอัปโหลดรูปขึ้น Drive ได้: กรุณาอนุญาตสิทธิ์ Drive ใน Apps Script หรือใช้รูปขนาดเล็กลง / วางลิงก์ URL');
  }
}
