/**
 * Sensitive event details stored in events/{eventId}/privateDetails/details.
 * Read allowed only for admins or users with approved registration for that event.
 */
export interface EventPrivateDetails {
  locationText: string;
  meetingUrl: string | null;
  locationType?: 'in_person' | 'virtual' | 'tbd';
  resourceLinkUrl?: string | null;
  resourceLinkLabel?: string | null;
}

/**
 * Event registration status for approval workflow.
 */
export type EventRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Event registration document (events/{eventId}/registrations/{userId}).
 * Extends legacy fields with approval workflow.
 */
export interface EventRegistrationWithStatus {
  userId: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  work: string;
  registeredAt: any;
  status: EventRegistrationStatus;
  createdAt?: any;
  updatedAt?: any;
  approvedAt?: any | null;
  approvedByAdminId?: string | null;
  rejectionReason?: string | null;
  emailSentAt?: any | null;
  checkedIn?: boolean;
  checkedInAt?: any;
  checkedInBy?: string;
  profileImage?: string | null;
  position?: string;
}
