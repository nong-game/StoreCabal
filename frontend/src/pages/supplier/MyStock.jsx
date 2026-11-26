import { Fragment, useMemo, useState } from 'react';
import { Undo2, RefreshCw, ChevronDown, ListPlus, LogOut, ListOrdered, Layers } from 'lucide-react';
import FlowSteps from '../../components/FlowSteps.jsx';
import { api } from '../../services/api.js';
import { Badge, Button, Card, Confirm, ErrorBox, QtyInput, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate, fmtUnit } from '../../utils/format.js';

const FILTERS = [
  ['ACTIVE', 'กำลังขาย'], ['AVAILABLE', 'ในคิว'], ['RESERVED', 'ติดจอง'], ['SOLD', 'ขายแล้ว'], ['WITHDRAWN', 'ถอนออก'], ['ALL', 'ทั้งหมด']
];
const ACTIVE = ['AVAILABLE', 'RESERVED'];
const norm = (n) => String(n ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const byCreated = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);

/**
 * Data is item-by-item (1 piece = 1 row) but shown by what the supplier thinks in:
 *  - in the queue  : one row per LOT  (11 pieces entered together = 1 queue slot)
 *  - in warehouse  : one row per item+variant
 *  - reserved/sold : one row per item+variant+order
 */
function buildGroups(rows) {
  const m = new Map();
  rows.forEach((r) => {
    let k;
    if (r.status === 'AVAILABLE') k = `AVAILABLE|${r.lot_id || r.stock_uid}`;
    else if (r.status === 'STOCKED') k = `STOCKED|${r.item_id}|${norm(r.custom_note)}`;
    else k = [r.status, r.item_id, norm(r.custom_note), r.order_ref].join('|');
    if (!m.has(k)) m.set(k, { key: k, status: r.status, item_name: r.item_name, unit: r.unit, note: r.custom_note, order_ref: r.order_ref, items: [] });
    m.get(k).items.push(r);
  });
  const list = [...m.values()];
  list.forEach((g) => {
    g.items.sort(byCreated);
    g.pos = g.items[0].queue_position; g.total = g.items[0].queue_total;
    g.latest = g.items.reduce((x, i) => (i.updated_at > x ? i.updated_at : x), '');
  });
  const rank = { AVAILABLE: 0, STOCKED: 1, RESERVED: 2, SOLD: 3, WITHDRAWN: 4 };
  return list.sort((a, b) => rank[a.status] - rank[b.status] || (a.pos ?? 1e9) - (b.pos ?? 1e9) || (a.latest < b.latest ? 1 : -1));
}

