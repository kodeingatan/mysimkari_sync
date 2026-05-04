---
name: Elevra Lumina
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3d4a3d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6d7b6c'
  outline-variant: '#bccbb9'
  surface-tint: '#006e2f'
  primary: '#006e2f'
  on-primary: '#ffffff'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#4ae176'
  secondary: '#5d5f5f'
  on-secondary: '#ffffff'
  secondary-container: '#dfe0e0'
  on-secondary-container: '#616363'
  tertiary: '#2b6954'
  on-tertiary: '#ffffff'
  tertiary-container: '#7ab8a0'
  on-tertiary-container: '#004937'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#b0f0d6'
  tertiary-fixed-dim: '#95d3ba'
  on-tertiary-fixed: '#002117'
  on-tertiary-fixed-variant: '#0b513d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 80px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  logo:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    letterSpacing: -0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-container: 64px
  card-padding: 32px
  section-gap: 120px
---

## Brand & Style

The brand identity centers on the intersection of organic growth and digital precision. It is designed for high-growth SaaS and premium technology sectors that value transparency, clarity, and a "breath of fresh air" in a crowded market. 

The visual style is a refined **Glassmorphism**. It utilizes multi-layered translucent panels to create depth, mimicking a physical frosted glass sheet held over a lush, nature-inspired environment. This approach evokes feelings of calmness, high-end sophistication, and environmental consciousness. The interface feels lightweight and non-intrusive, prioritizing content and data visualization through airy layouts and "floating" elements.

## Colors

The palette is anchored by "Vibrant Growth Green," used exclusively for primary actions and success states to ensure high visibility against the blurred background. 

- **Primary:** Vibrant Green (#22c55e) for high-impact CTAs.
- **Surface:** A spectrum of soft whites and semi-transparents. Surfaces use an alpha-channel white (e.g., `rgba(255, 255, 255, 0.15)`) to achieve the glass effect.
- **Accents:** Deep Forest Green (#064e3b) is used sparingly for text on light backgrounds to maintain legibility while staying within the organic theme.
- **Glass Stroke:** A high-clarity white border (`rgba(255, 255, 255, 0.4)`) is used to define the edges of panels.

## Typography

This design system uses a dual-font strategy. **Manrope** is used for headlines to provide a modern, geometric, and premium feel. Its tight kerning and wide apertures reflect the "growth" narrative. **Inter** is used for all functional body text and labels to ensure maximum readability over complex, blurred backgrounds.

The 'elevra' logo must always be rendered in lowercase with tight tracking. Headlines should utilize high contrast (white or very dark green) to pop against the translucent glass layers.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous margins to create an "airy" sensation. Components are never cramped; they "float" within the viewport.

- **Grid:** 12-column layout with 24px gutters.
- **Rhythm:** An 8px linear scale is used for all padding and margins.
- **Safe Areas:** Large 64px container margins ensure the nature-inspired background is visible around the edges of the main content glass panel, reinforcing the depth of the UI.

## Elevation & Depth

Depth is achieved through **Glassmorphism and Backdrop Blurs** rather than traditional shadows.

1.  **Level 1 (Background):** A high-resolution, blurred nature image (Lush Greenery).
2.  **Level 2 (Main Container):** A large frosted glass panel with a `backdrop-filter: blur(20px)` and a subtle `0.5px` white inner border.
3.  **Level 3 (Floating Cards):** Smaller cards placed on top of the main container with a higher opacity (`rgba(255, 255, 255, 0.25)`) and a more pronounced `backdrop-filter: blur(40px)`.
4.  **Level 4 (Interactions):** Elements like tooltips or active buttons use a slight glow effect (`box-shadow: 0 0 20px rgba(34, 197, 94, 0.3)`) instead of black shadows to maintain the "light-filled" aesthetic.

## Shapes

The shape language is "Organic Geometric." Elements use significant corner rounding to mimic smooth river stones or organic forms. 

- **Standard Buttons & Inputs:** 0.5rem (8px) base rounding.
- **Main Glass Panels:** 1.5rem (24px) for a soft, premium container feel.
- **Active States:** Pill-shaped (fully rounded) indicators for navigation items and toggle switches.

## Components

### Buttons
- **Primary:** Solid #22c55e background with white text. High-gloss finish.
- **Secondary/Ghost:** Translucent white border (1px) with a soft background blur on hover.
- **Rounding:** Large radius (12px to pill-shaped).

### Cards & Panels
- **Styling:** `backdrop-filter: blur(30px)`, `background: rgba(255, 255, 255, 0.15)`, and a `1px` white border at 30% opacity.
- **Content:** Include thin-line icons (1px stroke) and minimalist charts with no axes or grids—just clean, glowing lines.

### Navigation
- **Top Bar:** Floating glass capsule with centered links.
- **Active State:** A white pill-shaped background behind the active link with 100% opacity text.

### Inputs & Tables
- **Inputs:** Understated glass fields with white-to-transparent gradients. Bottom-border focus states using the Primary Green.
- **Tables:** No vertical dividers. Rows are separated by thin, low-opacity white lines. Headers use the `label-md` typographic style.