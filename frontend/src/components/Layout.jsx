import { LogOut, Swords } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { IS_MOCK } from '../services/api.js';

export default function Layout({ tabs, active, onChange, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex">
      {/* desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900/70 backdrop-blur p-4 sticky top-0 h-screen animate-fade-in">
        <div className="flex items-center gap-2 mb-6 text-gold-400 font-bold"><Swords size={22} className="animate-float" />Cabal Stock</div>
        <nav className="space-y-1 flex-1">
          {tabs.map((t, i) => (
            <button key={t.key} onClick={() => onChange(t.key)} style={{ animationDelay: `${i * 50}ms` }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 animate-fade-up ${active === t.key ? 'bg-arcane-600/20 text-arcane-400 border border-arcane-500/30 translate-x-1' : 'text-slate-400 hover:bg-ink-700 hover:text-slate-200 hover:translate-x-1 border border-transparent'}`}>
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r bg-gold-400 transition-all duration-300 ${active === t.key ? 'h-5 opacity-100' : 'h-0 opacity-0'}`} />
              <t.icon size={18} className="transition-transform duration-200 group-hover:scale-110" />{t.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-ink-700 pt-3">
          <div className="text-sm font-medium text-slate-200 truncate">{user.shop_name}</div>
          <div className="text-xs text-slate-500 mb-2">{user.role === 'admin' ? 'ผู้ดูแลร้าน' : 'ผู้ฝากขาย'} · {user.username}</div>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-300 transition"><LogOut size={14} />ออกจากระบบ</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-ink-700 bg-ink-900/90 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center gap-2 text-gold-400 font-bold"><Swords size={20} />Cabal Stock</div>
          <button onClick={logout} className="text-slate-400 p-1 active:scale-90 transition" aria-label="ออกจากระบบ"><LogOut size={18} /></button>
        </header>
        {IS_MOCK && <div className="bg-amber-500/10 text-amber-300 text-xs text-center py-1">โหมดทดลอง (Mock) – ข้อมูลเก็บในเบราว์เซอร์ ตั้ง VITE_API_URL เพื่อเชื่อม Google Sheets</div>}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-6xl w-full mx-auto">
          {/* key → remount → page entrance animation on every tab change */}
          <div key={active} className="space-y-4 animate-fade-up">{children}</div>
        </main>

        {/* mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink-900/95 backdrop-blur border-t border-ink-700 flex overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => onChange(t.key)}
              className={`relative flex-1 min-w-[64px] flex flex-col items-center gap-0.5 py-2 text-[10px] transition active:scale-90 ${active === t.key ? 'text-arcane-400' : 'text-slate-500'}`}>
              <span className={`absolute top-0 h-0.5 rounded-b bg-gold-400 transition-all duration-300 ${active === t.key ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
              <t.icon size={20} className={`transition-transform duration-200 ${active === t.key ? '-translate-y-0.5 scale-110' : ''}`} />{t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
