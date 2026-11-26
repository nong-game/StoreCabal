import { Boxes, Lock, BadgeCheck, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, ErrorBox, Spinner, Stat, useAsync } from '../../components/ui.jsx';
import { fmtNum } from '../../utils/format.js';

export default function Overview() {
  const { data, error, loading, reload } = useAsync(() => api.adminOverview(), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const byServer = {};
  data.rows.forEach((r) => { (byServer[r.server] ||= []).push(r); });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">ภาพรวมสต็อกทั้งร้าน</h1>
        <Button variant="ghost" onClick={reload} loading={loading}><RefreshCw size={14} />รีเฟรช</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="รอขายในคิว" value={data.totals.AVAILABLE} delay={0} icon={Boxes} tone="text-emerald-300" />
        <Stat label="ติดจอง" value={data.totals.RESERVED} delay={1} icon={Lock} tone="text-amber-300" />
        <Stat label="ขายแล้ว" value={data.totals.SOLD} delay={2} icon={BadgeCheck} tone="text-arcane-400" />
      </div>
      {Object.entries(byServer).map(([server, rows], i) => (
        <Card key={server} delay={3 + i} title={`${server} · พร้อมขาย ${fmtNum(data.available_by_server[server])} ชิ้น`}>
          <div className="overflow-x-auto -mx-4">
            <table className="w-full min-w-[520px]">
              <thead><tr><th className="th">ไอเทม</th><th className="th text-right">ในคลัง</th><th className="th text-right">รอขายในคิว</th><th className="th text-right">ติดจอง</th><th className="th text-right">ขายแล้ว</th><th className="th">ผู้ฝากขาย (รอขาย)</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item_id} className={`tr-hover ${r.is_active ? '' : 'opacity-50'}`}>
                    <td className="td">{r.item_name}{r.has_custom_option && <span className="ml-2 text-[10px] text-gold-400 border border-gold-500/30 rounded px-1">OPTION</span>}</td>
                    <td className="td text-right text-sky-300">{fmtNum(r.STOCKED)}</td>
                    <td className="td text-right font-bold text-emerald-300">{fmtNum(r.AVAILABLE)}</td>
                    <td className="td text-right text-amber-300">{fmtNum(r.RESERVED)}</td>
                    <td className="td text-right text-arcane-400">{fmtNum(r.SOLD)}</td>
                    <td className="td text-xs text-slate-400">{Object.entries(r.suppliers).map(([n, c]) => `${n} (${c})`).join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}
