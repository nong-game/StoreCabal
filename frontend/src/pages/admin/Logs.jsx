import { RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { Button, Card, Empty, ErrorBox, Spinner, useAsync } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

const COLOR = { ADD: 'text-emerald-300', RESERVE: 'text-amber-300', SOLD: 'text-arcane-400', WITHDRAW: 'text-slate-400' };

export default function Logs() {
  const { data, error, loading, reload } = useAsync(() => api.logsList(200), []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <Card title="Queue Logs (ล่าสุด 200 รายการ)" action={<Button variant="ghost" onClick={reload} loading={loading}><RefreshCw size={14} /></Button>}>
      {!data.length ? <Empty>ยังไม่มี Log</Empty> : (
        <div className="overflow-x-auto -mx-4">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">เวลา</th><th className="th">Action</th><th className="th">stock_uid</th><th className="th">โดย</th><th className="th">หมายเหตุ</th></tr></thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.log_id}>
                  <td className="td text-xs text-slate-400 whitespace-nowrap">{fmtDate(l.timestamp)}</td>
                  <td className={`td text-xs font-bold ${COLOR[l.action] || ''}`}>{l.action}</td>
                  <td className="td font-mono text-[11px] text-slate-500">{l.stock_uid}</td>
                  <td className="td text-slate-400">{l.actor_name}</td><td className="td text-xs text-slate-400">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
