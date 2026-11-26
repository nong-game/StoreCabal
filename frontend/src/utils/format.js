export const GAME_NAME = 'CABAL Revolution';
export const fmtGame = (s) => (!s || s === 'Server 1' ? GAME_NAME : s);
export const fmtUnit = (u) => String(u || '').trim() || 'ชิ้น';
export function defaultUnit(name) {
  const n = String(name || '').toLowerCase();
  if (/\balz\b/.test(n)) return 'M';
  if (/safeguard|ใบกันแตก/.test(n)) return 'ใบ';
  if (/rw3|blue|รถ|bike/.test(n)) return 'คัน';
  if (/core/.test(n)) return 'ก้อน';
  return 'ชิ้น';
}
export const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
};
export const fmtNum = (n) => Number(n || 0).toLocaleString('th-TH');
export const STATUS_STYLE = {
  STOCKED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  AVAILABLE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  RESERVED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SOLD: 'bg-arcane-500/15 text-arcane-400 border-arcane-500/30',
  WITHDRAWN: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
};
export const STATUS_LABEL = { STOCKED: 'ในคลัง', AVAILABLE: 'รอขาย', RESERVED: 'ติดจอง', SOLD: 'ขายแล้ว', WITHDRAWN: 'ถอนออก' };
