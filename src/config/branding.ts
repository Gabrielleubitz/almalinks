/**
 * AlmaLinks Badge Branding Configuration
 * Centralized styling for lanyard badges and other branded materials
 */

export const BADGE_BRANDING = {
  // Colors (using AlmaLinks theme)
  colors: {
    // Primary brand color
    primary: '#8B0000',
    // Secondary blue from gradient
    secondary: '#1E40AF',
    // Text colors
    textPrimary: '#1F2937', // Dark gray
    textSecondary: '#6B7280', // Medium gray
    // Background
    background: '#FFFFFF', // White
    // Accent for highlights
    accent: '#DC2626', // Red-600
    // QR code area background
    qrBackground: '#F9FAFB', // Very light gray
  },

  // Typography
  fonts: {
    // Primary font stack (system fallbacks)
    primary: ['Helvetica', 'Arial', 'sans-serif'],
    // Font sizes (in points)
    nameSize: 18,
    companySize: 12,
    linkedinSize: 10,
  },

  // Layout (in millimeters)
  layout: {
    // Page dimensions (A4)
    pageWidth: 210,
    pageHeight: 297,
    // Margins
    margin: 10,
    // Gutter between badges
    gutter: 10,
    // Badge grid (2x2)
    badgesPerRow: 2,
    badgesPerColumn: 2,
    // Computed badge dimensions
    badgeWidth: 90,  // (210 - 2*10 - 10) / 2 = 90
    badgeHeight: 133.5, // (297 - 2*10 - 10) / 2 = 133.5
    // Internal padding within each badge
    badgePadding: 5,
    // Logo dimensions
    logoWidth: 30,
    logoHeight: 12,
    // QR code area
    qrSize: 35,
  },

  // Asset paths
  assets: {
    logoPath: '/public/logo.png',
    fallbackLogo: '/public/W&G Logo.svg', // Fallback if logo.png doesn't exist
  },

  // Crop marks
  cropMarks: {
    length: 5, // Length of crop marks in mm
    offset: 2, // Distance from badge corner in mm
    strokeWidth: 0.5, // Line width in points
    color: '#000000', // Black
  }
};

/**
 * Convert millimeters to points (PDF unit)
 * 1mm = 2.83465 points
 */
export const mm = (millimeters: number): number => {
  return millimeters * 2.83465;
};

/**
 * Convert points to millimeters
 * 1 point = 0.352778 mm
 */
export const pt = (points: number): number => {
  return points * 0.352778;
};

/**
 * Calculate badge positions on the page
 * Returns array of {x, y} positions for each badge
 */
export const calculateBadgePositions = () => {
  const { layout } = BADGE_BRANDING;
  const positions = [];
  
  for (let row = 0; row < layout.badgesPerColumn; row++) {
    for (let col = 0; col < layout.badgesPerRow; col++) {
      const x = layout.margin + col * (layout.badgeWidth + layout.gutter);
      const y = layout.margin + row * (layout.badgeHeight + layout.gutter);
      positions.push({ x, y });
    }
  }
  
  return positions;
};

/**
 * Calculate crop mark positions for a badge
 */
export const calculateCropMarks = (badgeX: number, badgeY: number) => {
  const { layout, cropMarks } = BADGE_BRANDING;
  const marks = [];
  
  // Top-left corner
  marks.push(
    // Horizontal line (left)
    { 
      x1: badgeX - cropMarks.offset - cropMarks.length, 
      y1: badgeY - cropMarks.offset,
      x2: badgeX - cropMarks.offset,
      y2: badgeY - cropMarks.offset 
    },
    // Vertical line (top)
    { 
      x1: badgeX - cropMarks.offset, 
      y1: badgeY - cropMarks.offset - cropMarks.length,
      x2: badgeX - cropMarks.offset,
      y2: badgeY - cropMarks.offset 
    }
  );
  
  // Top-right corner
  marks.push(
    // Horizontal line (right)
    { 
      x1: badgeX + layout.badgeWidth + cropMarks.offset, 
      y1: badgeY - cropMarks.offset,
      x2: badgeX + layout.badgeWidth + cropMarks.offset + cropMarks.length,
      y2: badgeY - cropMarks.offset 
    },
    // Vertical line (top)
    { 
      x1: badgeX + layout.badgeWidth + cropMarks.offset, 
      y1: badgeY - cropMarks.offset - cropMarks.length,
      x2: badgeX + layout.badgeWidth + cropMarks.offset,
      y2: badgeY - cropMarks.offset 
    }
  );
  
  // Bottom-left corner
  marks.push(
    // Horizontal line (left)
    { 
      x1: badgeX - cropMarks.offset - cropMarks.length, 
      y1: badgeY + layout.badgeHeight + cropMarks.offset,
      x2: badgeX - cropMarks.offset,
      y2: badgeY + layout.badgeHeight + cropMarks.offset 
    },
    // Vertical line (bottom)
    { 
      x1: badgeX - cropMarks.offset, 
      y1: badgeY + layout.badgeHeight + cropMarks.offset,
      x2: badgeX - cropMarks.offset,
      y2: badgeY + layout.badgeHeight + cropMarks.offset + cropMarks.length 
    }
  );
  
  // Bottom-right corner
  marks.push(
    // Horizontal line (right)
    { 
      x1: badgeX + layout.badgeWidth + cropMarks.offset, 
      y1: badgeY + layout.badgeHeight + cropMarks.offset,
      x2: badgeX + layout.badgeWidth + cropMarks.offset + cropMarks.length,
      y2: badgeY + layout.badgeHeight + cropMarks.offset 
    },
    // Vertical line (bottom)
    { 
      x1: badgeX + layout.badgeWidth + cropMarks.offset, 
      y1: badgeY + layout.badgeHeight + cropMarks.offset,
      x2: badgeX + layout.badgeWidth + cropMarks.offset,
      y2: badgeY + layout.badgeHeight + cropMarks.offset + cropMarks.length 
    }
  );
  
  return marks;
};