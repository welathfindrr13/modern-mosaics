/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark theme palette
        dark: {
          50: '#f7f7f8',
          100: '#ececef',
          200: '#d5d5db',
          300: '#b0b0bb',
          400: '#858596',
          500: '#66667a',
          600: '#515163',
          700: '#434351',
          800: '#1a1a24',
          900: '#0f0f12',
          950: '#08080a',
        },
        // Your brand teal (from logo)
        brand: {
          50: '#edfcfd',
          100: '#d2f5f9',
          200: '#abe9f3',
          300: '#72d7e9',
          400: '#32bbd8',
          500: '#2d7a8c',
          600: '#257a8c',
          700: '#246373',
          800: '#25515e',
          900: '#234450',
          950: '#122c36',
        },
        // Gold accent for premium feel
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#d4a017',
          600: '#a16207',
          700: '#854d0e',
          800: '#713f12',
          900: '#5f3409',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(45, 122, 140, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(45, 122, 140, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #0f0f12 0%, #1a1a24 50%, #122c36 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(26, 26, 36, 0.8) 0%, rgba(15, 15, 18, 0.9) 100%)',
        'glow-gradient': 'radial-gradient(circle at center, rgba(45, 122, 140, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow': '0 0 30px rgba(45, 122, 140, 0.3)',
        'glow-lg': '0 0 60px rgba(45, 122, 140, 0.4)',
        'gold-glow': '0 0 30px rgba(212, 160, 23, 0.3)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
