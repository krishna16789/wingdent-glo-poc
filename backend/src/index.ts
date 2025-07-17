import express from 'express';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK
let serviceAccount;
try {
    serviceAccount = require(path.resolve(__dirname, '../firebase-adminsdk.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    console.error("Ensure 'firebase-adminsdk.json' is in the 'backend/' directory and FIREBASE_PROJECT_ID is set in .env");
    process.exit(1);
}

const db = admin.firestore(); // Get Firestore instance
const auth = admin.auth(); // Get Auth instance

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Allow your React frontend to access
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));
app.use(express.json());

// Helper to get app ID
const getAppId = () => process.env.CANVAS_APP_ID || 'default-app-id';

// Middleware to verify Firebase ID Token and attach user to request
const verifyIdToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No authorization token provided.' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        (req as any).user = decodedToken; // Attach decoded token to request
        next();
    } catch (error) {
        console.error("Error verifying Firebase ID token:", error);
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

// Middleware to check for Admin role
const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || (!user.role || (user.role !== 'admin' && user.role !== 'superadmin'))) {
        return res.status(403).json({ message: 'Access denied. Requires Admin privileges.' });
    }
    next();
};

// Middleware to check for SuperAdmin role
const isSuperAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Requires Super Admin privileges.' });
    }
    next();
};

// Simple Test Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Wingdent-Glo Backend is running!' });
});

// Example: Create a user with custom claims (Admin SDK functionality)
// This endpoint is used by Admin/SuperAdmin UI to create new users with roles.
app.post('/api/create-user-with-role', verifyIdToken, isAdmin, async (req, res) => {
    const { email, password, displayName, role } = req.body;
    const callerUser = (req as any).user; // The admin/superadmin making the request

    if (!email || !password || !displayName || !role) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    // SuperAdmin can create any role, Admin can create patient/doctor roles
    if (callerUser.role === 'admin' && (role === 'admin' || role === 'superadmin')) {
        return res.status(403).json({ message: 'Admins cannot create other Admin or SuperAdmin users.' });
    }

    try {
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: displayName,
            emailVerified: false,
            disabled: false,
        });

        await auth.setCustomUserClaims(userRecord.uid, { role: role });

        const appId = getAppId();
        const userDocRef = db.collection(`artifacts/${appId}/users/${userRecord.uid}/users`).doc(userRecord.uid);

        await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(userDocRef);
            if (docSnap.exists) {
                transaction.update(userDocRef, {
                    full_name: displayName,
                    role: role,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_login_at: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                transaction.set(userDocRef, {
                    email: email,
                    full_name: displayName,
                    role: role,
                    status: 'active',
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_login_at: admin.firestore.FieldValue.serverTimestamp(),
                    phone_number: '',
                    profile_picture_url: '',
                });
            }
        });

        res.status(201).json({
            message: 'User created successfully with role and profile!',
            uid: userRecord.uid,
            email: userRecord.email,
            role: role,
        });

    } catch (error: any) {
        console.error("Error creating user with role and profile:", error);
        let errorMessage = 'Failed to create user.';
        if (error.code === 'auth/email-already-exists') {
            errorMessage = 'The email address is already in use by another account.';
        } else if (error.code === 'auth/invalid-password') {
            errorMessage = 'The password must be at least 6 characters long.';
        }
        res.status(500).json({ message: errorMessage, error: error.message });
    }
});


// API: POST /api/seed-services - Populates Firestore with initial service data
app.post('/api/seed-services', async (req, res) => {
    const appId = getAppId();
    const servicesCollectionRef = db.collection(`artifacts/${appId}/services`);

    const initialServices = [
        { id: 'service1', name: 'Home Dental Consultation', description: 'Comprehensive check-up at your home.', base_price: 500, estimated_duration_minutes: 30, image: 'https://placehold.co/100x100/007bff/ffffff?text=Consult' },
        { id: 'service2', name: 'Scaling & Polishing', description: 'Professional teeth cleaning.', base_price: 1500, estimated_duration_minutes: 60, image: 'https://placehold.co/100x100/28a745/ffffff?text=Scaling' },
        { id: 'service3', name: 'Teeth Whitening', description: 'Brighten your smile with professional whitening.', base_price: 3000, estimated_duration_minutes: 90, image: 'https://placehold.co/100x100/ffc107/000000?text=Whiten' },
    ];

    try {
        const batch = db.batch();
        let servicesAdded = 0;

        for (const service of initialServices) {
            const serviceDocRef = servicesCollectionRef.doc(service.id);
            const docSnap = await serviceDocRef.get();
            if (!docSnap.exists) { // Only add if it doesn't already exist
                batch.set(serviceDocRef, {
                    ...service,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                servicesAdded++;
            }
        }
        await batch.commit();
        res.status(200).json({ message: `${servicesAdded} services seeded successfully (skipped existing ones).` });
    } catch (error) {
        console.error("Error seeding services:", error);
        res.status(500).json({ message: 'Failed to seed services.' });
    }
});

// NEW API: POST /api/seed-offers - Populates Firestore with initial offer data
app.post('/api/seed-offers', async (req, res) => {
    const appId = getAppId();
    const offersCollectionRef = db.collection(`artifacts/${appId}/offers`);

    const initialOffers = [
        { id: 'offer1', title: '20% Off First Consultation', description: 'New patients get 20% off their first home consultation.', image_url: 'https://placehold.co/600x200/6f42c1/ffffff?text=Offer+1', link_url: '#' },
        { id: 'offer2', title: 'Free Scaling with Whitening', description: 'Book a teeth whitening session and get scaling for free!', image_url: 'https://placehold.co/600x200/fd7e14/ffffff?text=Offer+2', link_url: '#' },
    ];

    try {
        const batch = db.batch();
        let offersAdded = 0;

        for (const offer of initialOffers) {
            const offerDocRef = offersCollectionRef.doc(offer.id);
            const docSnap = await offerDocRef.get();
            if (!docSnap.exists) { // Only add if it doesn't already exist
                batch.set(offerDocRef, {
                    ...offer,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                offersAdded++;
            }
        }
        await batch.commit();
        res.status(200).json({ message: `${offersAdded} offers seeded successfully (skipped existing ones).` });
    } catch (error) {
        console.error("Error seeding offers:", error);
        res.status(500).json({ message: 'Failed to seed offers.' });
    }
});


// --- Patient Workflow APIs (Protected by verifyIdToken middleware) ---
app.use(verifyIdToken); // All routes below this will require authentication

const getUserId = (req: express.Request) => (req as any).user.uid;

// GET /api/services - Fetch available dental services and their rates
app.get('/api/services', async (req, res) => {
    const appId = getAppId();
    try {
        // Now fetching from Firestore instead of mock data
        const servicesSnapshot = await db.collection(`artifacts/${appId}/services`).orderBy('name').get();
        const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(services);
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: 'Failed to fetch services.' });
    }
});

// GET /api/offers - Fetch active offer banners
app.get('/api/offers', async (req, res) => {
    const appId = getAppId();
    try {
        // Fetch from Firestore 'offers' collection
        const offersSnapshot = await db.collection(`artifacts/${appId}/offers`).orderBy('created_at', 'desc').get();
        const offers = offersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(offers);
    } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).json({ message: 'Failed to fetch offers.' });
    }
});

