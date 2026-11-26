# Cabal Stock Portal – Architecture

```
React (Vite + Tailwind)  ──POST text/plain JSON──▶  Apps Script Web App  ──▶  Google Sheets
   services/api.js                                   Router → Service → Db       Users / Master_Items /
   (mock if VITE_API_URL empty)                      LockService on every write   Stock_Items / Queue_Logs
```

## Layers (backend/Code.gs)
| Layer | Role | Port to Node later |
|---|---|---|
| `Router` | action → handler, token + role guard, wraps writes in lock | Express routes + middleware |
| `Service` | business rules (FIFO, queue position, status transitions) | unchanged |
| `Db` | only code touching `SpreadsheetApp` (`all`, `append`, `writeRow`) | swap for Sheets API client |
| `Auth` | salted SHA-256 password hash, HMAC-signed 12h token | JWT / bcrypt |

## Item-by-item
`add_stock(qty=5)` loops 5×, creating 5 `Stock_Items` rows, each with its own `stock_uid`, `created_at = base + i ms`
(strictly increasing) and an `ADD` log; all rows are written with **one** `setValues` call, so they stay contiguous and in order.
Items with `has_custom_option` must be added one at a time with a `custom_note`.

## Warehouse → queue lots
Status flow: `STOCKED` (in warehouse, NOT queued) → `AVAILABLE` (in queue) → `RESERVED` → `SOLD`; `WITHDRAWN` is final.
`add_stock` defaults to STOCKED; `enqueue` moves chosen pieces into the queue **together as one lot** (`lot_id`, `queued_at`), so 11 pieces = 1 queue slot.
Queue order is by `queued_at` (the time a lot entered the queue), and a queue position counts lots, not pieces. Selling still consumes pieces in FIFO order, so a partly sold lot keeps its place at the front.

## FIFO
Queue for (item_id, server) = rows with `status = AVAILABLE`, sorted by `created_at ASC`, then sheet row ASC.
* Queue position shown to supplier = index in that list + 1, total = list length (`คิวที่ 2 / 15`).
* `fifo_preview` – read-only, first *qty* rows of the queue, grouped by supplier.
* `fifo_confirm` – re-computes the queue **inside the lock**, then sets `RESERVED`/`SOLD` + `order_ref` + log. All-or-nothing: insufficient stock → nothing changes.
* Exception: for `has_custom_option` items admin may pass explicit `stock_uids` (hand-pick); validated as AVAILABLE and logged "เลือกเจาะจง".
* Releasing a RESERVED item (`order_update → AVAILABLE`) keeps its original `created_at`, so it returns to its old queue place. Withdrawn items are gone for good.

## Concurrency
Every mutating action has `needsLock = true` in the route table → `withLock_()`:
`LockService.getScriptLock().tryLock(20s)` → read fresh data → validate → write → `SpreadsheetApp.flush()` → release.
Validation and write happen in the same critical section, so two admins can never reserve the same piece and a supplier
cannot withdraw a piece at the same moment it is reserved (loser gets a `CONFLICT` error; UI refreshes). Reads are lock-free.

```
Admin A  confirm ─ lock ─ read ─ pick uid#1..3 ─ write RESERVED ─ flush ─ unlock
Admin B  confirm ──────── wait ───────────────▶ lock ─ read (uid#1..3 now RESERVED) ─ pick #4..6 ─ …
```

## Security notes
* Token = `base64(payload).HMAC`; secret in Script Properties. Account status re-checked from `Users` on every call (suspend = instant).
* Role guard per route; supplier queries are filtered by `actor.user_id` server-side (client never supplies supplier id).
* Login rate limit (5 fails / 10 min per username) via CacheService.
* Spreadsheet formula injection: strings starting with `= + - @` are prefixed with `'` before writing.
* Apps Script deployed "Anyone" is public by URL – that is why every action except `login` requires the token.

## Limits to know
Google Sheets is read in full per request (fine for ~tens of thousands of rows). If `Stock_Items` grows beyond that, archive SOLD/WITHDRAWN rows to a separate sheet.
`WITHDRAW`/`SOLD`/`RESERVE`/`ADD` are the only log actions; "release reservation" is logged as `ADD` with an explanatory note.
