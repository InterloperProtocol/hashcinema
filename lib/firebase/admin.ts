import { getEnv } from "@/lib/env";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let cachedApp: App | null = null;

export function getFirebaseAdminApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const env = getEnv();

  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });

  return cachedApp;
}

export function getDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}
