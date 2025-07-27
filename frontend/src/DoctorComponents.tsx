// frontend/src/DoctorComponents.tsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc, updateDoc, query, where, serverTimestamp, Timestamp, writeBatch, setDoc, collectionGroup, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext'; // UserProfile is imported from types now, but useAuth is needed for user context
import { LoadingSpinner, MessageDisplay, CustomModal } from './CommonComponents';
import { Appointment, Service, Address, Feedback, Prescription, HealthRecord, Consultation, MedicationItem, UserProfile } from './types'; // Import Prescription, HealthRecord, Consultation
import { DashboardProps } from './PatientComponents'; // Import DashboardProps for consistency

// Import the new PrescriptionViewerPage
import { PrescriptionViewerPage } from './PrescriptionViewerPage'; // NEW IMPORT

// Extend the Feedback type for local use in this component
interface EnrichedFeedback extends Feedback {
    patientName?: string;
    serviceName?: string;
}

// Helper function to get status badge class
const getStatusBadgeClass = (status: Appointment['status']) => {
    switch (status) {
        case 'pending_assignment': return 'bg-warning text-dark';
        case 'assigned':
        case 'confirmed': return 'bg-info text-dark';
        case 'on_the_way': return 'bg-primary';
        case 'arrived': return 'bg-dark';
        case 'service_started': return 'bg-secondary';
        case 'completed': return 'bg-success';
        case 'cancelled_by_patient':
        case 'declined_by_doctor':
        case 'rescheduled': return 'bg-danger';
        default: return 'bg-light text-dark';
    }
};

// Doctor Dashboard
export const DoctorDashboard: React.FC<DashboardProps> = ({ navigate, currentPage, pageData }) => {
    const { user, logout, db, appId, message } = useAuth(); // Added message from useAuth
    const [assignedAppointmentsCount, setAssignedAppointmentsCount] = useState<number>(0);
    const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState<number>(0);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [errorDashboard, setErrorDashboard] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoadingDashboard(true);
            setErrorDashboard(null);
            if (!db || !appId || !user?.uid) {
                setErrorDashboard("Firestore not initialized or user not logged in.");
                setLoadingDashboard(false);
                return;
            }
            try {
                // Fetch assigned appointments using collectionGroup
                // Requires composite index: appointments (doctor_id ASC, status ASC)
                const qAssigned = query(
                    collectionGroup(db, 'appointments'),
                    where('doctor_id', '==', user.uid),
                    where('status', 'in', ['assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started'])
                );
                const assignedSnapshot = await getDocs(qAssigned);
                let assignedCount = 0;
                assignedSnapshot.docs.forEach(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        assignedCount++;
                    }
                });
                setAssignedAppointmentsCount(assignedCount);

                // Fetch pending assignments (appointments not yet assigned to any doctor)
                // Requires composite index: appointments (status ASC, doctor_id ASC)
                const qPending = query(
                    collectionGroup(db, 'appointments'),
                    where('status', '==', 'pending_assignment'),
                    where('doctor_id', '==', null) // Appointments with no doctor assigned
                );
                const pendingSnapshot = await getDocs(qPending);
                let pendingCount = 0;
                pendingSnapshot.docs.forEach(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        pendingCount++;
                    }
                });
                setPendingAppointmentsCount(pendingCount);

            } catch (err: any) {
                console.error("Error fetching doctor dashboard data:", err);
                setErrorDashboard(err.message);
            } finally {
                setLoadingDashboard(false);
            }
        };

        if (user && db && appId && currentPage === 'dashboard') {
            fetchDashboardData();
        }
    }, [user, db, appId, currentPage]);


    const renderDoctorPage = () => {
        switch (currentPage) {
            case 'dashboard':
                if (loadingDashboard) return (
                    <div className="d-flex justify-content-center align-items-center min-vh-100">
                        <div className="text-center p-5">
                            <LoadingSpinner /><p className="mt-3 text-muted">Loading dashboard...</p>
                        </div>
                    </div>
                );
                if (errorDashboard) return <MessageDisplay message={{ text: errorDashboard, type: "error" }} />;
                if (!user || user.profile?.role !== 'doctor') {
                    return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
                }

                return (
                    <div className="container py-4">
                        <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                            <h2 className="h3 fw-bold text-info mb-4 text-center">Doctor Dashboard</h2>
                            <MessageDisplay message={message} /> {/* Display messages from AuthContext */}

                            <div className="text-center mb-4">
                                <img
                                    src={user?.photoURL || "https://placehold.co/100x100/17a2b8/ffffff?text=D"}
                                    onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/17a2b8/ffffff?text=D"; }}
                                    alt="Profile"
                                    className="rounded-circle mb-3"
                                    style={{ width: '100px', height: '100px', objectFit: 'cover', border: '3px solid #17a2b8' }}
                                />
                                <h4 className="fw-bold text-dark">{user?.profile?.full_name || user?.email || 'Doctor'}</h4>
                                <p className="text-muted mb-1">Role: {user?.profile?.role}</p>
                                <p className="small text-break text-muted">User ID: <span className="font-monospace">{user?.uid}</span></p>
                            </div>

                            <div className="row g-4 mb-5">
                                <div className="col-md-6">
                                    <div className="card h-100 bg-info text-white shadow-sm rounded-3">
                                        <div className="card-body d-flex flex-column justify-content-between">
                                            <h5 className="card-title fw-bold">My Assigned Appointments</h5>
                                            <p className="card-text">View and manage appointments assigned to you.</p>
                                            <p className="card-text fs-4 fw-bold">{assignedAppointmentsCount} Active</p>
                                            <button className="btn btn-light text-info mt-3" onClick={() => navigate('myAppointments')}>View Appointments</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="card h-100 bg-warning text-dark shadow-sm rounded-3">
                                        <div className="card-body d-flex flex-column justify-content-between">
                                            <h5 className="card-title fw-bold">Pending Assignments</h5>
                                            <p className="card-text">Appointments awaiting a doctor's assignment.</p>
                                            <p className="card-text fs-4 fw-bold">{pendingAppointmentsCount} Pending</p>
                                            <button className="btn btn-light text-warning mt-3" onClick={() => navigate('pendingAppointments')}>View Pending</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4 mb-4">
                                <div className="col-md-6">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-info">Patient Data & Records</h5>
                                            <div className="d-grid gap-2 mt-3">
                                                <button className="btn btn-outline-info" onClick={() => navigate('managePatientRecords')}>Manage Patient Records</button>
                                                {/* <button className="btn btn-outline-info" onClick={() => navigate('addConsultationPrescription')}>Add Consultation/Prescription</button> */}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-info">Profile & Availability</h5>
                                            <div className="d-grid gap-2 mt-3">
                                                <button className="btn btn-outline-info" onClick={() => navigate('manageAvailability')}>Manage Availability</button>
                                                <button className="btn btn-outline-secondary" onClick={() => navigate('doctorProfile')}>My Profile</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4">
                                <div className="col-md-12">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-info">Reports & Feedback</h5>
                                            <div className="d-grid gap-2 mt-3">
                                                <button className="btn btn-outline-secondary" onClick={() => navigate('patientFeedback')}>View Patient Feedback</button>
                                                <button className="btn btn-outline-secondary" onClick={() => navigate('doctorReports')}>Performance Reports</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'myAppointments':
                return <MyAppointmentsPage navigate={navigate} />;
            case 'pendingAppointments':
                return <PendingAppointmentsPage navigate={navigate} />;
            case 'manageAvailability':
                return <ManageAvailabilityPage navigate={navigate} />;
            case 'doctorProfile':
                return <DoctorProfilePage navigate={navigate} />;
            case 'patientFeedback':
                return <PatientFeedbackPage navigate={navigate} />;
            case 'doctorReports':
                return <DoctorReportsPage navigate={navigate} />;
            case 'appointmentDetails':
                return <DoctorAppointmentDetailsPage navigate={navigate} appointment={pageData?.appointment} />;
            // NEW CASES FOR DOCTOR DASHBOARD
            case 'managePatientRecords':
                return <ManagePatientRecordsPage navigate={navigate} />;
            case 'patientHealthDataView':
                return <PatientHealthDataViewPage navigate={navigate} patientId={pageData.patientId} patientName={pageData.patientName} />;
            case 'addPrescription':
                return <AddPrescriptionPage navigate={navigate} patientId={pageData.patientId} patientName={pageData.patientName} appointmentId={pageData.appointmentId} />;
            case 'addHealthRecord':
                return <AddHealthRecordPage navigate={navigate} patientId={pageData.patientId} patientName={pageData.patientName} appointmentId={pageData.appointmentId} />;
            case 'addConsultation':
                return <AddConsultationPage navigate={navigate} patientId={pageData.patientId} patientName={pageData.patientName} appointmentId={pageData.appointmentId} />;
            case 'prescriptionViewer': // NEW CASE for Prescription Viewer
                return <PrescriptionViewerPage navigate={navigate} patientId={pageData.patientId} prescriptionId={pageData.prescriptionId} />;
            default:
                return <MessageDisplay message={{ text: "Page not found.", type: "error" }} />;
        }
    };

    return (
        <div className="container py-4">
            {renderDoctorPage()}
        </div>
    );
};

