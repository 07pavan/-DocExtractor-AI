/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        iris: "#624de3",
        "soft-iris": "#8d4af7",
        "studio-slate": "#1a1d1e",
        obsidian: "#151718",
        "pure-white": "#ffffff",
        cloud: "#f6f7f9",
        mist: "#ebedef",
        graphite: "#8d8e8f",
        iron: "#5f6162",
        noir: "#000000",
        "cobalt-pop": "#1d58c0",
        "fern-pop": "#009639",
        "lilac-wash": "#f1eefe",
        "mint-wash": "#e5fbeb",
        "apricot-wash": "#feeadd",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Source Code Pro', 'monospace'],
      },
      borderRadius: {
        'pill': '40px',
        'badge': '100px',
        'card': '16px',
        'control': '6px',
      },
      boxShadow: {
        'subtle': 'rgba(0, 0, 0, 0.2) 0px 1px 2px 0px, rgba(0, 0, 0, 0.08) 0px 6px 16px 0px',
        'subtle-2': 'rgba(0, 0, 0, 0.08) 0px 1px 2px 0px, rgba(0, 0, 0, 0.06) 0px 4px 8px 0px',
        'subtle-3': 'rgba(255, 255, 255, 0.2) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.08) 0px 1px 2px 0px, rgba(0, 0, 0, 0.06) 0px 4px 8px 0px',
        'sm-elevated': 'rgba(0, 0, 0, 0.14) 0px 4px 6px -2px, rgba(0, 0, 0, 0.16) 0px 12px 16px -4px',
        'lg-elevated': 'rgba(0, 0, 0, 0.08) 0px 12px 24px 0px, rgba(0, 0, 0, 0.06) 0px 2px 4px 0px',
      },
      spacing: {
        '8px': '8px',
        '16px': '16px',
        '24px': '24px',
        '40px': '40px',
        '64px': '64px',
        '80px': '80px',
      }
    },
  },
  plugins: [],
};
