import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with experimentalForceLongPolling to avoid WebSocket/WebChannel connection failures in cloud/iframe environments
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Diagnostic connection test (non-blocking)
async function testConnection() {
  try {
    await getDoc(doc(db, 'test', 'connection'));
    console.log("Firestore connection initialized");
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.log("Firestore initialized (Public connectivity check restricted)");
    } else if (error?.message?.includes('offline') || error?.code === 'unavailable') {
      console.warn("Firestore operating in offline mode.");
    } else {
      console.log("Firestore status:", error?.message || error);
    }
  }
}

testConnection();

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

