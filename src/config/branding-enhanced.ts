/**
 * Alma Links Enhanced Badge Branding Configuration
 * Professional branding system for event badges with rich visual identity
 */

// Alma Links Brand Colors
export const BRAND_COLORS = {
  // Primary brand colors
  wine: '#0B2B6B',           // Deep blue for header bands and accents
  charcoal: '#11151A',       // Dark charcoal for primary text
  lightBg: '#F7F5F3',        // Light warm background
  accentGray: '#E8E5E1',     // Subtle accent gray for borders/dividers
  
  // Supporting colors
  white: '#FFFFFF',          // Pure white for QR backgrounds
  mutedText: '#4B5563',      // Muted gray for LinkedIn/secondary text
  overlayDark: 'rgba(0,0,0,0.25)', // Dark overlay for photo backgrounds
  
  // QR code colors
  qrForeground: '#000000',   // High contrast black for QR codes
  qrBackground: '#FFFFFF',   // Pure white QR background
} as const;

// Typography System
export const TYPOGRAPHY = {
  // Font stacks
  primary: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  
  // Font sizes (in points - will be converted to mm)
  name: {
    min: 26,      // Minimum readable size
    ideal: 36,    // Preferred size
    max: 44,      // Maximum before looking too large
  },
  company: {
    min: 16,
    ideal: 20,
    max: 22,
  },
  linkedin: {
    size: 13,     // Fixed size for consistency
  },
  header: {
    size: 16,     // "ALMA LINKS" header text
  },
  footer: {
    size: 10,     // Optional footer text
  },
  
  // Text styling
  letterSpacing: {
    header: '0.02em',    // +2% tracking for header
    normal: '0',
  },
  
  lineHeight: {
    tight: 0.9,    // For large names
    normal: 1.2,   // For body text
    loose: 1.4,    // For readability
  },
} as const;

// Layout System (in millimeters)
export const LAYOUT = {
  // Page setup (A4)
  page: {
    width: 210,
    height: 297,
    margin: 10,
  },
  
  // Badge grid (2×2)
  grid: {
    cols: 2,
    rows: 2,
    gutter: 10,
  },
  
  // Computed badge dimensions
  badge: {
    width: 90,      // (210 - 2*10 - 10) / 2 = 90mm
    height: 133.5,  // (297 - 2*10 - 10) / 2 = 133.5mm
    padding: 8,     // Internal content padding
  },
  
  // Header band
  header: {
    height: 20,     // Wine red header band
    logoSize: 14,   // Logo height within header
    textOffset: 3,  // Vertical offset for text alignment
  },
  
  // QR code area
  qr: {
    size: 35,       // QR code square size
    padding: 4,     // White tile padding around QR
    tileSize: 43,   // Total white tile size (35 + 2*4)
    margin: 6,      // Margin from badge edges
    quietZone: 2,   // Scanner quiet zone
  },
  
  // Content areas
  content: {
    nameTop: 32,        // Distance from top to name
    companyGap: 6,      // Gap between name and company
    linkedinGap: 4,     // Gap between company and LinkedIn
    footerHeight: 12,   // Footer area height
  },
  
  // Crop marks
  cropMarks: {
    length: 6,      // Length of each crop mark
    offset: 3,      // Distance from badge corner
    thickness: 0.5, // Line thickness
  },
} as const;

// Asset Paths
export const ASSETS = {
  logo: {
    png: '/logo.png',
    svg: '/logo.svg',
    fallback: '/alma-links-logo.svg',
  },
  eventBackground: '/event-hero.jpg',
  fallbackBackground: '/default-event-bg.jpg',
} as const;

// Print Specifications
export const PRINT_SPECS = {
  dpi: 300,                    // Print resolution
  mmToPoints: 2.83465,         // Conversion factor
  backgroundOpacity: 0.15,     // Event photo opacity (12-18%)
  qrErrorCorrection: 'M',      // Medium error correction for reliability
  qrMargin: 1,                 // QR quiet zone modules
} as const;

/**
 * Convert millimeters to points for PDF generation
 */
export const mm = (millimeters: number): number => {
  return millimeters * PRINT_SPECS.mmToPoints;
};

/**
 * Convert points to millimeters
 */
export const pt = (points: number): number => {
  return points / PRINT_SPECS.mmToPoints;
};

/**
 * Calculate responsive font size based on text width
 */
