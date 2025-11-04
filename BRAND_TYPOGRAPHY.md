# Alma Brand Typography

This document outlines the official Alma typography system and usage guidelines.

## Official Fonts

### Primary Font: Outfit
**Usage**: Logos, headings, body text, buttons, navigation, and all primary content

- **Font Family**: Outfit
- **Google Fonts**: https://fonts.google.com/specimen/Outfit
- **Weights Available**: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi Bold), 700 (Bold), 800 (Extra Bold), 900 (Black)
- **Tailwind Class**: `font-outfit` or `font-sans` (default)

**Characteristics**:
- Clean, modern sans-serif typeface
- Excellent readability at all sizes
- Professional and approachable
- Works well for both headings and body text

### Secondary Font: Brygada 1918
**Usage**: Quotes, subheadings, callouts, testimonials, and decorative text

- **Font Family**: Brygada 1918
- **Google Fonts**: https://fonts.google.com/specimen/Brygada+1918
- **Weights Available**: 400 (Regular), 500 (Medium), 600 (Semi Bold), 700 (Bold)
- **Styles**: Regular and Italic
- **Tailwind Classes**: `font-brygada` or `font-secondary`

**Characteristics**:
- Elegant serif typeface with historical roots
- Perfect for adding sophistication and contrast
- Ideal for quotes and featured content
- Creates visual hierarchy when paired with Outfit

## Typography Scale

### Headings (Outfit)
```tsx
// Hero Title / H1
<h1 className="font-outfit text-5xl md:text-6xl font-bold">
  Main Heading
</h1>

// Section Title / H2
<h2 className="font-outfit text-4xl md:text-5xl font-bold">
  Section Heading
</h2>

// Subsection / H3
<h3 className="font-outfit text-2xl md:text-3xl font-semibold">
  Subsection
</h3>

// Card Title / H4
<h4 className="font-outfit text-xl font-semibold">
  Card Title
</h4>

// Small Heading / H5
<h5 className="font-outfit text-lg font-medium">
  Small Heading
</h5>
```

### Body Text (Outfit)
```tsx
// Large Body
<p className="font-outfit text-lg font-normal">
  Large body text for important content
</p>

// Regular Body
<p className="font-outfit text-base font-normal">
  Standard body text
</p>

// Small Body
<p className="font-outfit text-sm font-normal">
  Small supporting text
</p>

// Caption / Fine Print
<p className="font-outfit text-xs font-normal">
  Caption or fine print
</p>
```

### Quotes & Special Text (Brygada 1918)
```tsx
// Featured Quote
<blockquote className="font-brygada text-2xl md:text-3xl italic text-gray-700">
  "Inspiring quote text here"
</blockquote>

// Testimonial
<p className="font-brygada text-lg italic">
  Customer testimonial text
</p>

// Subheading
<h3 className="font-brygada text-xl font-semibold">
  Elegant Subheading
</h3>

// Callout Text
<p className="font-secondary text-base font-medium">
  Important callout or highlight
</p>
```

## Usage Guidelines

### When to Use Outfit (Primary)
✅ **Use Outfit for:**
- All navigation elements
- Primary headings and titles
- Body text and paragraphs
- Buttons and CTAs
- Form labels and inputs
- Cards and data displays
- Tables and lists
- Mobile UI elements

### When to Use Brygada 1918 (Secondary)
✅ **Use Brygada 1918 for:**
- Pull quotes and testimonials
- Featured content blocks
- Hero subheadings (for contrast)
- Decorative section dividers
- Special announcements
- About/story sections
- Editorial content
- Mission statements

### Font Pairing Examples

#### Hero Section
```tsx
<div>
  {/* Main title: Outfit Bold */}
  <h1 className="font-outfit text-6xl font-bold text-brand-dark">
    Connect. Collaborate. Grow.
  </h1>

  {/* Subtitle: Brygada 1918 for elegance */}
  <p className="font-brygada text-2xl font-medium text-gray-700 italic mt-4">
    Building meaningful relationships across the globe
  </p>
</div>
```

