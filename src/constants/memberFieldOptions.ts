/**
 * Canonical option lists for member application / profile fields.
 * Values must match HubSpot multi-select options exactly (semicolon-separated on sync).
 */

export const SPECIALTY_OPTIONS = [
  'AI',
  'Angel Investments',
  'Branding',
  'Business Development & Partnerships',
  'Capital Markets',
  'Consumer Goods',
  'Cyber Security',
  'Financial Management',
  'Fundraising',
  'Leadership',
  'M&As',
  'Machine Learning',
  'Management Consulting',
  'SaaS',
  'Sales',
  'Venture Investments',
  'other',
] as const;

export const INDUSTRY_OPTIONS = [
  'Accounting',
  'Ad-Tech',
  'Aerospace',
  'Agriculture',
  'Apparel & Fashion',
  'Banking',
  'Beauty & Cosmetics',
  'Biotechnology',
  'Cyber Security',
  'Education',
  'Fintech',
  'Healthcare',
  'IT',
  'Investments',
  'Legal',
  'Manufacturing',
  'Media & Entertainment',
  'Nonprofit',
  'Real Estate',
  'Supply Chain',
  'Technology',
  'Telecommunications',
  'Government & Defense',
  'Consulting',
  'Logistics',
] as const;

export const POSITION_OPTIONS = [
  'CEO',
  'Managing Partner',
  'President',
  'Founder',
  'CFO',
  'COO',
  'CMO',
  'CTO',
  'CRO',
  'CPO',
  'CSO',
  'VP Sales',
  'Head of Sales',
  'Director of Sales',
  'VP Product',
  'Head of Product',
  'VP Business Development',
  'Head of Partnerships',
  'Director of Business Development',
  'VP Operations',
  'Head of Operations',
  'Chairman',
  'Executive Chairman',
  'VP Marketing',
  'Head of Marketing',
  'Investor',
  'Venture Capitalist',
  'Angel Investor',
  'General Partner',
  'Limited Partner',
] as const;

export const LOOKING_TO_GAIN_OPTIONS = [
  'Connecting/exchanging information with members from my industry.',
  'Connecting with/learning from members in different industries.',
  'Mentorship.',
  'Connecting with people who are in similar professional roles.',
  'Expanding an existing business into new global markets (import/export).',
  'Exposure to new business opportunities.',
  'New job opportunities.',
  'Exposure to Israeli businesses.',
  'Exposure to businesses in cities worldwide.',
  'Deepening my involvement with Israeli causes.',
  'Deepening my involvement with the Jewish community.',
  'Investment opportunities.',
  'Resources to start a new venture, including identifying partners/co-founders.',
  'Raising capital for my venture.',
  'Strengthening my current professional skills.',
  'Learning new professional skills.',
] as const;

export const ASSIST_MEMBERS_PLACEHOLDER =
  'Knowledge and experience-sharing within your vertical/industry. Making strategic introductions/assisting members with global business development efforts. Exposing members to new business opportunities. Socializing with members. Investing in members\' businesses and/or introducing members to potential investors. Advising/mentoring members.';

/** Parse Firestore string (semicolon-separated) or array into selected values. */
export function parseMultiSelectValue(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (value == null || typeof value !== 'string') return [];
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Serialize for Firestore / display (HubSpot uses same format). */
export function formatMultiSelectValue(values: string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(';');
}
