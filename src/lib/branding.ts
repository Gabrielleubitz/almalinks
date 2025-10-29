/**
 * AlmaLinks Brand System for Badge Generation
 * Professional specifications for consistent branding across all materials
 */

// Brand Colors (exact specifications)
export const BRAND_COLORS = {
  // Primary brand colors
  wine: '#7A1E1E',
  charcoal: '#11151A', 
  light: '#F7F5F3',
  mutedText: '#4B5563',
  
  // Supporting colors
  white: '#FFFFFF',
  black: '#000000',
  
  // Role-based chip colors
  roles: {
    organizer: '#7A1E1E',  // Wine
    speaker: '#C27803',    // Amber
    sponsor: '#0E7490',    // Cyan
    vip: '#6D28D9',        // Purple
    staff: '#374151',      // Gray
    attendee: '#475569',   // Slate
  },
} as const;

// Typography System
export const TYPOGRAPHY = {
  // Font stacks (Inter first to match website)
  fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
  
  // Font sizes (in points)
  name: {
    max: 44,
    ideal: 36,
    min: 26,
    step: 2, // Reduction step for long names
  },
  company: {
    size: 18,
  },
  linkedin: {
    size: 13,
  },
  header: {
    size: 16,
  },
  roleChip: {
    normal: 14,
    reduced: 12, // When name is very long
  },
  
  // Text styling
  letterSpacing: {
    normal: '0',
    tight: '-0.025em', // For role chips
    header: '0.02em',
  },
  
  lineHeight: {
    tight: 0.9,
    normal: 1.2,
  },
} as const;

// Layout System (all measurements in mm)
export const LAYOUT = {
  // Page specifications
  page: {
    width: 210,
    height: 297,
    margin: 10,
  },
  
  // Grid system
  grid: {
    cols: 2,
    rows: 2,
    gutter: 10,
  },
  
  // Badge specifications
  badge: {
    width: 90,
    height: 133.5,
    padding: 6, // Internal content padding
    bleed: 3,   // Optional bleed for edge-to-edge cutting
  },
  
  // Exact badge positions (as specified)
  positions: [
    { x: 10, y: 10 },      // Top-left
    { x: 110, y: 10 },     // Top-right  
    { x: 10, y: 153.5 },   // Bottom-left
    { x: 110, y: 153.5 },  // Bottom-right
  ],
  
  // Header band
  header: {
    height: 13,     // 12-14mm as specified
    logoHeight: 9,  // Logo within header
    logoWidth: 12,  // Estimated logo width
    textOffset: 2,  // Vertical text alignment
  },
  
  // Role chip specifications
  roleChip: {
    height: 10,
    paddingH: 4,
    radius: 3,
    marginTop: 2,   // Space from header
    marginRight: 6, // Distance from badge edge
  },
  
  // QR code specifications
  qr: {
    tileSize: 38,   // White tile size
    codeSize: 32,   // Actual QR code size
    padding: 3,     // Tile padding (38-32)/2 = 3
    margin: 8,      // Distance from badge edges
    quietZone: 4,   // Minimum quiet zone modules
  },
  
  // Content spacing
  content: {
    nameTop: 28,        // Distance from top to name
    companyGap: 4,      // Gap between name and company
    linkedinGap: 3,     // Gap between company and LinkedIn
  },
  
  // Crop marks
  cropMarks: {
    length: 5,
    offset: 2,
    thickness: 0.5,
  },
  
  // Background specifications
  background: {
    opacity: 0.15,     // 12-18% as specified
    overlayOpacity: 0.25, // Dark overlay for contrast
  },
} as const;

// Asset paths
export const ASSETS = {
  logo: '/logo.svg',
  logoWhite: '/logo-white.svg', 
  eventHero: '/event-hero.jpg',
} as const;