function QueueChip({ g }) {
  if (g.status !== 'AVAILABLE' || !g.pos) return <span className="text-slate-600">-</span>;
  const next = g.pos === 1;
  const pct = Math.max(8, Math.round(((g.total - g.pos + 1) / g.total) * 100));
  return (
    <div className="min-w-[120px]">
      <div className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5 ${next ? 'bg-gold-500/20 border border-gold-500/50 animate-glow' : 'bg-ink-700 border border-ink-600'}`}>
        <span className={`font-bold ${next ? 'text-gold-400' : 'text-slate-100'}`}>{next ? 'ถัดไป!' : `คิวที่ ${g.pos}`}</span>
        <span className="text-[11px] text-slate-500">/ {g.total} คิว</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-ink-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${next ? 'bg-gold-400' : 'bg-arcane-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const MODES = {
  enqueue: { title: 'เข้าคิวขาย', btn: (n) => `เข้าคิว ${n} ชิ้น (1 คิว)`, note: 'ชิ้นที่เลือกจะเข้าคิวพร้อมกันเป็น 1 ล็อต = 1 คิว ต่อท้ายคิวปัจจุบัน', danger: false, default: 'all' },
  unqueue: { title: 'ออกจากคิว', btn: (n) => `ออกจากคิว ${n} ชิ้น`, note: 'ของจะกลับเข้าคลัง และเสียตำแหน่งคิวเดิม ถ้าจะเข้าคิวใหม่ต้องต่อท้ายคิว', danger: true, default: 'all' },
  withdraw: { title: 'ถอนของออก', btn: (n) => `ถอนออก ${n} ชิ้น`, note: 'ถอนออกจากระบบถาวร ไม่สามารถนำกลับมาได้', danger: true, default: 1 }
};

export default function MyStock({ goTo }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.myStock(), []);
  const [filter, setFilter] = useState('ACTIVE');
  const [open, setOpen] = useState({});
  const [dlg, setDlg] = useState(null);   // { mode, label, items }
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const match = (r, f) => (f === 'ALL' ? true : f === 'ACTIVE' ? ACTIVE.includes(r.status) : r.status === f);
  const rows = useMemo(() => (data || []).filter((r) => r.status !== 'STOCKED'), [data]);
  const groups = useMemo(() => buildGroups(rows.filter((r) => match(r, filter))), [rows, filter]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const ask = (mode, g, items = g.items) => {
    setDlg({ mode, label: `${g.item_name}${g.note ? ` (${g.note})` : ''}`, items: [...items].sort(byCreated) });
    setQty(MODES[mode].default === 'all' ? items.length : 1);
  };
  const n = dlg ? Math.max(1, Math.min(Math.floor(Number(qty)) || 1, dlg.items.length)) : 0;
  // enqueue: oldest pieces first · unqueue/withdraw: take from the BACK so front pieces keep their place
  const chosen = dlg ? (dlg.mode === 'enqueue' ? dlg.items.slice(0, n) : dlg.items.slice(-n)) : [];

  const run = async () => {
    setBusy(true);
    const uids = chosen.map((c) => c.stock_uid);
    try {
      if (dlg.mode === 'enqueue') { await api.enqueue(uids); toast(`เข้าคิวแล้ว ${uids.length} ชิ้น = 1 คิว`); }
      else if (dlg.mode === 'unqueue') { await api.unqueue(uids); toast(`ย้ายกลับคลัง ${uids.length} ชิ้นแล้ว`); }
      else { await api.withdraw(uids); toast(`ถอนออก ${uids.length} ชิ้นแล้ว`); }
    } catch (x) { toast(x.message, 'err'); } finally { setBusy(false); setDlg(null); reload(); }
  };

  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const Actions = ({ g }) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {g.status === 'AVAILABLE' && <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => ask('unqueue', g)}><LogOut size={13} />ออกจากคิว</Button>}
      {g.status === 'AVAILABLE' && <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => ask('withdraw', g)}><Undo2 size={13} />ถอน</Button>}
    </div>
  );
  const Name = ({ g }) => (
    <div className="flex items-center gap-2">
      <div>
        <div className="font-medium text-slate-100">{g.item_name}{g.note && <span className="ml-1.5 text-xs text-gold-400">{g.note}</span>}</div>
        {g.order_ref && <div className="text-[11px] text-slate-500">ออเดอร์ {g.order_ref}</div>}
      </div>
      <span className="rounded-md bg-ink-700 border border-ink-600 px-2 py-0.5 text-sm font-bold text-slate-100 tabular-nums">× {g.items.length} {fmtUnit(g.unit)}</span>
    </div>
  );
  const piecesAction = (g) => (p) => ask('withdraw', g, [p]);

  return (
    <>
    <FlowSteps active="mine" goTo={goTo} badges={{ enqueue: (data || []).filter((r) => r.status === 'STOCKED').length }} />
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[
        ['คิวของฉัน', new Set(rows.filter((r) => r.status === 'AVAILABLE').map((r) => r.lot_id || r.stock_uid)).size, 'คิว', 'text-emerald-300', ListOrdered],
        ['ชิ้นในคิว', rows.filter((r) => r.status === 'AVAILABLE').length, 'ชิ้น', 'text-slate-100', Layers],
        ['ได้หัวคิว', new Set(rows.filter((r) => r.status === 'AVAILABLE' && r.queue_position === 1).map((r) => r.lot_id || r.stock_uid)).size, 'คิว', 'text-gold-400', ListPlus]
      ].map(([t, v, u, tone, Icon], i) => (
        <div key={t} className="card p-3 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Icon size={13} />{t}</div>
          <div className={`text-xl font-bold tabular-nums ${tone}`}>{v} <span className="text-xs font-normal text-slate-500">{u}</span></div>
        </div>
      ))}
    </div>
    <Card title="คิวของฉัน" delay={2}
      action={<Button variant="ghost" onClick={reload} loading={loading}><RefreshCw size={14} />รีเฟรช</Button>}>
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        {FILTERS.map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition active:scale-95 ${filter === f ? 'bg-arcane-600/25 border-arcane-500/40 text-arcane-400' : 'border-ink-600 text-slate-400 hover:text-slate-200'}`}>
            {label} ({rows.filter((r) => match(r, f)).length})
          </button>
        ))}
      </div>

      {!groups.length ? (
        <div className="py-10 text-center space-y-3 animate-fade-in">
          <ListOrdered size={40} className="mx-auto text-slate-600" />
          <div className="text-sm text-slate-400">ยังไม่มีรายการในหมวดนี้</div>
          {filter !== 'SOLD' && filter !== 'WITHDRAWN' && <Button variant="gold" onClick={() => goTo('enqueue')}><ListPlus size={16} />ไปลงคิวขาย</Button>}
        </div>
      ) : (
        <>
          {/* mobile: cards */}
          <ul className="md:hidden space-y-2">
            {groups.map((g, i) => (
              <li key={g.key} className="rounded-lg border border-ink-600 bg-ink-800 p-3 animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <div className="flex items-start justify-between gap-2"><Name g={g} /><Badge status={g.status} /></div>
                <div className="mt-2 flex items-end justify-between gap-2"><QueueChip g={g} /><Actions g={g} /></div>
                <button onClick={() => toggle(g.key)} className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
                  <ChevronDown size={14} className={`transition-transform ${open[g.key] ? 'rotate-180' : ''}`} />ดูรายชิ้น ({g.items.length})
                </button>
                {open[g.key] && <PieceList g={g} onWithdraw={piecesAction(g)} />}
              </li>
            ))}
          </ul>

          {/* desktop: table */}
          <div className="hidden md:block overflow-x-auto -mx-4">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th w-8" /><th className="th">ไอเทม / รุ่น</th><th className="th">คิว</th><th className="th">สถานะ</th><th className="th">ลงล่าสุด</th><th className="th" /></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="tr-hover cursor-pointer" onClick={() => toggle(g.key)}>
                      <td className="td"><ChevronDown size={16} className={`text-slate-500 transition-transform ${open[g.key] ? 'rotate-180' : ''}`} /></td>
                      <td className="td"><Name g={g} /></td>
                      <td className="td"><QueueChip g={g} /></td>
                      <td className="td"><Badge status={g.status} /></td>
                      <td className="td text-xs text-slate-400">{fmtDate(g.items[g.items.length - 1].created_at)}</td>
                      <td className="td text-right" onClick={(e) => e.stopPropagation()}><Actions g={g} /></td>
                    </tr>
                    {open[g.key] && (
                      <tr><td colSpan={6} className="bg-ink-900/40 px-4 pb-3"><PieceList g={g} onWithdraw={piecesAction(g)} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Confirm open={!!dlg} danger={dlg ? MODES[dlg.mode].danger : false} loading={busy} title={dlg ? MODES[dlg.mode].title : ''}
        confirmLabel={dlg ? MODES[dlg.mode].btn(n) : ''} onCancel={() => setDlg(null)} onConfirm={run}
        body={dlg && (
          <div className="space-y-3">
            <div><b className="text-slate-200">{dlg.label}</b> · {dlg.items.length} ชิ้น</div>
            {dlg.items.length > 1 && (
              <div>
                <label>จำนวนกี่ชิ้น</label>
                <QtyInput value={qty} onChange={setQty} max={dlg.items.length} />
              </div>
            )}
            <div className="text-xs text-slate-500">{MODES[dlg.mode].note}</div>
          </div>
        )} />
    </Card>
    </>
  );
}

function PieceList({ g, onWithdraw }) {
  return (
    <ul className="mt-2 divide-y divide-ink-700 rounded-lg border border-ink-700 bg-ink-900/40 animate-fade-in">
      {g.items.map((p, i) => (
        <li key={p.stock_uid} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
          <span className="w-8 font-semibold text-slate-400">#{i + 1}</span>
          <span className="font-mono text-[11px] text-slate-500 flex-1 truncate">{p.stock_uid}</span>
          <span className="text-slate-500 hidden sm:inline">{fmtDate(p.created_at)}</span>
          {(p.status === 'AVAILABLE' || p.status === 'STOCKED') && <button className="text-rose-300 hover:text-rose-200 transition" onClick={() => onWithdraw(p)}>ถอน</button>}
        </li>
      ))}
    </ul>
  );
}
