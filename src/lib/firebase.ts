import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp, deleteDoc, doc } from 'firebase/firestore';

// Check if we have a config. In AI Studio, this is usually injected or provided by the user.
// Since provisioning failed, we might not have these.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock_project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

const isMock = firebaseConfig.apiKey === "mock_key";

let app, auth, db;

if (!isMock) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn("Firebase config is missing. Using mock implementation.");
}

export { auth, db, isMock };

// --- Mock Implementations for when Firebase is not configured ---

export const mockSignIn = async () => {
  console.log("Mock Sign In");
  return { user: { uid: 'mock_user_1', displayName: 'Mock User', email: 'mock@example.com' } };
};

export const mockSignOut = async () => {
  console.log("Mock Sign Out");
};

export const saveLogToFirestore = async (userId: string, log: any[]) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  if (isMock) {
    const logId = `mock_log_${userId}_${Date.now()}`;
    localStorage.setItem(logId, JSON.stringify({ 
      log, 
      createdAt: Date.now(),
      expiresAt: expiresAt.getTime()
    }));
    return;
  }
  
  try {
    const logsRef = collection(db, 'digging_logs');
    await addDoc(logsRef, {
      userId,
      log,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt)
    });
  } catch (error) {
    console.error("Error saving log to Firestore:", error);
  }
};

export const getLogsFromFirestore = async (userId?: string) => {
  const now = Date.now();
  if (isMock) {
    const logs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mock_log_')) {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        // Check expiration
        if (data.expiresAt && data.expiresAt < now) {
          localStorage.removeItem(key);
          continue;
        }
        logs.push({ id: key, userId: key.split('_')[2], ...data });
      }
    }
    return userId ? logs.filter(l => l.userId === userId) : logs;
  }

  try {
    const logsRef = collection(db, 'digging_logs');
    const q = userId ? query(logsRef, where("userId", "==", userId)) : query(logsRef);
    const snapshot = await getDocs(q);
    
    // Filter out expired logs for Firestore as well (though usually done via TTL policy)
    const validDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt.toMillis() < now) {
        deleteDoc(doc.ref); // Clean up expired doc
        return false;
      }
      return true;
    });

    return validDocs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting logs from Firestore:", error);
    return [];
  }
};
