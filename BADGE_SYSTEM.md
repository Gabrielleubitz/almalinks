# Alma Links Badge Generation System

A comprehensive lanyard badge generation system for Alma Links events that creates professional, printable PDFs with QR codes, attendee information, and precise crop marks.

## Features

- **Professional Layout**: A4 format with 2×2 grid (4 badges per page)
- **Alma Links Branding**: Consistent brand colors, typography, and styling
- **QR Code Integration**: Automatic QR generation linking to networking profiles
- **Crop Marks**: Precise cutting guides for professional printing
- **Scalable**: Handles 10, 100, or 1,000+ attendees efficiently
- **Admin Interface**: User-friendly admin panel for badge generation

## Quick Start

### Admin Usage

1. Navigate to `/admin/badges?eventId=<your-event-id>`
2. Review event details and confirmed attendee count
3. Click "Generate Badges PDF"
4. Download `winegrind-badges-<eventId>.pdf`
5. Print on heavy cardstock (250gsm recommended)
6. Cut along crop marks for professional finish

### API Usage

```bash
GET /api/events/{eventId}/badges.pdf
```

Returns a downloadable PDF with all confirmed attendees' badges.

## Configuration

### Styling and Branding

All styling is centralized in `src/config/branding.ts`:

```typescript
export const BADGE_BRANDING = {
  colors: {
    primary: '#8B0000',        // Wine red
    textPrimary: '#1F2937',    // Dark gray
    textSecondary: '#6B7280',  // Medium gray
    background: '#FFFFFF',     // White
    qrBackground: '#F9FAFB',   // Light gray
  },
  fonts: {
    nameSize: 18,     // Large name text
    companySize: 12,  // Company text
    linkedinSize: 10, // LinkedIn text
  },
  layout: {
    badgeWidth: 90,    // mm
    badgeHeight: 133.5, // mm
    qrSize: 35,        // mm
    // ... more layout options
  }
};
```

### Font Customization

To use custom fonts instead of system fallbacks:

1. Add font files to `/public/fonts/`
2. Update `BADGE_BRANDING.fonts` in branding.ts
3. Modify the PDF generation to embed custom fonts:

```javascript
// In badges.js API
const customFont = await pdfDoc.embedFont(fontBytes);
```

### Logo Customization

1. Place your logo at `/public/logo.png` (recommended: 300×120px PNG)
2. Update `BADGE_BRANDING.assets.logoPath` if using different path
3. Adjust `logoWidth` and `logoHeight` in layout configuration

## Technical Architecture

### API Endpoint: `/api/events/[eventId]/badges.js`

- **Input**: Event ID from URL parameter
- **Process**: 
  1. Fetches confirmed attendees from Firebase
  2. Generates QR codes for networking
  3. Creates PDF with precise layout
  4. Streams response for download
- **Output**: PDF file with content-type `application/pdf`

### Frontend: `/src/pages/admin/Badges.tsx`

- React admin interface for badge generation
- Event selection and attendee count display
- Download trigger and error handling
- Integration with admin authentication

### Shared Configuration: `/src/config/branding.ts`

- Centralized styling and layout constants
- Unit conversion utilities (mm ↔ points)
- Grid calculation helpers
- Crop mark positioning logic

## Badge Layout Specifications

### Page Layout
- **Format**: A4 (210 × 297 mm)
- **Margins**: 10 mm all around
- **Grid**: 2 × 2 (4 badges per page)
- **Gutter**: 10 mm between badges
- **Badge Size**: 90 × 133.5 mm each

### Badge Content
1. **Header**: Alma Links branding (wine red background)
2. **Name**: Large, bold typography (18pt)
3. **Company**: Medium text from work field (12pt)
4. **LinkedIn**: Small text if provided (10pt)  
5. **QR Code**: 35×35mm in bottom-right corner
6. **Crop Marks**: 5mm marks at each corner

### QR Code Logic
- **Primary**: Uses `qr_code` field if available
- **Fallback**: Generates from `ticket_url` field
- **Format**: Links to `almalinks.com/connect?to=userId&event=eventId`
- **Encoding**: High error correction, 200px resolution

