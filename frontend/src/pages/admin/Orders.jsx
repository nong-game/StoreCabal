import { useState } from 'react';
import { CheckCheck, RotateCcw } from 'lucide-react';
import { api } from '../../services/api.js';
import { Badge, Button, Card, Empty, ErrorBox, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

export default function Orders() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.orderList(), []);
  const [busyId, setBusyId] = useState('');

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const act = async (uid, to) => {
    setBusyId(uid);
    try { await api.orderUpdate([uid], to); toast(to === 'SOLD' ? 'ยืนยันขายแล้ว' : 'ยกเลิกจอง คืนเข้าคิวเดิมแล้ว'); }
    catch (x) { toast(x.message, 'err'); } finally { setBusyId(''); reload(); }
  };

  return (
    <Card title="ออเดอร์ที่ติดจอง / ขายแล้ว">
      {!data.length ? <Empty>ยังไม่มีออเดอร์</Empty> : (
        <div className="overflow-x-auto -mx-4">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">order_ref</th><th className="th">ไอเทม</th><th className="th">ผู้ฝากขาย</th><th className="th">สถานะ</th><th className="th">อัปเดต</th><th className="th" /></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.stock_uid}>
                  <td className="td font-semibold">{r.order_ref}</td>
                  <td className="td">{r.item_name}<div className="text-[11px] font-mono text-slate-500">{r.stock_uid}</div></td>
                  <td className="td text-slate-400">{r.shop_name}</td>
                  <td className="td"><Badge status={r.status} /></td>
                  <td className="td text-xs text-slate-400">{fmtDate(r.updated_at)}</td>
                  <td className="td text-right whitespace-nowrap space-x-1.5">
                    {r.status === 'RESERVED' && <>
                      <Button className="!px-2.5 !py-1 text-xs" loading={busyId === r.stock_uid} onClick={() => act(r.stock_uid, 'SOLD')}><CheckCheck size={13} />ขายแล้ว</Button>
                      <Button variant="ghost" className="!px-2.5 !py-1 text-xs" disabled={busyId === r.stock_uid} onClick={() => act(r.stock_uid, 'AVAILABLE')}><RotateCcw size={13} />ปล่อยคืนคิว</Button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
