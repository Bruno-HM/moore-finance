import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

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
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("Firebase Admin SDK: No service account found. Check process.env.FIREBASE_SERVICE_ACCOUNT or 'serviceAccountKey.json' file.");
  }
} catch (error) {
  console.error("Firebase Admin SDK initialization failed:", error);
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
