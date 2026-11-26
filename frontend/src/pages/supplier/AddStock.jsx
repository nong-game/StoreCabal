import { useMemo, useState } from 'react';
import { PackagePlus, CheckCircle2, ListPlus, RotateCcw, Warehouse } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, ErrorBox, QtyInput, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import FlowSteps from '../../components/FlowSteps.jsx';
import { EX_OPTIONS, PLUS_OPTIONS, buildVariant, norm } from '../../utils/variant.js';

const chip = (on) => `rounded-lg border px-3 py-1.5 text-sm transition active:scale-95 ${on
  ? 'border-arcane-500/70 bg-arcane-600/25 text-arcane-400 font-semibold shadow shadow-arcane-600/20'
  : 'border-ink-600 bg-ink-800 text-slate-300 hover:border-slate-500 hover:text-slate-100'}`;

function Step({ n, title, children, hint }) {
  return (
    <div className="space-y-2 animate-fade-up">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-[11px] font-bold text-slate-300">{n}</span>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** Step 1 of the supplier flow: put pieces into the WAREHOUSE only. Queueing is a separate page. */
export default function AddStock({ goTo }) {
  const toast = useToast();
  const { data: items, error, loading, reload } = useAsync(() => api.masterItems(), []);
  const [itemId, setItemId] = useState('');
  const [ex, setEx] = useState('');
  const [plus, setPlus] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // last successful add → success panel

  const byCat = useMemo(() => {
    const m = {};
    (items || []).forEach((i) => { (m[i.category || 'อื่น ๆ'] ||= []).push(i); });
    return Object.entries(m);
  }, [items]);
  const item = (items || []).find((i) => i.item_id === itemId);
  const note = item?.has_custom_option ? buildVariant(ex, plus) : '';
  const label = item ? `${item.item_name}${note ? ` ${note}` : item.has_custom_option ? ' (ไม่ระบุรุ่น)' : ''}` : '';
  const count = Math.max(1, Math.floor(Number(qty)) || 1);

  if (loading && !items) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const pick = (id) => { setItemId(id); setEx(''); setPlus(''); setDone(null); };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.addStock({ item_id: itemId, qty: count, custom_note: note });
      toast(`เก็บเข้าคลัง ${r.created.length} ชิ้นแล้ว`);
      setDone({ label, count: r.created.length, focus: `${itemId}|${norm(note)}` });
      setQty(1);
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <>
      <FlowSteps active="add" goTo={goTo} />

      {done && (
        <div className="card border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-pop-in">
          <CheckCircle2 className="text-emerald-300 shrink-0" size={28} />
          <div className="flex-1">
            <div className="font-semibold text-emerald-200">เก็บเข้าคลังแล้ว: {done.label} × {done.count}</div>
            <div className="text-xs text-emerald-300/70">ของยังไม่เข้าคิว กด "ลงคิวขาย" เมื่อพร้อมขาย</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDone(null)}><RotateCcw size={14} />ลงเพิ่ม</Button>
            <Button variant="gold" onClick={() => goTo('enqueue', { focus: done.focus })}><ListPlus size={16} />ลงคิวขายเลย</Button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <Card title="ลงสต็อกเข้าคลัง" delay={1}>
          <div className="space-y-5">
            <Step n={1} title="เลือกไอเทม">
              {!items.length ? <p className="text-sm text-slate-500">ยังไม่มีไอเทม ให้แอดมินเพิ่มก่อน</p> : byCat.map(([cat, list]) => (
                <div key={cat} className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">{cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((i) => <button key={i.item_id} type="button" onClick={() => pick(i.item_id)} className={chip(itemId === i.item_id)}>{i.item_name}</button>)}
                  </div>
                </div>
              ))}
            </Step>

            {item?.has_custom_option && (
              <Step n={2} title="เลือกรุ่น" hint="รุ่นเดียวกันจะต่อคิวเดียวกัน · ไม่เลือกเลย = ไม่ระบุรุ่น">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">EX</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setEx('')} className={chip(ex === '')}>ไม่มี</button>
                      {EX_OPTIONS.map((n) => <button key={n} type="button" onClick={() => setEx(String(n))} className={chip(ex === String(n))}>EX {n}</button>)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">ค่าบวก</div>
                    <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5">
                      <button type="button" onClick={() => setPlus('')} className={`${chip(plus === '')} col-span-2 sm:col-span-1`}>ไม่มี</button>
                      {PLUS_OPTIONS.map((n) => <button key={n} type="button" onClick={() => setPlus(String(n))} className={`${chip(plus === String(n))} !px-0 tabular-nums`}>+{n}</button>)}
                    </div>
                  </div>
                </div>
              </Step>
            )}

            {item && (
              <Step n={item.has_custom_option ? 3 : 2} title="จำนวนชิ้น" hint="ระบบเก็บทีละชิ้น แต่ละชิ้นมีรหัส stock_uid ของตัวเอง">
                <div className="max-w-xs"><QtyInput value={qty} onChange={setQty} max={200} showMax={false} /></div>
              </Step>
            )}
          </div>
        </Card>

        {/* summary (sticky on desktop, under the form on mobile) */}
        <div className="lg:sticky lg:top-6 animate-fade-up" style={{ animationDelay: '140ms' }}>
          <div className="card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Warehouse size={16} className="text-sky-300" />สรุปก่อนเก็บเข้าคลัง</div>
            {item ? (
              <div className="rounded-lg border border-ink-600 bg-ink-900/50 p-3">
                <div className="text-xs text-slate-500">ไอเทม</div>
                <div className="font-semibold text-gold-400">{label}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">จำนวน</span>
                  <span key={count} className="text-2xl font-bold text-slate-100 tabular-nums animate-pop-in">× {count}</span>
                </div>
              </div>
            ) : <p className="text-sm text-slate-500">เลือกไอเทมก่อน</p>}
            <Button variant="gold" className="w-full" disabled={!item} loading={busy} onClick={submit}><PackagePlus size={16} />เก็บเข้าคลัง</Button>
            <p className="text-[11px] text-slate-500">ยังไม่เข้าคิว · ไปที่ "ลงคิวขาย" เพื่อเลือกจำนวนที่จะเข้าคิว (ทั้งชุด = 1 คิว)</p>
          </div>
        </div>
      </div>
    </>
  );
}
