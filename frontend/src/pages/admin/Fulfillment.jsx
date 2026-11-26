import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Pencil, Trash2, Swords, CheckCheck, RotateCcw, RefreshCw, ListOrdered, ClipboardCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, Confirm, ErrorBox, QtyInput, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

const iconBtn = 'p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-ink-600 transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none';
const qLabel = (q) => `${q.item_name}${q.variant ? ` ${q.variant}` : ''}`;

/** Admin queue board: see every queue, re-order / edit lots, sell from the front (FIFO), and close reserved jobs. */
export default function Fulfillment() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.queueBoard(), []);
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(1);
  const [orderRef, setOrderRef] = useState('');
  const [mark, setMark] = useState('RESERVED');
  const [busy, setBusy] = useState('');           // which action is running
  const [dlg, setDlg] = useState(null);           // { type:'sell'|'edit'|'remove', lot? }
  const [keep, setKeep] = useState(0);

  const queues = data?.queues || [];
  const q = queues.find((x) => x.key === sel);
  useEffect(() => { if (data && !q && queues.length) setSel(queues[0].key); }, [data, q, queues]);
  useEffect(() => { setQty(1); }, [sel]);

  // which lots the current qty would consume (client-side mirror of the server's FIFO)
  const take = useMemo(() => {
    const m = {}; let left = Math.max(0, Math.floor(Number(qty)) || 0);
    (q?.lots || []).forEach((l) => { const n = Math.min(l.count, left); if (n > 0) m[l.lot_id] = n; left -= n; });
    return m;
  }, [q, qty]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) toast(okMsg); await reload(); }
    catch (x) { toast(x.message, 'err'); reload(); }
    finally { setBusy(''); setDlg(null); }
  };
  const move = (lot, dir) => act(`${lot.lot_id}:${dir}`, () => api.queueMove(lot.lot_id, dir));
  const sell = () => act('sell', () => api.fifoConfirm({
    item_id: q.item_id, variant: q.has_custom_option ? q.variant : undefined, qty: Number(qty), order_ref: orderRef.trim(), mark
  }).then(() => setOrderRef('')), mark === 'SOLD' ? 'ปิดการขายแล้ว' : 'จองแล้ว รอปิดงานด้านล่าง');
  const saveLot = () => act('lot', () => api.lotUpdate(dlg.lot.lot_id, dlg.type === 'remove' ? 0 : Number(keep)),
    dlg.type === 'remove' ? 'เอาล็อตออกจากคิวแล้ว (คืนคลังพ่อค้า)' : 'แก้จำนวนแล้ว ส่วนที่ลดคืนคลังพ่อค้า');
  const closeJob = (r, to) => act(`${r.key}:${to}`, () => api.orderUpdate(r.uids, to), to === 'SOLD' ? `ปิดงาน ${r.order_ref} แล้ว` : `ยกเลิกจอง ${r.order_ref} คืนคิวเดิมแล้ว`);

  const reserved = data.reserved || [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">คิวขาย</h1>
        <Button variant="ghost" onClick={reload} loading={loading && !busy}><RefreshCw size={14} />รีเฟรช</Button>
      </div>

      {!queues.length ? (
        <Card><div className="py-10 text-center text-sm text-slate-500"><ListOrdered size={36} className="mx-auto mb-2 text-slate-600" />ยังไม่มีของในคิว</div></Card>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
          {/* queue list */}
          <Card title={`คิวทั้งหมด (${queues.length})`} delay={0}>
            <ul className="space-y-1.5 -mx-1">
              {queues.map((x) => (
                <li key={x.key}>
                  <button onClick={() => setSel(x.key)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition active:scale-[.98] ${x.key === sel ? 'border-arcane-500/60 bg-arcane-600/15' : 'border-transparent hover:bg-ink-700/60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm font-medium ${x.key === sel ? 'text-arcane-400' : 'text-slate-200'}`}>{x.item_name}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{x.lots.length} คิว</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gold-400">{x.variant || (x.has_custom_option ? 'ไม่ระบุรุ่น' : '')}</span>
                      <span className="text-slate-500 tabular-nums">{x.pieces} ชิ้น</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {q && (
            <div className="space-y-4 min-w-0">
              {/* sell bar */}
              <Card title={<span>ขาย <span className="text-gold-400">{qLabel(q)}</span></span>} delay={1}>
                <div className="grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
                  <div><label>จำนวนที่ลูกค้าสั่ง</label><QtyInput value={qty} onChange={setQty} max={q.pieces} /></div>
                  <div><label>เลขที่ออเดอร์</label><input value={orderRef} maxLength={80} onChange={(e) => setOrderRef(e.target.value)} placeholder="เช่น ORD-1024" /></div>
                  <div className="flex rounded-lg border border-ink-600 p-0.5 bg-ink-900/50 h-[38px]">
                    {[['RESERVED', 'จองไว้'], ['SOLD', 'ขายเลย']].map(([k, t]) => (
                      <button key={k} type="button" onClick={() => setMark(k)} className={`px-3 rounded-md text-xs font-semibold transition ${mark === k ? 'bg-arcane-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">ดึงจากหัวคิวตามลำดับ · ล็อตที่ถูกดึงไฮไลต์สีทองด้านล่าง</p>
                  <Button variant="gold" disabled={!orderRef.trim()} onClick={() => setDlg({ type: 'sell' })}><Swords size={16} />{mark === 'SOLD' ? 'ขาย' : 'จอง'} {Math.min(Number(qty) || 0, q.pieces)} ชิ้น</Button>
                </div>
              </Card>

              {/* the queue itself */}
              <Card title={`ลำดับคิว · ${q.lots.length} คิว / ${q.pieces} ชิ้น`} delay={2}>
                <ol className="space-y-1.5">
                  {q.lots.map((l, i) => {
                    const n = take[l.lot_id]; const b = (d) => busy === `${l.lot_id}:${d}`;
                    return (
                      <li key={l.lot_id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-300 animate-fade-up ${n ? 'border-gold-500/50 bg-gold-500/10' : 'border-ink-600 bg-ink-800'}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-gold-500 text-ink-950' : 'bg-ink-700 text-slate-300'}`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-slate-100">{l.shop_name}</span>
                            <span className="rounded bg-ink-700 px-1.5 text-sm font-bold text-slate-100 tabular-nums">× {l.count}</span>
                            {n && <span className="rounded-full bg-gold-500 px-2 text-[11px] font-bold text-ink-950 animate-pop-in">ดึง {n}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500">เข้าคิว {fmtDate(l.queued_at)}</div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button className={iconBtn} title="ไปหัวคิว" disabled={i === 0 || !!busy} onClick={() => move(l, 'top')}><ChevronsUp size={16} /></button>
                          <button className={iconBtn} title="ขึ้น 1" disabled={i === 0 || !!busy} onClick={() => move(l, 'up')}>{b('up') ? <RefreshCw size={16} className="animate-spin" /> : <ChevronUp size={16} />}</button>
                          <button className={iconBtn} title="ลง 1" disabled={i === q.lots.length - 1 || !!busy} onClick={() => move(l, 'down')}>{b('down') ? <RefreshCw size={16} className="animate-spin" /> : <ChevronDown size={16} />}</button>
                          <button className={iconBtn} title="ไปท้ายคิว" disabled={i === q.lots.length - 1 || !!busy} onClick={() => move(l, 'bottom')}><ChevronsDown size={16} /></button>
                          <span className="mx-1 h-5 w-px bg-ink-600" />
                          <button className={iconBtn} title="แก้จำนวน" disabled={l.count < 2 || !!busy} onClick={() => { setKeep(l.count - 1); setDlg({ type: 'edit', lot: l }); }}><Pencil size={15} /></button>
                          <button className={`${iconBtn} hover:!text-rose-300`} title="เอาออกจากคิว" disabled={!!busy} onClick={() => setDlg({ type: 'remove', lot: l })}><Trash2 size={15} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* jobs to close */}
      <Card title={<span className="flex items-center gap-2"><ClipboardCheck size={16} className="text-amber-300" />ติดจอง · รอปิดงาน ({reserved.length})</span>} delay={3}>
        {!reserved.length ? <p className="text-sm text-slate-500 py-4 text-center">ไม่มีงานค้าง</p> : (
          <ul className="space-y-1.5">
            {reserved.map((r) => (
              <li key={r.key} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 animate-fade-up">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-amber-200">{r.order_ref}</span>
                    <span className="text-sm text-slate-200">{r.item_name}{r.variant && <span className="ml-1 text-gold-400">{r.variant}</span>}</span>
                    <span className="rounded bg-ink-700 px-1.5 text-sm font-bold text-slate-100 tabular-nums">× {r.count}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{r.shop_name} · จองเมื่อ {fmtDate(r.updated_at)}</div>
                </div>
                <div className="flex gap-1.5">
                  <Button className="!px-3 !py-1.5 text-xs" loading={busy === `${r.key}:SOLD`} disabled={!!busy} onClick={() => closeJob(r, 'SOLD')}><CheckCheck size={14} />ปิดงาน (ขายแล้ว)</Button>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" loading={busy === `${r.key}:AVAILABLE`} disabled={!!busy} onClick={() => closeJob(r, 'AVAILABLE')}><RotateCcw size={14} />ยกเลิกจอง</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Confirm open={dlg?.type === 'sell'} loading={busy === 'sell'} title={mark === 'SOLD' ? 'ยืนยันขาย' : 'ยืนยันจอง'} confirmLabel="ยืนยัน" onCancel={() => setDlg(null)} onConfirm={sell}
        body={q && <>{mark === 'SOLD' ? 'ขาย' : 'จอง'} <b className="text-slate-200">{qLabel(q)} × {Math.min(Number(qty) || 0, q.pieces)}</b> ออเดอร์ <b className="text-slate-200">{orderRef}</b> จากหัวคิว ระบบจะตรวจคิวล่าสุดอีกครั้งก่อนบันทึก</>} />
      <Confirm open={dlg?.type === 'edit'} loading={busy === 'lot'} title="แก้จำนวนในล็อต" confirmLabel={`เหลือ ${keep} ชิ้น`} onCancel={() => setDlg(null)} onConfirm={saveLot}
        body={dlg?.lot && (
          <div className="space-y-3">
            <div>{dlg.lot.shop_name} · มี {dlg.lot.count} ชิ้น · ลดได้อย่างเดียว</div>
            <QtyInput value={keep} onChange={setKeep} min={1} max={dlg.lot.count - 1} showMax={false} />
            <div className="text-xs text-slate-500">ส่วนที่ลด ({dlg.lot.count - (Number(keep) || 0)} ชิ้น) คืนเข้าคลังของพ่อค้า ล็อตยังอยู่ตำแหน่งเดิม</div>
          </div>
        )} />
      <Confirm open={dlg?.type === 'remove'} danger loading={busy === 'lot'} title="เอาล็อตออกจากคิว" confirmLabel="เอาออก" onCancel={() => setDlg(null)} onConfirm={saveLot}
        body={dlg?.lot && <>เอาล็อตของ <b className="text-slate-200">{dlg.lot.shop_name}</b> ({dlg.lot.count} ชิ้น) ออกจากคิว ของจะคืนเข้าคลังของพ่อค้า ไม่ได้ถูกลบ</>} />
    </>
  );
}
