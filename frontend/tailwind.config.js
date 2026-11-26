/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07090f', 900: '#0b0f19', 800: '#111827', 700: '#1a2233', 600: '#263045' },
        gold: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        arcane: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' }
      },
      fontFamily: { sans: ['Inter', 'Noto Sans Thai', 'system-ui', 'sans-serif'] },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        popIn: { from: { opacity: 0, transform: 'scale(.94) translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(24px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        orb: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-20px) scale(1.12)' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(251,191,36,.45)' }, '50%': { boxShadow: '0 0 0 8px rgba(251,191,36,0)' } },
        indeterminate: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(400%)' } },
        shake: { '0%,100%': { transform: 'none' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } }
      },
      animation: {
        'fade-up': 'fadeUp .45s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fadeIn .3s ease-out both',
        'pop-in': 'popIn .28s cubic-bezier(.22,1,.36,1) both',
        'slide-in': 'slideIn .35s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        float: 'float 4s ease-in-out infinite',
        orb: 'orb 14s ease-in-out infinite',
        glow: 'glow 2s ease-out infinite',
        indeterminate: 'indeterminate 1.1s cubic-bezier(.65,0,.35,1) infinite',
        shake: 'shake .4s ease-in-out'
      }
    }
  },
  plugins: []
};