// My Appointments Page (Doctor)
export const MyAppointmentsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth(); // Added setMessage
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('upcoming'); // 'upcoming', 'completed', 'cancelled'

    const fetchMyAppointments = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            // Use collectionGroup to query all 'appointments' subcollections
            // Requires composite index: appointments (doctor_id ASC, status ASC)
            let q = query(collectionGroup(db, 'appointments'), where('doctor_id', '==', user.uid));

            if (filterStatus === 'upcoming') {
                q = query(q, where('status', 'in', ['assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started']));
            } else if (filterStatus === 'completed') {
                q = query(q, where('status', '==', 'completed'));
            } else if (filterStatus === 'cancelled') {
                q = query(q, where('status', 'in', ['cancelled_by_patient', 'declined_by_doctor', 'rescheduled']));
            }

            const snapshot = await getDocs(q);
            let fetchedAppointments: Appointment[] = [];

            // Pre-fetch all patients and services
            const patientsMap = new Map<string, UserProfile>();
            const servicesMap = new Map<string, Service>();

            const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
            allUsersSnapshot.docs.forEach(docSnap => {
                const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                    patientsMap.set(docSnap.id, profileData);
                }
            });

            const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`)); // CORRECTED PATH
            servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));


            for (const docSnap of snapshot.docs) {
                const apptData = docSnap.data() as Appointment;
                // Ensure the appointment belongs to the current app instance
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] !== appId) {
                    continue; // Skip if not for this app instance
                }

                let serviceName = servicesMap.get(apptData.service_id)?.name || 'Unknown Service';
                let patientName = patientsMap.get(apptData.patient_id)?.full_name || patientsMap.get(apptData.patient_id)?.email || 'Unknown Patient';
                let addressDetails: Address | undefined;

                // Fetch address details (from patient's address collection)
                if (apptData.address_id) {
                    const patientAddressesCollectionRef = collection(db, `artifacts/${appId}/users/${apptData.patient_id}/addresses`);
                    const addressDocRef = doc(patientAddressesCollectionRef, apptData.address_id);
                    const addressSnap = await getDoc(addressDocRef);
                    if (addressSnap.exists()) {
                        addressDetails = addressSnap.data() as Address;
                    }
                }

                fetchedAppointments.push({
                    ...apptData,
                    id: docSnap.id,
                    serviceName,
                    patientName,
                    addressDetails,
                });
            }
            setAppointments(fetchedAppointments);
        } catch (err: any) {
            console.error("Error fetching my appointments:", err);
            setError(err.message);
            setMessage({ text: `Error fetching appointments: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchMyAppointments();
        }
    }, [user, db, appId, filterStatus]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading your appointments...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">My Appointments</h2>

                <div className="mb-4">
                    <label htmlFor="statusFilter" className="form-label">Filter by:</label>
                    <select
                        id="statusFilter"
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled/Rescheduled</option>
                    </select>
                </div>

                {appointments.length === 0 ? (
                    <p className="text-muted text-center">No {filterStatus} appointments found.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Patient</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(appt => (
                                    <tr key={appt.id}>
                                        <td>{appt.serviceName}</td>
                                        <td>{appt.patientName}</td>
                                        <td>{appt.requested_date}</td>
                                        <td>{appt.requested_time_slot}</td>
                                        <td><span className={`badge ${getStatusBadgeClass(appt.status)}`}>{appt.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => navigate('appointmentDetails', { appointment: appt })}>View Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Pending Appointments Page (Doctor)
export const PendingAppointmentsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth(); // Added setMessage
    const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPendingAppointments = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            // Use collectionGroup to query all 'appointments' subcollections
            // Requires composite index: appointments (status ASC, doctor_id ASC)
            const q = query(
                collectionGroup(db, 'appointments'),
                where('status', '==', 'pending_assignment'),
                where('doctor_id', '==', null) // Filter for appointments not yet assigned to any doctor
            );
            const snapshot = await getDocs(q);
            let fetchedAppointments: Appointment[] = [];

            // Pre-fetch all patients and services
            const patientsMap = new Map<string, UserProfile>();
            const servicesMap = new Map<string, Service>();

            const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
            allUsersSnapshot.docs.forEach(docSnap => {
                const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId) {
                    patientsMap.set(docSnap.id, profileData);
                }
            });

            const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`)); // CORRECTED PATH
            servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));


            for (const docSnap of snapshot.docs) {
                const apptData = docSnap.data() as Appointment;
                // Ensure the appointment belongs to the current app instance
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] !== appId) {
                    continue; // Skip if not for this app instance
                }

                let serviceName = servicesMap.get(apptData.service_id)?.name || 'Unknown Service';
                let patientName = patientsMap.get(apptData.patient_id)?.full_name || patientsMap.get(apptData.patient_id)?.email || 'Unknown Patient';
                let addressDetails: Address | undefined;

                // Fetch address details (from patient's address collection)
                if (apptData.address_id) {
                    const patientAddressesCollectionRef = collection(db, `artifacts/${appId}/users/${apptData.patient_id}/addresses`);
                    const addressDocRef = doc(patientAddressesCollectionRef, apptData.address_id);
                    const addressSnap = await getDoc(addressDocRef);
                    if (addressSnap.exists()) {
                        addressDetails = addressSnap.data() as Address;
                    }
                }

                fetchedAppointments.push({
                    ...apptData,
                    id: docSnap.id,
                    serviceName,
                    patientName,
                    addressDetails,
                });
            }
            setPendingAppointments(fetchedAppointments);
        } catch (err: any) {
            console.error("Error fetching pending appointments:", err);
            setError(err.message);
            setMessage({ text: `Error fetching pending appointments: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchPendingAppointments();
        }
    }, [user, db, appId]);

    const handleAssignToMe = async (appointment: Appointment) => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" }); // Use setMessage
            setLoading(false);
            return;
        }
        try {
            // Update the appointment document to assign it to the current doctor
            // This update must happen on the patient's appointment document
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${appointment.patient_id}/appointments`, appointment.id);
            await updateDoc(appointmentDocRef, {
                doctor_id: user.uid,
                status: 'assigned', // Change status to 'assigned'
                assigned_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });
            setMessage({ text: `Appointment for ${appointment.patientName} assigned to you.`, type: "success" }); // Use setMessage
            fetchPendingAppointments(); // Refresh the list
        } catch (err: any) {
            console.error("Error assigning appointment:", err);
            setError(err.message);
            setMessage({ text: `Error assigning appointment: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading pending appointments...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-warning mb-4 text-center">Pending Assignments</h2>

                {pendingAppointments.length === 0 ? (
                    <p className="text-muted text-center">No pending appointments available.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Patient</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Address</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingAppointments.map(appt => (
                                    <tr key={appt.id}>
                                        <td>{appt.serviceName}</td>
                                        <td>{appt.patientName}</td>
                                        <td>{appt.requested_date}</td>
                                        <td>{appt.requested_time_slot}</td>
                                        <td>{appt.addressDetails ? `${appt.addressDetails.address_line_1}, ${appt.addressDetails.city}` : 'N/A'}</td>
                                        <td>
                                            <button className="btn btn-sm btn-primary" onClick={() => handleAssignToMe(appt)} disabled={loading}>Assign to Me</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Manage Availability Page (Doctor)
export const ManageAvailabilityPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth(); // Added setMessage
    const [availability, setAvailability] = useState<any[]>([]); // State to hold doctor's availability
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newAvailability, setNewAvailability] = useState({ date: '', time_slots: [] as string[] });
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

    const timeSlotsOptions = [
        "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM",
        "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM", "04:00 PM - 05:00 PM"
    ];

    const fetchAvailability = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            // Availability is stored directly on the doctor's user profile as a JSON string
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const profile = docSnap.data() as UserProfile;
                if (profile.availability_schedule) {
                    setAvailability(JSON.parse(profile.availability_schedule));
                } else {
                    setAvailability([]);
                }
            } else {
                setAvailability([]);
            }
        } catch (err: any) {
            console.error("Error fetching availability:", err);
            setError(err.message);
            setMessage({ text: `Error fetching availability: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchAvailability();
        }
    }, [user, db, appId]);

    const handleAddAvailability = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid || !newAvailability.date || newAvailability.time_slots.length === 0) {
            setMessage({ text: "Please select a date and at least one time slot.", type: "error" }); // Use setMessage
            setLoading(false);
            return;
        }
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
            // Check if the date already exists
            const existingScheduleIndex = availability.findIndex(s => s.date === newAvailability.date);
            let updatedSchedules;

            if (existingScheduleIndex > -1) {
                // Merge time slots for existing date
                updatedSchedules = [...availability];
                const existingSlots = new Set(updatedSchedules[existingScheduleIndex].time_slots);
                newAvailability.time_slots.forEach(slot => existingSlots.add(slot));
                updatedSchedules[existingScheduleIndex].time_slots = Array.from(existingSlots).sort();
            } else {
                // Add new date schedule
                updatedSchedules = [...availability, { ...newAvailability, time_slots: newAvailability.time_slots.sort() }];
            }

            await updateDoc(userDocRef, { availability_schedule: JSON.stringify(updatedSchedules), updated_at: serverTimestamp() });
            setMessage({ text: 'Availability updated successfully!', type: 'success' }); // Use setMessage
            setNewAvailability({ date: '', time_slots: [] });
            setSelectedTimeSlot('');
            fetchAvailability(); // Re-fetch to ensure UI is in sync
        } catch (err: any) {
            console.error("Error adding availability:", err);
            setError(err.message);
            setMessage({ text: `Error adding availability: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTimeSlot = async (date: string, slotToRemove: string) => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" }); // Use setMessage
            setLoading(false);
            return;
        }
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
            const updatedSchedules = availability.map(schedule => {
                if (schedule.date === date) {
                    return {
                        ...schedule,
                        time_slots: schedule.time_slots.filter((slot: string) => slot !== slotToRemove)
                    };
                }
                return schedule;
            }).filter(schedule => schedule.time_slots.length > 0); // Remove dates with no slots left

            await updateDoc(userDocRef, { availability_schedule: JSON.stringify(updatedSchedules), updated_at: serverTimestamp() });
            setMessage({ text: 'Time slot removed successfully!', type: 'success' }); // Use setMessage
            fetchAvailability(); // Re-fetch to ensure UI is in sync
        } catch (err: any) {
            console.error("Error removing time slot:", err);
            setError(err.message);
            setMessage({ text: `Error removing time slot: ${err.message}`, type: "error" }); // Use setMessage
        } finally {
            setLoading(false);
        }
    };

    const handleTimeSlotChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedTimeSlot(e.target.value);
    };

    const addSelectedTimeSlot = () => {
        if (selectedTimeSlot && !newAvailability.time_slots.includes(selectedTimeSlot)) {
            setNewAvailability(prev => ({
                ...prev,
                time_slots: [...prev.time_slots, selectedTimeSlot].sort()
            }));
            setSelectedTimeSlot(''); // Clear selected slot after adding
        }
    };

    const removeTimeSlotFromNew = (slotToRemove: string) => {
        setNewAvailability(prev => ({
            ...prev,
            time_slots: prev.time_slots.filter(slot => slot !== slotToRemove)
        }));
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading availability...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Manage Your Availability</h2>

                <div className="mb-5 border p-4 rounded-3 shadow-sm">
                    <h4 className="h5 fw-bold mb-3">Add New Availability</h4>
                    <div className="mb-3">
                        <label htmlFor="availabilityDate" className="form-label">Date:</label>
                        <input
                            type="date"
                            className="form-control"
                            id="availabilityDate"
                            value={newAvailability.date}
                            onChange={(e) => setNewAvailability(prev => ({ ...prev, date: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]} // Cannot select past dates
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="timeSlotSelect" className="form-label">Add Time Slot:</label>
                        <div className="input-group">
                            <select
                                className="form-select"
                                id="timeSlotSelect"
                                value={selectedTimeSlot}
                                onChange={handleTimeSlotChange}
                            >
                                <option value="">Select a time slot</option>
                                {timeSlotsOptions.map(slot => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
                            <button className="btn btn-outline-secondary" type="button" onClick={addSelectedTimeSlot} disabled={!selectedTimeSlot}>Add</button>
                        </div>
                        <div className="mt-2">
                            {newAvailability.time_slots.length > 0 ? (
                                <div className="d-flex flex-wrap gap-2">
                                    {newAvailability.time_slots.map(slot => (
                                        <span key={slot} className="badge bg-primary fs-6 p-2 d-flex align-items-center">
                                            {slot}
                                            <button type="button" className="btn-close btn-close-white ms-2" aria-label="Remove" onClick={() => removeTimeSlotFromNew(slot)}></button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <small className="text-muted">No time slots added for this date yet.</small>
                            )}
                        </div>
                    </div>
                    <button className="btn btn-primary w-100" onClick={handleAddAvailability} disabled={loading}>
                        {loading ? <LoadingSpinner /> : 'Save Availability'}
                    </button>
                </div>

                <h4 className="h5 fw-bold mb-3">Your Current Availability</h4>
                {availability.length === 0 ? (
                    <p className="text-muted text-center">No availability set yet.</p>
                ) : (
                    <div className="accordion" id="availabilityAccordion">
                        {availability.map((schedule, index) => (
                            <div className="accordion-item" key={index}>
                                <h2 className="accordion-header" id={`heading${index}`}>
                                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#collapse${index}`} aria-expanded="false" aria-controls={`collapse${index}`}>
                                        {schedule.date}
                                    </button>
                                </h2>
                                <div id={`collapse${index}`} className="accordion-collapse collapse" aria-labelledby={`heading${index}`} data-bs-parent="#availabilityAccordion">
                                    <div className="accordion-body">
                                        {schedule.time_slots.length === 0 ? (
                                            <p className="text-muted">No time slots for this date.</p>
                                        ) : (
                                            <div className="d-flex flex-wrap gap-2">
                                                {schedule.time_slots.map((slot: string) => (
                                                    <span key={slot} className="badge bg-success fs-6 p-2 d-flex align-items-center">
                                                        {slot}
                                                        <button type="button" className="btn-close btn-close-white ms-2" aria-label="Remove" onClick={() => handleRemoveTimeSlot(schedule.date, slot)}></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Doctor Profile Page (Doctor)
export const DoctorProfilePage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<UserProfile>>({});

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data() as UserProfile);
                    setFormData(docSnap.data() as UserProfile); // Initialize form data with current profile
                } else {
                    setError("Doctor profile not found.");
                }
            } catch (err: any) {
                console.error("Error fetching doctor profile:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchProfile();
        }
    }, [user, db, appId]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid || !profile) {
            setMessage({ text: "Firebase not initialized or user not logged in.", type: "error" });
            setLoading(false);
            return;
        }
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
            await updateDoc(userDocRef, {
                ...formData,
                updated_at: serverTimestamp(),
            });
            setProfile((prev: any) => ({ ...prev!, ...formData })); // Update local state
            setIsEditing(false);
            setMessage({ text: "Profile updated successfully!", type: "success" });
        } catch (err: any) {
            console.error("Error updating doctor profile:", err);
            setError(err.message);
            setMessage({ text: `Failed to update profile: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading profile...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }
    if (!profile) return <MessageDisplay message={{ text: "No profile data found.", type: "error" }} />;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">My Profile</h2>

                {!isEditing ? (
                    <>
                        <div className="mb-3">
                            <strong>Full Name:</strong> {profile.full_name}
                        </div>
                        <div className="mb-3">
                            <strong>Email:</strong> {profile.email}
                        </div>
                        <div className="mb-3">
                            <strong>Role:</strong> {profile.role}
                        </div>
                        <div className="mb-3">
                            <strong>Phone Number:</strong> {profile.phone_number || 'N/A'}
                        </div>
                        <div className="mb-3">
                            <strong>Specialization:</strong> {profile.specialization || 'N/A'}
                        </div>
                        <div className="mb-3">
                            <strong>License Number:</strong> {profile.license_number || 'N/A'}
                        </div>
                        <div className="mb-3">
                            <strong>Years of Experience:</strong> {profile.years_of_experience || 'N/A'}
                        </div>
                        <div className="mb-3">
                            <strong>Bio:</strong> {profile.bio || 'N/A'}
                        </div>
                        <div className="mb-3">
                            <strong>Available Now:</strong> {profile.is_available_now ? 'Yes' : 'No'}
                        </div>
                        <div className="mb-3">
                            <strong>Average Rating:</strong> {profile.average_rating ? profile.average_rating.toFixed(2) : 'N/A'} ({profile.total_reviews || 0} reviews)
                        </div>
                        <button className="btn btn-primary mt-3" onClick={() => setIsEditing(true)}>Edit Profile</button>
                    </>
                ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                        <div className="mb-3">
                            <label htmlFor="full_name" className="form-label">Full Name:</label>
                            <input type="text" className="form-control" id="full_name" name="full_name" value={formData.full_name || ''} onChange={handleFormChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="phone_number" className="form-label">Phone Number:</label>
                            <input type="text" className="form-control" id="phone_number" name="phone_number" value={formData.phone_number || ''} onChange={handleFormChange} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="specialization" className="form-label">Specialization:</label>
                            <input type="text" className="form-control" id="specialization" name="specialization" value={formData.specialization || ''} onChange={handleFormChange} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="license_number" className="form-label">License Number:</label>
                            <input type="text" className="form-control" id="license_number" name="license_number" value={formData.license_number || ''} onChange={handleFormChange} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="editExperience" className="form-label">Years of Experience:</label>
                            <input type="number" className="form-control" id="editExperience" name="years_of_experience" value={formData.years_of_experience || ''} onChange={handleFormChange} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="editBio" className="form-label">Bio:</label>
                            <textarea className="form-control" id="editBio" name="bio" rows={3} value={formData.bio || ''} onChange={handleFormChange}></textarea>
                        </div>
                        <div className="form-check mb-3">
                            <input type="checkbox" className="form-check-input" id="editIsAvailableNow" name="is_available_now" checked={formData.is_available_now || false} onChange={handleFormChange} />
                            <label className="form-check-label" htmlFor="editIsAvailableNow">Available Now</label>
                        </div>
                        <button type="submit" className="btn btn-success mt-3 me-2" disabled={loading}>
                            {loading ? <LoadingSpinner /> : 'Save Changes'}
                        </button>
                        <button type="button" className="btn btn-secondary mt-3" onClick={() => setIsEditing(false)} disabled={loading}>
                            Cancel
                        </button>
                    </form>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Patient Feedback Page (Doctor)
export const PatientFeedbackPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth(); // Added setMessage
    const [feedbacks, setFeedbacks] = useState<EnrichedFeedback[]>([]); // Use EnrichedFeedback
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFeedback = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                // Fetch all appointments assigned to this doctor that are completed
                // Requires composite index: appointments (doctor_id ASC, status ASC)
                const qAppointments = query(
                    collectionGroup(db, 'appointments'),
                    where('doctor_id', '==', user.uid),
                    where('status', '==', 'completed')
                );
                const appointmentsSnapshot = await getDocs(qAppointments);

                // Pre-fetch all patients and services once
                const patientsMap = new Map<string, UserProfile>();
                const servicesMap = new Map<string, Service>();

                const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
                allUsersSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        patientsMap.set(docSnap.id, profileData);
                    }
                });

                const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`)); // CORRECTED PATH
                servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));


                const feedbackPromises = appointmentsSnapshot.docs.map(async (apptDoc) => {
                    const apptData = apptDoc.data() as Appointment;
                    // Ensure the appointment belongs to the current app instance
                    const pathSegments = apptDoc.ref.path.split('/');
                    if (pathSegments[1] !== appId) {
                        return null; // Skip if not for this app instance
                    }

                    // Fetch feedback for this specific appointment from the patient's feedback subcollection
                    // Requires composite index: feedback (appointment_id ASC)
                    const feedbackQuery = query(
                        collection(db, `artifacts/${appId}/users/${apptData.patient_id}/feedback`),
                        where('appointment_id', '==', apptDoc.id)
                    );
                    const feedbackSnap = await getDocs(feedbackQuery);

                    if (!feedbackSnap.empty) {
                        const feedbackData = feedbackSnap.docs[0].data() as Feedback;

                        // Get patient name from pre-fetched map
                        const patientName = patientsMap.get(apptData.patient_id)?.full_name || patientsMap.get(apptData.patient_id)?.email || 'Unknown Patient';

                        // Get service name from pre-fetched map
                        const serviceName = servicesMap.get(apptData.service_id)?.name || 'Unknown Service';

                        return {
                            ...feedbackData,
                            id: feedbackSnap.docs[0].id,
                            patientName, // Add patientName to the feedback object
                            serviceName, // Add serviceName to the feedback object
                        } as EnrichedFeedback; // Cast to EnrichedFeedback
                    }
                    return null;
                });

                const fetchedFeedbacks = (await Promise.all(feedbackPromises)).filter(f => f !== null) as EnrichedFeedback[];
                setFeedbacks(fetchedFeedbacks);

            } catch (err: any) {
                console.error("Error fetching patient feedback:", err);
                setError(err.message);
                setMessage({ text: `Error fetching patient feedback: ${err.message}`, type: "error" }); // Use setMessage
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchFeedback();
        }
    }, [user, db, appId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading patient feedback...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Patient Feedback</h2>

                {feedbacks.length === 0 ? (
                    <p className="text-muted text-center">No feedback received yet.</p>
                ) : (
                    <div className="list-group">
                        {feedbacks.map(feedback => (
                            <div key={feedback.id} className="list-group-item mb-3 rounded-3 shadow-sm">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h5 className="mb-0">{feedback.patientName || 'Anonymous Patient'}</h5> {/* Use patientName */}
                                    <div>
                                        {[...Array(5)].map((_, i) => (
                                            <span key={i} style={{ color: i < feedback.rating ? '#ffc107' : '#e4e5e9' }}>★</span>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-muted small mb-1">Service: {feedback.serviceName || 'N/A'}</p> {/* Use serviceName */}
                                <p className="mb-0">{feedback.comments || 'No comments provided.'}</p>
                                <small className="text-muted d-block mt-2">
                                    {feedback.created_at instanceof Timestamp
                                        ? feedback.created_at.toDate().toLocaleDateString()
                                        : 'N/A'}
                                </small>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Doctor Reports Page (Doctor) - Placeholder
export const DoctorReportsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user } = useAuth();
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }
    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Performance Reports</h2>
                <p className="text-muted text-center">This page will display your performance metrics and reports.</p>
                <p className="text-muted text-center">Implementation coming soon!</p>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Doctor Appointment Details Page (Doctor)
export const DoctorAppointmentDetailsPage: React.FC<{ navigate: (page: string | number, data?: any) => void; appointment?: Appointment }> = ({ navigate, appointment: initialAppointment }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth();
    const [appointment, setAppointment] = useState<Appointment | undefined>(initialAppointment);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);

    useEffect(() => {
        const fetchAppointmentDetails = async () => {
            if (!initialAppointment?.id || !db || !appId || !user?.uid) {
                setError("Appointment ID or Firebase not initialized.");
                return;
            }
            setLoading(true);
            setError(null);
            try {
                // Fetch appointment using collectionGroup to find it regardless of parent patient
                // Requires composite index: appointments (id ASC) or (patient_id ASC, id ASC)
                const q = query(
                    collectionGroup(db, 'appointments'),
                    where('__name__', '==', `artifacts/${appId}/users/${initialAppointment.patient_id}/appointments/${initialAppointment.id}`)
                );
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const docSnap = snapshot.docs[0];
                    const apptData = docSnap.data() as Appointment;
                    // Ensure the appointment belongs to the current app instance and doctor
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] !== appId || apptData.doctor_id !== user.uid) {
                        setError("Access Denied: Appointment not found or not assigned to you.");
                        setLoading(false);
                        return;
                    }

                    let serviceName = 'Unknown Service';
                    let patientName = 'Unknown Patient';
                    let addressDetails: Address | undefined;

                    // Fetch service details
                    const serviceDocRef = doc(db, `artifacts/${appId}/services`, apptData.service_id); // CORRECTED PATH
                    const serviceSnap = await getDoc(serviceDocRef);
                    serviceName = serviceSnap.exists() ? (serviceSnap.data() as Service).name : serviceName;

                    // Fetch patient details
                    const patientUserDocRef = doc(db, `artifacts/${appId}/users/${apptData.patient_id}/users`, apptData.patient_id);
                    const patientProfileSnap = await getDoc(patientUserDocRef);
                    patientName = patientProfileSnap.exists() ? (patientProfileSnap.data() as UserProfile).full_name || (patientProfileSnap.data() as UserProfile).email : patientName;

                    // Fetch address details (from patient's address collection)
                    if (apptData.address_id) {
                        const patientAddressesCollectionRef = collection(db, `artifacts/${appId}/users/${apptData.patient_id}/addresses`);
                        const addressDocRef = doc(patientAddressesCollectionRef, apptData.address_id);
                        const addressSnap = await getDoc(addressDocRef);
                        if (addressSnap.exists()) {
                            addressDetails = addressSnap.data() as Address;
                        }
                    }

                    setAppointment({
                        ...apptData,
                        id: docSnap.id,
                        serviceName,
                        patientName,
                        addressDetails,
                    });
                } else {
                    setError("Appointment not found.");
                }
            } catch (err: any) {
                console.error("Error fetching appointment details:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (initialAppointment?.id && user && db && appId) {
            fetchAppointmentDetails();
        }
    }, [initialAppointment, user, db, appId]);

    const handleUpdateStatus = async (newStatus: Appointment['status']) => {
        setLoading(true);
        setError(null);
        if (!appointment?.id || !appointment.patient_id || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing appointment ID/patient ID or Firebase not initialized.", type: "error" });
            setLoading(false);
            return;
        }
        try {
            // Update the appointment document on the patient's subcollection
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${appointment.patient_id}/appointments`, appointment.id);
            await updateDoc(appointmentDocRef, {
                status: newStatus,
                updated_at: serverTimestamp(),
            });
            setAppointment(prev => prev ? { ...prev, status: newStatus } : prev); // Update local state
            setMessage({ text: `Appointment status updated to ${newStatus?.replace(/_/g, ' ').toUpperCase()}.`, type: "success" });
            setShowConfirmModal(false);
            setShowCancelModal(false);
            setShowCompleteModal(false);
        } catch (err: any) {
            console.error("Error updating appointment status:", err);
            setError(err.message);
            setMessage({ text: `Failed to update status: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading appointment details...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }
    if (!appointment) return <MessageDisplay message={{ text: "No appointment data provided or found.", type: "error" }} />;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Appointment Details</h2>

                <div className="mb-3">
                    <strong>Service:</strong> {appointment.serviceName}
                </div>
                <div className="mb-3">
                    <strong>Patient:</strong> {appointment.patientName}
                </div>
                <div className="mb-3">
                    <strong>Address:</strong> {appointment.addressDetails ? `${appointment.addressDetails.address_line_1}, ${appointment.addressDetails.city}, ${appointment.addressDetails.state} - ${appointment.addressDetails.zip_code}` : 'N/A'}
                </div>
                <div className="mb-3">
                    <strong>Requested Date:</strong> {appointment.requested_date}
                </div>
                <div className="mb-3">
                    <strong>Time Slot:</strong> {appointment.requested_time_slot}
                </div>
                <div className="mb-3">
                    <strong>Estimated Cost:</strong> ₹{appointment.estimated_cost?.toFixed(2) || 'N/A'}
                </div>
                <div className="mb-3">
                    <strong>Current Status:</strong> <span className={`badge ${getStatusBadgeClass(appointment.status)}`}>{appointment.status?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <div className="mb-3">
                    <strong>Payment Status:</strong> <span className={`badge ${appointment.payment_status === 'paid' ? 'bg-success' : 'bg-secondary'}`}>{appointment.payment_status.toUpperCase()}</span>
                </div>

                <div className="d-flex justify-content-center mt-4 flex-wrap gap-2">
                    {appointment.status === 'assigned' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus('confirmed')} disabled={loading}>Confirm Appointment</button>
                    )}
                    {appointment.status === 'confirmed' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus('on_the_way')} disabled={loading}>On the Way</button>
                    )}
                    {appointment.status === 'on_the_way' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus('arrived')} disabled={loading}>Arrived</button>
                    )}
                    {appointment.status === 'arrived' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus('service_started')} disabled={loading}>Start Service</button>
                    )}
                    {appointment.status === 'service_started' && (
                        <button className="btn btn-success" onClick={() => setShowCompleteModal(true)} disabled={loading}>Complete Service</button>
                    )}
                    {['pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started'].includes(appointment.status) && (
                        <button className="btn btn-danger" onClick={() => setShowCancelModal(true)} disabled={loading}>Cancel Appointment</button>
                    )}
                </div>

                {/* NEW: Buttons for adding patient data/consultation */}
                {appointment.status === 'completed' && (
                    <div className="mt-4 pt-4 border-top">
                        <h4 className="h5 fw-bold text-info mb-3">Post-Appointment Actions</h4>
                        <div className="d-flex flex-wrap gap-2">
                            <button
                                className="btn btn-outline-info"
                                onClick={() => navigate('addConsultation', { patientId: appointment.patient_id, patientName: appointment.patientName, appointmentId: appointment.id })}
                            >
                                Add Consultation Notes
                            </button>
                            <button
                                className="btn btn-outline-info"
                                onClick={() => navigate('addPrescription', { patientId: appointment.patient_id, patientName: appointment.patientName, appointmentId: appointment.id })}
                            >
                                Add Prescription
                            </button>
                            <button
                                className="btn btn-outline-info"
                                onClick={() => navigate('addHealthRecord', { patientId: appointment.patient_id, patientName: appointment.patientName, appointmentId: appointment.id })}
                            >
                                Add Health Record
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showConfirmModal && (
                <CustomModal
                    title="Confirm Appointment"
                    message="Are you sure you want to confirm this appointment?"
                    onConfirm={() => handleUpdateStatus('confirmed')}
                    onCancel={() => setShowConfirmModal(false)}
                    confirmText="Yes, Confirm"
                    cancelText="No"
                />
            )}

            {showCancelModal && (
                <CustomModal
                    title="Cancel Appointment"
                    message="Are you sure you want to cancel this appointment?"
                    onConfirm={() => handleUpdateStatus('declined_by_doctor')} // Doctor declines/cancels
                    onCancel={() => setShowCancelModal(false)}
                    confirmText="Yes, Cancel"
                    cancelText="No"
                />
            )}

            {showCompleteModal && (
                <CustomModal
                    title="Complete Service"
                    message="Are you sure you want to mark this service as completed?"
                    onConfirm={() => handleUpdateStatus('completed')}
                    onCancel={() => setShowCompleteModal(false)}
                    confirmText="Yes, Complete"
                    cancelText="No"
                />
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('myAppointments')}>Back to My Appointments</button>
            </div>
        </div>
    );
};

// --- NEW COMPONENTS FOR DOCTOR HEALTH DATA MANAGEMENT ---

// Manage Patient Records Page (Doctor)
export const ManagePatientRecordsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth();
    const [patients, setPatients] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredPatients, setFilteredPatients] = useState<UserProfile[]>([]);

    useEffect(() => {
        const fetchPatients = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                // Fetch all patient profiles
                const patientsQuery = query(
                    collectionGroup(db, 'users'),
                    where('role', '==', 'patient')
                );
                const snapshot = await getDocs(patientsQuery);
                const fetchedPatients: UserProfile[] = [];
                snapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                        fetchedPatients.push(profileData);
                    }
                });
                setPatients(fetchedPatients);
                setFilteredPatients(fetchedPatients); // Initialize filtered list
            } catch (err: any) {
                console.error("Error fetching patients:", err);
                setError(err.message);
                setMessage({ text: `Error fetching patients: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchPatients();
        }
    }, [user, db, appId]);

    useEffect(() => {
        // Filter patients based on search term
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const results = patients.filter(patient =>
            (patient.full_name?.toLowerCase().includes(lowerCaseSearchTerm) ||
             patient.email.toLowerCase().includes(lowerCaseSearchTerm) ||
             patient.phone_number?.toLowerCase().includes(lowerCaseSearchTerm))
        );
        setFilteredPatients(results);
    }, [searchTerm, patients]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading patients...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Manage Patient Records</h2>

                <div className="mb-4">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search patients by name, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {filteredPatients.length === 0 ? (
                    <p className="text-muted text-center">No patients found matching your search.</p>
                ) : (
                    <div className="list-group">
                        {filteredPatients.map(patient => (
                            <button
                                key={patient.id}
                                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                onClick={() => navigate('patientHealthDataView', { patientId: patient.id, patientName: patient.full_name || patient.email })}
                            >
                                <div>
                                    <h5 className="mb-1">{patient.full_name || patient.email}</h5>
                                    <small className="text-muted">{patient.email} {patient.phone_number && `| ${patient.phone_number}`}</small>
                                </div>
                                <span className="badge bg-primary rounded-pill">View Records</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Patient Health Data View Page (Doctor)
export const PatientHealthDataViewPage: React.FC<{ navigate: (page: string | number, data?: any) => void; patientId: string; patientName: string }> = ({ navigate, patientId, patientName }) => { // Updated navigate type
    const { user, db, appId, setMessage } = useAuth();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPatientData = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid || !patientId) {
                setError("Firebase not initialized, user not logged in, or patient ID missing.");
                setLoading(false);
                return;
            }
            try {
                // Pre-fetch all doctors and services once for enrichment
                const doctorsMap = new Map<string, UserProfile>();
                const servicesMap = new Map<string, Service>();

                const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
                allUsersSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId && profileData.role === 'doctor') {
                        doctorsMap.set(docSnap.id, profileData);
                    }
                });

                const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`)); // CORRECTED PATH
                servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));


                // Fetch Prescriptions for the patient
                const prescriptionsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/prescriptions`);
                const prescriptionsSnapshot = await getDocs(prescriptionsCollectionRef);
                const fetchedPrescriptions: Prescription[] = [];
                for (const docSnap of prescriptionsSnapshot.docs) {
                    const prescriptionData = docSnap.data() as Prescription;
                    const doctorName = doctorsMap.get(prescriptionData.doctor_id)?.full_name || doctorsMap.get(prescriptionData.doctor_id)?.email || 'Unknown Doctor';
                    fetchedPrescriptions.push({ ...prescriptionData, id: docSnap.id, doctorName });
                }
                setPrescriptions(fetchedPrescriptions);

                // Fetch Health Records for the patient
                const healthRecordsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/health_records`);
                const healthRecordsSnapshot = await getDocs(healthRecordsCollectionRef);
                const fetchedHealthRecords: HealthRecord[] = [];
                for (const docSnap of healthRecordsSnapshot.docs) {
                    const recordData = docSnap.data() as HealthRecord;
                    const doctorName = recordData.doctor_id ? (doctorsMap.get(recordData.doctor_id)?.full_name || doctorsMap.get(recordData.doctor_id)?.email || 'Unknown Doctor') : 'Patient Added';
                    fetchedHealthRecords.push({ ...recordData, id: docSnap.id, doctorName });
                }
                setHealthRecords(fetchedHealthRecords);

                // Fetch Consultations for the patient
                const consultationsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/consultations`);
                const consultationsSnapshot = await getDocs(consultationsCollectionRef);
                const fetchedConsultations: Consultation[] = [];
                for (const docSnap of consultationsSnapshot.docs) {
                    const consultationData = docSnap.data() as Consultation;
                    const doctorName = doctorsMap.get(consultationData.doctor_id)?.full_name || doctorsMap.get(consultationData.doctor_id)?.email || 'Unknown Doctor';

                    let serviceName = 'N/A';
                    if (consultationData.appointment_id) {
                        const appointmentDocRef = doc(db, `artifacts/${appId}/users/${patientId}/appointments`, consultationData.appointment_id);
                        const appointmentSnap = await getDoc(appointmentDocRef);
                        if (appointmentSnap.exists()) {
                            const serviceId = (appointmentSnap.data() as Appointment).service_id;
                            serviceName = servicesMap.get(serviceId)?.name || 'Unknown Service';
                        }
                    }
                    fetchedConsultations.push({ ...consultationData, id: docSnap.id, doctorName, serviceName });
                }
                setConsultations(fetchedConsultations);

            } catch (err: any) {
                console.error("Error fetching patient health data:", err);
                setError(err.message);
                setMessage({ text: `Error fetching patient data: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId && patientId) {
            fetchPatientData();
        }
    }, [user, db, appId, patientId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading patient health data...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'doctor') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Doctor to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Health Data for {patientName}</h2>

                <div className="d-flex justify-content-center gap-2 mb-4 flex-wrap">
                    <button className="btn btn-outline-primary" onClick={() => navigate('addPrescription', { patientId, patientName })}>Add Prescription</button>
                    <button className="btn btn-outline-primary" onClick={() => navigate('addHealthRecord', { patientId, patientName })}>Add Health Record</button>
                    {/* Consultation notes are typically added via an appointment, so not a direct "add" here unless it's a general consultation */}
                    {/* <button className="btn btn-outline-primary" onClick={() => navigate('addConsultation', { patientId, patientName })}>Add Consultation</button> */}
                </div>

                <h4 className="h5 fw-bold text-primary mb-3">Prescriptions</h4>
                {prescriptions.length === 0 ? (
                    <p className="text-muted">No prescriptions found for this patient.</p>
                ) : (
                    <div className="table-responsive mb-4">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Prescribed Date</th>
                                    <th>Expires Date</th>
                                    <th>Prescribed By</th> {/* Added back for clarity */}
                                    <th>Medications</th>
                                    <th>Actions</th> {/* NEW: Actions column */}
                                </tr>
                            </thead>
                            <tbody>
                                {prescriptions.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.prescribed_date}</td>
                                        <td>{p.expires_date || 'N/A'}</td>
                                        <td>{p.doctorName}</td> {/* Display doctor name */}
                                        <td>
                                            {p.medications && p.medications.length > 0 ? (
                                                <ul className="list-unstyled mb-0">
                                                    {p.medications.map((med, idx) => (
                                                        <li key={idx}>
                                                            <strong>{med.medication_name}</strong>: {med.dosage}, {med.frequency} ({med.instructions})
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : 'N/A'}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline-info"
                                                onClick={() => navigate('prescriptionViewer', { patientId, prescriptionId: p.id })}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <h4 className="h5 fw-bold text-primary mb-3">Health Records</h4>
                {healthRecords.length === 0 ? (
                    <p className="text-muted">No health records found for this patient.</p>
                ) : (
                    <div className="table-responsive mb-4">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Description</th>
                                    <th>Added By</th> {/* Added back for clarity */}
                                    <th>Attachment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {healthRecords.map(r => (
                                    <tr key={r.id}>
                                        <td>{r.record_date}</td>
                                        <td>{r.record_type.replace(/_/g, ' ').toUpperCase()}</td>
                                        <td>{r.title || 'N/A'}</td>
                                        <td>{r.description}</td>
                                        <td>{r.doctorName}</td> {/* Display doctor name */}
                                        <td>
                                            {r.attachment_url ? (
                                                <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">View</a>
                                            ) : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <h4 className="h5 fw-bold text-primary mb-3">Consultations</h4>
                {consultations.length === 0 ? (
                    <p className="text-muted">No consultation notes found for this patient.</p>
                ) : (
                    <div className="table-responsive mb-4">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Doctor</th> {/* Added back for clarity */}
                                    <th>Service</th> {/* Added back for clarity */}
                                    <th>Diagnosis</th>
                                    <th>Recommendations</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consultations.map(c => (
                                    <tr key={c.id}>
                                        <td>{c.consultation_date}</td>
                                        <td>{c.consultation_time}</td>
                                        <td>{c.doctorName}</td> {/* Display doctor name */}
                                        <td>{c.serviceName}</td> {/* Display service name */}
                                        <td>{c.diagnosis || 'N/A'}</td>
                                        <td>{c.recommendations || 'N/A'}</td>
                                        <td>{c.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('managePatientRecords')}>Back to Patient List</button>
            </div>
        </div>
    );
};

// Add Prescription Page (Doctor) - UPDATED FOR MULTIPLE MEDICATIONS
export const AddPrescriptionPage: React.FC<{ navigate: (page: string | number, data?: any) => void; patientId: string; patientName: string; appointmentId?: string }> = ({ navigate, patientId, patientName, appointmentId }) => { // Updated navigate type
    const { user, db, appId, setMessage, message } = useAuth();
    const [loading, setLoading] = useState(false);
    const [prescribedDate, setPrescribedDate] = useState(new Date().toISOString().split('T')[0]);
    const [expiresDate, setExpiresDate] = useState('');
    const [medications, setMedications] = useState<MedicationItem[]>([]);
    const [currentMedication, setCurrentMedication] = useState<MedicationItem>({
        medication_name: '',
        dosage: '',
        frequency: '',
        instructions: '',
    });

    const handleMedicationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCurrentMedication(prev => ({ ...prev, [name]: value }));
    };

    const handleAddMedication = () => {
        if (currentMedication.medication_name && currentMedication.dosage && currentMedication.frequency && currentMedication.instructions) {
            setMedications(prev => [...prev, currentMedication]);
            setCurrentMedication({
                medication_name: '',
                dosage: '',
                frequency: '',
                instructions: '',
            });
        } else {
            setMessage({ text: "Please fill all fields for the current medication before adding.", type: "warning" });
        }
    };

    const handleRemoveMedication = (index: number) => {
        setMedications(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmitPrescription = async () => {
        setLoading(true);
        setMessage({ text: '', type: 'info' });

        if (!db || !appId || !user?.uid || !patientId || medications.length === 0 || !prescribedDate) {
            setMessage({ text: "Please add at least one medication and fill the prescribed date.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const prescriptionsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/prescriptions`);
            await addDoc(prescriptionsCollectionRef, {
                patient_id: patientId,
                doctor_id: user.uid,
                appointment_id: appointmentId || null, // Link to appointment if provided
                medications: medications, // Save the array of medications
                prescribed_date: prescribedDate,
                expires_date: expiresDate || null,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });
            setMessage({ text: 'Prescription added successfully!', type: 'success' });
            navigate('patientHealthDataView', { patientId, patientName }); // Go back to patient's health data view
        } catch (err: any) {
            console.error("Error adding prescription:", err);
            setMessage({ text: `Failed to add prescription: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Add Prescription for {patientName}</h2>
                {appointmentId && <p className="text-muted text-center">Related to Appointment ID: {appointmentId}</p>}

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <label htmlFor="prescribed_date" className="form-label">Prescribed Date:</label>
                    <input type="date" className="form-control" id="prescribed_date" name="prescribed_date" value={prescribedDate} onChange={(e) => setPrescribedDate(e.target.value)} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="expires_date" className="form-label">Expires Date (Optional):</label>
                    <input type="date" className="form-control" id="expires_date" name="expires_date" value={expiresDate} onChange={(e) => setExpiresDate(e.target.value)} />
                </div>

                <hr className="my-4" />
                <h4 className="h5 fw-bold text-secondary mb-3">Add Medications</h4>

                <div className="border p-3 rounded mb-3 bg-light">
                    <div className="mb-3">
                        <label htmlFor="current_med_name" className="form-label">Medication Name:</label>
                        <input type="text" className="form-control" id="current_med_name" name="medication_name" value={currentMedication.medication_name} onChange={handleMedicationChange} placeholder="e.g., Amoxicillin" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="current_dosage" className="form-label">Dosage:</label>
                        <input type="text" className="form-control" id="current_dosage" name="dosage" value={currentMedication.dosage} onChange={handleMedicationChange} placeholder="e.g., 250mg" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="current_frequency" className="form-label">Frequency:</label>
                        <input type="text" className="form-control" id="current_frequency" name="frequency" value={currentMedication.frequency} onChange={handleMedicationChange} placeholder="e.g., Twice daily" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="current_instructions" className="form-label">Instructions:</label>
                        <textarea className="form-control" id="current_instructions" name="instructions" rows={2} value={currentMedication.instructions} onChange={handleMedicationChange} placeholder="e.g., Take with food"></textarea>
                    </div>
                    <button type="button" className="btn btn-outline-secondary w-100" onClick={handleAddMedication}>Add Medication</button>
                </div>

                <h5 className="fw-bold text-primary mb-3">Medications in this Prescription:</h5>
                {medications.length === 0 ? (
                    <p className="text-muted text-center">No medications added yet.</p>
                ) : (
                    <ul className="list-group mb-4">
                        {medications.map((med, index) => (
                            <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>{med.medication_name}</strong>
                                    <br />
                                    <small className="text-muted">{med.dosage}, {med.frequency} ({med.instructions})</small>
                                </div>
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveMedication(index)}>Remove</button>
                            </li>
                        ))}
                    </ul>
                )}

                <button className="btn btn-primary w-100 mt-3" onClick={handleSubmitPrescription} disabled={loading || medications.length === 0}>
                    {loading ? <LoadingSpinner /> : 'Create Prescription'}
                </button>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('patientHealthDataView', { patientId, patientName })}>Back to Patient Data</button>
            </div>
        </div>
    );
};

// Add Health Record Page (Doctor)
export const AddHealthRecordPage: React.FC<{ navigate: (page: string | number, data?: any) => void; patientId: string; patientName: string; appointmentId?: string }> = ({ navigate, patientId, patientName, appointmentId }) => { // Updated navigate type
    const { user, db, appId, setMessage, message } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<HealthRecord>>({
        record_type: 'diagnosis',
        record_date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        attachment_url: '',
    });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmitHealthRecord = async () => {
        setLoading(true);
        setMessage({ text: '', type: 'info' });

        if (!db || !appId || !user?.uid || !patientId || !formData.record_type || !formData.record_date || !formData.description) {
            setMessage({ text: "Please fill all required fields for the health record.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const healthRecordsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/health_records`);
            await addDoc(healthRecordsCollectionRef, {
                ...formData,
                patient_id: patientId,
                doctor_id: user.uid, // Doctor is adding this record
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });
            setMessage({ text: 'Health record added successfully!', type: 'success' });
            navigate('patientHealthDataView', { patientId, patientName });
        } catch (err: any) {
            console.error("Error adding health record:", err);
            setMessage({ text: `Failed to add health record: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Add Health Record for {patientName}</h2>

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <label htmlFor="record_type" className="form-label">Record Type:</label>
                    <select className="form-select" id="record_type" name="record_type" value={formData.record_type || ''} onChange={handleFormChange} required>
                        <option value="diagnosis">Diagnosis</option>
                        <option value="test_result">Test Result</option>
                        <option value="allergy">Allergy</option>
                        <option value="medical_history">Medical History</option>
                        <option value="vaccination">Vaccination</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div className="mb-3">
                    <label htmlFor="record_date" className="form-label">Record Date:</label>
                    <input type="date" className="form-control" id="record_date" name="record_date" value={formData.record_date || ''} onChange={handleFormChange} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="title" className="form-label">Title (Optional):</label>
                    <input type="text" className="form-control" id="title" name="title" value={formData.title || ''} onChange={handleFormChange} placeholder="e.g., Initial Consultation Diagnosis" />
                </div>
                <div className="mb-3">
                    <label htmlFor="description" className="form-label">Description:</label>
                    <textarea className="form-control" id="description" name="description" rows={5} value={formData.description || ''} onChange={handleFormChange} required></textarea>
                </div>
                <div className="mb-3">
                    <label htmlFor="attachment_url" className="form-label">Attachment URL (Optional):</label>
                    <input type="url" className="form-control" id="attachment_url" name="attachment_url" value={formData.attachment_url || ''} onChange={handleFormChange} placeholder="Link to a report PDF, image, etc." />
                </div>

                <button className="btn btn-primary w-100 mt-3" onClick={handleSubmitHealthRecord} disabled={loading}>
                    {loading ? <LoadingSpinner /> : 'Add Health Record'}
                </button>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('patientHealthDataView', { patientId, patientName })}>Back to Patient Data</button>
            </div>
        </div>
    );
};

// Add Consultation Page (Doctor)
export const AddConsultationPage: React.FC<{ navigate: (page: string | number, data?: any) => void; patientId: string; patientName: string; appointmentId: string }> = ({ navigate, patientId, patientName, appointmentId }) => { // Updated navigate type
    const { user, db, appId, setMessage, message } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<Consultation>>({
        consultation_date: new Date().toISOString().split('T')[0],
        consultation_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        notes: '',
        diagnosis: '',
        recommendations: '',
    });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmitConsultation = async () => {
        setLoading(true);
        setMessage({ text: '', type: 'info' });

        if (!db || !appId || !user?.uid || !patientId || !appointmentId || !formData.notes || !formData.consultation_date || !formData.consultation_time) {
            setMessage({ text: "Please fill all required fields for the consultation notes.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const consultationsCollectionRef = collection(db, `artifacts/${appId}/users/${patientId}/consultations`);
            await addDoc(consultationsCollectionRef, {
                ...formData,
                patient_id: patientId,
                doctor_id: user.uid,
                appointment_id: appointmentId,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });
            setMessage({ text: 'Consultation notes added successfully!', type: 'success' });
            // Navigate back to appointment details or patient health data view
            navigate('appointmentDetails', { appointment: { id: appointmentId, patient_id: patientId } });
        } catch (err: any) {
            console.error("Error adding consultation:", err);
            setMessage({ text: `Failed to add consultation: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-info mb-4 text-center">Add Consultation Notes for {patientName}</h2>
                <p className="text-muted text-center">For Appointment ID: {appointmentId}</p>

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <label htmlFor="consultation_date" className="form-label">Consultation Date:</label>
                    <input type="date" className="form-control" id="consultation_date" name="consultation_date" value={formData.consultation_date || ''} onChange={handleFormChange} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="consultation_time" className="form-label">Consultation Time:</label>
                    <input type="time" className="form-control" id="consultation_time" name="consultation_time" value={formData.consultation_time || ''} onChange={handleFormChange} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="notes" className="form-label">Notes:</label>
                    <textarea className="form-control" id="notes" name="notes" rows={5} value={formData.notes || ''} onChange={handleFormChange} required></textarea>
                </div>
                <div className="mb-3">
                    <label htmlFor="diagnosis" className="form-label">Diagnosis (Optional):</label>
                    <input type="text" className="form-control" id="diagnosis" name="diagnosis" value={formData.diagnosis || ''} onChange={handleFormChange} />
                </div>
                <div className="mb-3">
                    <label htmlFor="recommendations" className="form-label">Recommendations (Optional):</label>
                    <textarea className="form-control" id="recommendations" name="recommendations" rows={3} value={formData.recommendations || ''} onChange={handleFormChange}></textarea>
                </div>

                <button className="btn btn-primary w-100 mt-3" onClick={handleSubmitConsultation} disabled={loading}>
                    {loading ? <LoadingSpinner /> : 'Add Consultation Notes'}
                </button>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('appointmentDetails', { appointment: { id: appointmentId, patient_id: patientId } })}>Back to Appointment Details</button>
            </div>
        </div>
    );
};
