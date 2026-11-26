import { useEffect, useMemo, useState } from 'react';
import { ListPlus, PackagePlus, Undo2, CheckCircle2, ListOrdered, Warehouse, ArrowRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, Confirm, ErrorBox, QtyInput, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import FlowSteps from '../../components/FlowSteps.jsx';
import { norm } from '../../utils/variant.js';

const byCreated = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);

/** Step 2 of the supplier flow: pick pieces from the WAREHOUSE and put them in the sales queue as ONE lot = ONE queue slot. */
export default function Enqueue({ goTo, params }) {
  const toast = useToast();
  const stock = useAsync(() => api.myStock(), []);
  const vars = useAsync(() => api.variants(), []);
  const [sel, setSel] = useState(params?.focus || null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [askWithdraw, setAskWithdraw] = useState(false);
  const [done, setDone] = useState(null);

  // warehouse = STOCKED pieces, one card per item + variant
  const groups = useMemo(() => {
    const m = new Map();
    (stock.data || []).filter((r) => r.status === 'STOCKED').forEach((r) => {
      const k = `${r.item_id}|${norm(r.custom_note)}`;
      if (!m.has(k)) m.set(k, { key: k, item_id: r.item_id, item_name: r.item_name, note: r.custom_note, items: [] });
      m.get(k).items.push(r);
    });
    return [...m.values()].map((g) => ({ ...g, items: g.items.sort(byCreated) })).sort((a, b) => a.item_name.localeCompare(b.item_name, 'th') || norm(a.note).localeCompare(norm(b.note)));
  }, [stock.data]);

  const g = groups.find((x) => x.key === sel);
  useEffect(() => { // keep a valid selection: requested focus → else first card
    if (!stock.data) return;
    if (!g && groups.length) setSel(groups[0].key);
  }, [stock.data, groups, g]);
  useEffect(() => { if (g) setQty(g.items.length); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stock.loading && !stock.data) return <Spinner />;
  if (stock.error) return <ErrorBox error={stock.error} onRetry={stock.reload} />;

  const lotsAhead = (grp) => (vars.data?.[grp.item_id] || []).find((v) => norm(v.variant) === norm(grp.note))?.lots || 0;
  const n = g ? Math.max(1, Math.min(Math.floor(Number(qty)) || 1, g.items.length)) : 0;
  const label = (grp) => `${grp.item_name}${grp.note ? ` ${grp.note}` : ''}`;

  const enqueue = async () => {
    setBusy(true);
    const position = lotsAhead(g) + 1;
    try {
      await api.enqueue(g.items.slice(0, n).map((p) => p.stock_uid)); // oldest pieces first
      toast(`เข้าคิวแล้ว ${n} ชิ้น = 1 คิว`);
      setDone({ label: label(g), n, position });
      stock.reload(); vars.reload();
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    setBusy(true);
    try {
      await api.withdraw(g.items.slice(-n).map((p) => p.stock_uid)); // newest pieces first
      toast(`ถอนออกจากคลัง ${n} ชิ้นแล้ว`);
      stock.reload();
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); setAskWithdraw(false); }
  };

  const total = groups.reduce((x, grp) => x + grp.items.length, 0);

  return (
    <>
      <FlowSteps active="enqueue" goTo={goTo} badges={{ enqueue: total }} />

      {done && (
        <div className="card border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-pop-in">
          <CheckCircle2 className="text-emerald-300 shrink-0" size={28} />
          <div className="flex-1">
            <div className="font-semibold text-emerald-200">เข้าคิวแล้ว: {done.label} × {done.n}</div>
            <div className="text-xs text-emerald-300/70">ได้คิวที่ {done.position} (ทั้ง {done.n} ชิ้นนับเป็น 1 คิว)</div>
          </div>
          <Button variant="ghost" onClick={() => goTo('mine')}><ListOrdered size={16} />ดูคิวของฉัน</Button>
        </div>
      )}

      {!groups.length ? (
        <Card delay={1}>
          <div className="py-10 text-center space-y-3 animate-fade-in">
            <Warehouse size={40} className="mx-auto text-slate-600" />
            <div className="text-slate-300 font-medium">คลังว่าง</div>
            <div className="text-sm text-slate-500">ลงสต็อกเข้าคลังก่อน แล้วค่อยกลับมาเลือกเข้าคิว</div>
            <Button variant="gold" onClick={() => goTo('add')}><PackagePlus size={16} />ไปลงสต็อก</Button>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <Card title={`ของในคลัง · ${total} ชิ้น`} delay={1}>
            <ul className="grid sm:grid-cols-2 gap-2">
              {groups.map((grp, i) => {
                const on = grp.key === sel; const ahead = lotsAhead(grp);
                return (
                  <li key={grp.key} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                    <button type="button" onClick={() => { setSel(grp.key); setDone(null); }}
                      className={`w-full text-left rounded-xl border p-3 transition active:scale-[.98] ${on ? 'border-arcane-500/70 bg-arcane-600/15 shadow-lg shadow-arcane-600/10' : 'border-ink-600 bg-ink-800 hover:border-slate-500'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 truncate">{grp.item_name}</div>
                          {grp.note && <div className="text-xs font-semibold text-gold-400">{grp.note}</div>}
                        </div>
                        <span className="rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-sm font-bold text-sky-300 tabular-nums">× {grp.items.length}</span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">{ahead ? `ในคิวตอนนี้ ${ahead} คิว` : 'ยังไม่มีใครเข้าคิวรุ่นนี้'}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {g && (
            <div className="lg:sticky lg:top-6 animate-fade-up" style={{ animationDelay: '140ms' }}>
              <div className="card p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><ListPlus size={16} className="text-arcane-400" />เข้าคิวขาย</div>
                <div className="rounded-lg border border-ink-600 bg-ink-900/50 p-3">
                  <div className="font-semibold text-gold-400">{label(g)}</div>
                  <div className="text-xs text-slate-500">ในคลัง {g.items.length} ชิ้น</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">จำนวนที่จะเข้าคิว</div>
                  <QtyInput value={qty} onChange={setQty} max={g.items.length} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-ink-900/50 border border-ink-600 px-3 py-2">
                  <span className="text-xs text-slate-400">{n} ชิ้น <ArrowRight size={12} className="inline" /> 1 คิว</span>
                  <span key={`${sel}-${lotsAhead(g)}`} className="text-sm font-bold text-gold-400 animate-pop-in">ได้คิวที่ {lotsAhead(g) + 1}</span>
                </div>
                <Button variant="gold" className="w-full" loading={busy && !askWithdraw} onClick={enqueue}><ListPlus size={16} />เข้าคิว {n} ชิ้น</Button>
                <button type="button" onClick={() => setAskWithdraw(true)} className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-rose-300 transition">
                  <Undo2 size={13} />ถอน {n} ชิ้นออกจากคลัง
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Confirm open={askWithdraw} danger loading={busy} title="ถอนออกจากคลัง" confirmLabel={`ถอนออก ${n} ชิ้น`} onCancel={() => setAskWithdraw(false)} onConfirm={withdraw}
        body={g && <>ถอน <b className="text-slate-200">{label(g)}</b> {n} ชิ้นออกจากระบบถาวร</>} />
    </>
  );
}
