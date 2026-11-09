const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let firestoreDb = null;
let isFirestoreReady = false;

function initFirebase() {
  if (firestoreDb) return firestoreDb;

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'serviceAccountKey.json');

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firestoreDb = admin.firestore();
      isFirestoreReady = true;
      console.log(`🔥 Firebase Admin initialized successfully via ${path.basename(serviceAccountPath)}!`);
      console.log(`🗄️ Firestore Project: ${serviceAccount.project_id}`);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Initialize via Environment Variables (Cloud / CI/CD)
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      firestoreDb = admin.firestore();
      isFirestoreReady = true;
      console.log(`🔥 Firebase Admin initialized successfully via Environment Variables!`);
      console.log(`🗄️ Firestore Project: ${process.env.FIREBASE_PROJECT_ID}`);
    } else {
      console.log('ℹ️ Firebase credentials not found (serviceAccountKey.json). Local SQLite database will be used as fallback.');
      isFirestoreReady = false;
    }
  } catch (err) {
    console.warn('⚠️ Firebase initialization warning:', err.message);
    isFirestoreReady = false;
  }

  return firestoreDb;
}

module.exports = {
  admin,
  initFirebase,
  getFirestore: () => firestoreDb || initFirebase(),
  isFirestoreReady: () => isFirestoreReady
};
