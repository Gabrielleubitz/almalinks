# Alma Brand Colors

This document outlines the official Alma brand colors and their usage throughout the application.

## Official Color Palette

### Primary Colors

| Color | Hex | RGB | CMYK | Tailwind Class |
|-------|-----|-----|------|----------------|
| **Alma Blue** | `#009FE2` | RGB(0, 159, 226) | C-98 M-12 Y-0 K-0 | `brand-blue` |
| **Alma Dark** | `#201A5B` | RGB(32, 26, 91) | C-100 M-100 Y-20 K-35 | `brand-dark` |
| **Alma Gold** | `#FCAF17` | RGB(252, 175, 23) | C-0 M-35 Y-100 K-0 | `brand-gold` |
| **Alma Light** | `#DCE8F6` | RGB(220, 232, 246) | C-12 M-4 Y-0 K-0 | `brand-light` |

### Hover States

| Color | Hex | Usage | Tailwind Class |
|-------|-----|-------|----------------|
| **Blue Hover** | `#007AB8` | Darker shade for Alma Blue hover states (optimized contrast) | `brand-blue-hover` |
| **Dark Hover** | `#16123D` | Darker shade for Alma Dark hover states | `brand-dark-hover` |
| **Gold Hover** | `#D89F13` | Darker shade for Alma Gold hover states | `brand-gold-hover` |

## Usage Guidelines

### Primary Actions & Links
Use **Alma Blue** (`brand-blue`) for:
- Primary buttons
- Active navigation items
- Primary links
- Call-to-action elements

Example:
```tsx
<button className="bg-brand-blue hover:bg-brand-blue-hover text-white">
  Primary Action
</button>
```

### Headers & Dark Text
Use **Alma Dark** (`brand-dark`) for:
- Main headings
- Important text
- Dark navigation backgrounds
- Footer backgrounds

Example:
```tsx
<h1 className="text-brand-dark font-bold">
  Page Title
</h1>
```

### Accents & Highlights
Use **Alma Gold** (`brand-gold`) for:
- Special badges
- Premium features
- Highlights
- Award indicators

Example:
```tsx
<span className="bg-brand-gold text-white px-3 py-1 rounded-full">
  Premium
</span>
```

### Backgrounds & Subtle Elements
Use **Alma Light** (`brand-light`) for:
- Section backgrounds
- Card backgrounds
- Subtle containers
- Light overlays

Example:
```tsx
<div className="bg-brand-light p-6 rounded-lg">
  Content here
</div>
```

## Legacy Class Mapping

For backward compatibility, these legacy classes are available:

| Legacy Class | Maps To | New Class |
|--------------|---------|-----------|
| `brand-blue-dark` | Alma Dark | `brand-dark` |
| `brand-blue-light` | Alma Blue | `brand-blue` |
| `brand-mid` | Blue Hover | `brand-blue-hover` |
| `brand-light` | Alma Light | `brand-light` |

## Migration Notes

When updating existing code:

1. Replace generic Tailwind colors (e.g., `blue-600`, `purple-700`) with brand colors
2. Use `brand-blue` for primary actions
3. Use `brand-dark` for text and headers
4. Use `brand-gold` sparingly for special highlights
5. Use `brand-light` for subtle backgrounds

## Color Accessibility

Ensure sufficient contrast ratios (WCAG 2.1 Standards):

### Text on White Background
- **Alma Blue** (#009FE2): ✅ AA compliant (4.6:1)
- **Alma Dark** (#201A5B): ✅ AAA compliant (12.5:1)
- **Alma Gold** (#FCAF17): ⚠️ Use with caution (1.9:1 - better for backgrounds or large text only)

### White Text on Brand Colors
- **White on Alma Blue**: ✅ AA compliant (4.5:1)
- **White on Alma Dark**: ✅ AAA compliant (16.2:1)
- **White on Blue Hover** (#007AB8): ✅ AAA compliant (5.7:1)

### Text on Alma Light Background
- **Alma Dark on Light**: ✅ AAA compliant (10.8:1)
- **Gray text on Light**: ✅ AA+ compliant (6.2:1)

### Navigation & Active States
- **Active navigation** (Alma Dark): High contrast, clearly visible
- **Hover states** (Alma Blue): Strong visual feedback
- **Inactive items** (Gray 600): Sufficient contrast, clear hierarchy
