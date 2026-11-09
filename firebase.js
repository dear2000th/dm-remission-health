const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let firestoreDb = null;
let isFirestoreReady = false;

function initFirebase() {
  if (firestoreDb) return firestoreDb;

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'serviceAccountKey.json');

    let app;
    if (getApps().length === 0) {
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        app = initializeApp({
          credential: cert(serviceAccount)
        });
        firestoreDb = getFirestore(app);
        isFirestoreReady = true;
        console.log(`🔥 Firebase Admin initialized successfully via ${path.basename(serviceAccountPath)}!`);
        console.log(`🗄️ Firestore Project: ${serviceAccount.project_id}`);
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        // Initialize via Environment Variables (Cloud / CI/CD)
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
          })
        });
        firestoreDb = getFirestore(app);
        isFirestoreReady = true;
        console.log(`🔥 Firebase Admin initialized successfully via Environment Variables!`);
        console.log(`🗄️ Firestore Project: ${process.env.FIREBASE_PROJECT_ID}`);
      } else {
        console.log('ℹ️ Firebase credentials not found (serviceAccountKey.json). Local SQLite database will be used as fallback.');
        isFirestoreReady = false;
      }
    } else {
      app = getApps()[0];
      firestoreDb = getFirestore(app);
      isFirestoreReady = true;
    }
  } catch (err) {
    console.warn('⚠️ Firebase initialization warning:', err.message);
    isFirestoreReady = false;
  }

  return firestoreDb;
}

module.exports = {
  initFirebase,
  getFirestore: () => firestoreDb || initFirebase(),
  isFirestoreReady: () => isFirestoreReady
};