// GET /api/addresses - Fetch addresses for the authenticated patient
app.get('/api/addresses', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    try {
        const addressesRef = db.collection(`artifacts/${appId}/users/${userId}/addresses`);
        const snapshot = await addressesRef.get();
        const addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(addresses);
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).json({ message: 'Failed to fetch addresses.' });
    }
});

// POST /api/addresses - Add a new address for the authenticated patient
app.post('/api/addresses', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const { address_line_1, address_line_2, city, state, zip_code, label, is_default } = req.body;

    if (!address_line_1 || !city || !state || !zip_code || !label) {
        return res.status(400).json({ message: 'Missing required address fields.' });
    }

    try {
        // If setting as default, unset other defaults for this user
        if (is_default) {
            const addressesRef = db.collection(`artifacts/${appId}/users/${userId}/addresses`);
            const defaultSnapshot = await addressesRef.where('is_default', '==', true).get();
            const batch = db.batch();
            defaultSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { is_default: false });
            });
            await batch.commit();
        }

        const newAddressRef = await db.collection(`artifacts/${appId}/users/${userId}/addresses`).add({
            user_id: userId,
            address_line_1,
            address_line_2: address_line_2 || '',
            city,
            state,
            zip_code,
            label,
            is_default: is_default || false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const newAddressSnap = await newAddressRef.get();
        res.status(201).json({ id: newAddressSnap.id, ...newAddressSnap.data() });
    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ message: 'Failed to add address.' });
    }
});

// PUT /api/addresses/:id - Update an address for the authenticated patient
app.put('/api/addresses/:id', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const addressId = req.params.id;
    const updates = req.body;

    try {
        const addressRef = db.collection(`artifacts/${appId}/users/${userId}/addresses`).doc(addressId);
        const docSnap = await addressRef.get();

        if (!docSnap.exists || docSnap.data()?.user_id !== userId) {
            return res.status(404).json({ message: 'Address not found or unauthorized.' });
        }

        // If setting as default, unset other defaults for this user
        if (updates.is_default) {
            const addressesRef = db.collection(`artifacts/${appId}/users/${userId}/addresses`);
            const defaultSnapshot = await addressesRef.where('is_default', '==', true).get();
            const batch = db.batch();
            defaultSnapshot.docs.forEach(doc => {
                if (doc.id !== addressId) { // Exclude the current address from unsetting
                    batch.update(doc.ref, { is_default: false });
                }
            });
            await batch.commit();
        }

        await addressRef.update({
            ...updates,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const updatedAddressSnap = await addressRef.get();
        res.status(200).json({ id: updatedAddressSnap.id, ...updatedAddressSnap.data() });
    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({ message: 'Failed to update address.' });
    }
});

// DELETE /api/addresses/:id - Delete an address for the authenticated patient
app.delete('/api/addresses/:id', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const addressId = req.params.id;

    try {
        const addressRef = db.collection(`artifacts/${appId}/users/${userId}/addresses`).doc(addressId);
        const docSnap = await addressRef.get();

        if (!docSnap.exists || docSnap.data()?.user_id !== userId) {
            return res.status(404).json({ message: 'Address not found or unauthorized.' });
        }

        await addressRef.delete();
        res.status(200).json({ message: 'Address deleted successfully.' });
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ message: 'Failed to delete address.' });
    }
});


