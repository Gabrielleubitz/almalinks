import { UserProfileForm, UserProfile } from '../types/user';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation (E.164 format or local)
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true; // Optional field
  
  // E.164 format: +[1-9]\d{1,14}
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  
  // Local format: allow digits, spaces, dashes, parentheses
  const localRegex = /^[\d\s\-\(\)]{7,}$/;
  
  return e164Regex.test(phone) || localRegex.test(phone);
};

// LinkedIn URL validation
export const isValidLinkedInUrl = (url: string): boolean => {
  if (!url) return true; // Optional field
  
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
  return linkedinRegex.test(url);
};

// General URL validation
export const isValidUrl = (url: string): boolean => {
  if (!url) return true; // Optional field
  
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
};

// Skills validation
export const validateSkills = (skills: string[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (skills.length > 12) {
    errors.push({
      field: 'skills',
      message: 'Maximum 12 skills allowed'
    });
  }
  
  skills.forEach((skill, index) => {
    if (skill.length < 2 || skill.length > 20) {
      errors.push({
        field: `skills[${index}]`,
        message: 'Each skill must be 2-20 characters'
      });
    }
  });
  
  return errors;
};

// IANA timezone validation (simplified - in production you'd use a proper timezone library)
export const isValidTimezone = (timezone: string): boolean => {
  if (!timezone) return true; // Optional field
  
  // Basic check for IANA format (continent/city or area/location)
  const timezoneRegex = /^[A-Z][a-z]+\/[A-Z][a-z_]+(\/?[A-Z][a-z_]*)*$/;
  return timezoneRegex.test(timezone);
};

// Validate individual field
export const validateField = (field: string, value: any): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  switch (field) {
    case 'firstName':
    case 'lastName':
      if (!value || value.trim().length === 0) {
        errors.push({ field, message: `${field === 'firstName' ? 'First name' : 'Last name'} is required` });
      } else if (value.length > 50) {
        errors.push({ field, message: `${field === 'firstName' ? 'First name' : 'Last name'} must be 50 characters or less` });
      }
      break;
      
    case 'displayName':
      if (!value || value.trim().length === 0) {
        errors.push({ field, message: 'Display name is required' });
      } else if (value.length > 100) {
        errors.push({ field, message: 'Display name must be 100 characters or less' });
      }
      break;
      
    case 'email':
      if (!value || value.trim().length === 0) {
        errors.push({ field, message: 'Email is required' });
      } else if (!isValidEmail(value)) {
        errors.push({ field, message: 'Please enter a valid email address' });
      }
      break;
      
    case 'phone':
      if (value && !isValidPhone(value)) {
        errors.push({ field, message: 'Please enter a valid phone number' });
      }
      break;
      
    case 'linkedin':
      if (value && !isValidLinkedInUrl(value)) {
        errors.push({ field, message: 'Please enter a valid LinkedIn URL' });
      }
      break;
      
    case 'website':
    case 'twitter':
      if (value && !isValidUrl(value)) {
        errors.push({ field, message: `Please enter a valid ${field} URL` });
      }
      break;
      
    case 'bioTitle':
      if (value && value.length > 60) {
        errors.push({ field, message: 'Bio title must be 60 characters or less' });
      }
      break;
      
    case 'bio':
      if (value && value.length > 400) {
        errors.push({ field, message: 'Bio must be 400 characters or less' });
      }
      break;
      
    case 'skills':
      errors.push(...validateSkills(value || []));
      break;
      
    case 'city':
    case 'country':
      if (value && value.length > 100) {
        errors.push({ field, message: `${field} must be 100 characters or less` });
      }
      break;
      
    case 'timezone':
      if (value && !isValidTimezone(value)) {
        errors.push({ field, message: 'Please select a valid timezone' });
      }
      break;
  }
  
  return errors;
};

// Validate entire form
export const validateUserProfile = (profile: Partial<UserProfileForm>): ValidationResult => {
  const allErrors: ValidationError[] = [];
  
  // Validate each field
  Object.entries(profile).forEach(([field, value]) => {
    const fieldErrors = validateField(field, value);
    allErrors.push(...fieldErrors);
  });
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};

// Calculate profile completion percentage
export const calculateProfileCompletion = (profile: UserProfile): number => {
  const totalFields = 16; // Total number of profile fields that count toward completion
  let completedFields = 0;
  
  // Required fields (must have these to count toward completion)
  const requiredFields = ['firstName', 'lastName', 'displayName', 'email'];
  for (const field of requiredFields) {
    if (profile[field as keyof UserProfile]) {
      completedFields++;
    } else {
      return 0; // If any required field is missing, completion is 0%
    }
  }
  
  // Optional fields that count toward completion
  const optionalFields = [
    'phone', 'linkedin', 'website', 'twitter', 'title', 'company',
    'bioTitle', 'bio', 'skills', 'city', 'country', 'timezone'
  ];
  
  for (const field of optionalFields) {
    const value = profile[field as keyof UserProfile];
    if (value && (Array.isArray(value) ? value.length > 0 : value.toString().trim().length > 0)) {
      completedFields++;
    }
  }
  
  return Math.round((completedFields / totalFields) * 100);
};

// Format field names for display
export const formatFieldName = (field: string): string => {
  const fieldNames: Record<string, string> = {
    firstName: 'First Name',
    lastName: 'Last Name',
    displayName: 'Display Name',
    bioTitle: 'Bio Title',
    showPhone: 'Show Phone Number',
    profileVisibility: 'Profile Visibility'
  };
  
  return fieldNames[field] || field.charAt(0).toUpperCase() + field.slice(1);
};

// Clean and normalize URLs
export const normalizeUrl = (url: string, type: 'linkedin' | 'website' | 'twitter'): string => {
  if (!url) return '';
  
  let normalized = url.trim();
  
  if (type === 'linkedin') {
    // Ensure LinkedIn URL is properly formatted
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }
    if (!normalized.includes('linkedin.com/in/')) {
      // Try to extract username and build proper URL
      const username = normalized.split('/').pop();
      normalized = `https://www.linkedin.com/in/${username}`;
    }
  } else {
    // For website and twitter, ensure proper protocol
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }
  }
  
  return normalized;
};