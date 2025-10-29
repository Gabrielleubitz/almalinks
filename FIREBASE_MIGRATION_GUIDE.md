# Firebase Database Migration Guide

## ✅ Configuration Updated

I've successfully updated your Firebase configuration to use the new `alma-links-test` database:

### Updated Files:
- **`src/firebase/config.ts`** - Updated Firebase config with new credentials
- **`.env`** - Updated environment variables with new Firebase project

### New Configuration:
- **Project ID**: `alma-links-test`
- **Auth Domain**: `alma-links-test.firebaseapp.com`
- **Storage Bucket**: `alma-links-test.firebasestorage.app`
- **Analytics**: Added measurement ID for analytics tracking

## 🔥 What You Need to Do in Firebase Console

### 1. Set Up Firestore Database
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your `alma-links-test` project
3. Navigate to **Firestore Database**
4. Click **Create database**
5. Choose **Start in production mode** (recommended)
6. Select your preferred region (closest to your users)

### 2. Configure Firestore Security Rules
Set up the following security rules in Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Allow admins to read/write any user
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Events - public read, admin write
    match /events/{eventId} {
      allow read: if true; // Public read
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // Event registrations - users can register themselves
      match /registrations/{registrationId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Connections - users can read/write their own connections
    match /connections/{connectionId} {
      allow read: if request.auth != null && 
        (resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid);
      allow write: if request.auth != null && 
        (request.resource.data.fromUid == request.auth.uid || request.resource.data.toUid == request.auth.uid);
      // Allow admins to create any connections
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Connection requests - users can read/write their own
    match /connection_requests/{requestId} {
      allow read: if request.auth != null && 
        (resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid);
      allow write: if request.auth != null && 
        (request.resource.data.fromUid == request.auth.uid || request.resource.data.toUid == request.auth.uid);
    }
    
    // User directory - read for authenticated users, admin write
    match /user_directory/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.uid == userId ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'));
    }
  }
}
```

### 3. Enable Authentication
1. Go to **Authentication** in Firebase console
2. Click **Get started**
3. Enable **Email/Password** provider
4. Optionally enable other providers (Google, etc.)

### 4. Create Required Indexes
Go to **Firestore Database** → **Indexes** and create these composite indexes:

```javascript
// Connections by user and timestamp
Collection: connections
Fields: fromUid (Ascending), timestamp (Descending)

Collection: connections  
Fields: toUid (Ascending), timestamp (Descending)

// Connections by user, event, and timestamp
Collection: connections
Fields: fromUid (Ascending), eventId (Ascending), timestamp (Descending)

Collection: connections
Fields: toUid (Ascending), eventId (Ascending), timestamp (Descending)

// Connection requests by user and timestamp  
Collection: connection_requests
Fields: toUid (Ascending), status (Ascending), createdAt (Descending)

Collection: connection_requests
Fields: fromUid (Ascending), createdAt (Descending)

// User directory by discoverability
Collection: user_directory
Fields: discoverability (Ascending), lastActive (Descending)

// Events by status
Collection: events
Fields: status (in), (no additional fields needed)
```

### 5. Set Up Storage (if using file uploads)
1. Go to **Storage** in Firebase console
2. Click **Get started**
3. Choose **Start in production mode**
4. Set up storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can upload their own profile images
    match /profile_images/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Event images - admin only
    match /event_images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
        exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
        get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 📊 Data Migration Options

### Option 1: Start Fresh (Recommended for New Projects)
Your new database is empty, so you can start fresh with:
- New user registrations
- New events
- New connections

### Option 2: Export/Import Data (If You Have Existing Data)
If you have existing data to migrate:

1. **Export from old database:**
   ```bash
   # Install Firebase CLI if not already installed
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Export data from old project
   firebase firestore:export gs://wine-and-grind.firebasestorage.app/backup
   ```

2. **Import to new database:**
   ```bash
   # Set new project
   firebase use alma-links-test
   
   # Import data
   firebase firestore:import gs://alma-links-test.firebasestorage.app/backup
   ```

## 🔧 Development Setup

### Environment Variables
Your `.env` file has been updated. For production deployment, make sure to set these environment variables in your hosting platform:

```bash
VITE_FIREBASE_API_KEY=AIzaSyC6cvhqnPB04oiCnfI2eYRfZ8Wsdxojcb4
VITE_FIREBASE_AUTH_DOMAIN=alma-links-test.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=alma-links-test
VITE_FIREBASE_STORAGE_BUCKET=alma-links-test.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=993488312241
VITE_FIREBASE_APP_ID=1:993488312241:web:7fc18f59d3ec9457afcf90
VITE_FIREBASE_MEASUREMENT_ID=G-CBHYZHPBSC
```

### Test the Connection
After setting up Firestore, restart your development server:

```bash
npm run dev
```

The app should now connect to your new `alma-links-test` Firebase project.

## 🚀 Deployment Checklist

- [ ] Firestore database created in production mode
- [ ] Security rules configured
- [ ] Authentication enabled (Email/Password)
- [ ] Required indexes created
- [ ] Storage configured (if needed)
- [ ] Environment variables updated in production
- [ ] Test user registration and login
- [ ] Test event creation and registration
- [ ] Test connection functionality

## 🔍 Testing Your Setup

1. **Test Authentication:**
   - Register a new user
   - Login/logout functionality

2. **Test Database:**
   - Create an event (admin user)
   - Register for an event
   - Test auto-connections

3. **Test Admin Features:**
   - Access admin panel
   - User management
   - Connection management

## ⚠️ Important Notes

1. **New Database**: This is a completely new Firebase project, so all existing users and data will need to be recreated or migrated.

2. **Domain Configuration**: If you're using custom domains, update them in Firebase console under **Authentication** → **Settings** → **Authorized domains**.

3. **API Keys**: The API keys are now public in your repository. Consider using environment variables for sensitive configurations.

4. **Analytics**: Analytics is now enabled with measurement ID `G-CBHYZHPBSC`.

Your Firebase integration is now ready! Let me know if you encounter any issues during setup or if you need help with data migration.