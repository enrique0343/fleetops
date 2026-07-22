/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        fleet: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          muted: '#64748b',
        },
        // Paleta institucional Avante (sistema visual aprobado)
        avante: {
          ink: '#1A1A1A',      // primario: texto, encabezados
          slate: '#4A4A4A',    // secundario: etiquetas, pies
          mid: '#6B7280',      // texto auxiliar
          line: '#E5E5E5',     // hairlines, bordes
          band: '#F4F4F4',     // fila alterna / fondos tenues
          bg: '#FAFAFA',       // fondo de página claro
          navy: '#1A2B4A',     // acento A: datos primarios
          teal: '#5B9BA8',     // acento B: secundarios
          violet: '#7A6B8E',   // acento C: tercera categoría
          red: '#B8443A',      // alerta crítica
          redDeep: '#A0322D',
          amber: '#B8862E',    // alerta moderada
          green: '#1F5740',    // cumple
        },
      },
      fontFamily: {
        // Century Gothic institucional en toda la aplicación
        sans: ['Century Gothic', 'CenturyGothic', 'AppleGothic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'modal-in': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'backdrop-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'sheet-in': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'modal-in': 'modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'backdrop-in': 'backdrop-in 180ms ease-out',
        'sheet-in': 'sheet-in 260ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
