import { PackagePlus, ListPlus, ListOrdered, ChevronRight } from 'lucide-react';

const STEPS = [
  { key: 'add', n: 1, label: 'ลงสต็อก', sub: 'เก็บเข้าคลัง', icon: PackagePlus },
  { key: 'enqueue', n: 2, label: 'ลงคิวขาย', sub: 'เลือกจากคลัง', icon: ListPlus },
  { key: 'mine', n: 3, label: 'คิวของฉัน', sub: 'รอตัดขาย', icon: ListOrdered }
];

/** Small "1 → 2 → 3" strip so suppliers always see where they are in the flow. Clickable. */
export default function FlowSteps({ active, goTo, badges = {} }) {
  return (
    <nav className="grid grid-cols-3 gap-1.5 sm:gap-2 animate-fade-up" aria-label="ขั้นตอน">
      {STEPS.map((s, i) => {
        const on = s.key === active;
        return (
          <button key={s.key} type="button" onClick={() => goTo(s.key)}
            className={`group relative flex items-center gap-2 rounded-xl border px-2.5 py-2 sm:px-3 text-left transition active:scale-[.98]
              ${on ? 'border-arcane-500/60 bg-arcane-600/15 shadow-lg shadow-arcane-600/10' : 'border-ink-600 bg-ink-800/60 hover:border-ink-600 hover:bg-ink-700/50'}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition
              ${on ? 'bg-arcane-500 text-white' : 'bg-ink-700 text-slate-400 group-hover:text-slate-200'}`}>{s.n}</span>
            <span className="min-w-0">
              <span className={`block truncate text-xs sm:text-sm font-semibold ${on ? 'text-arcane-400' : 'text-slate-300'}`}>{s.label}</span>
              <span className="hidden sm:block truncate text-[11px] text-slate-500">{s.sub}</span>
            </span>
            {badges[s.key] > 0 && (
              <span className="ml-auto rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-ink-950 tabular-nums">{badges[s.key]}</span>
            )}
            {i < STEPS.length - 1 && <ChevronRight size={14} className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-ink-600 hidden sm:block" />}
          </button>
        );
      })}
    </nav>
  );
}
