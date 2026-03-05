import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
import { GOOGLE_POPUP_TIMEOUT_MS, withAuthTimeout } from '@/lib/auth-flow';

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
export type AuthFailureCode =
  | 'popup_blocked'
  | 'popup_closed'
  | 'popup_timeout'
  | 'popup_cancelled'
  | 'invalid_credentials'
  | 'email_already_in_use'
  | 'weak_password'
  | 'too_many_requests'
  | 'network_error'
  | 'unknown';

export type AuthResult = {
  user: User | null;
  error: AuthError | Error | null;
  code: AuthFailureCode | null;
  timedOut?: boolean;
};

type PasswordResetResult = {
  success: boolean;
  error: AuthError | Error | null;
  code: AuthFailureCode | null;
};

function mapAuthCode(code?: string): AuthFailureCode {
  switch (code) {
    case 'auth/popup-blocked':
      return 'popup_blocked';
    case 'auth/popup-closed-by-user':
      return 'popup_closed';
    case 'auth/popup-timeout':
      return 'popup_timeout';
    case 'auth/cancelled-popup-request':
      return 'popup_cancelled';
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'invalid_credentials';
    case 'auth/email-already-in-use':
      return 'email_already_in_use';
    case 'auth/weak-password':
      return 'weak_password';
    case 'auth/too-many-requests':
      return 'too_many_requests';
    case 'auth/network-request-failed':
      return 'network_error';
    default:
      return 'unknown';
  }
}

// Sign in with Google
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    const result = await withAuthTimeout(
      signInWithPopup(auth, googleProvider),
      GOOGLE_POPUP_TIMEOUT_MS
    );
    return { user: result.user, error: null, code: null };
  } catch (error) {
    const authError = error as AuthError | Error;
    const code = mapAuthCode((authError as AuthError)?.code);
    const timedOut = (authError as { timedOut?: boolean }).timedOut === true || code === 'popup_timeout';
    console.error('Error signing in with Google', authError);
    return { user: null, error: authError, code, timedOut };
  }
};

// Sign in with email/password
export const signInWithEmailPassword = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null, code: null };
  } catch (error) {
    console.error("Error signing in with email/password", error);
    const authError = error as AuthError;
    return { user: null, error: authError, code: mapAuthCode(authError.code) };
  }
};

// Create user with email/password
export const createUserWithEmailPassword = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null, code: null };
  } catch (error) {
    console.error("Error creating user with email/password", error);
    const authError = error as AuthError;
    return { user: null, error: authError, code: mapAuthCode(authError.code) };
  }
};

// Sign in anonymously
export const signInAnonymously = async (): Promise<AuthResult> => {
  try {
    const result = await firebaseSignInAnonymously(auth);
    return { user: result.user, error: null, code: null };
  } catch (error) {
    console.error("Error signing in anonymously", error);
    const authError = error as AuthError;
    return { user: null, error: authError, code: mapAuthCode(authError.code) };
  }
};

export const sendPasswordResetEmailLink = async (email: string): Promise<PasswordResetResult> => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true, error: null, code: null };
  } catch (error) {
    const authError = error as AuthError;
    console.error('Error sending password reset email', authError);
    return { success: false, error: authError, code: mapAuthCode(authError.code) };
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
