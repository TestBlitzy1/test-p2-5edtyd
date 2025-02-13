import type { Config } from 'tailwindcss'
// @tailwindcss/forms ^0.5.0
// @tailwindcss/typography ^0.5.0
// @tailwindcss/aspect-ratio ^0.4.0

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af'
        },
        secondary: {
          50: '#f5f3ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3'
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        text: {
          primary: '#111827',
          secondary: '#4b5563'
        },
        background: {
          primary: '#ffffff',
          secondary: '#f3f4f6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Inter', 'ui-sans-serif', 'system-ui']
      },
      fontSize: {
        xs: ['0.75rem', '1rem'],
        sm: ['0.875rem', '1.25rem'],
        base: ['1rem', '1.5rem'],
        lg: ['1.125rem', '1.75rem'],
        xl: ['1.25rem', '1.75rem'],
        '2xl': ['1.5rem', '2rem'],
        '3xl': ['1.875rem', '2.25rem'],
        '4xl': ['2.25rem', '2.5rem'],
        '5xl': ['3rem', '1']
      },
      spacing: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        4: '1rem',
        6: '1.5rem',
        8: '2rem',
        12: '3rem',
        16: '4rem',
        20: '5rem'
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px'
      }
    },
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px'
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio')
  ]
}

export default config