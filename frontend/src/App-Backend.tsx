// frontend/src/App.tsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
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
    signInAnonymously // Import signInAnonymously
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    Firestore,
    serverTimestamp
} from 'firebase/firestore';

// Define types for better type safety
interface UserProfile {
    email: string;
    full_name: string;
    role: 'patient' | 'doctor' | 'admin' | 'superadmin';
    status: 'active' | 'inactive';
    created_at: Date; // Will be Firebase Timestamp, but Date is fine for client-side representation
    updated_at: Date;
    last_login_at: Date;
    phone_number?: string;
    profile_picture_url?: string;
    // Doctor specific fields
    license_number?: string;
    specialization?: string;
    years_of_experience?: number;
    bio?: string;
    assigned_zones?: string[];
    availability_schedule?: string; // JSON string
    is_available_now?: boolean;
    average_rating?: number;
    total_reviews?: number;
}

interface Service {
    id: string;
    name: string;
    description: string;
    base_price: number;
    estimated_duration_minutes: number;
    image: string;
}

interface Offer {
    id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
}

interface Address {
    id: string;
    user_id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    zip_code: string;
    label: string;
    is_default: boolean;
    created_at: any; // Firebase Timestamp
    updated_at: any; // Firebase Timestamp
}

interface Appointment {
    id: string;
    patient_id: string;
    doctor_id?: string;
    service_id: string;
    address_id: string;
    requested_date: string;
    requested_time_slot: string;
    estimated_cost: number;
    status: 'pending_assignment' | 'assigned' | 'confirmed' | 'on_the_way' | 'arrived' | 'service_started' | 'completed' | 'cancelled_by_patient' | 'cancelled_by_doctor' | 'rescheduled' | 'declined_by_doctor';
    payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
    created_at: any;
    updated_at: any;
    // Enriched fields for display
    serviceName?: string;
    addressDetails?: Address;
    doctorName?: string;
    patientName?: string;
}

interface DoctorEarnings {
    totalEarnings: number;
    earningsHistory: Array<{
        appointment_id: string;
        payment_id: string;
        amount: number;
        currency: string;
        transaction_date: any;
        service_id: string;
    }>;
}


interface AuthContextType {
    user: (User & { profile?: UserProfile }) | null;
    loading: boolean;
    message: { text: string; type: 'success' | 'error' | '' };
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    sendMagicLink: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    authMode: 'login' | 'signup' | 'otp';
    setAuthMode: React.Dispatch<React.SetStateAction<'login' | 'signup' | 'otp'>>;
    otpSent: boolean;
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    setOtpSent: React.Dispatch<React.SetStateAction<boolean>>;
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
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'otp'>('login');
    const [otpSent, setOtpSent] = useState(false);
    const [email, setEmail] = useState('');

    // Use refs to hold Firebase instances to avoid re-initialization issues
    const firebaseAppRef = React.useRef<FirebaseApp | null>(null);
    const firebaseAuthRef = React.useRef<Auth | null>(null);
    const firestoreDbRef = React.useRef<Firestore | null>(null);

    // Canvas environment specific variables (if running in Canvas)
    const canvasAppId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : process.env.REACT_APP_FIREBASE_APP_ID;
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
        let auth: Auth;
        let db: Firestore;

        try {
            app = initializeApp(canvasFirebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            firebaseAppRef.current = app;
            firebaseAuthRef.current = auth;
            firestoreDbRef.current = db;

            console.log("Firebase client initialized successfully.");
            console.log("Frontend canvasAppId:", canvasAppId); // DEBUG: Log canvasAppId
        } catch (error: any) {
            console.error("Firebase client initialization failed:", error);
            setMessage({ text: `Firebase initialization failed: ${error.message}. Please check your config.`, type: 'error' });
            setLoading(false);
            return;
        }

        // Handle initial custom token sign-in for Canvas environment or anonymous sign-in
        const performInitialAuth = async (authInstance: Auth) => {
            if (initialAuthToken) {
                try {
                    await (authInstance as any).signInWithCustomToken(initialAuthToken);
                    console.log("Signed in with initial custom token.");
                } catch (error) {
                    console.error("Error with initial custom token sign-in:", error);
                    // Fallback to anonymous sign-in if custom token fails
                    try {
                        await signInAnonymously(authInstance);
                        console.log("Signed in anonymously as fallback.");
                    } catch (anonError: any) {
                        console.error("Error with anonymous sign-in:", anonError);
                        setMessage({ text: `Authentication failed: ${anonError.message}`, type: 'error' });
                    }
                }
            } else {
                // If no initial token, sign in anonymously
                try {
                    await signInAnonymously(authInstance);
                    console.log("Signed in anonymously.");
                } catch (anonError: any) {
                    console.error("Error with anonymous sign-in:", anonError);
                    setMessage({ text: `Authentication failed: ${anonError.message}`, type: 'error' });
                }
            }
            setLoading(false); // Ensure loading is set to false after initial auth attempt
        };

        // Call initial auth immediately after getting auth instance
        if (firebaseAuthRef.current) {
            performInitialAuth(firebaseAuthRef.current);
        }


        // Action code settings for Email Link Sign-in
        // Note: The URL must be whitelisted in Firebase Console -> Authentication -> Sign-in method -> Email/Password -> Email link.
        const actionCodeSettings = {
            url: window.location.href, // Current URL, Firebase will append ?mode=...
            handleCodeInApp: true,
        };

        // Handle email link sign-in (if user clicked a magic link)
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
                        await createUserProfileDocument(currentUser, 'patient', currentUser.displayName || 'New User', firestoreDbRef.current);
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
                    // User is signed in. Fetch their profile.
                    const userDocRef = doc(firestoreDbRef.current!, `artifacts/${canvasAppId}/users/${currentUser.uid}/users`, currentUser.uid);
                    try {
                        const docSnap = await getDoc(userDocRef);
                        console.log(docSnap.data());
                        if (docSnap.exists()) {
                            setUser({ ...currentUser, profile: docSnap.data() as UserProfile });
                        } else {
                            console.warn("User profile document missing, creating one.");
                            // Create a default profile if it doesn't exist
                            const defaultProfile: UserProfile = {
                                email: currentUser.email || '',
                                full_name: currentUser.displayName || 'New User',
                                role: 'patient', // Default role for new users
                                status: 'active',
                                created_at: new Date(),
                                updated_at: new Date(),
                                last_login_at: new Date(),
                                phone_number: currentUser.phoneNumber || '',
                                profile_picture_url: currentUser.photoURL || '',
                            };
                            await createUserProfileDocument(currentUser, defaultProfile.role, defaultProfile.full_name, firestoreDbRef.current!);
                            setUser({ ...currentUser, profile: defaultProfile });
                            setMessage({ text: 'Welcome! Your profile has been created.', type: 'success' });
                        }
                    } catch (firestoreError: any) {
                        console.error("Error fetching/creating user profile:", firestoreError);
                        setMessage({ text: `Failed to load/create profile: ${firestoreError.message}`, type: 'error' });
                        await signOut(firebaseAuthRef.current!); // Sign out if profile fails to load/create
                    }
                } else {
                    // User is signed out
                    setUser(null);
                }
                setLoading(false);
            });
            return () => unsubscribe(); // Cleanup listener on unmount
        } else {
            return () => {}; // Return an empty cleanup function if Firebase instances aren't ready
        }
    }, []); // Empty dependency array means this runs once on mount

    // Helper function to create/update user profile in Firestore
    const createUserProfileDocument = async (authUser: User, role: UserProfile['role'], fullName: string, firestoreInstance: Firestore) => {
        const userDocRef = doc(firestoreInstance, `artifacts/${canvasAppId}/users/${authUser.uid}/users`, authUser.uid);
        try {
            await setDoc(userDocRef, {
                email: authUser.email,
                full_name: fullName,
                role: role,
                status: 'active',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                last_login_at: serverTimestamp(),
                phone_number: authUser.phoneNumber || '',
                profile_picture_url: authUser.photoURL || '',
            }, { merge: true });
            console.log("User profile document created/updated successfully.");
        } catch (error: any) {
            console.error("Error creating user profile document:", error);
            setMessage({ text: `Failed to create user profile: ${error.message}`, type: 'error' });
            throw error;
        }
    };

    // Email/Password Signup
    const signUp = async (email: string, password: string, fullName: string) => {
        setMessage({ text: '', type: '' });
        setLoading(true);
        if (!firebaseAuthRef.current || !firestoreDbRef.current) { // Check for auth and db directly
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(firebaseAuthRef.current, email, password);
            await createUserProfileDocument(userCredential.user, 'patient', fullName, firestoreDbRef.current);
            setMessage({ text: 'Signup successful! Welcome to Wingdent-Glo!', type: 'success' });
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
        if (!firebaseAuthRef.current || !firestoreDbRef.current) { // Check for auth and db directly
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            await signInWithEmailAndPassword(firebaseAuthRef.current, email, password);
            setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
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
        if (!firebaseAuthRef.current || !firestoreDbRef.current) { // Check for auth and db directly
            setMessage({ text: 'Firebase not initialized.', type: 'error' });
            setLoading(false);
            return;
        }
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuthRef.current, provider);
            await createUserProfileDocument(result.user, 'patient', result.user.displayName || 'Google User', firestoreDbRef.current);
            setMessage({ text: 'Google Sign-in successful! Redirecting...', type: 'success' });
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
        setOtpSent
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Loading Spinner Component
const LoadingSpinner: React.FC = () => (
    <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
    </div>
);

// Message Display Component
const MessageDisplay: React.FC<{ message: { text: string; type: 'success' | 'error' | '' } }> = ({ message }) => {
    if (!message.text) return null;
    return (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mb-4`} role="alert">
            {message.text}
        </div>
    );
};

// AuthForm Component
const AuthForm: React.FC = () => {
    const { signIn, signUp, signInWithGoogle, sendMagicLink, authMode, setAuthMode, otpSent, email, setEmail, loading, message, setOtpSent } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authMode === 'signup') {
            if (password !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }
            await signUp(email, password, fullName);
        } else if (authMode === 'login') {
            await signIn(email, password);
        } else if (authMode === 'otp' && !otpSent) {
            await sendMagicLink(email);
        }
    };

    return (
        <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '450px', width: '100%' }}>
            <h2 className="h3 fw-bold text-dark mb-4 text-center">
                {authMode === 'login' ? 'Login to Wingdent-Glo' : authMode === 'signup' ? 'Sign Up for Wingdent-Glo' : 'Verify Email'}
            </h2>

            <MessageDisplay message={message} />

            {authMode === 'otp' ? (
                <div>
                    <p className="text-muted mb-4 text-center">
                        {otpSent ? `A magic link has been sent to ${email}. Click the link in your email to sign in.` : 'Enter your email to receive a magic link for sign-in.'}
                    </p>
                    {!otpSent && (
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <input
                                    type="email"
                                    placeholder="Your Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="form-control form-control-lg"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                                {loading && <LoadingSpinner />}
                                Send Magic Link
                            </button>
                        </form>
                    )}
                    <button
                        onClick={() => { setAuthMode('login'); setOtpSent(false); }}
                        className="btn btn-link text-decoration-none text-primary mt-3 w-100"
                    >
                        Back to Login
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {authMode === 'signup' && (
                        <div className="mb-3">
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="form-control form-control-lg"
                            />
                        </div>
                    )}
                    <div className="mb-3">
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="form-control form-control-lg"
                        />
                    </div>
                    <div className="mb-4">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-control form-control-lg"
                        />
                    </div>
                    {authMode === 'signup' && (
                        <div className="mb-4">
                            <input
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="form-control form-control-lg"
                            />
                            {password !== confirmPassword && confirmPassword !== '' && (
                                <p className="text-danger small mt-1">Passwords do not match.</p>
                            )}
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                        {loading && <LoadingSpinner />}
                        {authMode === 'login' ? 'Login' : 'Sign Up'}
                    </button>

                    <div className="my-4 text-center text-muted">OR</div>

                    <button
                        type="button"
                        onClick={signInWithGoogle}
                        className="btn btn-outline-dark w-100 py-2 d-flex align-items-center justify-content-center"
                        disabled={loading}
                    >
                        {loading && <LoadingSpinner />}
                        <img src="https://www.google.com/favicon.ico" alt="Google icon" className="me-2" style={{ width: '20px', height: '20px' }} />
                        Sign in with Google
                    </button>

                    <div className="mt-4 text-center">
                        {authMode === 'login' ? (
                            <>
                                <button
                                    onClick={() => setAuthMode('signup')}
                                    className="btn btn-link text-decoration-none text-primary me-3"
                                >
                                    Don't have an account? Sign Up
                                </button>
                                <button
                                    onClick={() => setAuthMode('otp')}
                                    className="btn btn-link text-decoration-none text-primary"
                                >
                                    Login with Magic Link
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthMode('login')}
                                className="btn btn-link text-decoration-none text-primary"
                            >
                                Already have an account? Login
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
};

// API Utility Function
const fetchApi = async (url: string, method: string = 'GET', body?: any) => {
    const idToken = await getAuth().currentUser?.getIdToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // Log the backend URL being used
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
    console.log(`Attempting to fetch from: ${backendUrl}${url}`);

    if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        console.log("Firebase ID Token found and added to Authorization header.");
    } else {
        console.warn("No Firebase ID Token found. Request will proceed without Authorization header.");
    }

    const options: RequestInit = {
        method,
        headers,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${backendUrl}${url}`, options);

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`API call failed: ${method} ${url}`, errorData);
            throw new Error(errorData.message || `API call failed with status ${response.status}.`);
        }
        console.log(`API call successful: ${method} ${url}`);
        return response.json();
    } catch (error: any) {
        // More specific error for network issues like "Failed to fetch"
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error(`Network error: Could not connect to backend at ${backendUrl}. Please ensure your backend server is running and accessible.`);
            throw new Error(`Network error: Could not connect to the backend. Please ensure the backend server is running at ${backendUrl}.`);
        }
        console.error(`Error during API fetch to ${backendUrl}${url}:`, error);
        throw error;
    }
};


