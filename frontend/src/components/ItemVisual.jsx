import { useState } from 'react';
import { Coins, Gem, Bike, Swords, Package } from 'lucide-react';

const CATEGORY_THEME = {
  Currency: {
    bg: 'from-amber-950/90 via-ink-800 to-gold-600/20',
    ring: 'border-gold-500/30 bg-gold-500/15 text-gold-400',
    glow: 'bg-gold-500/20',
    Icon: Coins
  },
  Material: {
    bg: 'from-sky-950/90 via-ink-800 to-cyan-600/20',
    ring: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    glow: 'bg-sky-500/20',
    Icon: Gem
  },
  Vehicle: {
    bg: 'from-purple-950/90 via-ink-800 to-arcane-500/25',
    ring: 'border-arcane-500/30 bg-arcane-500/15 text-arcane-400',
    glow: 'bg-arcane-500/25',
    Icon: Bike
  },
  Equipment: {
    bg: 'from-rose-950/80 via-ink-800 to-amber-500/20',
    ring: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    glow: 'bg-rose-500/20',
    Icon: Swords
  }
};

const DEFAULT_THEME = {
  bg: 'from-ink-900 via-ink-800 to-arcane-600/20',
  ring: 'border-ink-600 bg-ink-700/80 text-slate-300',
  glow: 'bg-arcane-500/15',
  Icon: Package
};

/**
 * Displays an item's uploaded image when available, or a themed dark-fantasy artwork fallback
 * so cards and tables never look empty.
 */
export default function ItemVisual({ src, name = '', category = '', size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const theme = CATEGORY_THEME[category] || DEFAULT_THEME;
  const Icon = theme.Icon;
  const showImg = !!src && !failed;

  if (showImg) {
    return (
      <div className={`relative overflow-hidden bg-ink-900 ${className}`}>
        <img
          src={src}
          alt={name || 'รูปสินค้า'}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
    );
  }

  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 48 : 34;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} flex items-center justify-center ${className}`}>
      {/* subtle grid & ambient glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0)', backgroundSize: '16px 16px' }}
      />
      <div aria-hidden className={`absolute h-24 w-24 rounded-full blur-2xl ${theme.glow}`} />
      <div className={`relative flex items-center justify-center rounded-2xl border backdrop-blur-sm shadow-inner ${size === 'sm' ? 'p-1.5 rounded-lg' : size === 'lg' ? 'p-5' : 'p-3.5'} ${theme.ring}`}>
        <Icon size={iconSize} strokeWidth={1.75} />
      </div>
    </div>
  );
}
