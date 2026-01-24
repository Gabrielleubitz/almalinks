import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot';
import type { HubSpotApiResponse } from '@/types/hubspot';

/**
 * PATCH /api/hubspot/lifecycle
 * 
 * Updates a contact's lifecycle stage in HubSpot.
 * 
 * Request body:
 * {
 *   contactId: string (required) - HubSpot contact ID
 *   lifecycleStage: string (required) - Lifecycle stage value
 * }
 * 
 * Common lifecycle stages:
 * - "subscriber"
 * - "lead"
 * - "marketingqualifiedlead"
 * - "salesqualifiedlead"
 * - "opportunity"
 * - "customer"
 * - "evangelist"
 * - "other"
 * 
 * Returns:
 * - 200: Lifecycle stage updated successfully
 * - 400: Validation error
 * - 404: Contact not found
 * - 500: Server error
 * 
 * Note: This is an optional feature. Remove if you don't need lifecycle updates.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, lifecycleStage } = body;

    // Validate required fields
    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          errors: [{
            message: 'contactId is required',
            status: 'VALIDATION_ERROR',
            category: 'VALIDATION',
          }],
        },
        { status: 400 }
      );
    }

    if (!lifecycleStage || typeof lifecycleStage !== 'string') {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          errors: [{
            message: 'lifecycleStage is required',
            status: 'VALIDATION_ERROR',
            category: 'VALIDATION',
          }],
        },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();

    // Update contact lifecycle stage
    const updateData = {
      properties: {
        lifecyclestage: lifecycleStage,
      },
    };

    await hubspot.crm.contacts.basicApi.update(contactId, updateData);

    return NextResponse.json<HubSpotApiResponse>(
      {
        success: true,
        data: {
          contactId,
          lifecycleStage,
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[HubSpot API] Error updating lifecycle stage:', error);

    if (error.statusCode === 404) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: 'Contact not found',
        },
        { status: 404 }
      );
    }

    if (error.body) {
      return NextResponse.json<HubSpotApiResponse>(
        {
          success: false,
          error: error.message || 'Failed to update lifecycle stage',
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

