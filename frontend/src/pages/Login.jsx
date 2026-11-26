import { useState } from 'react';
import { Swords, LogIn, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorBox, Field } from '../components/ui.jsx';
import { IS_MOCK } from '../services/api.js';

export default function Login({ onBack }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [errKey, setErrKey] = useState(0); // re-mount ErrorBox so it shakes on every new error
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(form.username, form.password); } catch (x) { setErr(x.message); setErrKey((k) => k + 1); setBusy(false); }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* animated background orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-arcane-600/25 blur-3xl animate-orb" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-gold-500/15 blur-3xl animate-orb [animation-delay:-6s]" />

      <form onSubmit={submit} className="card relative w-full max-w-sm p-6 space-y-4 animate-pop-in shadow-2xl shadow-black/40">
        {onBack && (
          <button type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-400 transition">
            <ArrowLeft size={14} />กลับหน้าร้านลูกค้า
          </button>
        )}
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-arcane-600 to-gold-500 mb-3 animate-float shadow-lg shadow-arcane-600/30"><Swords className="text-white" size={28} /></div>
          <h1 className="text-xl font-bold text-slate-100">Cabal Stock Portal</h1>
          <p className="text-xs text-slate-500">ระบบหลังบ้านผู้ฝากขาย & แอดมินร้าน</p>
        </div>

        {err && <ErrorBox key={errKey} error={err} />}

        <Field label="ชื่อผู้ใช้">
          <input autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </Field>
        <Field label="รหัสผ่าน">
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" className="!pr-10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 transition">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Button type="submit" loading={busy} className="w-full"><LogIn size={16} />เข้าสู่ระบบ</Button>

        {IS_MOCK && (
          <div className="text-[11px] text-slate-500 border-t border-ink-700 pt-3 space-y-0.5">
            <div>ทดลอง: <b className="text-slate-300">admin</b> / admin1234</div>
            <div>ผู้ฝากขาย: <b className="text-slate-300">supplier1</b> / supplier1234</div>
          </div>
        )}
      </form>
    </div>
  );
}
