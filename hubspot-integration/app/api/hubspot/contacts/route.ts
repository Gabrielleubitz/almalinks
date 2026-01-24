import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient, validateContactData } from '@/lib/hubspot';
import type { HubSpotContact, HubSpotApiResponse, HubSpotContactResponse } from '@/types/hubspot';

/**
 * POST /api/hubspot/contacts
 * 
 * Creates or updates a HubSpot contact.
 * 
 * Request body:
 * {
 *   email: string (required)
 *   firstname?: string
 *   lastname?: string
 *   phone?: string
 *   company?: string
 *   website?: string
 *   jobtitle?: string
 *   ... (any other HubSpot contact properties)
 * }
 * 
 * Returns:
 * - 200: Contact created/updated successfully
 * - 400: Validation error
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: HubSpotContact = await request.json();

    // Validate input
    const validation = validateContactData(body);
    if (!validation.isValid) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          errors: validation.errors.map(msg => ({
            message: msg,
            status: 'VALIDATION_ERROR',
            category: 'VALIDATION',
          })),
        },
        { status: 400 }
      );
    }

    // Get HubSpot client
    const hubspot = getHubSpotClient();

    // Create or update contact
    // HubSpot automatically creates if doesn't exist, updates if exists (based on email)
    const contactData = {
      properties: {
        email: body.email,
        ...(body.firstname && { firstname: body.firstname }),
        ...(body.lastname && { lastname: body.lastname }),
        ...(body.phone && { phone: body.phone }),
        ...(body.company && { company: body.company }),
        ...(body.website && { website: body.website }),
        ...(body.jobtitle && { jobtitle: body.jobtitle }),
        // Allow any additional properties from the request
        ...Object.fromEntries(
          Object.entries(body).filter(([key]) => 
            !['email', 'firstname', 'lastname', 'phone', 'company', 'website', 'jobtitle'].includes(key)
          )
        ),
      },
    };

    const response = await hubspot.crm.contacts.basicApi.create(contactData);

    return NextResponse.json<HubSpotApiResponse<HubSpotContactResponse>>(
      {
        success: true,
        data: {
          id: response.id,
          properties: response.properties as HubSpotContact,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[HubSpot API] Error creating contact:', error);

    // Handle HubSpot API errors
    if (error.body) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: error.message || 'Failed to create contact',
          errors: Array.isArray(error.body.errors) ? error.body.errors : [{
            message: error.body.message || 'Unknown error',
            status: error.body.status || 'ERROR',
            category: error.body.category || 'API_ERROR',
          }],
        },
        { status: error.statusCode || 500 }
      );
    }

    // Handle other errors
    return NextResponse.json<HubSpotApiResponse>(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hubspot/contacts
 * 
 * Retrieves a contact by email (for testing/debugging).
 * 
 * Query params:
 * - email: string (required)
 * 
 * Note: This endpoint is optional and can be removed in production
 * if you don't need to retrieve contacts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Email query parameter is required',
        },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();
    const response = await hubspot.crm.contacts.basicApi.getByEmail(email);

    return NextResponse.json<HubSpotApiResponse<HubSpotContactResponse>>(
      {
        success: true,
        data: {
          id: response.id,
          properties: response.properties as HubSpotContact,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.statusCode === 404) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Contact not found',
        },
        { status: 404 }
      );
    }

    console.error('[HubSpot API] Error retrieving contact:', error);
    return NextResponse.json<HubSpotApiResponse>(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

