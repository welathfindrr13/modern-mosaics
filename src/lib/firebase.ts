import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  AuthError,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore
} from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
  }
};

// Initialize Firebase with error handling
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  validateFirebaseConfig();
  
  // Initialize Firebase (singleton pattern)
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  
  console.log('Firebase initialized successfully for hosted services');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Auth providers
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Type for auth results
type AuthResult = {
  user: User | null;
  error: AuthError | null;
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    const authError = error as AuthError;
    console.error("Error signing in with Google", authError);
    
    // Handle specific Firebase Auth errors
    if (authError.code === 'auth/popup-blocked') {
      console.error('Popup was blocked by the browser');
    } else if (authError.code === 'auth/popup-closed-by-user') {
      console.error('Popup was closed by user');
    } else if (authError.code === 'auth/cancelled-popup-request') {
      console.error('Popup request was cancelled');
    }
    
    return { user: null, error: authError };
  }
};

// Sign in with email/password
export const signInWithEmailPassword = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("Error signing in with email/password", error);
    return { user: null, error: error as AuthError };
  }
};

// Create user with email/password
export const createUserWithEmailPassword = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("Error creating user with email/password", error);
    return { user: null, error: error as AuthError };
  }
};

// Sign in anonymously
export const signInAnonymously = async (): Promise<AuthResult> => {
  try {
    const result = await firebaseSignInAnonymously(auth);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("Error signing in anonymously", error);
    return { user: null, error: error as AuthError };
  }
};

// Sign out 
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error) {
    console.error("Error signing out", error);
    return { error };
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { app, auth, db };