// POST /api/appointments - Raise a new service request
app.post('/api/appointments', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const { service_id, address_id, requested_date, requested_time_slot, estimated_cost } = req.body;

    if (!service_id || !address_id || !requested_date || !requested_time_slot || estimated_cost === undefined) {
        return res.status(400).json({ message: 'Missing required appointment fields.' });
    }

    try {
        // Validation: Check if service_id and address_id exist and belong to user
        const serviceSnap = await db.collection(`artifacts/${appId}/services`).doc(service_id).get();
        const addressSnap = await db.collection(`artifacts/${appId}/users/${userId}/addresses`).doc(address_id).get();

        if (!serviceSnap.exists) { // Check if service exists in Firestore
            return res.status(400).json({ message: 'Invalid service ID: Service not found in database.' });
        }
        if (!addressSnap.exists || addressSnap.data()?.user_id !== userId) {
            return res.status(400).json({ message: 'Invalid address ID or address does not belong to user.' });
        }

        const newAppointmentRef = await db.collection(`artifacts/${appId}/users/${userId}/appointments`).add({
            patient_id: userId,
            service_id,
            address_id,
            requested_date,
            requested_time_slot,
            estimated_cost,
            status: 'pending_assignment', // Initial status
            payment_status: 'pending',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const newAppointmentSnap = await newAppointmentRef.get();
        res.status(201).json({ id: newAppointmentSnap.id, ...newAppointmentSnap.data() });
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({ message: 'Failed to create appointment.' });
    }
});

// GET /api/appointments - Get all appointments for the authenticated patient
app.get('/api/appointments', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    try {
        const appointmentsRef = db.collection(`artifacts/${appId}/users/${userId}/appointments`);
        const snapshot = await appointmentsRef.orderBy('created_at', 'desc').get(); // Order by creation time
        const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ message: 'Failed to fetch appointments.' });
    }
});

// GET /api/appointments/:id - Get a single appointment by ID for the authenticated patient
app.get('/api/appointments/:id', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const appointmentId = req.params.id;

    try {
        const appointmentRef = db.collection(`artifacts/${appId}/users/${userId}/appointments`).doc(appointmentId);
        const docSnap = await appointmentRef.get();

        if (!docSnap.exists || docSnap.data()?.patient_id !== userId) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }

        // Optionally, enrich appointment data with service name and address details
        const appointmentData = docSnap.data();
        let serviceName = 'Unknown Service';
        let addressDetails: any = null;

        if (appointmentData?.service_id) {
            const serviceSnap = await db.collection(`artifacts/${appId}/services`).doc(appointmentData.service_id).get();
            if (serviceSnap.exists) {
                serviceName = serviceSnap.data()?.name;
            }
        }

        if (appointmentData?.address_id) {
            const addressSnap = await db.collection(`artifacts/${appId}/users/${userId}/addresses`).doc(appointmentData.address_id).get();
            if (addressSnap.exists) {
                addressDetails = addressSnap.data();
            }
        }

        res.status(200).json({
            id: docSnap.id,
            ...appointmentData,
            serviceName,
            addressDetails,
        });
    } catch (error) {
        console.error("Error fetching single appointment:", error);
        res.status(500).json({ message: 'Failed to fetch appointment.' });
    }
});


// PUT /api/appointments/:id - Reschedule or cancel an appointment
app.put('/api/appointments/:id', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const appointmentId = req.params.id;
    const { status, reschedule_date, reschedule_time_slot, cancellation_reason } = req.body;

    try {
        const appointmentRef = db.collection(`artifacts/${appId}/users/${userId}/appointments`).doc(appointmentId);
        const docSnap = await appointmentRef.get();

        if (!docSnap.exists || docSnap.data()?.patient_id !== userId) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }

        const updates: any = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

        if (status === 'rescheduled') {
            if (!reschedule_date || !reschedule_time_slot) {
                return res.status(400).json({ message: 'Reschedule date and time slot are required.' });
            }
            updates.status = 'rescheduled';
            updates.requested_date = reschedule_date; // Update to new date
            updates.requested_time_slot = reschedule_time_slot; // Update to new time slot
            updates.reschedule_reason = 'Patient requested reschedule'; // Or a more specific reason
            // You might also need to clear doctor assignment if rescheduling
            updates.doctor_id = null;
            updates.auto_routed_doctor_id = null;
            updates.status = 'pending_assignment'; // Reset status for re-assignment
        } else if (status === 'cancelled_by_patient') {
            updates.status = 'cancelled_by_patient';
            updates.cancellation_reason = cancellation_reason || 'Patient cancelled.';
            // Handle potential refund logic here
        } else {
            return res.status(400).json({ message: 'Invalid status update for patient.' });
        }

        await appointmentRef.update(updates);
        const updatedAppointmentSnap = await appointmentRef.get();
        res.status(200).json({ id: updatedAppointmentSnap.id, ...updatedAppointmentSnap.data() });
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).json({ message: 'Failed to update appointment.' });
    }
});

