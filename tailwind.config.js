export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'liu-bg':     '#040d1c',
        'liu-card':   '#0d1a2e',
        'liu-accent': '#40c4ff',
        'liu-accent2':'#0088ff',
        'liu-border': 'rgba(255,255,255,0.08)',
        'liu-muted':  '#7a94b0',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      backgroundImage: {
        'liu-gradient': 'linear-gradient(135deg, #0070bb 0%, #09ddff 100%)',
        'liu-hero':
          'radial-gradient(55% 55% at 28% 55%, rgba(0,100,200,0.18) 0%, transparent 65%), radial-gradient(35% 35% at 70% 30%, rgba(0,160,255,0.08) 0%, transparent 55%)',
      },
      // Sharper corners app-wide — leaves `rounded-full` (circular badges,
      // avatars, pitch markings) untouched since that key isn't overridden.
      borderRadius: {
        lg:  '4px',
        xl:  '6px',
        '2xl': '8px',
      },
    },
  },
  plugins: [],
};
