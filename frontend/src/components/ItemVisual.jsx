import { useState } from 'react';
import { Coins, Gem, Bike, Swords, Package } from 'lucide-react';

const CATEGORY_THEME = {
  Currency: {
    bg: 'from-amber-950/90 via-ink-800 to-gold-600/20',
    ring: 'border-gold-500/40 bg-gold-500/15 text-gold-400',
    glow: 'bg-gold-500/25',
    art: './game/coin.webp',
    artContain: true,
    Icon: Coins
  },
  Material: {
    bg: 'from-stone-900 via-ink-800 to-amber-700/20',
    ring: 'border-amber-500/35 bg-ink-900/75 text-amber-300',
    glow: 'bg-amber-500/20',
    art: './game/kv2.webp',
    Icon: Gem
  },
  Vehicle: {
    bg: 'from-blood-900/90 via-ink-800 to-arcane-500/25',
    ring: 'border-arcane-400/45 bg-ink-900/75 text-arcane-400',
    glow: 'bg-arcane-500/25',
    art: './game/kv1.webp',
    Icon: Bike
  },
  Equipment: {
    bg: 'from-red-950/90 via-ink-800 to-arcane-500/20',
    ring: 'border-arcane-500/40 bg-ink-900/75 text-arcane-400',
    glow: 'bg-blood-500/30',
    art: './game/feature1.webp',
    Icon: Swords
  }
};

const DEFAULT_THEME = {
  bg: 'from-ink-900 via-ink-800 to-blood-900/40',
  ring: 'border-bone/20 bg-ink-900/75 text-bone',
  glow: 'bg-arcane-500/15',
  art: './game/kv3.webp',
  Icon: Package
};

function matchNamedIcon(name) {
  const n = String(name || '');
  if (/rw3/i.test(n)) {
    return { src: './game/item-rw3.png', framed: true, glow: 'bg-sky-500/30', ring: 'border-sky-400/40 bg-[#101826]', bgArt: './game/kv1.webp' };
  }
  if (/\bblue\b|รถ\s*blue|ไบค์\s*blue/i.test(n)) {
    return { src: './game/item-blue.png', framed: true, glow: 'bg-cyan-500/30', ring: 'border-cyan-400/40 bg-[#101826]', bgArt: './game/kv2.webp' };
  }
  if (/\bgem\b|เจม|เพชร/i.test(n)) {
    return { src: './game/item-gem.png', framed: false, glow: 'bg-cyan-400/35', bgArt: './game/kv3.webp' };
  }
  if (/\balz\b/i.test(n)) {
    return { src: './game/coin.webp', framed: false, glow: 'bg-gold-500/30' };
  }
  return null;
}

/**
 * Displays an item's uploaded image when available, or a matched in-game icon (RW3 / Blue / Gem / Alz)
 * and CABAL Revolution themed artwork fallback so cards always look vivid.
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

  const named = matchNamedIcon(name);
  if (named) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} flex items-center justify-center ${className}`}>
        {named.bgArt && size !== 'sm' && (
          <>
            <img src={named.bgArt} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25 transition duration-500 group-hover:scale-105" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-900/50 to-ink-950/50" />
          </>
        )}
        <div aria-hidden className={`absolute h-24 w-24 rounded-full blur-2xl ${named.glow}`} />
        {named.framed ? (
          <div className={`relative rounded-xl border shadow-lg transition duration-500 group-hover:scale-105 ${named.ring} ${size === 'sm' ? 'p-1 rounded-lg' : size === 'lg' ? 'px-5 py-3.5' : 'px-3.5 py-2.5'}`}>
            <img
              src={named.src}
              alt={name}
              loading="lazy"
              className={`object-contain ${size === 'sm' ? 'h-6 w-8' : size === 'lg' ? 'h-16 w-28' : 'h-12 w-20'}`}
            />
          </div>
        ) : (
          <img
            src={named.src}
            alt={name}
            loading="lazy"
            className={`relative object-contain drop-shadow-[0_4px_16px_rgba(34,211,238,0.45)] transition duration-500 group-hover:scale-110 ${size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'}`}
          />
        )}
      </div>
    );
  }

  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 44 : 32;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} flex items-center justify-center ${className}`}>
      {theme.art && !theme.artContain && size !== 'sm' && (
        <>
          <img src={theme.art} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-35 transition duration-500 group-hover:scale-105" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-900/40 to-ink-950/40" />
        </>
      )}
      <div aria-hidden className={`absolute h-24 w-24 rounded-full blur-2xl ${theme.glow}`} />
      {theme.artContain ? (
        <img
          src={theme.art}
          alt={name || category}
          loading="lazy"
          className={`relative object-contain drop-shadow-[0_4px_14px_rgba(247,185,85,0.4)] transition duration-500 group-hover:scale-110 ${size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'}`}
        />
      ) : (
        <div className={`relative flex items-center justify-center rounded-2xl border backdrop-blur-sm shadow-lg ${size === 'sm' ? 'p-1.5 rounded-lg' : size === 'lg' ? 'p-4' : 'p-3'} ${theme.ring}`}>
          <Icon size={iconSize} strokeWidth={1.75} />
        </div>
      )}
    </div>
  );
}