// --- Patient Workflow Components ---

// Services Page
const ServicesPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { message, user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const servicesData = await fetchApi('/api/services');
                setServices(servicesData);
                const offersData = await fetchApi('/api/offers');
                setOffers(offersData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        if (user) { // Only load data if user is authenticated
            loadData();
        }
    }, [user]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading services and offers...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-primary mb-4 text-center">Our Services</h2>
            <MessageDisplay message={message} />

            {offers.length > 0 && (
                <div className="mb-5">
                    <h4 className="fw-bold text-dark mb-3">Special Offers!</h4>
                    <div id="offerCarousel" className="carousel slide" data-bs-ride="carousel">
                        <div className="carousel-inner rounded-3 shadow-sm">
                            {offers.map((offer, index) => (
                                <div className={`carousel-item ${index === 0 ? 'active' : ''}`} key={offer.id}>
                                    <img src={offer.image_url} className="d-block w-100" alt={offer.title}
                                         onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/600x200/cccccc/000000?text=Offer"; }} />
                                    <div className="carousel-caption d-none d-md-block bg-dark bg-opacity-75 rounded p-2">
                                        <h5>{offer.title}</h5>
                                        <p>{offer.description}</p>
                                        {offer.link_url && <a href={offer.link_url} className="btn btn-sm btn-light mt-2">Learn More</a>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {offers.length > 1 && (
                            <>
                                <button className="carousel-control-prev" type="button" data-bs-target="#offerCarousel" data-bs-slide="prev">
                                    <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                                    <span className="visually-hidden">Previous</span>
                                </button>
                                <button className="carousel-control-next" type="button" data-bs-target="#offerCarousel" data-bs-slide="next">
                                    <span className="carousel-control-next-icon" aria-hidden="true"></span>
                                    <span className="visually-hidden">Next</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                {services.map(service => (
                    <div className="col" key={service.id}>
                        <div className="card h-100 shadow-sm">
                            <img src={service.image} className="card-img-top" alt={service.name} style={{ height: '180px', objectFit: 'cover' }}
                                 onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/300x180/007bff/ffffff?text=Service"; }} />
                            <div className="card-body d-flex flex-column">
                                <h5 className="card-title text-dark">{service.name}</h5>
                                <p className="card-text text-muted flex-grow-1">{service.description}</p>
                                <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                                    <span className="fw-bold text-primary fs-5">₹{service.base_price}</span>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => navigate('requestService', { service })}
                                    >
                                        Request Service
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="d-flex justify-content-center mt-5">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Request Service Page
const RequestServicePage: React.FC<{ navigate: (page: string, data?: any) => void; service: Service }> = ({ navigate, service }) => {
    const { user, message } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const timeSlots = ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM', '04:00 PM - 05:00 PM'];

    useEffect(() => {
        const loadAddresses = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchApi('/api/addresses');
                setAddresses(data);
                const defaultAddress = data.find((addr: Address) => addr.is_default);
                if (defaultAddress) {
                    setSelectedAddressId(defaultAddress.id);
                } else if (data.length > 0) {
                    setSelectedAddressId(data[0].id); // Select first if no default
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        if (user) {
            loadAddresses();
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const newAppointment = await fetchApi('/api/appointments', 'POST', {
                service_id: service.id,
                address_id: selectedAddressId,
                requested_date: selectedDate,
                requested_time_slot: selectedTimeSlot,
                estimated_cost: service.base_price, // Using base price as estimated cost for simplicity
            });
            navigate('appointmentStatus', { appointment: newAppointment, serviceName: service.name });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && addresses.length === 0) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading addresses...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user) return <div className="alert alert-warning text-center m-4">Please log in to request a service.</div>;


    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '600px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Request: {service.name}</h2>
                <MessageDisplay message={message} />

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="serviceDescription" className="form-label fw-bold">Service Details:</label>
                        <p id="serviceDescription" className="text-muted">{service.description}</p>
                        <p className="fw-bold text-success">Estimated Cost: ₹{service.base_price}</p>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="selectAddress" className="form-label fw-bold">Select Address:</label>
                        {addresses.length === 0 ? (
                            <div className="alert alert-warning">No addresses found. Please add an address in your profile.</div>
                        ) : (
                            <select
                                id="selectAddress"
                                className="form-select form-select-lg"
                                value={selectedAddressId}
                                onChange={(e) => setSelectedAddressId(e.target.value)}
                                required
                            >
                                <option value="">Choose an address...</option>
                                {addresses.map(addr => (
                                    <option key={addr.id} value={addr.id}>
                                        {addr.label}: {addr.address_line_1}, {addr.city} - {addr.zip_code} {addr.is_default && '(Default)'}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button type="button" className="btn btn-link mt-2" onClick={() => navigate('addressManagement')}>Manage Addresses</button>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="selectDate" className="form-label fw-bold">Preferred Date:</label>
                        <input
                            type="date"
                            id="selectDate"
                            className="form-control form-control-lg"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="selectTime" className="form-label fw-bold">Preferred Time Slot:</label>
                        <select
                            id="selectTime"
                            className="form-select form-select-lg"
                            value={selectedTimeSlot}
                            onChange={(e) => setSelectedTimeSlot(e.target.value)}
                            required
                        >
                            <option value="">Choose a time slot...</option>
                            {timeSlots.map(slot => (
                                <option key={slot} value={slot}>{slot}</option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading || addresses.length === 0}>
                        {loading && <LoadingSpinner />}
                        Confirm Request
                    </button>
                </form>
                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('services')}>Back to Services</button>
                </div>
            </div>
        </div>
    );
};

// Appointment Status Page
const AppointmentStatusPage: React.FC<{ navigate: (page: string, data?: any) => void; appointment?: Appointment }> = ({ navigate, appointment: initialAppointment }) => {
    const { user, message } = useAuth();
    const [appointment, setAppointment] = useState<Appointment | undefined>(initialAppointment);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState<string>('');
    const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState<string>('');

    const timeSlots = ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM', '04:00 PM - 05:00 PM'];


    useEffect(() => {
        const fetchAppointment = async () => {
            if (!initialAppointment?.id) {
                setError("No appointment ID provided.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const fetchedAppt = await fetchApi(`/api/appointments/${initialAppointment.id}`);
                setAppointment(fetchedAppt);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user && initialAppointment?.id) {
            fetchAppointment();
        } else if (!initialAppointment) {
            // If no initial appointment, try to fetch the latest one or redirect
            const fetchLatestAppointment = async () => {
                setLoading(true);
                try {
                    const appointments = await fetchApi('/api/appointments');
                    if (appointments && appointments.length > 0) {
                        setAppointment(appointments[0]); // Display the most recent one
                    } else {
                        setError("No appointments found.");
                    }
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            if (user) fetchLatestAppointment();
        }
    }, [user, initialAppointment]);

    const handleReschedule = async () => {
        if (!appointment?.id || !rescheduleDate || !rescheduleTimeSlot) {
            alert('Please select a new date and time for rescheduling.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const updatedAppt = await fetchApi(`/api/appointments/${appointment.id}`, 'PUT', {
                status: 'rescheduled',
                reschedule_date: rescheduleDate,
                reschedule_time_slot: rescheduleTimeSlot,
            });
            setAppointment(updatedAppt);
            alert('Appointment rescheduled successfully!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!appointment?.id || !window.confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const updatedAppt = await fetchApi(`/api/appointments/${appointment.id}`, 'PUT', {
                status: 'cancelled_by_patient',
                cancellation_reason: 'Patient initiated cancellation via app.',
            });
            setAppointment(updatedAppt);
            alert('Appointment cancelled successfully!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading appointment status...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!appointment) return <div className="alert alert-info text-center m-4">No appointment details available.</div>;

    const isCompleted = appointment.status === 'completed' || appointment.payment_status === 'paid';
    const isCancellable = ['pending_assignment', 'assigned', 'confirmed'].includes(appointment.status);
    const isReschedulable = ['pending_assignment', 'assigned', 'confirmed'].includes(appointment.status);
    const isPayable = appointment.status === 'completed' && appointment.payment_status === 'pending';

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '700px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Appointment Status</h2>
                <MessageDisplay message={message} />

                <div className="mb-4">
                    <p><strong>Service:</strong> {appointment.serviceName || 'Loading...'}</p>
                    <p><strong>Requested Date:</strong> {appointment.requested_date}</p>
                    <p><strong>Time Slot:</strong> {appointment.requested_time_slot}</p>
                    <p><strong>Estimated Cost:</strong> ₹{appointment.estimated_cost}</p>
                    <p><strong>Status:</strong> <span className={`badge ${
                        appointment.status === 'completed' || appointment.payment_status === 'paid' ? 'bg-success' :
                        appointment.status.includes('cancelled') ? 'bg-danger' :
                        appointment.status === 'pending_assignment' ? 'bg-warning text-dark' : 'bg-info text-dark'
                    }`}>
                        {appointment.status.replace(/_/g, ' ').toUpperCase()}
                    </span></p>
                    <p><strong>Payment Status:</strong> <span className={`badge ${
                        appointment.payment_status === 'paid' ? 'bg-success' :
                        appointment.payment_status === 'failed' ? 'bg-danger' : 'bg-secondary'
                    }`}>
                        {appointment.payment_status.toUpperCase()}
                    </span></p>
                    {appointment.doctorName && <p><strong>Assigned Doctor:</strong> {appointment.doctorName}</p>}
                    {appointment.addressDetails && (
                        <p><strong>Address:</strong> {appointment.addressDetails.address_line_1}, {appointment.addressDetails.city}</p>
                    )}
                </div>

                <hr />

                <div className="row g-3">
                    <div className="col-md-6">
                        <h5>Actions:</h5>
                        {isPayable && (
                            <button
                                className="btn btn-success w-100 mb-2"
                                onClick={() => navigate('payment', { appointmentId: appointment.id, amount: appointment.estimated_cost })}
                            >
                                Make Payment
                            </button>
                        )}
                        {isCompleted && appointment.payment_status === 'paid' && (
                            <button
                                className="btn btn-info w-100 mb-2"
                                onClick={() => navigate('feedback', { appointmentId: appointment.id, doctorId: appointment.doctor_id })}
                            >
                                Provide Feedback
                            </button>
                        )}
                        {isReschedulable && (
                            <button
                                className="btn btn-warning w-100 mb-2"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target="#rescheduleForm"
                                aria-expanded="false"
                                aria-controls="rescheduleForm"
                            >
                                Reschedule Appointment
                            </button>
                        )}
                        {isCancellable && (
                            <button
                                className="btn btn-danger w-100 mb-2"
                                onClick={handleCancel}
                            >
                                Cancel Appointment
                            </button>
                        )}
                    </div>
                    <div className="col-md-6">
                        <div className="collapse" id="rescheduleForm">
                            <div className="card card-body">
                                <h5>Reschedule:</h5>
                                <div className="mb-3">
                                    <label htmlFor="rescheduleDate" className="form-label">New Date:</label>
                                    <input
                                        type="date"
                                        id="rescheduleDate"
                                        className="form-control"
                                        value={rescheduleDate}
                                        onChange={(e) => setRescheduleDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="rescheduleTime" className="form-label">New Time Slot:</label>
                                    <select
                                        id="rescheduleTime"
                                        className="form-select"
                                        value={rescheduleTimeSlot}
                                        onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                                        required
                                    >
                                        <option value="">Select time...</option>
                                        {timeSlots.map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                                <button className="btn btn-primary w-100" onClick={handleReschedule} disabled={loading}>
                                    {loading && <LoadingSpinner />}
                                    Confirm Reschedule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// Payment Page
const PaymentPage: React.FC<{ navigate: (page: string, data?: any) => void; appointmentId: string; amount: number }> = ({ navigate, appointmentId, amount }) => {
    const { message } = useAuth();
    const [paymentMethod, setPaymentMethod] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState<boolean | null>(null);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setPaymentSuccess(null);
        try {
            const result = await fetchApi('/api/payments', 'POST', {
                appointment_id: appointmentId,
                amount: amount,
                currency: 'INR', // Hardcoded for now
                payment_method: paymentMethod,
                payment_gateway_transaction_id: `mock_txn_${Date.now()}`, // Mock transaction ID
            });
            setPaymentSuccess(result.status === 'successful');
            alert(result.message);
            if (result.status === 'successful') {
                navigate('appointmentStatus', { appointment: { id: appointmentId } }); // Go back to status to see update
            }
        } catch (err: any) {
            setError(err.message);
            setPaymentSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '500px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Make Payment</h2>
                <MessageDisplay message={message} />

                <div className="mb-3 text-center">
                    <p className="fw-bold fs-4">Amount Due: ₹{amount}</p>
                    <p className="text-muted">For Appointment ID: {appointmentId}</p>
                </div>

                <form onSubmit={handlePayment}>
                    <div className="mb-3">
                        <label className="form-label fw-bold">Select Payment Method:</label>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="paymentMethod"
                                id="creditCard"
                                value="credit_card"
                                checked={paymentMethod === 'credit_card'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                            />
                            <label className="form-check-label" htmlFor="creditCard">
                                Credit Card
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="paymentMethod"
                                id="upi"
                                value="upi"
                                checked={paymentMethod === 'upi'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                            />
                            <label className="form-check-label" htmlFor="upi">
                                UPI
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="paymentMethod"
                                id="netbanking"
                                value="netbanking"
                                checked={paymentMethod === 'netbanking'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                            />
                            <label className="form-check-label" htmlFor="netbanking">
                                Net Banking
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-success w-100 py-2" disabled={loading || !paymentMethod}>
                        {loading && <LoadingSpinner />}
                        Pay Now
                    </button>
                </form>

                {paymentSuccess !== null && (
                    <div className={`alert mt-4 ${paymentSuccess ? 'alert-success' : 'alert-danger'}`}>
                        {paymentSuccess ? 'Payment Successful!' : 'Payment Failed. Please try again.'}
                    </div>
                )}

                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('appointmentStatus', { appointment: { id: appointmentId } })}>Back to Appointment</button>
                </div>
            </div>
        </div>
    );
};

// Feedback Page
const FeedbackPage: React.FC<{ navigate: (page: string, data?: any) => void; appointmentId: string; doctorId?: string }> = ({ navigate, appointmentId, doctorId }) => {
    const { message } = useAuth();
    const [rating, setRating] = useState(0);
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    const handleStarClick = (index: number) => {
        setRating(index + 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/api/feedback', 'POST', {
                appointment_id: appointmentId,
                rating,
                comments,
                doctor_id: doctorId, // Pass doctorId if available
            });
            setFeedbackSubmitted(true);
            alert('Feedback submitted successfully!');
            navigate('dashboard'); // Go back to dashboard after feedback
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (feedbackSubmitted) {
        return (
            <div className="container py-4">
                <div className="card shadow-lg p-4 p-md-5 rounded-3 text-center" style={{ maxWidth: '500px', margin: 'auto' }}>
                    <h2 className="h3 fw-bold text-success mb-4">Feedback Submitted!</h2>
                    <p className="text-muted">Thank you for your valuable feedback.</p>
                    <button className="btn btn-primary mt-3" onClick={() => navigate('dashboard')}>Go to Dashboard</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '600px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Provide Feedback</h2>
                <MessageDisplay message={message} />

                <div className="mb-3 text-center">
                    <p className="text-muted">For Appointment ID: {appointmentId}</p>
                    {doctorId && <p className="text-muted">Doctor ID: {doctorId}</p>}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3 text-center">
                        <label className="form-label fw-bold d-block mb-2">Your Rating:</label>
                        {[...Array(5)].map((_, index) => (
                            <span
                                key={index}
                                style={{ cursor: 'pointer', fontSize: '2rem', color: index < rating ? '#ffc107' : '#e4e5e9' }}
                                onClick={() => handleStarClick(index)}
                                className="me-1"
                            >
                                ★
                            </span>
                        ))}
                        {!rating && <p className="text-danger small mt-2">Please select a rating.</p>}
                    </div>

                    <div className="mb-4">
                        <label htmlFor="comments" className="form-label fw-bold">Comments (Optional):</label>
                        <textarea
                            id="comments"
                            className="form-control"
                            rows={4}
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Share your experience..."
                        ></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading || rating === 0}>
                        {loading && <LoadingSpinner />}
                        Submit Feedback
                    </button>
                </form>

                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// Address Management Page
const AddressManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newAddress, setNewAddress] = useState({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        label: '',
        is_default: false,
    });
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

    const loadAddresses = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/addresses');
            setAddresses(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadAddresses();
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setNewAddress(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAddOrUpdateAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (editingAddressId) {
                await fetchApi(`/api/addresses/${editingAddressId}`, 'PUT', newAddress);
                alert('Address updated successfully!');
            } else {
                await fetchApi('/api/addresses', 'POST', newAddress);
                alert('Address added successfully!');
            }
            setNewAddress({
                address_line_1: '', address_line_2: '', city: '', state: '', zip_code: '', label: '', is_default: false,
            });
            setEditingAddressId(null);
            loadAddresses(); // Reload addresses to show updates
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAddress = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this address?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/addresses/${id}`, 'DELETE');
            alert('Address deleted successfully!');
            loadAddresses();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (address: Address) => {
        setNewAddress({
            address_line_1: address.address_line_1,
            address_line_2: address.address_line_2 || '',
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            label: address.label,
            is_default: address.is_default,
        });
        setEditingAddressId(address.id);
    };

    const handleSetDefault = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/addresses/${id}`, 'PUT', { is_default: true });
            alert('Default address set successfully!');
            loadAddresses();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    if (loading && addresses.length === 0) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading addresses...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user) return <div className="alert alert-warning text-center m-4">Please log in to manage addresses.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Manage Your Addresses</h2>
                <MessageDisplay message={message} />

                <form onSubmit={handleAddOrUpdateAddress} className="mb-5 border p-4 rounded-3 shadow-sm">
                    <h4 className="h5 fw-bold mb-3">{editingAddressId ? 'Edit Address' : 'Add New Address'}</h4>
                    <div className="mb-3">
                        <label htmlFor="address_line_1" className="form-label">Address Line 1:</label>
                        <input type="text" className="form-control" id="address_line_1" name="address_line_1" value={newAddress.address_line_1} onChange={handleInputChange} required />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="address_line_2" className="form-label">Address Line 2 (Optional):</label>
                        <input type="text" className="form-control" id="address_line_2" name="address_line_2" value={newAddress.address_line_2} onChange={handleInputChange} />
                    </div>
                    <div className="row mb-3">
                        <div className="col-md-6">
                            <label htmlFor="city" className="form-label">City:</label>
                            <input type="text" className="form-control" id="city" name="city" value={newAddress.city} onChange={handleInputChange} required />
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="state" className="form-label">State:</label>
                            <input type="text" className="form-control" id="state" name="state" value={newAddress.state} onChange={handleInputChange} required />
                        </div>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="zip_code" className="form-label">Zip Code:</label>
                        <input type="text" className="form-control" id="zip_code" name="zip_code" value={newAddress.zip_code} onChange={handleInputChange} required />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="label" className="form-label">Label (e.g., Home, Office):</label>
                        <input type="text" className="form-control" id="label" name="label" value={newAddress.label} onChange={handleInputChange} required />
                    </div>
                    <div className="form-check mb-4">
                        <input className="form-check-input" type="checkbox" id="is_default" name="is_default" checked={newAddress.is_default} onChange={handleInputChange} />
                        <label className="form-check-label" htmlFor="is_default">Set as Default Address</label>
                    </div>
                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                        {loading && <LoadingSpinner />}
                        {editingAddressId ? 'Update Address' : 'Add Address'}
                    </button>
                    {editingAddressId && (
                        <button type="button" className="btn btn-secondary w-100 py-2 mt-2" onClick={() => { setEditingAddressId(null); setNewAddress({ address_line_1: '', address_line_2: '', city: '', state: '', zip_code: '', label: '', is_default: false }); }}>
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h4 className="h5 fw-bold mb-3">Your Saved Addresses</h4>
                {addresses.length === 0 ? (
                    <p className="text-muted text-center">You have no saved addresses yet.</p>
                ) : (
                    <ul className="list-group">
                        {addresses.map(addr => (
                            <li key={addr.id} className="list-group-item d-flex justify-content-between align-items-center flex-wrap">
                                <div>
                                    <strong>{addr.label}</strong> {addr.is_default && <span className="badge bg-primary ms-2">Default</span>}
                                    <br />
                                    <small className="text-muted">
                                        {addr.address_line_1}, {addr.address_line_2 && `${addr.address_line_2}, `}{addr.city}, {addr.state} - {addr.zip_code}
                                    </small>
                                </div>
                                <div className="mt-2 mt-md-0">
                                    {!addr.is_default && (
                                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleSetDefault(addr.id)} disabled={loading}>
                                            Set Default
                                        </button>
                                    )}
                                    <button className="btn btn-sm btn-outline-info me-2" onClick={() => handleEditClick(addr)} disabled={loading}>
                                        Edit
                                    </button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteAddress(addr.id)} disabled={loading}>
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Help/FAQ Page
const HelpFAQPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();
    const faqs = [
        { question: "How do I book an appointment?", answer: "Navigate to 'Services', select your desired service, choose a date/time, confirm your address, and submit the request." },
        { question: "Can I reschedule my appointment?", answer: "Yes, you can reschedule from the 'My Appointments' section if the appointment status allows it." },
        { question: "What payment methods are accepted?", answer: "We accept Credit Card, UPI, and Net Banking." },
        { question: "How do I update my profile information?", answer: "You can update your personal details and manage addresses from your Patient Dashboard." },
        { question: "What if I have an emergency?", answer: "In case of a dental emergency, please use the 'Emergency' quick action on your dashboard or contact our support line directly." },
    ];

    if (!user) return <div className="alert alert-warning text-center m-4">Please log in to view help and FAQs.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Help & FAQs</h2>
                <div className="accordion" id="faqAccordion">
                    {faqs.map((faq, index) => (
                        <div className="accordion-item" key={index}>
                            <h2 className="accordion-header" id={`heading${index}`}>
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#collapse${index}`} aria-expanded="false" aria-controls={`collapse${index}`}>
                                    {faq.question}
                                </button>
                            </h2>
                            <div id={`collapse${index}`} className="accordion-collapse collapse" aria-labelledby={`heading${index}`} data-bs-parent="#faqAccordion">
                                <div className="accordion-body">
                                    {faq.answer}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};


// --- PatientDashboard Component ---
const PatientDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard'); // State for patient dashboard navigation
    const [pageData, setPageData] = useState<any>(null); // State to pass data between pages

    const navigate = (page: string, data: any = null) => {
        setCurrentPage(page);
        setPageData(data);
    };

    const renderPatientPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="h3 fw-bold text-primary mb-0">Patient Dashboard</h2>
                            <button onClick={logout} className="btn btn-outline-danger">Logout</button>
                        </div>
                        <div className="text-center mb-4">
                            <img
                                src={user?.photoURL || "https://placehold.co/100x100/007bff/ffffff?text=P"}
                                onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/007bff/ffffff?text=P"; }}
                                alt="Profile"
                                className="rounded-circle mb-3"
                                style={{ width: '100px', height: '100px', objectFit: 'cover', border: '3px solid #007bff' }}
                            />
                            <h4 className="fw-bold text-dark">{user?.profile?.full_name || user?.email || 'Patient'}</h4>
                            <p className="text-muted mb-1">{user?.email}</p>
                            <p className="small text-break text-muted">User ID: <span className="font-monospace">{user?.uid}</span></p>
                        </div>

                        <div className="row g-4 mb-4">
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Quick Actions</h5>
                                        <div className="d-grid gap-2 mt-3">
                                            <button className="btn btn-primary" onClick={() => navigate('services')}>Browse Services & Book</button>
                                            <button className="btn btn-outline-primary" onClick={() => navigate('appointmentStatus')}>My Appointments</button>
                                            <button className="btn btn-outline-info" onClick={() => navigate('addressManagement')}>Manage Addresses</button>
                                            <button className="btn btn-outline-secondary" onClick={() => navigate('helpFAQ')}>Help & FAQs</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Notifications</h5>
                                        <ul className="list-group list-group-flush">
                                            <li className="list-group-item">Your appointment with Dr. White on 2025-07-20 is confirmed.</li>
                                            <li className="list-group-item">New offers available! Check out our 'Special Offers' section.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'services':
                return <ServicesPage navigate={navigate} />;
            case 'requestService':
                return <RequestServicePage navigate={navigate} service={pageData.service} />;
            case 'appointmentStatus':
                return <AppointmentStatusPage navigate={navigate} appointment={pageData?.appointment} />;
            case 'payment':
                return <PaymentPage navigate={navigate} appointmentId={pageData.appointmentId} amount={pageData.amount} />;
            case 'feedback':
                return <FeedbackPage navigate={navigate} appointmentId={pageData.appointmentId} doctorId={pageData.doctorId} />;
            case 'addressManagement':
                return <AddressManagementPage navigate={navigate} />;
            case 'helpFAQ':
                return <HelpFAQPage navigate={navigate} />;
            default:
                return <div className="alert alert-danger">Page not found.</div>;
        }
    };

    return (
        <div className="container py-4">
            {renderPatientPage()}
        </div>
    );
};


// --- Doctor Workflow Components ---

// Doctor Available Requests Page
const AvailableRequestsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [requests, setRequests] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAvailableRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/doctor/requests/available');
            setRequests(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'doctor') {
            fetchAvailableRequests();
        }
    }, [user]);

    const handleAccept = async (appointmentId: string) => {
        if (!window.confirm('Are you sure you want to accept this request?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/doctor/requests/${appointmentId}/accept`, 'POST');
            alert('Request accepted successfully!');
            fetchAvailableRequests(); // Refresh the list
            navigate('doctorAppointments'); // Navigate to my appointments
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async (appointmentId: string) => {
        const reason = window.prompt('Reason for declining (optional):');
        if (!window.confirm('Are you sure you want to decline this request?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/doctor/requests/${appointmentId}/decline`, 'POST', { reason });
            alert('Request declined successfully!');
            fetchAvailableRequests(); // Refresh the list
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading available requests...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || user.profile?.role !== 'doctor') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-success mb-4 text-center">Available Service Requests</h2>
            <MessageDisplay message={message} />

            {requests.length === 0 ? (
                <p className="text-muted text-center">No new service requests available in your zones.</p>
            ) : (
                <div className="row row-cols-1 row-cols-md-2 g-4">
                    {requests.map(request => (
                        <div className="col" key={request.id}>
                            <div className="card h-100 shadow-sm">
                                <div className="card-body d-flex flex-column">
                                    <h5 className="card-title text-dark">{request.serviceName}</h5>
                                    <p className="card-text"><strong>Patient:</strong> {request.patientName}</p>
                                    <p className="card-text"><strong>Date:</strong> {request.requested_date}</p>
                                    <p className="card-text"><strong>Time:</strong> {request.requested_time_slot}</p>
                                    {request.addressDetails && (
                                        <p className="card-text">
                                            <strong>Address:</strong> {request.addressDetails.address_line_1}, {request.addressDetails.city} - {request.addressDetails.zip_code}
                                        </p>
                                    )}
                                    <p className="card-text text-muted flex-grow-1">Status: <span className="badge bg-warning text-dark">{request.status.replace(/_/g, ' ').toUpperCase()}</span></p>
                                    <div className="mt-auto d-flex justify-content-between">
                                        <button className="btn btn-success btn-sm" onClick={() => handleAccept(request.id)} disabled={loading}>Accept</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDecline(request.id)} disabled={loading}>Decline</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Doctor My Appointments Page
const MyAppointmentsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState<Appointment['status'] | ''>('');

    const fetchMyAppointments = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/doctor/appointments');
            setAppointments(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'doctor') {
            fetchMyAppointments();
        }
    }, [user]);

    const handleUpdateStatusClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setNewStatus(appointment.status); // Pre-fill with current status
        setShowUpdateStatusModal(true);
    };

    const handleStatusChange = async () => {
        if (!selectedAppointment?.id || !newStatus) {
            alert('Please select a status.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/doctor/appointments/${selectedAppointment.id}/status`, 'PUT', { status: newStatus });
            alert('Appointment status updated successfully!');
            setShowUpdateStatusModal(false);
            fetchMyAppointments(); // Refresh the list
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading your appointments...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || user.profile?.role !== 'doctor') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-success mb-4 text-center">My Appointments</h2>
            <MessageDisplay message={message} />

            {appointments.length === 0 ? (
                <p className="text-muted text-center">You have no appointments yet.</p>
            ) : (
                <div className="row row-cols-1 row-cols-md-2 g-4">
                    {appointments.map(appointment => (
                        <div className="col" key={appointment.id}>
                            <div className="card h-100 shadow-sm">
                                <div className="card-body d-flex flex-column">
                                    <h5 className="card-title text-dark">{appointment.serviceName}</h5>
                                    <p className="card-text"><strong>Patient:</strong> {appointment.patientName}</p>
                                    <p className="card-text"><strong>Date:</strong> {appointment.requested_date}</p>
                                    <p className="card-text"><strong>Time:</strong> {appointment.requested_time_slot}</p>
                                    {appointment.addressDetails && (
                                        <p className="card-text">
                                            <strong>Address:</strong> {appointment.addressDetails.address_line_1}, {appointment.addressDetails.city} - {appointment.addressDetails.zip_code}
                                        </p>
                                    )}
                                    <p className="card-text"><strong>Status:</strong> <span className={`badge ${
                                        appointment.status === 'completed' ? 'bg-success' :
                                        appointment.status.includes('cancelled') || appointment.status.includes('declined') ? 'bg-danger' :
                                        appointment.status === 'pending_assignment' ? 'bg-warning text-dark' : 'bg-info text-dark'
                                    }`}>
                                        {appointment.status.replace(/_/g, ' ').toUpperCase()}
                                    </span></p>
                                    <p className="card-text"><strong>Payment:</strong> <span className={`badge ${
                                        appointment.payment_status === 'paid' ? 'bg-success' : 'bg-secondary'
                                    }`}>
                                        {appointment.payment_status.toUpperCase()}
                                    </span></p>
                                    <div className="mt-auto">
                                        {['assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started'].includes(appointment.status) && (
                                            <button className="btn btn-primary btn-sm me-2" onClick={() => handleUpdateStatusClick(appointment)}>Update Status</button>
                                        )}
                                        {/* Potentially add a "View Patient Details" button here */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Update Status Modal */}
            {showUpdateStatusModal && selectedAppointment && (
                <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Update Status for {selectedAppointment.serviceName}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowUpdateStatusModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p>Current Status: <strong>{selectedAppointment.status.replace(/_/g, ' ').toUpperCase()}</strong></p>
                                <div className="mb-3">
                                    <label htmlFor="newStatus" className="form-label">Select New Status:</label>
                                    <select
                                        id="newStatus"
                                        className="form-select"
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value as Appointment['status'])}
                                    >
                                        <option value="">Choose...</option>
                                        <option value="on_the_way">On the Way</option>
                                        <option value="arrived">Arrived</option>
                                        <option value="service_started">Service Started</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateStatusModal(false)}>Close</button>
                                <button type="button" className="btn btn-primary" onClick={handleStatusChange} disabled={loading || !newStatus || newStatus === selectedAppointment.status}>
                                    {loading && <LoadingSpinner />}
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Doctor Availability Management Page
const DoctorAvailabilityPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [isAvailableNow, setIsAvailableNow] = useState<boolean>(user?.profile?.is_available_now ?? true);
    const [availabilitySchedule, setAvailabilitySchedule] = useState<any>(
        user?.profile?.availability_schedule ? JSON.parse(user.profile.availability_schedule) : {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' },
            saturday: { start: '', end: '' },
            sunday: { start: '', end: '' },
        }
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const handleScheduleChange = (day: string, type: 'start' | 'end', value: string) => {
        setAvailabilitySchedule((prev: any) => ({
            ...prev,
            [day]: { ...prev[day], [type]: value }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/api/doctor/availability', 'PUT', {
                availability_schedule: availabilitySchedule,
                is_available_now: isAvailableNow,
            });
            alert('Availability updated successfully!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user || user.profile?.role !== 'doctor') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '700px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-success mb-4 text-center">Manage Your Availability</h2>
                <MessageDisplay message={message} />

                <form onSubmit={handleSubmit}>
                    <div className="mb-4 form-check form-switch">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="isAvailableNowSwitch"
                            checked={isAvailableNow}
                            onChange={(e) => setIsAvailableNow(e.target.checked)}
                        />
                        <label className="form-check-label fw-bold" htmlFor="isAvailableNowSwitch">
                            Currently Available: {isAvailableNow ? <span className="text-success">Yes</span> : <span className="text-danger">No</span>}
                        </label>
                        <small className="form-text text-muted d-block">Toggle this to quickly set your immediate availability.</small>
                    </div>

                    <h5 className="fw-bold mb-3">Weekly Schedule:</h5>
                    {daysOfWeek.map(day => (
                        <div className="row mb-3 align-items-center" key={day}>
                            <div className="col-md-3">
                                <label className="form-label text-capitalize">{day}:</label>
                            </div>
                            <div className="col-md-4">
                                <input
                                    type="time"
                                    className="form-control"
                                    value={availabilitySchedule[day]?.start || ''}
                                    onChange={(e) => handleScheduleChange(day, 'start', e.target.value)}
                                />
                            </div>
                            <div className="col-md-1 text-center">-</div>
                            <div className="col-md-4">
                                <input
                                    type="time"
                                    className="form-control"
                                    value={availabilitySchedule[day]?.end || ''}
                                    onChange={(e) => handleScheduleChange(day, 'end', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}

                    <button type="submit" className="btn btn-success w-100 py-2 mt-4" disabled={loading}>
                        {loading && <LoadingSpinner />}
                        Save Availability
                    </button>
                </form>

                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// Doctor Earnings History Page
const DoctorEarningsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [earningsData, setEarningsData] = useState<DoctorEarnings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEarnings = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/doctor/earnings');
            setEarningsData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'doctor') {
            fetchEarnings();
        }
    }, [user]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading earnings data...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || user.profile?.role !== 'doctor') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '800px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-success mb-4 text-center">My Earnings & Payment History</h2>
                <MessageDisplay message={message} />

                {earningsData ? (
                    <>
                        <div className="text-center mb-4">
                            <h4 className="fw-bold text-dark">Total Earnings: <span className="text-success">₹{earningsData.totalEarnings.toFixed(2)}</span></h4>
                        </div>

                        <h5 className="fw-bold mb-3">Recent Transactions:</h5>
                        {earningsData.earningsHistory.length === 0 ? (
                            <p className="text-muted text-center">No completed and paid appointments found yet.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-striped table-hover">
                                    <thead>
                                        <tr>
                                            <th>Appointment ID</th>
                                            <th>Service ID</th>
                                            <th>Amount</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {earningsData.earningsHistory.map((transaction, index) => (
                                            <tr key={index}>
                                                <td>{transaction.appointment_id.substring(0, 8)}...</td>
                                                <td>{transaction.service_id}</td>
                                                <td>₹{transaction.amount.toFixed(2)}</td>
                                                <td>{new Date(transaction.transaction_date._seconds * 1000).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-muted text-center">No earnings data available.</p>
                )}

                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// Doctor Help Page
const DoctorHelpPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();
    const faqs = [
        { question: "How do I accept a request?", answer: "Go to 'Available Requests', review the details, and click 'Accept'." },
        { question: "How do I update appointment status?", answer: "In 'My Appointments', find the relevant appointment and use the 'Update Status' button." },
        { question: "How do I manage my availability?", answer: "Navigate to 'Manage Availability' from your dashboard to set your working hours and current status." },
        { question: "When do I get paid?", answer: "Earnings for completed and paid services are reflected in your 'My Earnings' section. Payouts are processed as per policy." },
        { question: "What if I can't find a patient's address?", answer: "Contact support immediately or reach out to the patient using their contact details provided in the appointment." },
    ];

    if (!user || user.profile?.role !== 'doctor') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Doctor Help & Resources</h2>
                <div className="accordion" id="doctorFaqAccordion">
                    {faqs.map((faq, index) => (
                        <div className="accordion-item" key={index}>
                            <h2 className="accordion-header" id={`doctorHeading${index}`}>
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#doctorCollapse${index}`} aria-expanded="false" aria-controls={`doctorCollapse${index}`}>
                                    {faq.question}
                                </button>
                            </h2>
                            <div id={`doctorCollapse${index}`} className="accordion-collapse collapse" aria-labelledby={`doctorHeading${index}`} data-bs-parent="#doctorFaqAccordion">
                                <div className="accordion-body">
                                    {faq.answer}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// --- Admin Workflow Components ---

// Admin User Management Page
const AdminUserManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'patient' as UserProfile['role'] });
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/admin/users');
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin') {
            fetchUsers();
        }
    }, [user]);

    const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewUser(prev => ({ ...prev, [name]: value }));
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/api/create-user-with-role', 'POST', {
                email: newUser.email,
                password: newUser.password,
                displayName: newUser.fullName,
                role: newUser.role,
            });
            alert('User added successfully!');
            setShowAddUserModal(false);
            setNewUser({ email: '', password: '', fullName: '', role: 'patient' });
            fetchUsers(); // Refresh list
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditUserClick = (userToEdit: UserProfile) => {
        setEditingUser(userToEdit);
        setNewUser({
            email: userToEdit.email,
            password: '', // Password cannot be pre-filled for security
            fullName: userToEdit.full_name,
            role: userToEdit.role,
        });
        setShowAddUserModal(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setLoading(true);
        setError(null);
        try {
            const updates: any = {
                full_name: newUser.fullName,
                role: newUser.role,
                status: editingUser.status, // Keep current status unless explicitly changed
            };
            // Only update password if provided
            if (newUser.password) {
                updates.password = newUser.password;
            }
            await fetchApi(`/api/admin/users/${editingUser.email}`, 'PUT', updates); // Using email as ID for simplicity
            alert('User updated successfully!');
            setShowAddUserModal(false);
            setEditingUser(null);
            setNewUser({ email: '', password: '', fullName: '', role: 'patient' });
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userEmail: string) => {
        if (!window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/users/${userEmail}`, 'DELETE');
            alert('User deleted successfully!');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeUserStatus = async (userEmail: string, currentStatus: 'active' | 'inactive') => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        if (!window.confirm(`Are you sure you want to change status of ${userEmail} to ${newStatus}?`)) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/users/${userEmail}`, 'PUT', { status: newStatus });
            alert('User status updated successfully!');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading users...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-danger mb-4 text-center">User Management</h2>
            <MessageDisplay message={message} />

            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-primary" onClick={() => { setEditingUser(null); setNewUser({ email: '', password: '', fullName: '', role: 'patient' }); setShowAddUserModal(true); }}>
                    Add New User
                </button>
            </div>

            {users.length === 0 ? (
                <p className="text-muted text-center">No users found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.email}>
                                    <td>{u.email}</td>
                                    <td>{u.full_name}</td>
                                    <td><span className={`badge bg-${u.role === 'admin' || u.role === 'superadmin' ? 'danger' : u.role === 'doctor' ? 'success' : 'primary'}`}>{u.role.toUpperCase()}</span></td>
                                    <td><span className={`badge bg-${u.status === 'active' ? 'success' : 'secondary'}`}>{u.status.toUpperCase()}</span></td>
                                    <td>
                                        <button className="btn btn-sm btn-info me-2" onClick={() => handleEditUserClick(u)} disabled={loading}>Edit</button>
                                        <button className={`btn btn-sm ${u.status === 'active' ? 'btn-warning' : 'btn-success'} me-2`} onClick={() => handleChangeUserStatus(u.email, u.status)} disabled={loading}>
                                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.email)} disabled={loading}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit User Modal */}
            {showAddUserModal && (
                <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{editingUser ? 'Edit User' : 'Add New User'}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAddUserModal(false)}></button>
                            </div>
                            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label htmlFor="userEmail" className="form-label">Email:</label>
                                        <input type="email" className="form-control" id="userEmail" name="email" value={newUser.email} onChange={handleNewUserChange} required disabled={!!editingUser} />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userPassword" className="form-label">Password {editingUser ? '(leave blank to keep current)' : ''}:</label>
                                        <input type="password" className="form-control" id="userPassword" name="password" value={newUser.password} onChange={handleNewUserChange} required={!editingUser} />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userFullName" className="form-label">Full Name:</label>
                                        <input type="text" className="form-control" id="userFullName" name="fullName" value={newUser.fullName} onChange={handleNewUserChange} required />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userRole" className="form-label">Role:</label>
                                        <select className="form-select" id="userRole" name="role" value={newUser.role} onChange={handleNewUserChange} required>
                                            <option value="patient">Patient</option>
                                            <option value="doctor">Doctor</option>
                                            <option value="admin">Admin</option>
                                            {user?.profile?.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Close</button>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading && <LoadingSpinner />}
                                        {editingUser ? 'Update User' : 'Add User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('adminDashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Admin Service Management Page
const AdminServiceManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [currentService, setCurrentService] = useState<Service | null>(null);
    const [newServiceData, setNewServiceData] = useState<Omit<Service, 'id'>>({
        name: '', description: '', base_price: 0, estimated_duration_minutes: 0, image: ''
    });

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/services'); // Reusing patient API for now
            setServices(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin') {
            fetchServices();
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewServiceData(prev => ({
            ...prev,
            [name]: name === 'base_price' || name === 'estimated_duration_minutes' ? parseFloat(value) || 0 : value
        }));
    };

    const handleAddOrUpdateService = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (currentService) {
                await fetchApi(`/api/admin/services/${currentService.id}`, 'PUT', newServiceData);
                alert('Service updated successfully!');
            } else {
                await fetchApi('/api/admin/services', 'POST', newServiceData);
                alert('Service added successfully!');
            }
            setShowServiceModal(false);
            setCurrentService(null);
            setNewServiceData({ name: '', description: '', base_price: 0, estimated_duration_minutes: 0, image: '' });
            fetchServices();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteService = async (serviceId: string) => {
        if (!window.confirm('Are you sure you want to delete this service?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/services/${serviceId}`, 'DELETE');
            alert('Service deleted successfully!');
            fetchServices();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (service: Service) => {
        setCurrentService(service);
        setNewServiceData(service);
        setShowServiceModal(true);
    };

    const openAddModal = () => {
        setCurrentService(null);
        setNewServiceData({ name: '', description: '', base_price: 0, estimated_duration_minutes: 0, image: '' });
        setShowServiceModal(true);
    };


    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading services...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) return <div className="alert alert-warning text-center m-4">Access denied.</div>;


    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-danger mb-4 text-center">Service Management</h2>
            <MessageDisplay message={message} />

            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-primary" onClick={openAddModal}>Add New Service</button>
            </div>

            {services.length === 0 ? (
                <p className="text-muted text-center">No services found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Price</th>
                                <th>Duration (min)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map(service => (
                                <tr key={service.id}>
                                    <td>{service.name}</td>
                                    <td>{service.description}</td>
                                    <td>₹{service.base_price}</td>
                                    <td>{service.estimated_duration_minutes}</td>
                                    <td>
                                        <button className="btn btn-sm btn-info me-2" onClick={() => openEditModal(service)} disabled={loading}>Edit</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteService(service.id)} disabled={loading}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Service Modal */}
            {showServiceModal && (
                <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{currentService ? 'Edit Service' : 'Add New Service'}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowServiceModal(false)}></button>
                            </div>
                            <form onSubmit={handleAddOrUpdateService}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label htmlFor="serviceName" className="form-label">Service Name:</label>
                                        <input type="text" className="form-control" id="serviceName" name="name" value={newServiceData.name} onChange={handleInputChange} required />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="serviceDescription" className="form-label">Description:</label>
                                        <textarea className="form-control" id="serviceDescription" name="description" value={newServiceData.description} onChange={handleInputChange} rows={3} required></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="servicePrice" className="form-label">Base Price (₹):</label>
                                        <input type="number" className="form-control" id="servicePrice" name="base_price" value={newServiceData.base_price} onChange={handleInputChange} required min="0" step="0.01" />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="serviceDuration" className="form-label">Estimated Duration (minutes):</label>
                                        <input type="number" className="form-control" id="serviceDuration" name="estimated_duration_minutes" value={newServiceData.estimated_duration_minutes} onChange={handleInputChange} required min="1" />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="serviceImage" className="form-label">Image URL:</label>
                                        <input type="text" className="form-control" id="serviceImage" name="image" value={newServiceData.image} onChange={handleInputChange} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowServiceModal(false)}>Close</button>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading && <LoadingSpinner />}
                                        {currentService ? 'Update Service' : 'Add Service'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('adminDashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Admin Offer Management Page
const AdminOfferManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
    const [newOfferData, setNewOfferData] = useState<Omit<Offer, 'id'>>({
        title: '', description: '', image_url: '', link_url: ''
    });

    const fetchOffers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/offers'); // Reusing patient API for now
            setOffers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin') {
            fetchOffers();
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewOfferData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddOrUpdateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (currentOffer) {
                await fetchApi(`/api/admin/offers/${currentOffer.id}`, 'PUT', newOfferData);
                alert('Offer updated successfully!');
            } else {
                await fetchApi('/api/admin/offers', 'POST', newOfferData);
                alert('Offer added successfully!');
            }
            setShowOfferModal(false);
            setCurrentOffer(null);
            setNewOfferData({ title: '', description: '', image_url: '', link_url: '' });
            fetchOffers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOffer = async (offerId: string) => {
        if (!window.confirm('Are you sure you want to delete this offer?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/offers/${offerId}`, 'DELETE');
            alert('Offer deleted successfully!');
            fetchOffers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (offer: Offer) => {
        setCurrentOffer(offer);
        setNewOfferData(offer);
        setShowOfferModal(true);
    };

    const openAddModal = () => {
        setCurrentOffer(null);
        setNewOfferData({ title: '', description: '', image_url: '', link_url: '' });
        setShowOfferModal(true);
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading offers...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-danger mb-4 text-center">Offer Management</h2>
            <MessageDisplay message={message} />

            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-primary" onClick={openAddModal}>Add New Offer</button>
            </div>

            {offers.length === 0 ? (
                <p className="text-muted text-center">No offers found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Description</th>
                                <th>Image</th>
                                <th>Link</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offers.map(offer => (
                                <tr key={offer.id}>
                                    <td>{offer.title}</td>
                                    <td>{offer.description}</td>
                                    <td><img src={offer.image_url} alt={offer.title} style={{ width: '80px', height: 'auto', borderRadius: '5px' }}
                                             onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/80x50/cccccc/000000?text=Offer"; }} /></td>
                                    <td><a href={offer.link_url} target="_blank" rel="noopener noreferrer">View</a></td>
                                    <td>
                                        <button className="btn btn-sm btn-info me-2" onClick={() => openEditModal(offer)} disabled={loading}>Edit</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteOffer(offer.id)} disabled={loading}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Offer Modal */}
            {showOfferModal && (
                <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{currentOffer ? 'Edit Offer' : 'Add New Offer'}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowOfferModal(false)}></button>
                            </div>
                            <form onSubmit={handleAddOrUpdateOffer}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label htmlFor="offerTitle" className="form-label">Title:</label>
                                        <input type="text" className="form-control" id="offerTitle" name="title" value={newOfferData.title} onChange={handleInputChange} required />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="offerDescription" className="form-label">Description:</label>
                                        <textarea className="form-control" id="offerDescription" name="description" value={newOfferData.description} onChange={handleInputChange} rows={3} required></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="offerImage" className="form-label">Image URL:</label>
                                        <input type="text" className="form-control" id="offerImage" name="image_url" value={newOfferData.image_url} onChange={handleInputChange} required />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="offerLink" className="form-label">Link URL:</label>
                                        <input type="text" className="form-control" id="offerLink" name="link_url" value={newOfferData.link_url} onChange={handleInputChange} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowOfferModal(false)}>Close</button>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading && <LoadingSpinner />}
                                        {currentOffer ? 'Update Offer' : 'Add Offer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('adminDashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Admin Appointment Oversight Page
const AdminAppointmentOversightPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAllAppointments = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/admin/appointments');
            setAppointments(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin') {
            fetchAllAppointments();
        }
    }, [user]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading all appointments...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-danger mb-4 text-center">All Appointments Oversight</h2>
            <MessageDisplay message={message} />

            {appointments.length === 0 ? (
                <p className="text-muted text-center">No appointments found across the platform.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Patient</th>
                                <th>Service</th>
                                <th>Doctor</th>
                                <th>Date/Time</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(appt => (
                                <tr key={appt.id}>
                                    <td>{appt.id.substring(0, 8)}...</td>
                                    <td>{appt.patientName || 'N/A'}</td>
                                    <td>{appt.serviceName || 'N/A'}</td>
                                    <td>{appt.doctorName || 'Unassigned'}</td>
                                    <td>{appt.requested_date} @ {appt.requested_time_slot}</td>
                                    <td><span className={`badge bg-${
                                        appt.status === 'completed' ? 'success' :
                                        appt.status.includes('cancelled') || appt.status.includes('declined') ? 'danger' :
                                        appt.status === 'pending_assignment' ? 'warning text-dark' : 'info text-dark'
                                    }`}>{appt.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                                    <td><span className={`badge bg-${appt.payment_status === 'paid' ? 'success' : 'secondary'}`}>{appt.payment_status.toUpperCase()}</span></td>
                                    <td>₹{appt.estimated_cost}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('adminDashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Admin System Settings Page (Placeholder)
const AdminSystemSettingsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();

    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '700px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-danger mb-4 text-center">System Settings</h2>
                <p className="text-muted text-center">
                    This page is a placeholder for administrative system settings.
                    Here you would configure global application parameters, integrations, and other core functionalities.
                </p>
                <ul className="list-group list-group-flush mt-4">
                    <li className="list-group-item">Manage notification templates</li>
                    <li className="list-group-item">Configure payment gateway settings</li>
                    <li className="list-group-item">Set default service zones</li>
                    <li className="list-group-item">Manage data retention policies</li>
                </ul>
                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('adminDashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// --- SuperAdmin Workflow Components ---

// SuperAdmin Global User Management Page (Similar to Admin, but can manage admins too)
const SuperAdminGlobalUserManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'patient' as UserProfile['role'] });
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchApi('/api/admin/users'); // Reuse admin API, backend handles superadmin check
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.profile?.role === 'superadmin') {
            fetchUsers();
        }
    }, [user]);

    const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewUser(prev => ({ ...prev, [name]: value }));
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/api/create-user-with-role', 'POST', {
                email: newUser.email,
                password: newUser.password,
                displayName: newUser.fullName,
                role: newUser.role,
            });
            alert('User added successfully!');
            setShowAddUserModal(false);
            setNewUser({ email: '', password: '', fullName: '', role: 'patient' });
            fetchUsers(); // Refresh list
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditUserClick = (userToEdit: UserProfile) => {
        setEditingUser(userToEdit);
        setNewUser({
            email: userToEdit.email,
            password: '', // Password cannot be pre-filled for security
            fullName: userToEdit.full_name,
            role: userToEdit.role,
        });
        setShowAddUserModal(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setLoading(true);
        setError(null);
        try {
            const updates: any = {
                full_name: newUser.fullName,
                role: newUser.role,
                status: editingUser.status, // Keep current status unless explicitly changed
            };
            // Only update password if provided
            if (newUser.password) {
                updates.password = newUser.password;
            }
            await fetchApi(`/api/admin/users/${editingUser.email}`, 'PUT', updates); // Using email as ID for simplicity
            alert('User updated successfully!');
            setShowAddUserModal(false);
            setEditingUser(null);
            setNewUser({ email: '', password: '', fullName: '', role: 'patient' });
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userEmail: string) => {
        if (!window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/users/${userEmail}`, 'DELETE');
            alert('User deleted successfully!');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeUserStatus = async (userEmail: string, currentStatus: 'active' | 'inactive') => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        if (!window.confirm(`Are you sure you want to change status of ${userEmail} to ${newStatus}?`)) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/api/admin/users/${userEmail}`, 'PUT', { status: newStatus });
            alert('User status updated successfully!');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading users...</p>
            </div>
        </div>
    );
    if (error) return <div className="alert alert-danger text-center m-4">{error}</div>;
    if (!user || user.profile?.role !== 'superadmin') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <h2 className="h3 fw-bold text-dark mb-4 text-center">Global User Management</h2>
            <MessageDisplay message={message} />

            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-primary" onClick={() => { setEditingUser(null); setNewUser({ email: '', password: '', fullName: '', role: 'patient' }); setShowAddUserModal(true); }}>
                    Add New User
                </button>
            </div>

            {users.length === 0 ? (
                <p className="text-muted text-center">No users found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.email}>
                                    <td>{u.email}</td>
                                    <td>{u.full_name}</td>
                                    <td><span className={`badge bg-${u.role === 'admin' || u.role === 'superadmin' ? 'danger' : u.role === 'doctor' ? 'success' : 'primary'}`}>{u.role.toUpperCase()}</span></td>
                                    <td><span className={`badge bg-${u.status === 'active' ? 'success' : 'secondary'}`}>{u.status.toUpperCase()}</span></td>
                                    <td>
                                        <button className="btn btn-sm btn-info me-2" onClick={() => handleEditUserClick(u)} disabled={loading}>Edit</button>
                                        <button className={`btn btn-sm ${u.status === 'active' ? 'btn-warning' : 'btn-success'} me-2`} onClick={() => handleChangeUserStatus(u.email, u.status)} disabled={loading}>
                                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.email)} disabled={loading}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit User Modal */}
            {showAddUserModal && (
                <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{editingUser ? 'Edit User' : 'Add New User'}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAddUserModal(false)}></button>
                            </div>
                            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label htmlFor="userEmail" className="form-label">Email:</label>
                                        <input type="email" className="form-control" id="userEmail" name="email" value={newUser.email} onChange={handleNewUserChange} required disabled={!!editingUser} />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userPassword" className="form-label">Password {editingUser ? '(leave blank to keep current)' : ''}:</label>
                                        <input type="password" className="form-control" id="userPassword" name="password" value={newUser.password} onChange={handleNewUserChange} required={!editingUser} />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userFullName" className="form-label">Full Name:</label>
                                        <input type="text" className="form-control" id="userFullName" name="fullName" value={newUser.fullName} onChange={handleNewUserChange} required />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="userRole" className="form-label">Role:</label>
                                        <select className="form-select" id="userRole" name="role" value={newUser.role} onChange={handleNewUserChange} required>
                                            <option value="patient">Patient</option>
                                            <option value="doctor">Doctor</option>
                                            <option value="admin">Admin</option>
                                            <option value="superadmin">Super Admin</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Close</button>
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading && <LoadingSpinner />}
                                        {editingUser ? 'Update User' : 'Add User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('superAdminDashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// SuperAdmin Platform Configuration Page (Placeholder)
const SuperAdminPlatformConfigPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();

    if (!user || user.profile?.role !== 'superadmin') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '700px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-dark mb-4 text-center">Platform Configuration</h2>
                <p className="text-muted text-center">
                    This page is a placeholder for super administrative platform configurations.
                    Here you would manage critical system-wide settings, integrations, and core parameters.
                </p>
                <ul className="list-group list-group-flush mt-4">
                    <li className="list-group-item">Manage global pricing rules</li>
                    <li className="list-group-item">Configure third-party API integrations</li>
                    <li className="list-group-item">System-wide feature toggles</li>
                    <li className="list-group-item">Backup and restore options</li>
                </ul>
                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('superAdminDashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// SuperAdmin Financial Oversight Page (Placeholder)
const SuperAdminFinancialOversightPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();

    if (!user || user.profile?.role !== 'superadmin') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '800px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-dark mb-4 text-center">Financial Oversight</h2>
                <p className="text-muted text-center">
                    This page is a placeholder for comprehensive financial oversight.
                    You would typically see aggregated data, revenue reports, payout summaries, and transaction details here.
                </p>
                <ul className="list-group list-group-flush mt-4">
                    <li className="list-group-item">Total Revenue Overview</li>
                    <li className="list-group-item">Doctor Payouts Summary</li>
                    <li className="list-group-item">Platform Fee Reports</li>
                    <li className="list-group-item">Detailed Transaction Logs</li>
                </ul>
                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('superAdminDashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};

// SuperAdmin Audit Logs Page (Placeholder)
const SuperAdminAuditLogsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user } = useAuth();

    if (!user || user.profile?.role !== 'superadmin') return <div className="alert alert-warning text-center m-4">Access denied.</div>;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '800px', margin: 'auto' }}>
                <h2 className="h3 fw-bold text-dark mb-4 text-center">Audit Logs</h2>
                <p className="text-muted text-center">
                    This page is a placeholder for detailed system audit logs.
                    It would show a chronological record of significant events and actions performed by users and the system.
                </p>
                <ul className="list-group list-group-flush mt-4">
                    <li className="list-group-item">User Login/Logout Activity</li>
                    <li className="list-group-item">Admin Actions (User/Service/Offer changes)</li>
                    <li className="list-group-item">Appointment Status Changes</li>
                    <li className="list-group-item">System Errors and Warnings</li>
                </ul>
                <div className="d-flex justify-content-center mt-4">
                    <button className="btn btn-link" onClick={() => navigate('superAdminDashboard')}>Back to Dashboard</button>
                </div>
            </div>
        </div>
    );
};



// DoctorDashboard Component
const DoctorDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard'); // State for doctor dashboard navigation
    const [pageData, setPageData] = useState<any>(null); // State to pass data between pages

    const navigate = (page: string, data: any = null) => {
        setCurrentPage(page);
        setPageData(data);
    };

    const renderDoctorPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 text-center" style={{ maxWidth: '600px', width: '100%' }}>
                        <h3 className="h4 fw-bold text-success mb-3">Doctor Dashboard</h3>
                        <p className="text-muted">Welcome, Dr. {user?.profile?.full_name || user?.email || 'Doctor'}!</p>
                        <p className="small text-break">Your User ID: <span className="font-monospace">{user?.uid}</span></p>
                        <p className="text-muted">Specialization: {user?.profile?.specialization || 'N/A'}</p>
                        <p className="text-muted">Current Availability: {user?.profile?.is_available_now ? <span className="text-success">Available</span> : <span className="text-danger">Not Available</span>}</p>

                        <div className="mt-4 d-grid gap-3">
                            <button className="btn btn-success" onClick={() => navigate('availableRequests')}>View Available Requests</button>
                            <button className="btn btn-outline-success" onClick={() => navigate('doctorAppointments')}>My Appointments</button>
                            <button className="btn btn-outline-info" onClick={() => navigate('doctorAvailability')}>Manage Availability</button>
                            <button className="btn btn-outline-primary" onClick={() => navigate('doctorEarnings')}>View Earnings History</button>
                            <button className="btn btn-outline-secondary" onClick={() => navigate('doctorHelp')}>Help & Resources</button>
                        </div>
                        <button onClick={logout} className="btn btn-secondary mt-3">Logout</button>
                    </div>
                );
            case 'availableRequests':
                return <AvailableRequestsPage navigate={navigate} />;
            case 'doctorAppointments':
                return <MyAppointmentsPage navigate={navigate} />;
            case 'doctorAvailability':
                return <DoctorAvailabilityPage navigate={navigate} />;
            case 'doctorEarnings':
                return <DoctorEarningsPage navigate={navigate} />;
            case 'doctorHelp':
                return <DoctorHelpPage navigate={navigate} />;
            default:
                return <div className="alert alert-danger">Page not found for doctor.</div>;
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
            {renderDoctorPage()}
        </div>
    );
};


// AdminDashboard Component
const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [pageData, setPageData] = useState<any>(null);

    const navigate = (page: string, data: any = null) => {
        setCurrentPage(page);
        setPageData(data);
    };

    const renderAdminPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 text-center" style={{ maxWidth: '600px', width: '100%' }}>
                        <h3 className="h4 fw-bold text-danger mb-3">Admin Dashboard</h3>
                        <p className="text-muted">Welcome, Admin {user?.profile?.full_name || user?.email || 'Administrator'}!</p>
                        <p className="small text-break">Your User ID: <span className="font-monospace">{user?.uid}</span></p>
                        <div className="mt-4 d-grid gap-3">
                            <button className="btn btn-danger" onClick={() => navigate('adminUserManagement')}>Manage Users</button>
                            <button className="btn btn-outline-danger" onClick={() => navigate('adminServiceManagement')}>Manage Services</button>
                            <button className="btn btn-outline-danger" onClick={() => navigate('adminOfferManagement')}>Manage Offers</button>
                            <button className="btn btn-outline-danger" onClick={() => navigate('adminAppointmentOversight')}>Appointment Oversight</button>
                            <button className="btn btn-outline-danger" onClick={() => navigate('adminSystemSettings')}>System Settings</button>
                        </div>
                        <button onClick={logout} className="btn btn-secondary mt-3">Logout</button>
                    </div>
                );
            case 'adminUserManagement':
                return <AdminUserManagementPage navigate={navigate} />;
            case 'adminServiceManagement':
                return <AdminServiceManagementPage navigate={navigate} />;
            case 'adminOfferManagement':
                return <AdminOfferManagementPage navigate={navigate} />;
            case 'adminAppointmentOversight':
                return <AdminAppointmentOversightPage navigate={navigate} />;
            case 'adminSystemSettings':
                return <AdminSystemSettingsPage navigate={navigate} />;
            default:
                return <div className="alert alert-danger">Page not found for admin.</div>;
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
            {renderAdminPage()}
        </div>
    );
};

// SuperAdminDashboard Component
const SuperAdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [pageData, setPageData] = useState<any>(null);

    const navigate = (page: string, data: any = null) => {
        setCurrentPage(page);
        setPageData(data);
    };

    const renderSuperAdminPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 text-center" style={{ maxWidth: '700px', width: '100%' }}>
                        <h3 className="h4 fw-bold text-dark mb-3">Super Admin Dashboard</h3>
                        <p className="text-muted">Welcome, Super Admin {user?.profile?.full_name || user?.email || 'Super Administrator'}!</p>
                        <p className="small text-break">Your User ID: <span className="font-monospace">{user?.uid}</span></p>
                        <div className="mt-4 d-grid gap-3">
                            <button className="btn btn-dark" onClick={() => navigate('superAdminGlobalUserManagement')}>Global User Management</button>
                            <button className="btn btn-outline-dark" onClick={() => navigate('superAdminPlatformConfig')}>Platform Configuration</button>
                            <button className="btn btn-outline-dark" onClick={() => navigate('superAdminFinancialOversight')}>Financial Oversight</button>
                            <button className="btn btn-outline-dark" onClick={() => navigate('superAdminAuditLogs')}>Audit Logs</button>
                        </div>
                        <button onClick={logout} className="btn btn-secondary mt-3">Logout</button>
                    </div>
                );
            case 'superAdminGlobalUserManagement':
                return <SuperAdminGlobalUserManagementPage navigate={navigate} />;
            case 'superAdminPlatformConfig':
                return <SuperAdminPlatformConfigPage navigate={navigate} />;
            case 'superAdminFinancialOversight':
                return <SuperAdminFinancialOversightPage navigate={navigate} />;
            case 'superAdminAuditLogs':
                return <SuperAdminAuditLogsPage navigate={navigate} />;
            default:
                return <div className="alert alert-danger">Page not found for super admin.</div>;
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
            {renderSuperAdminPage()}
        </div>
    );
};


// Main App Component
const App: React.FC = () => {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100">
                <div className="card shadow-lg p-5 rounded-3 text-center">
                    <LoadingSpinner />
                    <p className="text-muted mt-3">Loading application...</p>
                </div>
            </div>
        );
    }

    if (user) {
        // User is logged in, show appropriate dashboard based on role
        switch (user.profile?.role) {
            case 'patient':
                return <PatientDashboard />;
            case 'doctor':
                return <DoctorDashboard />;
            case 'admin':
                return <AdminDashboard />;
            case 'superadmin':
                return <SuperAdminDashboard />;
            default:
                // Fallback for users without a specific role or if profile is still loading
                return (
                    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                        <div className="card shadow-lg p-5 rounded-3 text-center" style={{ maxWidth: '450px', width: '100%' }}>
                            <h3 className="h4 fw-bold text-dark mb-3">Welcome, {user.email}!</h3>
                            <p className="text-muted">Your role is not defined or profile is loading. Please contact support.</p>
                            <p className="small text-break">Your User ID: <span className="font-monospace">{user.uid}</span></p>
                            <button onClick={logout} className="btn btn-secondary mt-3">Logout</button>
                        </div>
                    </div>
                );
        }
    }

    // User is not logged in, show authentication form
    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
            <AuthForm />
        </div>
    );
};

export default App;
