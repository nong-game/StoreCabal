import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2, X, CheckCircle2, AlertTriangle, Minus, Plus } from 'lucide-react';
import { STATUS_LABEL, STATUS_STYLE, fmtNum } from '../utils/format.js';

export function Badge({ status }) {
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] || ''}`}>{STATUS_LABEL[status] || status}</span>;
}

const VARIANTS = {
  primary: 'bg-gradient-to-r from-arcane-600 to-arcane-500 hover:from-arcane-500 hover:to-arcane-400 text-white shadow-lg shadow-arcane-600/20 hover:shadow-arcane-500/30',
  gold: 'bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-ink-950 font-semibold shadow-lg shadow-gold-500/10 hover:shadow-gold-500/25',
  ghost: 'bg-ink-700 hover:bg-ink-600 text-slate-200 border border-ink-600',
  danger: 'bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
};
export function Button({ variant = 'primary', loading, className = '', children, disabled, ...rest }) {
  return (
    <button disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${VARIANTS[variant]} ${className}`} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}{children}
    </button>
  );
}

/** delay = stagger step (0,1,2...) for the entrance animation */
export function Card({ title, action, className = '', delay = 0, children }) {
  return (
    <section className={`card animate-fade-up ${className}`} style={{ animationDelay: `${delay * 70}ms` }}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink-700">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>{action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return undefined; }
    let raf; let start;
    const step = (t) => {
      start ??= t;
      const p = Math.min((t - start) / ms, 1);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Stat({ label, value, icon: Icon, tone = 'text-slate-100', delay = 0 }) {
  const shown = useCountUp(Number(value) || 0);
  return (
    <div className="card card-hover p-4 flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${delay * 70}ms` }}>
      {Icon && <div className="p-2.5 rounded-lg bg-ink-700"><Icon size={20} className={tone} /></div>}
      <div><div className="text-xs text-slate-400">{label}</div><div className={`text-2xl font-bold tabular-nums ${tone}`}>{fmtNum(shown)}</div></div>
    </div>
  );
}

/** Tells the user why it is slow (Apps Script cold start) instead of looking frozen. */
export function SlowHint({ after = 3500 }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), after); return () => clearTimeout(t); }, [after]);
  return show ? <p className="text-center text-xs text-slate-500 animate-fade-in">เซิร์ฟเวอร์กำลังตอบกลับ อาจใช้เวลาสักครู่…</p> : null;
}

/** Page loading placeholder: looks like the real page (header, stat cards, list) with a soft shimmer. Kept as `Spinner` so pages need no change. */
export const Spinner = ({ label = 'กำลังโหลด' }) => (
  <div className="space-y-4 animate-fade-in" role="status" aria-live="polite" aria-label={label}>
    <div className="flex items-center justify-between">
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-9 w-24" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4 flex items-center gap-3" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton h-10 w-10 shrink-0 !rounded-lg" />
          <div className="flex-1 space-y-2"><div className="skeleton h-3 w-2/3" /><div className="skeleton h-5 w-1/3" /></div>
        </div>
      ))}
    </div>
    <div className="card">
      <div className="border-b border-ink-700 px-4 py-3"><div className="skeleton h-4 w-32" /></div>
      <div className="p-4 space-y-3">
        {[90, 75, 82, 60, 70].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-8 w-8 shrink-0 !rounded-full" />
            <div className="skeleton h-4" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
    <SlowHint />
    <span className="sr-only">{label}</span>
  </div>
);
export const Empty = ({ children }) => <div className="py-10 text-center text-sm text-slate-500 animate-fade-in">{children}</div>;
export const ErrorBox = ({ error, onRetry }) => (
  <div className="animate-shake rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm p-3 flex items-center justify-between gap-3">
    <span>{error}</span>{onRetry && <button onClick={onRetry} className="underline">ลองใหม่</button>}
  </div>
);
export const Field = ({ label, children, hint }) => (
  <div><label>{label}</label>{children}{hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}</div>
);

/** Quantity stepper:  [-]  [ 10 ]  [+]  [Max]   (Max only when `max` is given and showMax is not false) */
export function QtyInput({ value, onChange, min = 1, max, showMax = true }) {
  const n = Math.floor(Number(value)) || min;
  const clamp = (v) => Math.max(min, max != null ? Math.min(v, max) : v);
  const step = 'w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-ink-700 hover:bg-ink-600 border border-ink-600 text-slate-200 transition active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-stretch gap-1.5">
      <button type="button" className={step} aria-label="ลด" disabled={n <= min} onClick={() => onChange(clamp(n - 1))}><Minus size={16} /></button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        required
        value={value}
        className="min-w-[3.25rem] flex-1 !px-1.5 !text-center font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        onChange={(e) => onChange(e.target.value === '' ? '' : clamp(Math.floor(Number(e.target.value)) || min))}
        onBlur={() => onChange(clamp(n))}
      />
      <button type="button" className={step} aria-label="เพิ่ม" disabled={max != null && n >= max} onClick={() => onChange(clamp(n + 1))}><Plus size={16} /></button>
      {max != null && showMax && (
        <button type="button" disabled={n >= max} onClick={() => onChange(max)}
          className="shrink-0 px-2.5 rounded-lg text-xs font-semibold bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-gold-400 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">Max</button>
      )}
    </div>
  );
}

/* ----- data loading hook ----- */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    return fn().then((data) => setState({ data, error: '', loading: false }), (e) => setState({ data: null, error: e.message, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

/* ----- toasts ----- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-50 top-3 right-3 left-3 sm:left-auto sm:w-80 space-y-2 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} className={`animate-slide-in pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-xl ${t.type === 'ok' ? 'bg-emerald-950 border-emerald-600/40 text-emerald-200' : 'bg-rose-950 border-rose-600/40 text-rose-200'}`}>
            {t.type === 'ok' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="ปิด"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Confirm({ open, title, body, confirmLabel = 'ยืนยัน', danger, loading, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
      <div className="card max-w-sm w-full p-5 animate-pop-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
        <div className="text-sm text-slate-400 mb-5">{body}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
