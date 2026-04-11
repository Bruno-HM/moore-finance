import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

let isInitialized = false;

try {
  let serviceAccount: any;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  }

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("✅ Firebase Admin SDK initialized successfully.");
    isInitialized = true;
  } else {
    console.error("❌ Firebase Admin SDK: No service account found!");
    console.error("Please add the FIREBASE_SERVICE_ACCOUNT environment variable in your hosting dashboard.");
  }
} catch (error) {
  console.error("❌ Firebase Admin SDK initialization failed:", error);
}

export const adminDb = isInitialized ? getFirestore() : null as any;
if (isInitialized && adminDb) {
  adminDb.settings({ ignoreUndefinedProperties: true });
}
export const adminAuth = isInitialized ? getAuth() : null as any;


