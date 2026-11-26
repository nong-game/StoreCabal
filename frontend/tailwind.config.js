/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // CABAL Revolution inspired dark obsidian, warm charcoal, crimson blood & molten ember palette
        ink: { 950: '#040404', 900: '#070707', 800: '#11100f', 700: '#1b1816', 600: '#2d2825' },
        gold: { 400: '#f7b955', 500: '#e89b35', 600: '#c77a1b' },
        arcane: { 400: '#ff7138', 500: '#e64b22', 600: '#c23614' },
        blood: { 500: '#8b261d', 700: '#641d16', 900: '#350e0a' },
        bone: '#eeeae3',
        ash: '#8d8984'
      },
      fontFamily: {
        sans: ['Noto Sans Thai', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Noto Sans Thai', 'serif']
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        popIn: { from: { opacity: 0, transform: 'scale(.94) translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(24px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        orb: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-20px) scale(1.12)' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,113,56,.45)' }, '50%': { boxShadow: '0 0 0 8px rgba(255,113,56,0)' } },
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
