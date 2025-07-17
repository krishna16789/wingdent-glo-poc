// frontend/src/DoctorComponents.tsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc, updateDoc, query, where, serverTimestamp, Timestamp, writeBatch, setDoc, collectionGroup } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay, CustomModal } from './CommonComponents';
import { Appointment, Service, Address, Feedback, UserProfile } from './types';
import { DashboardProps } from './PatientComponents'; // Import DashboardProps for consistency

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
    const { user, logout, db, appId } = useAuth();
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
                setAssignedAppointmentsCount(assignedSnapshot.size);

                // Fetch pending assignments (appointments not yet assigned to any doctor)
                // Requires composite index: appointments (status ASC, doctor_id ASC)
                const qPending = query(
                    collectionGroup(db, 'appointments'),
                    where('status', '==', 'pending_assignment'),
                    where('doctor_id', '==', null) // Appointments with no doctor assigned
                );
                const pendingSnapshot = await getDocs(qPending);
                setPendingAppointmentsCount(pendingSnapshot.size);

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

                            <div className="row g-4">
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
                                <div className="col-md-6">
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
export const MyAppointmentsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId } = useAuth();
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

            for (const docSnap of snapshot.docs) {
                const apptData = docSnap.data() as Appointment;
                // Ensure the appointment belongs to the current app instance
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] !== appId) {
                    continue; // Skip if not for this app instance
                }

                let serviceName = 'Unknown Service';
                let patientName = 'Unknown Patient';
                let addressDetails: Address | undefined;

                // Fetch service details
                const serviceDocRef = doc(db, `artifacts/${appId}/public/data/services`, apptData.service_id);
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
export const PendingAppointmentsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId } = useAuth();
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

            for (const docSnap of snapshot.docs) {
                const apptData = docSnap.data() as Appointment;
                // Ensure the appointment belongs to the current app instance
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] !== appId) {
                    continue; // Skip if not for this app instance
                }

                let serviceName = 'Unknown Service';
                let patientName = 'Unknown Patient';
                let addressDetails: Address | undefined;

                // Fetch service details
                const serviceDocRef = doc(db, `artifacts/${appId}/public/data/services`, apptData.service_id);
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
            setError("Firestore not initialized or user not logged in.");
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
            alert(`Appointment for ${appointment.patientName} assigned to you.`);
            fetchPendingAppointments(); // Refresh the list
        } catch (err: any) {
            console.error("Error assigning appointment:", err);
            setError(err.message);
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
export const ManageAvailabilityPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId } = useAuth();
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
            const availabilityDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/availability`, 'doctorAvailability');
            const docSnap = await getDoc(availabilityDocRef);
            if (docSnap.exists()) {
                setAvailability(docSnap.data().schedules || []);
            } else {
                setAvailability([]);
            }
        } catch (err: any) {
            console.error("Error fetching availability:", err);
            setError(err.message);
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
            setError("Please select a date and at least one time slot.");
            setLoading(false);
            return;
        }
        try {
            const availabilityDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/availability`, 'doctorAvailability');
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

            await setDoc(availabilityDocRef, { schedules: updatedSchedules, updated_at: serverTimestamp() }, { merge: true });
            alert('Availability updated successfully!');
            setNewAvailability({ date: '', time_slots: [] });
            setSelectedTimeSlot('');
            fetchAvailability();
        } catch (err: any) {
            console.error("Error adding availability:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTimeSlot = async (date: string, slotToRemove: string) => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const availabilityDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/availability`, 'doctorAvailability');
            const updatedSchedules = availability.map(schedule => {
                if (schedule.date === date) {
                    return {
                        ...schedule,
                        time_slots: schedule.time_slots.filter((slot: string) => slot !== slotToRemove)
                    };
                }
                return schedule;
            }).filter(schedule => schedule.time_slots.length > 0); // Remove dates with no slots left

            await setDoc(availabilityDocRef, { schedules: updatedSchedules, updated_at: serverTimestamp() }, { merge: true });
            alert('Time slot removed successfully!');
            fetchAvailability();
        } catch (err: any) {
            console.error("Error removing time slot:", err);
            setError(err.message);
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
export const DoctorProfilePage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
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
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid || !profile) {
            setError("Firebase not initialized or user not logged in.");
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
export const PatientFeedbackPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId } = useAuth();
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
                        
                        // Fetch patient name
                        const patientDocRef = doc(db, `artifacts/${appId}/users/${apptData.patient_id}/users`, apptData.patient_id);
                        const patientSnap = await getDoc(patientDocRef);
                        const patientName = patientSnap.exists() ? (patientSnap.data() as UserProfile).full_name || (patientSnap.data() as UserProfile).email : 'Unknown Patient';

                        // Fetch service name
                        const serviceDocRef = doc(db, `artifacts/${appId}/public/data/services`, apptData.service_id);
                        const serviceSnap = await getDoc(serviceDocRef);
                        const serviceName = serviceSnap.exists() ? (serviceSnap.data() as Service).name : 'Unknown Service';

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
export const DoctorReportsPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
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

// Doctor Appointment Details Page
export const DoctorAppointmentDetailsPage: React.FC<{ navigate: (page: string, data?: any) => void; appointment?: Appointment }> = ({ navigate, appointment: initialAppointment }) => {
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
                    const serviceDocRef = doc(db, `artifacts/${appId}/public/data/services`, apptData.service_id);
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
            setError("Missing appointment ID/patient ID or Firebase not initialized.");
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
            setMessage({ text: `Appointment status updated to ${newStatus.replace(/_/g, ' ').toUpperCase()}.`, type: "success" });
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
                    <strong>Current Status:</strong> <span className={`badge ${getStatusBadgeClass(appointment.status)}`}>{appointment.status.replace(/_/g, ' ').toUpperCase()}</span>
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
