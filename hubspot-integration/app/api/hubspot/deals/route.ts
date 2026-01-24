import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot';
import type { HubSpotDeal, HubSpotApiResponse, HubSpotDealResponse } from '@/types/hubspot';

/**
 * POST /api/hubspot/deals
 * 
 * Creates a new deal in HubSpot.
 * 
 * Request body:
 * {
 *   dealname: string (required) - Name of the deal
 *   dealstage?: string - Deal stage ID
 *   pipeline?: string - Pipeline ID
 *   amount?: string - Deal amount
 *   closedate?: string - Expected close date (ISO format)
 *   associatedcompanyid?: string - Associated company ID
 *   associatedcontactids?: string[] - Array of associated contact IDs
 *   ... (any other HubSpot deal properties)
 * }
 * 
 * Returns:
 * - 200: Deal created successfully
 * - 400: Validation error
 * - 500: Server error
 * 
 * Note: This is an optional feature. Remove if you don't need deal creation.
 */
export async function POST(request: NextRequest) {
  try {
    const body: HubSpotDeal = await request.json();

    // Validate required fields
    if (!body.dealname || typeof body.dealname !== 'string') {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          errors: [{
            message: 'dealname is required',
            status: 'VALIDATION_ERROR',
            category: 'VALIDATION',
          }],
        },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();

    // Prepare deal data
    const dealData = {
      properties: {
        dealname: body.dealname,
        ...(body.dealstage && { dealstage: body.dealstage }),
        ...(body.pipeline && { pipeline: body.pipeline }),
        ...(body.amount && { amount: body.amount }),
        ...(body.closedate && { closedate: body.closedate }),
        // Allow additional properties
        ...Object.fromEntries(
          Object.entries(body).filter(([key]) => 
            !['dealname', 'dealstage', 'pipeline', 'amount', 'closedate', 'associatedcompanyid', 'associatedcontactids'].includes(key)
          )
        ),
      },
      associations: [
        ...(body.associatedcompanyid ? [{
          to: { id: body.associatedcompanyid },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 5 }], // Company to Deal
        }] : []),
        ...(body.associatedcontactids?.map(contactId => ({
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }], // Contact to Deal
        })) || []),
      ],
    };

    const response = await hubspot.crm.deals.basicApi.create(dealData);

    return NextResponse.json<HubSpotApiResponse<HubSpotDealResponse>>(
      {
        success: true,
        data: {
          id: response.id,
          properties: response.properties as HubSpotDeal,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[HubSpot API] Error creating deal:', error);

    if (error.body) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: error.message || 'Failed to create deal',
          errors: Array.isArray(error.body.errors) ? error.body.errors : [{
            message: error.body.message || 'Unknown error',
            status: error.body.status || 'ERROR',
            category: error.body.category || 'API_ERROR',
          }],
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json<HubSpotApiResponse>(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

