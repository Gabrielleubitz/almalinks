/**
 * Remove undefined values from an object recursively
 * Firestore does not allow undefined values - only null or omitted fields
 * 
 * @param obj - Object to sanitize
 * @param removeEmptyStrings - If true, also removes empty string values (default: false)
 * @returns New object with undefined values removed
 */
export function removeUndefined<T extends Record<string, any>>(
  obj: T,
  removeEmptyStrings: boolean = false
): Partial<T> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item, removeEmptyStrings)) as any;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined values
    if (value === undefined) {
      continue;
    }
    
    // Optionally skip empty strings
    if (removeEmptyStrings && value === '') {
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sanitizedNested = removeUndefined(value, removeEmptyStrings);
      // Only include if nested object has at least one property
      if (Object.keys(sanitizedNested).length > 0) {
        sanitized[key] = sanitizedNested;
      }
    } else if (Array.isArray(value)) {
      // Sanitize array items
      const sanitizedArray = value.map(item => 
        typeof item === 'object' && item !== null 
          ? removeUndefined(item, removeEmptyStrings)
          : item
      ).filter(item => item !== undefined);
      if (sanitizedArray.length > 0) {
        sanitized[key] = sanitizedArray;
      }
    } else {
      // Include primitive values (string, number, boolean, null, Date, etc.)
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize an object for Firestore write operations
 * Removes undefined values and optionally empty strings
 * 
 * @param data - Data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object safe for Firestore
 */
export function sanitizeForFirestore<T extends Record<string, any>>(
  data: T,
  options: {
    removeEmptyStrings?: boolean;
    keepNull?: boolean; // Keep null values (default: true)
  } = {}
): Partial<T> {
  const { removeEmptyStrings = false, keepNull = true } = options;
  
  const sanitized = removeUndefined(data, removeEmptyStrings);
  
  // If keepNull is false, also remove null values
  if (!keepNull) {
    const withoutNull: any = {};
    for (const [key, value] of Object.entries(sanitized)) {
      if (value !== null) {
        withoutNull[key] = value;
      }
    }
    return withoutNull;
  }
  
  return sanitized;
}
