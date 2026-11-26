import { useEffect, useState } from 'react';
import { onLoadingChange } from '../services/api.js';

/** Thin animated bar at the very top while any API call is running (shown after 150 ms to avoid flicker). */
export default function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let t;
    const off = onLoadingChange((n) => {
      clearTimeout(t);
      if (n > 0) t = setTimeout(() => setBusy(true), 150);
      else setBusy(false);
    });
    return () => { clearTimeout(t); off(); };
  }, []);
  return (
    <div aria-hidden className={`fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-300 ${busy ? 'opacity-100' : 'opacity-0'}`}>
      <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-arcane-500 via-gold-400 to-arcane-500 shadow-[0_0_8px_rgba(251,191,36,.6)] animate-indeterminate" />
    </div>
  );
}
