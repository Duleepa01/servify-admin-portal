# Servify Admin Portal

> A web-based admin dashboard for managing the **Servify** platform — a service booking app connecting customers with professional service providers.

---

## Overview

The Servify Admin Portal is a responsive single-page web application built with vanilla JavaScript and Firebase. It gives platform administrators full control over providers, customers, services, and bookings — all in real time.

---

## Features

### Dashboard
- Live stats — Total Providers, Customers, Services, and Bookings
- At-a-glance overview of platform activity

### Provider Management
- View all registered service providers
- Approve or reject provider applications
- Revoke approved providers

### Customer Management
- View all registered customers
- Revoke or restore customer accounts

### Service Management
- Add new services with name, description, base price (LKR), duration, and image
- Edit existing services by double-clicking a row
- Toggle service active/inactive status
- Images uploaded and served via Firebase Storage

### Booking Management
- View all bookings with customer names resolved from Firestore
- Status badges (Pending, Confirmed, Completed, Cancelled)
- Sorted newest-first by timestamp

### Admin Profile
- View and edit personal info (name, username, email, phone, location)
- Upload profile photo (Firebase Storage)
- Change password with live strength meter and re-authentication
- Send password reset email
- Notification preferences
- Sign out all sessions

### Auth & Security
- Firebase Authentication with role-based access (`role: "admin"` in Firestore)
- Splash screen → auth check → redirect flow
- Protected routes — non-admins are bounced to sign-in

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript (ES Modules) |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| UI | Material Icons, custom CSS design system |
| Hosting | Firebase Hosting / Live Server (dev) |

---

## Project Structure

```
servify-admin/
├── index.html              # Main dashboard (all sections)
├── profile.html            # Admin profile page
├── splash.html             # Splash / loading screen
├── signin.html             # Sign in page
├── css/
│   ├── styles.css          # Global design system & components
│   └── profile.css         # Profile page styles
├── js/
│   ├── firebase.js         # Firebase app init & exports
│   ├── script.js           # Dashboard logic (providers, customers, services, bookings)
│   ├── profile.js          # Profile page logic
│   └── splash.js           # Splash auth routing
└── splash.css              # Splash screen styles
```

---

## Firebase Setup

### Firestore Collections

| Collection | Key Fields |
|---|---|
| `users` | `name`, `email`, `role`, `phone`, `location`, `photoURL`, `createdAt` |
| `providers` | `name`, `email`, `approved`, `rejected` |
| `services` | `serviceName`, `description`, `basePrice`, `estimatedDuration`, `imageUrl`, `active` |
| `bookings` | `userId`, `serviceName`, `price`, `status`, `timestamp` |

### Firestore Rules (recommended)
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Storage Rules
```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profilePhotos/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    match /serviceImages/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (for VS Code Live Server or Firebase CLI)
- A Firebase project with Firestore, Authentication, and Storage enabled
- VS Code with the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension

### 1. Clone the repo
```bash
git clone https://github.com/your-username/servify-admin.git
cd servify-admin
```

### 2. Configure Firebase
Replace the config object in `js/firebase.js` with your own Firebase project credentials:
```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Set the splash screen as default
Add this to `.vscode/settings.json`:
```json
{
  "liveServer.settings.file": "splash.html"
}
```

### 4. Create the first admin user
In Firebase Console → Firestore, manually create a document in the `users` collection:
```
users / {your-uid}
  name: "Admin"
  email: "admin@example.com"
  role: "admin"
```

### 5. Run
Right-click `splash.html` → **Open with Live Server**

---

## Android App

This admin portal is the web companion to the **Servify Android app** (Java), which allows customers to browse services, make bookings, and manage their profiles. Both share the same Firebase backend.

---

## Environment

Never commit your `firebase.js` config with real credentials to a public repository. Use environment variables or Firebase App Hosting secrets for production deployments.

Add this to `.gitignore`:
```
js/firebase.js
```
And provide a `js/firebase.example.js` with placeholder values for contributors.

---

## License

This project is licensed under the MIT License.

---

*Built using Firebase & vanilla JS*

---

## Firebase Configuration

A template is provided as `js/firebase.example.js`.

### Setup steps
1. Copy the example file:
```bash
cp js/firebase.example.js js/firebase.js
```
2. Replace the placeholder values in `js/firebase.js` with your real Firebase project credentials from the [Firebase Console](https://console.firebase.google.com/).

### `js/firebase.example.js`
```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

> ⚠️ Make sure `js/firebase.js` is listed in your `.gitignore` so your real credentials are never committed.
