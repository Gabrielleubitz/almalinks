# Auto-Connect Database Schema Design

## Overview
Replace scan-to-connect with automatic connections when users register for the same event, plus a global directory for manual connections.

## Database Collections

### 1. users (existing - enhanced)
```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  work: string;
  position: string;
  linkedinUsername?: string;
  profileImage?: string;
  
  // NEW FIELDS
  discoverability: 'public' | 'event_only' | 'hidden'; // default: 'event_only'
  discoverabilityConsented: boolean; // default: false
  discoverabilityConsentedAt?: Timestamp;
  
  // Rate limiting
  dailyConnectRequests: number; // reset daily
  lastRequestDate: string; // YYYY-MM-DD format
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2. events (existing - enhanced)
```typescript
interface Event {
  id: string;
  name: string;
  slug: string;
  location: string;
  date: string;
  description: string;
  imageUrl: string;
  status: 'active' | 'non-active' | 'sold-out' | 'completed';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // NEW FIELDS
  autoConnectEnabled: boolean; // default: true
}
```

### 3. events/{eventId}/registrations (existing - no changes needed)
```typescript
interface EventRegistration {
  name: string;
  email: string;
  phone: string;
  work: string;
  registeredAt: Timestamp;
  qrCodeUrl?: string;  // legacy field name; stores connection URL
  checkedIn?: boolean;
  checkedInAt?: Timestamp;
  checkedInBy?: string;
  profileImage?: string;
}
```

### 4. connections (existing - enhanced)
```typescript
interface Connection {
  id: string;
  fromUid: string;
  toUid: string;
  eventId: string; // Can be null for global directory connections
  connectionType: 'auto' | 'manual' | 'scan'; // NEW: track connection source
  timestamp: Timestamp;
  
  // Enriched user data (existing)
  fromName?: string;
  toName?: string;
  fromWork?: string;
  toWork?: string;
  fromPosition?: string;
  toPosition?: string;
  fromLinkedin?: string;
  toLinkedin?: string;
  fromEmail?: string;
  toEmail?: string;
  fromProfileImage?: string;
  toProfileImage?: string;
}
```

### 5. connection_requests (NEW - for manual connections)
```typescript
interface ConnectionRequest {
  id: string;
  fromUid: string;
  toUid: string;
  eventId?: string; // Optional - for event-based requests
  message?: string; // Optional message from sender
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  respondedAt?: Timestamp;
  
  // Enriched user data at time of request
  fromName: string;
  fromWork: string;
  fromPosition?: string;
  fromProfileImage?: string;
}
```

### 6. user_directory (NEW - for optimized global directory)
```typescript
interface UserDirectoryEntry {
  uid: string;
  name: string;
  work: string;
  position?: string;
  profileImage?: string;
  discoverability: 'public' | 'event_only' | 'hidden';
  lastActive: Timestamp;
  eventIds: string[]; // Events user is registered for
  
  // Search optimization
  searchTokens: string[]; // Tokenized name, work for search
  
  updatedAt: Timestamp;
}
```

## Privacy Control Implementation

### Discoverability Levels:
1. **public**: Visible in global directory + event connections
2. **event_only**: Only visible to people who share an event  
3. **hidden**: Only visible to admins + existing connections

### Auto-Connect Rules:
1. When user registers for event with `autoConnectEnabled: true`
2. Auto-connect them with all other registrants based on discoverability:
   - **public** users: connect with everyone
   - **event_only** users: connect with everyone in same event
   - **hidden** users: no auto-connections (manual only)

### Rate Limiting:
- Manual connection requests: 50/day per user
- Reset daily at UTC midnight
- Track in user document: `dailyConnectRequests` and `lastRequestDate`

## Firestore Schema (Supabase alternative provided separately)

```typescript
// Firestore Collections
/users/{uid}
/events/{eventId}  
/events/{eventId}/registrations/{userUid}
/connections/{connectionId}
/connection_requests/{requestId}
/user_directory/{uid}
```

## Migration Strategy

1. Add new fields to existing users with defaults
2. Add new fields to existing events with defaults  
3. Create new collections for connection_requests and user_directory
4. Migrate existing connections to include connectionType: 'scan'
5. Populate user_directory from existing users
6. Show consent modal to existing users on first login

## Supabase Schema Alternative

```sql
-- Users table (enhanced)
ALTER TABLE users 
ADD COLUMN discoverability VARCHAR(20) DEFAULT 'event_only',
ADD COLUMN discoverability_consented BOOLEAN DEFAULT false,
ADD COLUMN discoverability_consented_at TIMESTAMP,
ADD COLUMN daily_connect_requests INTEGER DEFAULT 0,
ADD COLUMN last_request_date DATE;

-- Events table (enhanced)  
ALTER TABLE events
ADD COLUMN auto_connect_enabled BOOLEAN DEFAULT true;

-- Connections table (enhanced)
ALTER TABLE connections
ADD COLUMN connection_type VARCHAR(20) DEFAULT 'scan';

-- New tables
CREATE TABLE connection_requests (
    id VARCHAR(50) PRIMARY KEY,
    from_uid VARCHAR(50) REFERENCES users(uid),
    to_uid VARCHAR(50) REFERENCES users(uid), 
    event_id VARCHAR(50) REFERENCES events(id),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    from_name VARCHAR(255),
    from_work VARCHAR(255), 
    from_position VARCHAR(100),
    from_profile_image TEXT
);

CREATE TABLE user_directory (
    uid VARCHAR(50) PRIMARY KEY REFERENCES users(uid),
    name VARCHAR(255),
    work VARCHAR(255),
    position VARCHAR(100), 
    profile_image TEXT,
    discoverability VARCHAR(20),
    last_active TIMESTAMP,
    event_ids JSON,
    search_tokens JSON,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connection_requests_to_uid ON connection_requests(to_uid);
CREATE INDEX idx_connection_requests_from_uid ON connection_requests(from_uid);  
CREATE INDEX idx_user_directory_discoverability ON user_directory(discoverability);
CREATE INDEX idx_user_directory_search ON user_directory USING gin(search_tokens);
```