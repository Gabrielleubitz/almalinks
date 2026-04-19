# Igani Watermark Implementation Guide

## Overview
Subtle Igani branding has been added across the AlmaLinks website to credit your company for building and maintaining the platform.

## Quick Setup

### Step 1: Prepare Your Logo
1. Open `public/igani-logo-template.md` for detailed specifications
2. Required size: **150px × 60px** (transparent PNG or SVG)
3. Keep design simple and recognizable at small sizes
4. Use neutral/monochrome colors for subtlety

### Step 2: Upload Your Logo
Save your logo file in the `public/` folder as:
- `igani-logo.png` (preferred) OR
- `igani-logo.svg` (alternative)

### Step 3: Test
The watermark will automatically appear in the footer of all pages with text "Powered by Igani"

## Current Watermark Locations

### ✅ Currently Implemented
1. **Footer** - All pages
   - Position: Center, below copyright
   - Opacity: 50%
   - Size: Medium (32px height)
   - Format: "Powered by [Logo]"

### 🎨 Available Positions (Optional)
You can easily add more watermarks using the `IganiWatermark` component:

```tsx
import IganiWatermark from './components/IganiWatermark';

// In Footer (already implemented)
<IganiWatermark position="footer" size="md" opacity={0.5} />

// Bottom-right corner (floating)
<IganiWatermark position="bottom-right" size="sm" opacity={0.3} />

// Bottom-center
<IganiWatermark position="bottom-center" size="sm" opacity={0.4} />
```

## Component Props

### `position`
- `'footer'` - Centered with "Powered by" text (default)
- `'bottom-right'` - Fixed to bottom-right corner
- `'bottom-center'` - Centered at bottom

### `size`
- `'sm'` - 28px height (~70px width) (subtle, for floating watermarks)
- `'md'` - 36px height (~90px width) (default, for footer)
- `'lg'` - 48px height (~120px width) (prominent, for special pages)

### `opacity`
- Range: `0.1` to `1.0`
- Recommended: `0.3` - `0.5` for subtle branding
- Default: `0.4`

## Adding Watermarks to Specific Pages

### Example: Add floating watermark to Dashboard
```tsx
// In src/pages/DashboardPage.tsx
import IganiWatermark from '../components/IganiWatermark';

// Add before closing </div> of main content
<IganiWatermark position="bottom-right" size="sm" opacity={0.3} />
```

### Example: Add to Admin Pages
```tsx
// In src/pages/admin/AdminDashboard.tsx
import IganiWatermark from '../../components/IganiWatermark';

// Add at the end of the page content
<IganiWatermark position="bottom-center" size="sm" opacity={0.35} />
```

## Best Practices

### ✅ DO
- Keep watermarks subtle (30-50% opacity)
- Use small sizes for floating watermarks
- Place in non-intrusive locations
- Maintain consistency across similar pages

### ❌ DON'T
- Don't make watermarks too prominent (>60% opacity)
- Don't place over important content
- Don't use large sizes on mobile viewports
- Don't add too many watermarks per page (1-2 max)

## File Structure
```
alma/
├── public/
│   ├── igani-logo.png              ← Your logo here (upload this)
│   ├── igani-logo.svg              ← Alternative SVG format
│   ├── igani-logo-placeholder.svg  ← Auto-generated placeholder
│   └── igani-logo-template.md      ← Logo specifications
├── src/
│   └── components/
│       └── IganiWatermark.tsx      ← Watermark component
└── IGANI_WATERMARK_GUIDE.md        ← This file
```

## Troubleshooting

### Logo not appearing?
1. Verify filename is exactly `igani-logo.png` or `igani-logo.svg`
2. Check file is in `public/` folder (not `src/` or subfolders)
3. Clear browser cache and refresh
4. Check browser console for errors

### Logo too large/small?
- Resize your source image to 150×60px before uploading
- Or adjust the `size` prop: `size="sm"`, `size="md"`, `size="lg"`

### Logo not visible enough?
- Increase opacity: `opacity={0.6}` or `opacity={0.7}`
- Use a larger size: `size="lg"`
- Ensure logo has good contrast with background

### Logo too prominent?
- Decrease opacity: `opacity={0.3}` or `opacity={0.25}`
- Use a smaller size: `size="sm"`
- Consider using a monochrome/subtle color version

## Support

For questions or customization requests, contact the Igani development team.

---

**Built with care by Igani** 🚀