## Database Schema

### Expected Attendee Data
```javascript
{
  "first_name": "Maya",
  "last_name": "Cohen", 
  "company": "Acme Robotics",
  "linkedin": "linkedin.com/in/mayacohen", // Optional
  "qr_code": "https://tickets.almalinks.com/t/abc123",
  "email": "maya@acme.com"
}
```

### Firebase Collections
- **events**: Event details (name, date, location)
- **registrations**: Attendee registrations with `status: 'confirmed'`

## Performance Optimization

### Memory Management
- **Page-by-page generation**: Prevents memory spikes with large attendee lists
- **Streaming response**: Reduces server memory usage
- **QR code caching**: Generates QR codes on-demand, not pre-stored

### Scalability Testing
- **10 attendees**: ~3 pages, <1 second generation
- **100 attendees**: ~25 pages, <3 seconds generation  
- **1,000 attendees**: ~250 pages, <30 seconds generation

### Vercel Limits
- **Function timeout**: 10 seconds default, 30 seconds max
- **Memory**: 1GB default, optimized for streaming
- **Response size**: PDF streaming prevents large response issues

## Error Handling

### Common Scenarios
- **No attendees**: Returns 404 with JSON error message
- **Invalid event**: Returns 404 with "Event not found"
- **Missing QR data**: Skips QR code, continues with other badge content
- **Long names**: Automatically reduces font size to fit badge width
- **Memory issues**: Page-by-page generation prevents crashes

### Debugging
```bash
# Check API logs in Vercel dashboard
# Local testing:
npm run dev
curl http://localhost:3000/api/events/test-event/badges.pdf -o test-badges.pdf
```

## Testing

### Unit Tests
```bash
npm test src/config/branding.test.ts
```

Tests cover:
- Unit conversions (mm ↔ points)
- Grid calculations (badge positions)
- Crop mark positioning
- Layout validation
- Performance edge cases

### Manual Testing
1. **10 attendees**: Verify basic functionality
2. **100 attendees**: Test pagination and performance
3. **1,000 attendees**: Stress test memory and timeout limits
4. **Edge cases**: Missing data, long names, no LinkedIn

### Print Testing
1. Print on regular paper first (draft mode)
2. Verify crop marks align properly
3. Test on 250gsm cardstock for final version
4. Check badge fits standard lanyard sleeves (54×85mm)

## Troubleshooting

### Common Issues

**PDF doesn't download:**
- Check browser network tab for API errors
- Verify event has confirmed attendees
- Check Vercel function logs

**Badges appear blank:**
- Verify Firebase data structure matches expected schema
- Check QR code generation (may fail silently)
- Ensure attendee names exist

**Layout issues:**
- Verify A4 printer settings
- Check PDF viewer zoom (should be 100%)
- Ensure crop marks are visible before cutting

**Performance problems:**
- Large events (500+ attendees) may timeout
- Consider implementing pagination for huge events
- Monitor Vercel function execution time

### Development Tips

**Local Development:**
```bash
# Start dev server
npm run dev

# Test API directly
curl "http://localhost:3000/api/events/your-event-id/badges.pdf" -o test.pdf

# View PDF
open test.pdf  # macOS
xdg-open test.pdf  # Linux
start test.pdf  # Windows
```

**Adding New Badge Fields:**
1. Update attendee data structure in badges.js
2. Modify `drawBadge()` function to include new field
3. Adjust layout calculations if needed
4. Update branding.ts constants
5. Test with various data combinations

## Contributing

When making changes to the badge system:

1. Update unit tests in `branding.test.ts`
2. Test with multiple attendee counts (10, 100, 1000)
3. Verify print quality on physical printer
4. Update this README if adding new features
5. Consider backward compatibility for existing events

## Dependencies

- **pdf-lib**: PDF generation and manipulation
- **qrcode**: QR code generation
- **sharp**: Image processing (for logos)
- **firebase-admin**: Database access

## License

Part of the Alma Links event management system. Internal use only.