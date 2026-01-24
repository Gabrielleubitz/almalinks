import { Client } from '@hubspot/api-client';

/**
 * HubSpot API Client
 * 
 * Creates a HubSpot client instance using the private app token.
 * This should only be used in server-side code (API routes, server components).
 * 
 * Requires: HUBSPOT_PRIVATE_APP_TOKEN environment variable
 */
export function getHubSpotClient(): Client {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error('HUBSPOT_PRIVATE_APP_TOKEN is not configured');
  }

  return new Client({ accessToken: token });
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate required fields for contact creation
 */
export function validateContactData(data: Record<string, any>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

