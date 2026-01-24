/**
 * HubSpot Type Definitions
 */

export interface HubSpotContact {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  website?: string;
  jobtitle?: string;
  [key: string]: any; // Allow additional custom properties
}

export interface HubSpotContactResponse {
  id: string;
  properties: HubSpotContact;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  dealname: string;
  dealstage?: string;
  pipeline?: string;
  amount?: string;
  closedate?: string;
  associatedcompanyid?: string;
  associatedcontactids?: string[];
  [key: string]: any;
}

export interface HubSpotDealResponse {
  id: string;
  properties: HubSpotDeal;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotApiError {
  message: string;
  status: string;
  category: string;
  subCategory?: string;
}

export interface HubSpotApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: HubSpotApiError[];
}

