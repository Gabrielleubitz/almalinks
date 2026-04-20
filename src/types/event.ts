/**
 * Sensitive event details stored in events/{eventId}/privateDetails/details.
 * Read allowed only for admins or users with approved registration for that event.
 */
export interface EventPrivateDetails {
  locationText: string;
  /** Full street / venue address — shown only to approved registrants, calendar, and approval email. */
  venueAddress?: string | null;
  meetingUrl: string | null;
  locationType?: 'in_person' | 'virtual' | 'tbd';
  resourceLinkUrl?: string | null;
  resourceLinkLabel?: string | null;
  zoom_recording_url?: string | null;
  zoom_password?: string | null;
  pictures_url?: string | null;
  zoomRecordingUrl?: string | null;
  zoomPassword?: string | null;
  picturesUrl?: string | null;
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