#### Testimonial Card
```tsx
<div className="bg-white p-6 rounded-lg">
  {/* Quote: Brygada 1918 */}
  <blockquote className="font-brygada text-xl italic text-gray-700">
    "AlmaLinks has transformed how we network"
  </blockquote>

  {/* Author: Outfit */}
  <p className="font-outfit text-sm font-medium text-gray-900 mt-4">
    — Sarah Cohen, CEO
  </p>
</div>
```

#### Content Section
```tsx
<section>
  {/* Section heading: Outfit */}
  <h2 className="font-outfit text-4xl font-bold text-brand-dark">
    Our Mission
  </h2>

  {/* Featured text: Brygada 1918 */}
  <p className="font-brygada text-xl font-medium text-gray-700 mt-4">
    Fostering connections that drive innovation and growth
  </p>

  {/* Body text: Outfit */}
  <p className="font-outfit text-base text-gray-600 mt-4">
    We believe in the power of authentic relationships...
  </p>
</section>
```

## Font Weights Guide

### Outfit Weight Usage
| Weight | Tailwind Class | Use Case |
|--------|----------------|----------|
| 300 | `font-light` | Subtle text, decorative elements |
| 400 | `font-normal` | Body text, paragraphs |
| 500 | `font-medium` | Emphasized text, subheadings |
| 600 | `font-semibold` | Card titles, secondary headings |
| 700 | `font-bold` | Primary headings, CTAs |
| 800 | `font-extrabold` | Hero titles, major headings |
| 900 | `font-black` | Impact text (use sparingly) |

### Brygada 1918 Weight Usage
| Weight | Tailwind Class | Use Case |
|--------|----------------|----------|
| 400 | `font-normal` | Quotes, testimonials |
| 500 | `font-medium` | Featured text |
| 600 | `font-semibold` | Subheadings, callouts |
| 700 | `font-bold` | Emphasized quotes |

## Accessibility Notes

### Minimum Font Sizes
- **Body text**: 16px (1rem) minimum
- **Small text**: 14px (0.875rem) minimum
- **Fine print**: 12px (0.75rem) minimum (use sparingly)

### Font Weight for Readability
- Body text should use `font-normal` (400) or `font-medium` (500)
- Headings should be at least `font-semibold` (600) for proper hierarchy
- Avoid using `font-light` (300) for small text sizes

### Line Height
- Body text: 1.5 to 1.75 line height
- Headings: 1.2 to 1.4 line height
- Quotes: 1.6 line height for better readability

## Migration from Inter

If updating existing components:

1. **Default behavior**: All text automatically uses Outfit (no changes needed)
2. **Add secondary font**: Apply `font-brygada` or `font-secondary` to quotes and special text
3. **Remove custom fonts**: Remove any `font-inter` or custom font specifications

### Quick Migration
```tsx
// Before (Inter)
<blockquote className="text-xl italic">Quote</blockquote>

// After (Add Brygada for quotes)
<blockquote className="font-brygada text-xl italic">Quote</blockquote>

// Body text (automatic, already uses Outfit)
<p className="text-base">Body text</p>
```

## Examples in Components

### Navigation
```tsx
// All navigation uses Outfit (default)
<nav className="text-sm font-medium">
  <a href="/dashboard">Dashboard</a>
</nav>
```

### Cards
```tsx
<div className="card">
  {/* Title: Outfit */}
  <h3 className="text-xl font-semibold">Card Title</h3>

  {/* Body: Outfit */}
  <p className="text-base">Card description...</p>

  {/* Quote: Brygada */}
  <blockquote className="font-brygada text-lg italic mt-4">
    "Featured quote"
  </blockquote>
</div>
```

## Best Practices

1. **Maintain hierarchy**: Use Outfit for primary content, Brygada for accents
2. **Don't overuse italics**: Reserve italic Brygada for genuine quotes
3. **Consistent weights**: Use the same weight for similar elements
4. **Readable sizes**: Never go below 14px for body text
5. **Test on mobile**: Ensure fonts are readable at smaller viewport sizes
6. **Pair thoughtfully**: Mix Outfit and Brygada intentionally, not randomly
7. **Performance**: Both fonts are already loaded, so use them freely