// POST /api/payments - Process payment for an appointment
app.post('/api/payments', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const { appointment_id, amount, currency, payment_method, payment_gateway_transaction_id } = req.body;

    if (!appointment_id || amount === undefined || !currency || !payment_method) {
        return res.status(400).json({ message: 'Missing required payment fields.' });
    }

    try {
        const appointmentRef = db.collection(`artifacts/${appId}/users/${userId}/appointments`).doc(appointment_id);
        const appointmentSnap = await appointmentRef.get();

        if (!appointmentSnap.exists || appointmentSnap.data()?.patient_id !== userId) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }
        if (appointmentSnap.data()?.payment_status === 'paid') {
            return res.status(400).json({ message: 'Payment already processed for this appointment.' });
        }

        // Simulate payment gateway interaction (in a real app, this would be an external API call)
        const paymentSuccessful = Math.random() > 0.1; // 90% success rate for simulation

        const paymentStatus = paymentSuccessful ? 'successful' : 'failed';
        const transactionId = payment_gateway_transaction_id || `TXN_${Date.now()}`;

        // Calculate fee distribution (mock percentages for now)
        const platformFeePercentage = 0.15; // 15%
        const doctorSharePercentage = 0.70; // 70%
        const adminFeePercentage = 0.15; // 15%

        const platform_fee_amount = amount * platformFeePercentage;
        const doctor_fee_amount = amount * doctorSharePercentage;
        const admin_fee_amount = amount * adminFeePercentage;


        const newPaymentRef = await db.collection(`artifacts/${appId}/users/${userId}/payments`).add({
            appointment_id,
            patient_id: userId,
            amount,
            currency,
            payment_gateway_transaction_id: transactionId,
            status: paymentStatus,
            payment_method,
            platform_fee_amount,
            doctor_fee_amount,
            admin_fee_amount,
            transaction_date: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update appointment payment status
        await appointmentRef.update({
            payment_status: paymentStatus === 'successful' ? 'paid' : 'failed',
            payment_id: newPaymentRef.id,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (paymentSuccessful) {
            res.status(200).json({ message: 'Payment processed successfully!', paymentId: newPaymentRef.id, status: paymentStatus });
        } else {
            res.status(400).json({ message: 'Payment failed. Please try again.', status: paymentStatus });
        }

    } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ message: 'Failed to process payment.' });
    }
});

// POST /api/feedback - Submit feedback/ratings for a completed appointment
app.post('/api/feedback', async (req, res) => {
    const userId = getUserId(req);
    const appId = getAppId();
    const { appointment_id, rating, comments } = req.body;

    if (!appointment_id || rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Appointment ID and a rating (1-5) are required.' });
    }

    try {
        const appointmentRef = db.collection(`artifacts/${appId}/users/${userId}/appointments`).doc(appointment_id);
        const appointmentSnap = await appointmentRef.get();

        if (!appointmentSnap.exists || appointmentSnap.data()?.patient_id !== userId) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized.' });
        }
        if (appointmentSnap.data()?.status !== 'completed' && appointmentSnap.data()?.status !== 'paid') {
            return res.status(400).json({ message: 'Feedback can only be submitted for completed or paid appointments.' });
        }

        await db.collection(`artifacts/${appId}/users/${userId}/feedback`).add({
            patient_id: userId,
            appointment_id,
            doctor_id: appointmentSnap.data()?.doctor_id || null, // Associate with doctor if available
            rating,
            comments: comments || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Optionally, update doctor's average rating in their profile
        // This would involve fetching the doctor's current rating, adding the new one, and updating.
        // For simplicity, this is omitted here but is a common next step.

        res.status(201).json({ message: 'Feedback submitted successfully!' });
    } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).json({ message: 'Failed to submit feedback.' });
    }
});

// --- Doctor Workflow APIs ---

// GET /api/doctor/requests/available - Fetch available service requests for the authenticated doctor's zones
app.get('/api/doctor/requests/available', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();

    try {
        // First, get the doctor's assigned zones
        const doctorDocRef = db.collection(`artifacts/${appId}/users/${doctorId}/users`).doc(doctorId);
        const doctorSnap = await doctorDocRef.get();
        const doctorData = doctorSnap.data();

        if (!doctorSnap.exists || doctorData?.role !== 'doctor') {
            return res.status(403).json({ message: 'Access denied. User is not a doctor or profile not found.' });
        }

        // Assuming doctor's zones are stored in their profile or a separate collection
        // For now, we'll fetch all pending assignments and assume a doctor can see them.
        // In a real scenario, you'd filter by doctor's assigned zones.
        const availableRequestsSnapshot = await db.collectionGroup('appointments') // Use collectionGroup to query across all user appointments
            .where('status', '==', 'pending_assignment')
            .get();

        const requests = await Promise.all(availableRequestsSnapshot.docs.map(async (doc) => {
            const appointmentData = doc.data();
            // Fetch patient details
            const patientDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.patient_id}/users`).doc(appointmentData.patient_id).get();
            const patientName = patientDoc.exists ? patientDoc.data()?.full_name || patientDoc.data()?.email : 'Unknown Patient';

            // Fetch service details
            const serviceDoc = await db.collection(`artifacts/${appId}/services`).doc(appointmentData.service_id).get();
            const serviceName = serviceDoc.exists ? serviceDoc.data()?.name : 'Unknown Service';

            // Fetch address details
            const addressDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.patient_id}/addresses`).doc(appointmentData.address_id).get();
            const addressDetails = addressDoc.exists ? addressDoc.data() : null;

            return {
                id: doc.id,
                ...appointmentData,
                patientName,
                serviceName,
                addressDetails,
            };
        }));

        res.status(200).json(requests);
    } catch (error) {
        console.error("Error fetching available doctor requests:", error);
        res.status(500).json({ message: 'Failed to fetch available requests.' });
    }
});