// Print specifications
export const PRINT_SPECS = {
  dpi: 300,
  mmToPoints: 2.83465,
  qrErrorCorrection: 'H', // High error correction as specified
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
 * Fit text to maximum width with stepwise font reduction
 */
export const fitText = (
  text: string, 
  maxWidthPt: number, 
  maxSizePt: number, 
  minSizePt: number,
  estimatedCharWidth: number = 0.6 // Approximate character width ratio
): number => {
  let fontSize = maxSizePt;
  const step = TYPOGRAPHY.name.step;
  
  while (fontSize >= minSizePt) {
    const estimatedWidth = text.length * estimatedCharWidth * fontSize;
    if (estimatedWidth <= maxWidthPt) {
      return fontSize;
    }
    fontSize -= step;
  }
  
  return minSizePt;
};

/**
 * Normalize attendee role for chip color mapping
 */
export const getRole = (attendee: {
  role?: string;
  ticket_type?: string;
  tags?: string[];
  badgeRole?: string; // New field for manually assigned badge roles
}): keyof typeof BRAND_COLORS.roles => {
  // Check for manually assigned badge role first (highest priority)
  if (attendee.badgeRole && attendee.badgeRole.trim()) {
    const badgeRole = attendee.badgeRole.toLowerCase().trim();
    if (badgeRole in BRAND_COLORS.roles) {
      return badgeRole as keyof typeof BRAND_COLORS.roles;
    }
  }
  
  // Direct role mapping
  if (attendee.role && attendee.role.trim()) {
    const role = attendee.role.toLowerCase().trim();
    if (role in BRAND_COLORS.roles) {
      return role as keyof typeof BRAND_COLORS.roles;
    }
  }
  
  // Infer from ticket_type
  if (attendee.ticket_type && attendee.ticket_type.trim()) {
    const ticketType = attendee.ticket_type.toLowerCase();
    for (const [roleKey] of Object.entries(BRAND_COLORS.roles)) {
      if (ticketType.includes(roleKey)) {
        return roleKey as keyof typeof BRAND_COLORS.roles;
      }
    }
  }
  
  // Infer from tags
  if (attendee.tags && Array.isArray(attendee.tags) && attendee.tags.length > 0) {
    for (const tag of attendee.tags) {
      const tagLower = tag.toLowerCase();
      for (const [roleKey] of Object.entries(BRAND_COLORS.roles)) {
        if (tagLower.includes(roleKey)) {
          return roleKey as keyof typeof BRAND_COLORS.roles;
        }
      }
    }
  }
  
  // Default to attendee
  return 'attendee';
};

/**
 * Get role chip color
 */
export const getRoleColor = (role: keyof typeof BRAND_COLORS.roles): string => {
  return BRAND_COLORS.roles[role];
};

/**
 * Format text for display (Title Case for names, sentence case for company)
 */
export const formatText = {
  name: (text: string): string => {
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },
  
  company: (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },
  
  roleChip: (text: string): string => {
    return text.toUpperCase();
  },
};

/**
 * Calculate QR positioning to avoid overlaps
 */
export const getQRPosition = (badgeX: number, badgeY: number) => {
  const { badge, qr } = LAYOUT;
  
  return {
    tileX: badgeX + badge.width - qr.tileSize - qr.margin,
    tileY: badgeY + badge.height - qr.tileSize - qr.margin,
    codeX: badgeX + badge.width - qr.tileSize - qr.margin + qr.padding,
    codeY: badgeY + badge.height - qr.tileSize - qr.margin + qr.padding,
  };
};

/**
 * Calculate role chip positioning to avoid overlaps
 */
export const getRoleChipPosition = (
  badgeX: number, 
  badgeY: number, 
  chipWidth: number
) => {
  const { badge, header, roleChip } = LAYOUT;
  
  return {
    x: badgeX + badge.width - chipWidth - roleChip.marginRight,
    y: badgeY + badge.height - header.height - roleChip.height - roleChip.marginTop,
  };
};

/**
 * Get content area boundaries (avoiding QR and role chip)
 */
export const getContentArea = (badgeX: number, badgeY: number) => {
  const { badge, qr, roleChip } = LAYOUT;
  
  return {
    x: badgeX + badge.padding,
    y: badgeY + badge.padding,
    width: badge.width - (2 * badge.padding),
    height: badge.height - (2 * badge.padding),
    maxTextWidth: badge.width - (2 * badge.padding) - qr.tileSize - qr.margin,
  };
};

/**
 * Calculate crop marks for a badge
 */
export const calculateCropMarks = (badgeX: number, badgeY: number) => {
  const { badge, cropMarks } = LAYOUT;
  const marks = [];
  
  // Corner positions
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
 * Validate attendee data for badge generation
 */
export const validateAttendee = (attendee: any): boolean => {
  return Boolean(
    attendee &&
    (attendee.first_name || attendee.last_name) && // At least one name
    attendee.ticket_url // Required for QR code
  );
};

export default {
  BRAND_COLORS,
  TYPOGRAPHY,
  LAYOUT,
  ASSETS,
  PRINT_SPECS,
  mm,
  pt,
  fitText,
  getRole,
  getRoleColor,
  formatText,
  getQRPosition,
  getRoleChipPosition,
  getContentArea,
  calculateCropMarks,
  validateAttendee,
};