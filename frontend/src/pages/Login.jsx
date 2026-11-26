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
      <img src="./game/kv1.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-900/75 via-ink-900/85 to-ink-900" />
      {/* animated background orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blood-700/30 blur-3xl animate-orb" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-arcane-500/15 blur-3xl animate-orb [animation-delay:-6s]" />

      <form onSubmit={submit} className="card relative w-full max-w-sm p-6 space-y-4 animate-pop-in shadow-2xl shadow-black/60">
        {onBack && (
          <button type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-ash hover:text-gold-400 transition">
            <ArrowLeft size={14} />กลับหน้าร้านลูกค้า
          </button>
        )}
        <div className="text-center space-y-2">
          <img src="./game/logo.webp" alt="CABAL Revolution" className="h-12 w-auto mx-auto object-contain drop-shadow-[0_4px_16px_rgba(230,75,34,0.4)] animate-float" />
          <h1 className="text-lg font-display font-bold tracking-wide text-bone">CABAL Revolution</h1>
          <p className="text-xs text-ash">ระบบหลังบ้านผู้ฝากขาย & แอดมินร้าน</p>
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
