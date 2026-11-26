import { Swords } from 'lucide-react';
import { SlowHint } from './ui.jsx';

/** Full-screen branded loader shown while the saved session is being checked. */
export default function Splash() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center gap-6 p-4 overflow-hidden" role="status" aria-live="polite">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-arcane-600/20 blur-3xl animate-orb" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-gold-500/10 blur-3xl animate-orb [animation-delay:-6s]" />

      <div className="relative animate-pop-in">
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-arcane-500/40 blur-xl animate-pulse" />
        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-arcane-600 to-gold-500 shadow-lg shadow-arcane-600/30 animate-float">
          <Swords className="text-white" size={36} />
        </div>
      </div>

      <div className="text-center space-y-1 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="text-lg font-display font-bold tracking-wide text-bone">CABAL Revolution</div>
        <div className="text-sm text-ash">กำลังตรวจสอบการเข้าสู่ระบบ…</div>
      </div>

      <div className="w-48 h-1 rounded-full bg-ink-700 overflow-hidden animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-arcane-500 via-gold-400 to-arcane-500 animate-indeterminate" />
      </div>
      <SlowHint />
    </div>
  );
}
