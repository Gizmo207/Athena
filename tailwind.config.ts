import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,mdx}',
    './pages/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './app/**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'athena-cyan': '#00d4ff',
        'athena-green': '#00ff88',
        'athena-dark': '#1a1a2e',
        'athena-darker': '#0a0a0f',
        'neon-blue': '#0099ff',
        'neon-red': '#ff004d',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 153, 255, 0.5)',
        'neon-cyan': '0 0 20px rgba(0, 212, 255, 0.5)',
        'neon-red': '0 0 20px rgba(255, 0, 77, 0.5)',
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { textShadow: '0 0 5px currentColor' },
          '100%': { textShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
