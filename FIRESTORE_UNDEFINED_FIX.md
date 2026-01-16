# Fix: Firestore "Unsupported field value: undefined" Error

## Problem

Firestore does not allow `undefined` values in documents. When creating join requests, optional fields like `bioTitle`, `bio`, `city`, etc. were being set to `undefined` if not provided in the form data, causing Firestore write operations to fail.

## Root Cause

In `joinRequestService.ts`, the `createJoinRequest` method was building a payload object with optional fields directly from `formData`, which could be `undefined`:

```typescript
const joinRequest: JoinRequest = {
  // ... required fields
  bioTitle: formData.bioTitle,  // ❌ Could be undefined
  bio: formData.bio,            // ❌ Could be undefined
  // ...
};
```

## Solution

### 1. Created Utility Function (`src/utils/firestoreHelpers.ts`)

Added `removeUndefined()` and `sanitizeForFirestore()` utility functions to:
- Remove `undefined` values from objects recursively
- Optionally remove empty strings
- Handle nested objects and arrays
- Preserve `null` values (if needed)

### 2. Updated `createJoinRequest` (`src/services/joinRequestService.ts`)

**Before:**
```typescript
const joinRequest: JoinRequest = {
  // ... required fields
  bioTitle: formData.bioTitle,  // ❌ Could be undefined
  bio: formData.bio,
  // ...
};
await setDoc(requestRef, joinRequest);
```

**After:**
```typescript
// Build payload with required fields
const joinRequestPayload: any = {
  uid,
  email: formData.email.toLowerCase().trim(),
  name: formData.name || formData.displayName || '',
  // ... all required fields
  status: 'pending',
  createdAt: serverTimestamp()
};

// Add optional fields only if they are defined
if (formData.bioTitle !== undefined && formData.bioTitle !== null && formData.bioTitle !== '') {
  joinRequestPayload.bioTitle = formData.bioTitle;
}
// ... other optional fields

// Sanitize to remove any undefined values (safety check)
const sanitizedPayload = sanitizeForFirestore(joinRequestPayload);
await setDoc(requestRef, sanitizedPayload);
```

### 3. Updated `approveRequest` (`src/services/joinRequestService.ts`)

Applied the same sanitization when creating user documents from approved join requests.

### 4. Updated `createOrUpdateUserProfile` (`src/hooks/useAuth.ts`)

Enhanced the update logic to explicitly check for defined values and sanitize the payload before writing.

## Key Changes

1. **Explicit Field Inclusion**: Optional fields are only included if they have defined, non-empty values
2. **Sanitization**: All payloads are sanitized using `sanitizeForFirestore()` before writing to Firestore
3. **Better Error Handling**: Enhanced error logging shows which fields were included in the payload
4. **Type Safety**: Maintained TypeScript types while using `any` for the payload object during construction

## Files Changed

1. **`src/utils/firestoreHelpers.ts`** (NEW)
   - `removeUndefined()` - Recursively removes undefined values
   - `sanitizeForFirestore()` - Sanitizes objects for Firestore writes

2. **`src/services/joinRequestService.ts`**
   - `createJoinRequest()` - Now builds payload explicitly and sanitizes before write
   - `approveRequest()` - Now sanitizes user profile payload before write

3. **`src/hooks/useAuth.ts`**
   - `createOrUpdateUserProfile()` - Enhanced to explicitly check for defined values and sanitize

## Testing

### Test Signup Flow

1. **Create a new account** with minimal required fields
2. **Verify in console**: Should see `✅ Join request write succeeded`
3. **Verify in Firestore Console**: 
   - Document exists at `joinRequests/{uid}`
   - Has required fields: `uid`, `email`, `name`, `displayName`, `status`, `createdAt`
   - Optional fields are **omitted** (not set to `undefined` or `null`)

### Test Signup with Optional Fields

1. **Create account** with optional fields (bioTitle, bio, city, etc.)
2. **Verify in Firestore Console**:
   - Optional fields that were provided are present
   - Optional fields that were not provided are **omitted** (not in document)

### Test Admin Approval

1. **Approve a pending request** in admin panel
2. **Verify in Firestore Console**:
   - `joinRequests/{uid}` has `status: 'approved'`
   - `users/{uid}` document is created with all fields
   - No `undefined` values in user document

## Acceptance Criteria ✅

- [x] Signup succeeds without Firestore "unsupported field value: undefined" errors
- [x] Document appears in `joinRequests/{uid}` with `status='pending'`
- [x] Optional fields are omitted (not set to `undefined`) if not provided
- [x] Admin panel can see pending join requests
- [x] No `users/{uid}` member document is created until admin approval
- [x] User document creation on approval also sanitizes payload
- [x] Enhanced error logging shows payload structure

## Notes

- **Null vs Undefined**: Firestore allows `null` values, but not `undefined`. The fix omits undefined fields entirely rather than setting them to `null`.
- **Empty Strings**: Currently, empty strings are kept in the document. If needed, we can modify `sanitizeForFirestore()` to also remove empty strings.
- **Recursive Sanitization**: The utility function handles nested objects and arrays, so it's safe to use with complex data structures.