// POST /api/doctor/requests/:id/accept - Doctor accepts a service request
app.post('/api/doctor/requests/:id/accept', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();
    const appointmentId = req.params.id;

    try {
        // Find the appointment using a collection group query
        const appointmentQuerySnapshot = await db.collectionGroup('appointments')
            .where(admin.firestore.FieldPath.documentId(), '==', appointmentId)
            .get();

        if (appointmentQuerySnapshot.empty) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        const appointmentDoc = appointmentQuerySnapshot.docs[0]; // Get the actual document snapshot
        const appointmentData = appointmentDoc.data();

        if (appointmentData.status !== 'pending_assignment') {
            return res.status(400).json({ message: 'Appointment is not in pending assignment status.' });
        }

        await appointmentDoc.ref.update({ // Use .ref to get the DocumentReference
            status: 'assigned',
            doctor_id: doctorId,
            assigned_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const updatedAppointmentSnap = await appointmentDoc.ref.get();
        res.status(200).json({ message: 'Appointment accepted successfully!', appointment: { id: updatedAppointmentSnap.id, ...updatedAppointmentSnap.data() } });
    } catch (error) {
        console.error("Error accepting appointment:", error);
        res.status(500).json({ message: 'Failed to accept appointment.' });
    }
});

// POST /api/doctor/requests/:id/decline - Doctor declines a service request
app.post('/api/doctor/requests/:id/decline', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();
    const appointmentId = req.params.id;
    const { reason } = req.body; // Optional reason for declining

    try {
        const appointmentQuerySnapshot = await db.collectionGroup('appointments')
            .where(admin.firestore.FieldPath.documentId(), '==', appointmentId)
            .get();

        if (appointmentQuerySnapshot.empty) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        const appointmentDoc = appointmentQuerySnapshot.docs[0];
        const appointmentData = appointmentDoc.data();

        if (appointmentData.status !== 'pending_assignment') {
            return res.status(400).json({ message: 'Appointment is not in pending assignment status.' });
        }

        await appointmentDoc.ref.update({
            status: 'declined_by_doctor',
            declined_reason: reason || 'Doctor declined the request.',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const updatedAppointmentSnap = await appointmentDoc.ref.get();
        res.status(200).json({ message: 'Appointment declined successfully!', appointment: { id: updatedAppointmentSnap.id, ...updatedAppointmentSnap.data() } });
    } catch (error) {
        console.error("Error declining appointment:", error);
        res.status(500).json({ message: 'Failed to decline appointment.' });
    }
});


// GET /api/doctor/appointments - Get all appointments assigned to the authenticated doctor
app.get('/api/doctor/appointments', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();
    const statusFilter = req.query.status as string; // Optional filter for status

    try {
        let appointmentsQuery: admin.firestore.Query = db.collectionGroup('appointments')
            .where('doctor_id', '==', doctorId);

        if (statusFilter) {
            appointmentsQuery = appointmentsQuery.where('status', '==', statusFilter);
        }

        const snapshot = await appointmentsQuery.orderBy('requested_date', 'desc').get();

        const appointments = await Promise.all(snapshot.docs.map(async (doc) => {
            const appointmentData = doc.data();
            // Fetch patient details
            const patientDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.patient_id}/users`).doc(appointmentData.patient_id).get();
            const patientName = patientDoc.exists ? patientDoc.data()?.full_name || patientDoc.data()?.email : 'Unknown Patient';

            // Fetch service details
            const serviceDoc = await db.collection(`artifacts/${appId}/services`).doc(appointmentData.service_id).get();
            const serviceName = serviceDoc.exists ? serviceDoc.data()?.name : 'Unknown Service';

            // Fetch address details
            const addressDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.patient_id}/addresses`).doc(appointmentData.address_id).get();
            const addressDetails = addressDoc.exists ? addressDoc.data() : null;

            return {
                id: doc.id,
                ...appointmentData,
                patientName,
                serviceName,
                addressDetails,
            };
        }));
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching doctor's appointments:", error);
        res.status(500).json({ message: 'Failed to fetch appointments.' });
    }
});

// PUT /api/doctor/appointments/:id/status - Doctor updates appointment status
app.put('/api/doctor/appointments/:id/status', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();
    const appointmentId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['on_the_way', 'arrived', 'service_started', 'completed'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        const appointmentQuerySnapshot = await db.collectionGroup('appointments')
            .where(admin.firestore.FieldPath.documentId(), '==', appointmentId)
            .get();

        if (appointmentQuerySnapshot.empty) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        const appointmentDoc = appointmentQuerySnapshot.docs[0];
        const appointmentData = appointmentDoc.data();

        if (appointmentData.doctor_id !== doctorId) {
            return res.status(403).json({ message: 'Unauthorized: You are not assigned to this appointment.' });
        }

        const updates: any = {
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (status === 'service_started') {
            updates.actual_start_time = admin.firestore.FieldValue.serverTimestamp();
        } else if (status === 'completed') {
            updates.actual_end_time = admin.firestore.FieldValue.serverTimestamp();
            // Set payment status to pending if completed, to trigger patient payment
            updates.payment_status = 'pending';
        }

        await appointmentDoc.ref.update(updates);
        const updatedAppointmentSnap = await appointmentDoc.ref.get();
        res.status(200).json({ message: `Appointment status updated to ${status}.`, appointment: { id: updatedAppointmentSnap.id, ...updatedAppointmentSnap.data() } });
    } catch (error) {
        console.error("Error updating appointment status:", error);
        res.status(500).json({ message: 'Failed to update appointment status.' });
    }
});

