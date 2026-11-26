import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, Field, useToast } from '../components/ui.jsx';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ old_password: '', new_password: '' });

  const changePw = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.changePassword(pw.old_password, pw.new_password); toast('เปลี่ยนรหัสผ่านแล้ว'); setPw({ old_password: '', new_password: '' }); }
    catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start max-w-4xl">
      <Card title="บัญชีของฉัน" delay={0}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-arcane-600 to-gold-500 flex items-center justify-center text-lg font-bold text-white">{user.shop_name.slice(0, 1).toUpperCase()}</div>
          <div><div className="font-semibold text-slate-100">{user.shop_name}</div><div className="text-xs text-slate-500">{user.username} · {String(user.role || '').trim().toLowerCase() === 'admin' ? 'ผู้ดูแลร้าน' : 'ผู้ฝากขาย'}</div></div>
        </div>
      </Card>

      <Card title="เปลี่ยนรหัสผ่าน" delay={1}>
        <form onSubmit={changePw} className="space-y-3">
          <Field label="รหัสผ่านเดิม"><input type="password" autoComplete="current-password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required /></Field>
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร"><input type="password" autoComplete="new-password" minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></Field>
          <Button type="submit" loading={busy} className="w-full"><KeyRound size={16} />บันทึกรหัสผ่านใหม่</Button>
        </form>
      </Card>
    </div>
  );
}
