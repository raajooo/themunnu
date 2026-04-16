import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence, getDocFromServer, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with experimentalForceLongPolling to bypass potential WebSocket blocks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Connection Test
async function testConnection() {
  try {
    // Try to fetch a non-existent doc just to check connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore: Connection successful");
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("Firestore: Connection failed - check configuration or network.");
    }
  }
}
testConnection();

// Enable modern multi-tab persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    console.warn('Firestore persistence warning:', err.message);
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
