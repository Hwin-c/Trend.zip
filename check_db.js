import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "mock_key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mock_project",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: process.env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snapshot = await getDocs(query(collection(db, 'test_tracks'), limit(1)));
  if (snapshot.empty) {
    console.log("No documents in test_tracks");
  } else {
    console.log(snapshot.docs[0].data());
  }
}

check().catch(console.error);
