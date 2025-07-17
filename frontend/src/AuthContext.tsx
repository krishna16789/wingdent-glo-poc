import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import {
    initializeApp,
    FirebaseApp
} from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    User,
    Auth,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    signInAnonymously, // Keep import for potential fallback or specific anonymous use
    signInWithCustomToken // Keep import for Canvas environment token
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    Firestore,
    serverTimestamp,
    Timestamp, // Import Timestamp
    FieldValue // Import FieldValue
} from 'firebase/firestore';

import { UserProfile, Appointment, Service, Offer, Address, Payment, Feedback, FeeConfiguration } from './types'; // Import all types

export interface AuthContextType {
    user: (User & { profile?: UserProfile }) | null;
    loading: boolean;
    message: { text: string; type: 'success' | 'error' | '' };
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, role?: UserProfile['role']) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    sendMagicLink: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    authMode: 'login' | 'signup' | 'otp';
    setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'signup' | 'otp'>>;
    authReady?: boolean;
    otpSent: boolean;
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    setMessage: React.Dispatch<React.SetStateAction<any>>;
    setOtpSent: React.Dispatch<React.SetStateAction<boolean>>;
    db: Firestore | null; // Expose db for direct use in components
    auth: Auth | null;   // Expose auth for direct use in components
    appId: string;       // Expose appId for Firestore paths
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the AuthContext
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// AuthProvider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<(User & { profile?: UserProfile }) | null>(null);
    const [loading, setLoading] = useState(true); // Keep loading true initially for Firebase init
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'otp'>('login');
    const [otpSent, setOtpSent] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [email, setEmail] = useState('');

    // Use refs to hold Firebase instances to avoid re-initialization issues
    const firebaseAppRef = useRef<FirebaseApp | null>(null);
    const firebaseAuthRef = useRef<Auth | null>(null);
    const firestoreDbRef = useRef<Firestore | null>(null);
    const appIdRef = useRef<string>('');

    // Canvas environment specific variables (if running in Canvas)
    const canvasAppId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
    const initialAuthToken = typeof (window as any).__initial_auth_token !== 'undefined' ? (window as any).__initial_auth_token : null;
    const canvasFirebaseConfig = typeof (window as any).__firebase_config !== 'undefined' ? JSON.parse((window as any).__firebase_config) : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
    };

    // Initialize Firebase on component mount
    useEffect(() => {
        let app: FirebaseApp;
        let authInstance: Auth;
        let dbInstance: Firestore;

        try {
            app = initializeApp(canvasFirebaseConfig);
            authInstance = getAuth(app);
            dbInstance = getFirestore(app);

            firebaseAppRef.current = app;
            firebaseAuthRef.current = authInstance;
            firestoreDbRef.current = dbInstance;
            appIdRef.current = canvasAppId;

            console.log("Firebase client initialized successfully.");
            console.log("Frontend canvasAppId:", canvasAppId);

        } catch (error: any) {
            console.error("Firebase client initialization failed:", error);
            setMessage({ text: `Firebase initialization failed: ${error.message}. Please check your config.`, type: 'error' });
            setLoading(false);
            return;
        }

        // Handle initial custom token sign-in for Canvas environment
        // This is the ONLY automatic sign-in. If no token, user must explicitly sign in.
        const performCanvasAuth = async () => {
            if (initialAuthToken && firebaseAuthRef.current) {
                try {
                    await signInWithCustomToken(firebaseAuthRef.current, initialAuthToken);
                    console.log("Signed in with initial custom token.");
                } catch (error: any) {
                    console.error("Error with initial custom token sign-in:", error);
                    setMessage({ text: `Canvas authentication failed: ${error.message}`, type: 'error' });
                }
            }
            // If no initialAuthToken, we don't sign in anonymously here.
            // The user will be null, and the AuthForm will be displayed.
            setLoading(false); // Set loading to false after initial auth attempt (or lack thereof)
        };

        performCanvasAuth();

        // Handle email link sign-in (if user clicked a magic link)
        // This still needs to be handled automatically if the user comes back via a link
        if (firebaseAuthRef.current && isSignInWithEmailLink(firebaseAuthRef.current, window.location.href)) {
            let emailFromStorage = window.localStorage.getItem('emailForSignIn');
            if (!emailFromStorage) {
                setMessage({ text: 'Please open the sign-in link from the same browser/device you requested it, or try again.', type: 'error' });
                setLoading(false);
                return;
            }
            setLoading(true);
            signInWithEmailLink(firebaseAuthRef.current, emailFromStorage, window.location.href)
                .then(async (result) => {
                    window.localStorage.removeItem('emailForSignIn');
                    const currentUser = result.user;
                    if (firestoreDbRef.current) {
                        // Default role for magic link sign-ups is 'patient'
                        await createUserProfileDocument(currentUser, 'patient', currentUser.displayName || 'New User');
                    }
                    setMessage({ text: 'Successfully signed in via email link!', type: 'success' });
                })
                .catch((error) => {
                    console.error("Error signing in with email link:", error);
                    setMessage({ text: `Email link sign-in failed: ${error.message}`, type: 'error' });
                    setLoading(false);
                });
        }


        // Listen for Firebase Auth state changes
        if (firebaseAuthRef.current && firestoreDbRef.current) {
            const unsubscribe = onAuthStateChanged(firebaseAuthRef.current, async (currentUser) => {
                if (currentUser) {
                    // Force refresh ID token to get latest custom claims
                    const idTokenResult = await currentUser.getIdTokenResult(true);
                    const customRole = idTokenResult.claims.role as UserProfile['role'];

                    // User is signed in. Fetch their profile.
                    // Note: The user profile document is stored in `artifacts/{appId}/users/{uid}/users/{uid}`
                    const userDocRef = doc(firestoreDbRef.current!, `artifacts/${appIdRef.current}/users/${currentUser.uid}/users`, currentUser.uid);
                    try {
                        const docSnap = await getDoc(userDocRef);
                        if (docSnap.exists()) {
                            const profileData = docSnap.data() as UserProfile;
                            // Prefer role from custom claims if available, otherwise from profile
                            const finalRole = customRole || profileData.role;
                            setUser({ ...currentUser, profile: {  ...profileData, role: finalRole, id: currentUser.uid } });
                            console.log(`User ${currentUser.uid} logged in. Role (from token/profile): ${finalRole}`);
                        } else {
                            // If user exists in Auth but not in Firestore (e.g., new Google sign-in), create profile
                            console.warn("User profile document missing, creating one with default role 'patient'.");
                            const defaultRole: UserProfile['role'] = customRole || 'patient'; // Use custom claim role if present, else patient
                            const defaultProfile: UserProfile = {
                                id: currentUser.uid,
                                email: currentUser.email || '',
                                full_name: currentUser.displayName || 'New User',
                                role: defaultRole,
                                status: 'active',
                                created_at: serverTimestamp(), // Use serverTimestamp for new creation
                                updated_at: serverTimestamp(),
                                last_login_at: serverTimestamp(),
                                phone_number: currentUser.phoneNumber || '',
                                profile_picture_url: currentUser.photoURL || '',
                            };
                            await createUserProfileDocument(currentUser, defaultProfile.role, defaultProfile.full_name);
                            setUser({ ...currentUser, profile: defaultProfile });
                            setMessage({ text: 'Welcome! Your profile has been created.', type: 'success' });
                            
                        }
                        setAuthReady(true);
                    } catch (firestoreError: any) {
                        console.error("Error fetching/creating user profile:", firestoreError);
                        setMessage({ text: `Failed to load/create profile: ${firestoreError.message}`, type: 'error' });
                        await signOut(firebaseAuthRef.current!); // Sign out if profile fails to load/create
                    }
                } else {
                    // User is signed out or not authenticated
                    setUser(null);
                }
                setLoading(false); // Set loading to false after auth state is determined
            });
            return () => unsubscribe(); // Cleanup listener on unmount
        } else {
            // If Firebase instances aren't ready, ensure loading is false and no user
            setLoading(false);
            setUser(null);
            return () => {}; // Return an empty cleanup function
        }
    }, []); // Empty dependency array means this runs once on mount

    // Helper function to create/update user profile in Firestore
    const createUserProfileDocument = async (authUser: User, role: UserProfile['role'], fullName: string) => {
        if (!firestoreDbRef.current || !appIdRef.current) {
            setMessage({ text: 'Firebase not initialized for profile creation.', type: 'error' });
            return;
        }
        const userDocRef = doc(firestoreDbRef.current, `artifacts/${appIdRef.current}/users/${authUser.uid}/users`, authUser.uid);
        try {
            await setDoc(userDocRef, {
                id: authUser.uid, // Ensure ID is stored in the document
                email: authUser.email,
                full_name: fullName,
                role: role,
                status: 'active',
                created_at: serverTimestamp(), // Use serverTimestamp for new creation
                updated_at: serverTimestamp(),
                last_login_at: serverTimestamp(),
                phone_number: authUser.phoneNumber || '',
                profile_picture_url: authUser.photoURL || '',
            }, { merge: true }); // Use merge to avoid overwriting existing fields
            console.log("User profile document created/updated successfully.");
        } catch (error: any) {
            console.error("Error creating user profile document:", error);
            setMessage({ text: `Failed to create user profile: ${error.message}`, type: 'error' });
            throw error; // Re-throw to propagate to calling function
        }
    };

    // Email/Password Signup
    const signUp = async (email: string, password: string, fullName: string, role: UserProfile['role'] = 'patient') => {
        setMessage({ text: '', type: '' });
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) {
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(firebaseAuthRef.current, email, password);
            await createUserProfileDocument(userCredential.user, role, fullName);
            setMessage({ text: 'Signup successful! Welcome to Wingdent-Glo!', type: 'success' });
            // Force token refresh after sign-up to ensure claims are up-to-date
            await userCredential.user.getIdToken(true);
        } catch (error: any) {
            console.error("Email Signup Error:", error);
            setMessage({ text: `Signup failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Email/Password Login
    const signIn = async (email: string, password: string) => {
        setMessage({ text: '', type: '' });
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) {
            setMessage({ text: 'Firebase not initialized.', type: 'error'});
            setLoading(false);
            return;
        }
        try {
            const userCredential = await signInWithEmailAndPassword(firebaseAuthRef.current, email, password);
            //setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
            // Force token refresh after sign-in to ensure claims are up-to-date
            await userCredential.user.getIdToken(true);
        } catch (error: any) {
            console.error("Email Login Error:", error);
            setMessage({ text: `Login failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Google Sign-in
    const signInWithGoogle = async () => {
        setMessage({ text: '', type: '' });
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) {
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuthRef.current, provider);
            // Check if user profile exists, if not, create one with 'patient' role
            const userDocRef = doc(firestoreDbRef.current, `artifacts/${appIdRef.current}/users/${result.user.uid}/users`, result.user.uid);
            const docSnap = await getDoc(userDocRef);
            if (!docSnap.exists()) {
                await createUserProfileDocument(result.user, 'patient', result.user.displayName || 'Google User');
            }
            setMessage({ text: 'Google Sign-in successful! Redirecting...', type: 'success' });
            // Force token refresh after sign-in to ensure claims are up-to-date
            await result.user.getIdToken(true);
        } catch (error: any) {
            console.error("Google Sign-in Error:", error);
            setMessage({ text: `Google Sign-in failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Send Email Link (Passwordless)
    const sendMagicLink = async (email: string) => {
        setMessage({ text: '', type: '' });
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) {
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            const actionCodeSettingsForSend = {
                url: window.location.href,
                handleCodeInApp: true,
            };
            await sendSignInLinkToEmail(firebaseAuthRef.current, email, actionCodeSettingsForSend);
            window.localStorage.setItem('emailForSignIn', email);
            setOtpSent(true);
            setMessage({ text: 'A sign-in link has been sent to your email. Please check your inbox!', type: 'success' });
        } catch (error: any) {
            console.error("Send Email Link Error:", error);
            setMessage({ text: `Failed to send link: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Logout
    const logout = async () => {
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) {
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            await signOut(firebaseAuthRef.current);
            setMessage({ text: 'Logged out successfully.', type: 'success' });
            setEmail('');
            setOtpSent(false);
            setAuthMode('login');
        } catch (error: any) {
            console.error("Logout Error:", error);
            setMessage({ text: `Logout failed: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const contextValue: AuthContextType = {
        user,
        loading,
        message,
        signIn,
        signUp,
        signInWithGoogle,
        sendMagicLink,
        logout,
        authMode,
        setAuthMode,
        otpSent,
        email,
        setEmail,
        setOtpSent,
        setMessage,
        db: firestoreDbRef.current,
        auth: firebaseAuthRef.current,
        appId: appIdRef.current,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
