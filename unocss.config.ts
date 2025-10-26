import { presetAttributify, presetIcons, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'
import presetAnimations from 'unocss-preset-animations'
import { presetKobalte } from 'unocss-preset-primitives'
import { defineConfig } from 'unocss/vite'

export default defineConfig({
  presets: [
    presetWind3({
      dark: {
        dark: '[data-kb-theme="dark"]',
        light: '[data-kb-theme="light"]',
      },
    }),
    presetAttributify(),
    presetIcons(),
    presetAnimations(),
    presetKobalte(),
  ],
  transformers: [
    transformerVariantGroup(),
    transformerDirectives(),
  ],
  preflights: [
    {
      getCSS: () => `
        *, ::before, ::after {
          border-color: hsl(var(--border));
          /* color: hsl(var(--foreground)); */
        }
      `,
    },
  ],
  theme: {
    colors: {
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      secondary: {
        DEFAULT: 'hsl(var(--secondary))',
        foreground: 'hsl(var(--secondary-foreground))',
      },
      destructive: {
        DEFAULT: 'hsl(var(--destructive))',
        foreground: 'hsl(var(--destructive-foreground))',
      },
      info: {
        DEFAULT: 'hsl(var(--info))',
        foreground: 'hsl(var(--info-foreground))',
      },
      success: {
        DEFAULT: 'hsl(var(--success))',
        foreground: 'hsl(var(--success-foreground))',
      },
      warning: {
        DEFAULT: 'hsl(var(--warning))',
        foreground: 'hsl(var(--warning-foreground))',
      },
      error: {
        DEFAULT: 'hsl(var(--error))',
        foreground: 'hsl(var(--error-foreground))',
      },
      muted: {
        DEFAULT: 'hsl(var(--muted))',
        foreground: 'hsl(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'hsl(var(--accent))',
        foreground: 'hsl(var(--accent-foreground))',
      },
      popover: {
        DEFAULT: 'hsl(var(--popover))',
        foreground: 'hsl(var(--popover-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
    },
    borderRadius: {
      xl: 'calc(var(--radius) + 4px)',
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
    keyframes: {
      'accordion-down': {
        from: { height: 0 },
        to: { height: 'var(--kb-accordion-content-height)' },
      },
      'accordion-up': {
        from: { height: 'var(--kb-accordion-content-height)' },
        to: { height: 0 },
      },
      'content-show': {
        from: { opacity: 0, transform: 'scale(0.96)' },
        to: { opacity: 1, transform: 'scale(1)' },
      },
      'content-hide': {
        from: { opacity: 1, transform: 'scale(1)' },
        to: { opacity: 0, transform: 'scale(0.96)' },
      },
    },
    animation: {
      'accordion-down': 'accordion-down 0.2s ease-out',
      'accordion-up': 'accordion-up 0.2s ease-out',
      'content-show': 'content-show 0.2s ease-out',
      'content-hide': 'content-hide 0.2s ease-out',
    },
  },
})
