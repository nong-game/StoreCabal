import { useState } from 'react';
import { UserPlus, Ban, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button, Card, ErrorBox, Field, Spinner, useAsync, useToast } from '../../components/ui.jsx';

const blank = { username: '', password: '', shop_name: '', role: 'supplier' };

export default function UsersAdmin() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.userList(), []);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.userCreate(form); toast('สร้างบัญชีแล้ว'); setForm(blank); reload(); }
    catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  const setStatus = async (u) => {
    try { await api.userUpdate({ user_id: u.user_id, status: u.status === 'active' ? 'suspended' : 'active' }); reload(); }
    catch (x) { toast(x.message, 'err'); }
  };
  const resetPw = async (u) => {
    const pw = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.username} (อย่างน้อย 8 ตัวอักษร)`);
    if (!pw) return;
    try { await api.userUpdate({ user_id: u.user_id, new_password: pw }); toast('เปลี่ยนรหัสผ่านแล้ว'); }
    catch (x) { toast(x.message, 'err'); }
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      <Card title="สร้างบัญชี">
        <form onSubmit={create} className="space-y-3">
          <Field label="Username"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoComplete="off" /></Field>
          <Field label="ชื่อร้าน / ผู้ฝากขาย"><input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required maxLength={80} /></Field>
          <Field label="รหัสผ่านเริ่มต้น" hint="อย่างน้อย 8 ตัวอักษร"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" /></Field>
          <Field label="สิทธิ์">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="supplier">Supplier</option><option value="admin">Admin</option></select>
          </Field>
          <Button type="submit" loading={busy} className="w-full"><UserPlus size={16} />สร้างบัญชี</Button>
        </form>
      </Card>
      <Card title={`บัญชีทั้งหมด (${data.length})`}>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full min-w-[520px]">
            <thead><tr><th className="th">ร้าน</th><th className="th">Username</th><th className="th">สิทธิ์</th><th className="th">สถานะ</th><th className="th" /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.user_id} className={u.status === 'active' ? '' : 'opacity-60'}>
                  <td className="td">{u.shop_name}</td><td className="td text-slate-400">{u.username}</td>
                  <td className="td text-xs">{u.role}</td>
                  <td className="td text-xs">{u.status === 'active' ? <span className="text-emerald-300">active</span> : <span className="text-rose-300">suspended</span>}</td>
                  <td className="td text-right whitespace-nowrap space-x-1.5">
                    <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => resetPw(u)}><KeyRound size={13} />รหัสผ่าน</Button>
                    {u.user_id !== me.user_id && (
                      <Button variant={u.status === 'active' ? 'danger' : 'ghost'} className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(u)}>
                        {u.status === 'active' ? <><Ban size={13} />ระงับ</> : <><CheckCircle2 size={13} />เปิด</>}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
