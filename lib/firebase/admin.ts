import { getEnv } from "@/lib/env";
import { App, applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let cachedApp: App | null = null;

function isLikelyPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith("your_") ||
    normalized.includes("placeholder") ||
    normalized.includes("...")
  );
}

function hasUsableServiceAccount(env: ReturnType<typeof getEnv>): boolean {
  return (
    !isLikelyPlaceholder(env.FIREBASE_CLIENT_EMAIL) &&
    !isLikelyPlaceholder(env.FIREBASE_PRIVATE_KEY)
  );
}

export function getFirebaseAdminApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const env = getEnv();

  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }

  cachedApp = initializeApp(
    hasUsableServiceAccount(env)
      ? {
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL!,
            privateKey: env.FIREBASE_PRIVATE_KEY!,
          }),
          storageBucket: env.FIREBASE_STORAGE_BUCKET,
        }
      : {
          credential: applicationDefault(),
          projectId: env.FIREBASE_PROJECT_ID,
          storageBucket: env.FIREBASE_STORAGE_BUCKET,
        },
  );

  return cachedApp;
}

export function getDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getBucket() {
  return getStorage(getFirebaseAdminApp()).bucket();
}
