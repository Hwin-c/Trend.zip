import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, addDoc, deleteDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { ParentGenre, HomeTrendingMetadata, AllGenresMetadata, Track } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const saveLogToFirestore = async (userId: string, log: any[]) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
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
  try {
    const logsRef = collection(db, 'digging_logs');
    const q = userId ? query(logsRef, where("userId", "==", userId)) : query(logsRef);
    const snapshot = await getDocs(q);
    
    const validDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt.toMillis() < now) {
        deleteDoc(doc.ref); 
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

// --- Fetch Metadata (Extreme Denormalization) ---

export const fetchHomeTrending = async (): Promise<HomeTrendingMetadata | null> => {
  try {
    const docRef = doc(db, 'metadata', 'home_trending');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as HomeTrendingMetadata;
    }
    return null;
  } catch (error) {
    console.error("Error fetching home trending:", error);
    return null;
  }
};

export const fetchAllGenresMetadata = async (): Promise<AllGenresMetadata | null> => {
  try {
    const docRef = doc(db, 'metadata', 'all_parent_genres');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as AllGenresMetadata;
    }
    return null;
  } catch (error) {
    console.error("Error fetching all genres metadata:", error);
    return null;
  }
};

export const fetchParentGenreById = async (genreId: string): Promise<ParentGenre | null> => {
  try {
    const docRef = doc(db, 'parent_genres', genreId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as ParentGenre;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching parent_genre ${genreId}:`, error);
    return null;
  }
};

export const fetchAllParentGenres = async (): Promise<ParentGenre[]> => {
  try {
    const colRef = collection(db, 'parent_genres');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentGenre));
  } catch (error) {
    console.error("Error fetching all parent genres:", error);
    return [];
  }
};

export const fetchTracksByGenre = async (genreName: string, maxLimit: number = 20): Promise<Track[]> => {
  try {
    const tracksRef = collection(db, 'tracks');
    const q = query(
      tracksRef,
      where("Genre_List", "array-contains", genreName),
      orderBy("popularity_score", "desc"),
      limit(maxLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Track));
  } catch (error) {
    console.error(`Error fetching tracks for genre ${genreName}:`, error);
    return [];
  }
};