export const calculateFontSize = (
  text: string, 
  maxWidth: number, 
  fontConfig: typeof TYPOGRAPHY.name,
  baseWidth: number = 100 // Estimated character width at ideal size
): number => {
  const textLength = text.length;
  const estimatedWidth = (textLength * baseWidth * fontConfig.ideal) / 100;
  
  if (estimatedWidth <= maxWidth) {
    return fontConfig.ideal;
  }
  
  // Scale down proportionally
  const scaleFactor = maxWidth / estimatedWidth;
  const scaledSize = fontConfig.ideal * scaleFactor;
  
  // Ensure within bounds
  return Math.max(fontConfig.min, Math.min(fontConfig.max, scaledSize));
};

/**
 * Calculate badge positions on A4 page
 */
export const calculateBadgePositions = () => {
  const positions = [];
  
  for (let row = 0; row < LAYOUT.grid.rows; row++) {
    for (let col = 0; col < LAYOUT.grid.cols; col++) {
      const x = LAYOUT.page.margin + col * (LAYOUT.badge.width + LAYOUT.grid.gutter);
      const y = LAYOUT.page.margin + row * (LAYOUT.badge.height + LAYOUT.grid.gutter);
      positions.push({ x, y, row, col });
    }
  }
  
  return positions;
};

/**
 * Calculate crop mark coordinates for a badge
 */
export const calculateCropMarks = (badgeX: number, badgeY: number) => {
  const { cropMarks, badge } = LAYOUT;
  const marks = [];
  
  // Define corner positions
  const corners = [
    { x: badgeX, y: badgeY }, // Top-left
    { x: badgeX + badge.width, y: badgeY }, // Top-right
    { x: badgeX, y: badgeY + badge.height }, // Bottom-left
    { x: badgeX + badge.width, y: badgeY + badge.height }, // Bottom-right
  ];
  
  corners.forEach((corner, index) => {
    const isLeft = index % 2 === 0;
    const isTop = index < 2;
    
    // Horizontal crop mark
    marks.push({
      x1: corner.x + (isLeft ? -cropMarks.offset - cropMarks.length : cropMarks.offset),
      y1: corner.y + (isTop ? -cropMarks.offset : cropMarks.offset),
      x2: corner.x + (isLeft ? -cropMarks.offset : cropMarks.offset + cropMarks.length),
      y2: corner.y + (isTop ? -cropMarks.offset : cropMarks.offset),
    });
    
    // Vertical crop mark
    marks.push({
      x1: corner.x + (isLeft ? -cropMarks.offset : cropMarks.offset),
      y1: corner.y + (isTop ? -cropMarks.offset - cropMarks.length : cropMarks.offset),
      x2: corner.x + (isLeft ? -cropMarks.offset : cropMarks.offset),
      y2: corner.y + (isTop ? -cropMarks.offset : cropMarks.offset + cropMarks.length),
    });
  });
  
  return marks;
};

/**
 * Get QR code positioning within badge
 */
export const getQRPosition = (badgeX: number, badgeY: number) => {
  const { badge, qr } = LAYOUT;
  
  return {
    // QR tile background (white square)
    tileX: badgeX + badge.width - qr.tileSize - qr.margin,
    tileY: badgeY + badge.height - qr.tileSize - qr.margin,
    tileSize: qr.tileSize,
    
    // Actual QR code position
    qrX: badgeX + badge.width - qr.tileSize - qr.margin + qr.padding,
    qrY: badgeY + badge.height - qr.tileSize - qr.margin + qr.padding,
    qrSize: qr.size,
  };
};

/**
 * Get content area boundaries (avoiding QR code)
 */
export const getContentArea = (badgeX: number, badgeY: number) => {
  const { badge, qr } = LAYOUT;
  
  return {
    x: badgeX + badge.padding,
    y: badgeY,
    width: badge.width - (2 * badge.padding),
    height: badge.height - qr.tileSize - qr.margin - badge.padding,
    maxTextWidth: badge.width - (2 * badge.padding) - qr.tileSize - qr.margin,
  };
};

export default {
  BRAND_COLORS,
  TYPOGRAPHY,
  LAYOUT,
  ASSETS,
  PRINT_SPECS,
  mm,
  pt,
  calculateFontSize,
  calculateBadgePositions,
  calculateCropMarks,
  getQRPosition,
  getContentArea,
};