// PUT /api/doctor/availability - Doctor updates their availability schedule
app.put('/api/doctor/availability', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();
    const { availability_schedule, is_available_now } = req.body;

    if (availability_schedule === undefined && is_available_now === undefined) {
        return res.status(400).json({ message: 'No availability data provided.' });
    }

    try {
        const doctorDocRef = db.collection(`artifacts/${appId}/users/${doctorId}/users`).doc(doctorId);
        const doctorSnap = await doctorDocRef.get();

        if (!doctorSnap.exists || doctorSnap.data()?.role !== 'doctor') {
            return res.status(403).json({ message: 'Access denied. User is not a doctor or profile not found.' });
        }

        const updates: any = {
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (availability_schedule !== undefined) {
            // Store as JSON string if complex, or direct object if simple
            updates.availability_schedule = JSON.stringify(availability_schedule);
        }
        if (is_available_now !== undefined) {
            updates.is_available_now = is_available_now;
        }

        await doctorDocRef.update(updates);
        const updatedDoctorSnap = await doctorDocRef.get();
        res.status(200).json({ message: 'Availability updated successfully!', doctorProfile: updatedDoctorSnap.data() });
    } catch (error) {
        console.error("Error updating doctor availability:", error);
        res.status(500).json({ message: 'Failed to update availability.' });
    }
});

// GET /api/doctor/earnings - Get doctor's earnings and payment history
app.get('/api/doctor/earnings', async (req, res) => {
    const doctorId = getUserId(req);
    const appId = getAppId();

    try {
        // Fetch payments where this doctor was involved (via appointment_id)
        // This requires a collectionGroup query on 'payments' and then joining with appointments
        // For simplicity, we'll assume payments directly reference doctor_id for now,
        // or iterate through appointments to find related payments.
        // A more robust solution might involve a dedicated 'doctor_payouts' collection.

        // Approach: Find all appointments assigned to this doctor, then find payments for those appointments.
        const appointmentsSnapshot = await db.collectionGroup('appointments')
            .where('doctor_id', '==', doctorId)
            .where('payment_status', '==', 'paid') // Only consider paid appointments for earnings
            .get();

        let totalEarnings = 0;
        const earningsHistory: any[] = [];

        for (const apptDoc of appointmentsSnapshot.docs) {
            const appointmentData = apptDoc.data();
            const paymentsSnapshot = await db.collectionGroup('payments')
                .where('appointment_id', '==', apptDoc.id)
                .where('status', '==', 'successful')
                .get();

            for (const paymentDoc of paymentsSnapshot.docs) {
                const paymentData = paymentDoc.data();
                if (paymentData.doctor_fee_amount) {
                    totalEarnings += paymentData.doctor_fee_amount;
                    earningsHistory.push({
                        appointment_id: apptDoc.id,
                        payment_id: paymentDoc.id,
                        amount: paymentData.doctor_fee_amount,
                        currency: paymentData.currency,
                        transaction_date: paymentData.transaction_date,
                        service_id: appointmentData.service_id, // For context
                    });
                }
            }
        }

        res.status(200).json({ totalEarnings, earningsHistory });
    } catch (error) {
        console.error("Error fetching doctor earnings:", error);
        res.status(500).json({ message: 'Failed to fetch earnings.' });
    }
});


// --- Admin Workflow APIs (Protected by verifyIdToken and isAdmin middlewares) ---
app.use('/api/admin', verifyIdToken, isAdmin); // All routes below this will require Admin or SuperAdmin privileges

