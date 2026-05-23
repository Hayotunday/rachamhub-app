import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate required config values
const requiredKeys = ["apiKey", "authDomain", "projectId"] as const;
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.warn(
    `[Firebase] Missing environment variables: ${missingKeys.join(", ")}. ` +
      `Please set NEXT_PUBLIC_FIREBASE_* variables in your .env.local file.`,
  );
}

// Only initialize Firebase if we have required config (client-side only)
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: Firestore | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (
  typeof window !== "undefined" &&
  requiredKeys.every((key) => firebaseConfig[key])
) {
  try {
    // Initialize Firebase (only once)
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // Initialize Auth
    auth = getAuth(app);

    // Set persistence for web
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("[Firebase Auth] Failed to set persistence:", err);
    });

    // Initialize Firestore with modern persistent cache configuration
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({}),
        }),
      });
      console.log("[Firestore] Initialized");
    } catch (err) {
      console.error("[Firestore] Failed to initialize:", err);
      db = null;
    }

    // Initialize Storage
    storage = getStorage(app);
    console.log(
      "[Firebase] Init status - Auth:",
      !!auth,
      "Firestore:",
      !!db,
      "Storage:",
      !!storage,
    );
  } catch (error) {
    console.error("[Firebase] Initialization error:", error);
  }
}

export { app, auth, db, storage };