// GET /api/admin/users - Fetch all user profiles (for Admin/SuperAdmin)
app.get('/api/admin/users', async (req, res) => {
    const appId = getAppId();
    try {
        // Fetch all user profiles from the 'users' subcollection under each UID
        const users: any[] = [];
        const usersCollectionGroup = await db.collectionGroup('users').get(); // Query all 'users' subcollections

        for (const docSnap of usersCollectionGroup.docs) {
            const userData = docSnap.data();
            // Ensure the user profile belongs to the current app instance (optional, but good for multi-app setups)
            if (docSnap.ref.path.startsWith(`artifacts/${appId}/users/`)) {
                users.push({ id: docSnap.id, ...userData });
            }
        }
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching all users for admin:", error);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

// PUT /api/admin/users/:email - Update user profile (role, status, full_name, password)
app.put('/api/admin/users/:email', async (req, res) => {
    const targetEmail = req.params.email;
    const { full_name, role, status, password } = req.body;
    const callerUser = (req as any).user; // The admin/superadmin making the request
    const appId = getAppId();

    try {
        const userRecord = await auth.getUserByEmail(targetEmail);
        const targetUid = userRecord.uid;

        // Prevent admin from modifying superadmin or other admins (unless caller is superadmin)
        const targetUserProfileSnap = await db.collection(`artifacts/${appId}/users/${targetUid}/users`).doc(targetUid).get();
        const targetRole = targetUserProfileSnap.data()?.role;

        if (callerUser.role === 'admin' && (targetRole === 'admin' || targetRole === 'superadmin')) {
            return res.status(403).json({ message: 'Admins cannot modify other Admin or SuperAdmin users.' });
        }
        // Prevent admin from elevating roles to admin/superadmin
        if (callerUser.role === 'admin' && (role === 'admin' || role === 'superadmin') && targetRole !== role) {
             return res.status(403).json({ message: 'Admins cannot elevate user roles to Admin or SuperAdmin.' });
        }
        // Superadmin can change any role, including other admins (but not self)
        if (callerUser.role === 'superadmin' && targetUid === callerUser.uid && role !== callerUser.role) {
            return res.status(403).json({ message: 'Super Admin cannot change their own role via this endpoint.' });
        }


        const updates: any = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (role !== undefined) {
            updates.role = role;
            // Update custom claims in Firebase Auth
            await auth.setCustomUserClaims(targetUid, { role: role });
        }
        if (status !== undefined) {
            updates.status = status;
            // Enable/disable user in Firebase Auth
            await auth.updateUser(targetUid, { disabled: status === 'inactive' });
        }
        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        // Update password if provided (only if caller is superadmin or admin and not trying to change another admin's password)
        if (password && password.length >= 6) {
            if (callerUser.role === 'admin' && (targetRole === 'admin' || targetRole === 'superadmin')) {
                // This case is already covered by the role modification check, but good to be explicit for password reset
                return res.status(403).json({ message: 'Admins cannot reset passwords for other Admin or SuperAdmin users.' });
            }
            await auth.updateUser(targetUid, { password: password });
        } else if (password && password.length < 6) {
             return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }


        await db.collection(`artifacts/${appId}/users/${targetUid}/users`).doc(targetUid).update(updates);

        res.status(200).json({ message: 'User updated successfully!' });
    } catch (error: any) {
        console.error("Error updating user:", error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(500).json({ message: error.message || 'Failed to update user.' });
    }
});

// DELETE /api/admin/users/:email - Delete a user
app.delete('/api/admin/users/:email', async (req, res) => {
    const targetEmail = req.params.email;
    const callerUser = (req as any).user; // The admin/superadmin making the request
    const appId = getAppId();

    try {
        const userRecord = await auth.getUserByEmail(targetEmail);
        const targetUid = userRecord.uid;

        // Prevent admin from deleting superadmin or other admins (unless caller is superadmin)
        const targetUserProfileSnap = await db.collection(`artifacts/${appId}/users/${targetUid}/users`).doc(targetUid).get();
        const targetRole = targetUserProfileSnap.data()?.role;

        if (callerUser.role === 'admin' && (targetRole === 'admin' || targetRole === 'superadmin')) {
            return res.status(403).json({ message: 'Admins cannot delete other Admin or SuperAdmin users.' });
        }
        // Prevent superadmin from deleting themselves
        if (callerUser.role === 'superadmin' && targetUid === callerUser.uid) {
            return res.status(403).json({ message: 'Super Admin cannot delete their own account.' });
        }

        // Delete user from Firebase Auth
        await auth.deleteUser(targetUid);

        // Delete user's profile and subcollections from Firestore
        // This is a complex operation and requires careful handling for subcollections.
        // For simplicity, we'll just delete the main user profile document here.
        // In a real-world app, you'd use Firebase Cloud Functions to recursively delete subcollections.
        await db.collection(`artifacts/${appId}/users/${targetUid}/users`).doc(targetUid).delete();
        // You would also need to delete their addresses, appointments, payments, feedback etc.
        // For example:
        // const addressesSnapshot = await db.collection(`artifacts/${appId}/users/${targetUid}/addresses`).get();
        // const batch = db.batch();
        // addressesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        // await batch.commit();

        res.status(200).json({ message: 'User deleted successfully!' });
    } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(500).json({ message: error.message || 'Failed to delete user.' });
    }
});

// POST /api/admin/services - Add a new service
app.post('/api/admin/services', async (req, res) => {
    const appId = getAppId();
    const { name, description, base_price, estimated_duration_minutes, image } = req.body;

    if (!name || !description || base_price === undefined || estimated_duration_minutes === undefined) {
        return res.status(400).json({ message: 'Missing required service fields.' });
    }

    try {
        const newServiceRef = db.collection(`artifacts/${appId}/services`).doc(); // Auto-generate ID
        await newServiceRef.set({
            name,
            description,
            base_price: parseFloat(base_price),
            estimated_duration_minutes: parseInt(estimated_duration_minutes),
            image: image || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const newServiceSnap = await newServiceRef.get();
        res.status(201).json({ message: 'Service added successfully!', service: { id: newServiceSnap.id, ...newServiceSnap.data() } });
    } catch (error) {
        console.error("Error adding service:", error);
        res.status(500).json({ message: 'Failed to add service.' });
    }
});

// PUT /api/admin/services/:id - Update an existing service
app.put('/api/admin/services/:id', async (req, res) => {
    const appId = getAppId();
    const serviceId = req.params.id;
    const updates = req.body;

    try {
        const serviceRef = db.collection(`artifacts/${appId}/services`).doc(serviceId);
        const docSnap = await serviceRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Service not found.' });
        }

        const updateData: any = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.base_price !== undefined) updateData.base_price = parseFloat(updates.base_price);
        if (updates.estimated_duration_minutes !== undefined) updateData.estimated_duration_minutes = parseInt(updates.estimated_duration_minutes);
        if (updates.image !== undefined) updateData.image = updates.image;

        await serviceRef.update(updateData);
        const updatedServiceSnap = await serviceRef.get();
        res.status(200).json({ message: 'Service updated successfully!', service: { id: updatedServiceSnap.id, ...updatedServiceSnap.data() } });
    } catch (error) {
        console.error("Error updating service:", error);
        res.status(500).json({ message: 'Failed to update service.' });
    }
});

// DELETE /api/admin/services/:id - Delete a service
app.delete('/api/admin/services/:id', async (req, res) => {
    const appId = getAppId();
    const serviceId = req.params.id;

    try {
        const serviceRef = db.collection(`artifacts/${appId}/services`).doc(serviceId);
        const docSnap = await serviceRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Service not found.' });
        }

        await serviceRef.delete();
        res.status(200).json({ message: 'Service deleted successfully!' });
    } catch (error) {
        console.error("Error deleting service:", error);
        res.status(500).json({ message: 'Failed to delete service.' });
    }
});

// POST /api/admin/offers - Add a new offer
app.post('/api/admin/offers', async (req, res) => {
    const appId = getAppId();
    const { title, description, image_url, link_url } = req.body;

    if (!title || !description || !image_url) {
        return res.status(400).json({ message: 'Missing required offer fields.' });
    }

    try {
        const newOfferRef = db.collection(`artifacts/${appId}/offers`).doc(); // Auto-generate ID
        await newOfferRef.set({
            title,
            description,
            image_url,
            link_url: link_url || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        const newOfferSnap = await newOfferRef.get();
        res.status(201).json({ message: 'Offer added successfully!', offer: { id: newOfferSnap.id, ...newOfferSnap.data() } });
    } catch (error) {
        console.error("Error adding offer:", error);
        res.status(500).json({ message: 'Failed to add offer.' });
    }
});

// PUT /api/admin/offers/:id - Update an existing offer
app.put('/api/admin/offers/:id', async (req, res) => {
    const appId = getAppId();
    const offerId = req.params.id;
    const updates = req.body;

    try {
        const offerRef = db.collection(`artifacts/${appId}/offers`).doc(offerId);
        const docSnap = await offerRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Offer not found.' });
        }

        const updateData: any = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
        if (updates.link_url !== undefined) updateData.link_url = updates.link_url;

        await offerRef.update(updateData);
        const updatedOfferSnap = await offerRef.get();
        res.status(200).json({ message: 'Offer updated successfully!', offer: { id: updatedOfferSnap.id, ...updatedOfferSnap.data() } });
    } catch (error) {
        console.error("Error updating offer:", error);
        res.status(500).json({ message: 'Failed to update offer.' });
    }
});

// DELETE /api/admin/offers/:id - Delete an offer
app.delete('/api/admin/offers/:id', async (req, res) => {
    const appId = getAppId();
    const offerId = req.params.id;

    try {
        const offerRef = db.collection(`artifacts/${appId}/offers`).doc(offerId);
        const docSnap = await offerRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Offer not found.' });
        }

        await offerRef.delete();
        res.status(200).json({ message: 'Offer deleted successfully!' });
    } catch (error) {
        console.error("Error deleting offer:", error);
        res.status(500).json({ message: 'Failed to delete offer.' });
    }
});

// GET /api/admin/appointments - Get all appointments across the platform (for Admin/SuperAdmin)
app.get('/api/admin/appointments', async (req, res) => {
    const appId = getAppId();
    try {
        // Fetch all appointments using a collection group query
        const appointmentsSnapshot = await db.collectionGroup('appointments').get();

        const appointments = await Promise.all(appointmentsSnapshot.docs.map(async (doc) => {
            const appointmentData = doc.data();
            let patientName = 'Unknown Patient';
            let serviceName = 'Unknown Service';
            let doctorName = 'Unassigned';

            // Fetch patient details
            if (appointmentData.patient_id) {
                const patientDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.patient_id}/users`).doc(appointmentData.patient_id).get();
                patientName = patientDoc.exists ? patientDoc.data()?.full_name || patientDoc.data()?.email : patientName;
            }

            // Fetch service details
            if (appointmentData.service_id) {
                const serviceDoc = await db.collection(`artifacts/${appId}/services`).doc(appointmentData.service_id).get();
                serviceName = serviceDoc.exists ? serviceDoc.data()?.name : serviceName;
            }

            // Fetch doctor details
            if (appointmentData.doctor_id) {
                const doctorDoc = await db.collection(`artifacts/${appId}/users/${appointmentData.doctor_id}/users`).doc(appointmentData.doctor_id).get();
                doctorName = doctorDoc.exists ? doctorDoc.data()?.full_name || doctorDoc.data()?.email : doctorName;
            }

            return {
                id: doc.id,
                ...appointmentData,
                patientName,
                serviceName,
                doctorName,
            };
        }));
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Error fetching all appointments for admin oversight:", error);
        res.status(500).json({ message: 'Failed to fetch all appointments.' });
    }
});

// --- SuperAdmin Specific APIs (Protected by verifyIdToken and isSuperAdmin middlewares) ---
app.use('/api/superadmin', verifyIdToken, isSuperAdmin); // All routes below this will require SuperAdmin privileges

// Placeholder for Global Settings Management
app.get('/api/superadmin/platform-config', (req, res) => {
    res.status(200).json({ message: 'Platform configuration endpoint (placeholder).' });
});

// Placeholder for Financial Oversight
app.get('/api/superadmin/financial-oversight', (req, res) => {
    res.status(200).json({ message: 'Financial oversight endpoint (placeholder).' });
});

// Placeholder for Audit Logs
app.get('/api/superadmin/audit-logs', (req, res) => {
    res.status(200).json({ message: 'Audit logs endpoint (placeholder).' });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
