// frontend/src/PatientComponents.tsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, query, where, serverTimestamp, collectionGroup, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay, CustomModal } from './CommonComponents';

// Define types for data structures (now imported from types.ts)
import { Service, Offer, Address, Appointment, Payment, Prescription, HealthRecord, Consultation, FeeConfiguration, Feedback, MedicationItem, UserProfile, Teleconsultation } from './types'; // Import Teleconsultation

// Import the new PrescriptionViewerPage
import { PrescriptionViewerPage } from './PrescriptionViewerPage';

// NEW IMPORT: TeleconsultationCallPage (assuming this is now a separate file)
import { TeleconsultationCallPage } from './TeleconsultationCallPage';

// Define a common interface for dashboard props
export interface DashboardProps {
    navigate: (page: string | number, data?: any) => void;
    currentPage: string;
    pageData: any;
}

// Helper function to get status badge class (can be shared or duplicated if needed)
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

// Patient Dashboard Component
export const PatientDashboard: React.FC<DashboardProps> = ({ navigate, currentPage, pageData }) => {
    const { user, logout, db, appId, message } = useAuth();
    const [latestAppointment, setLatestAppointment] = useState<Appointment | null>(null);
    const [upcomingAppointmentsCount, setUpcomingAppointmentsCount] = useState<number>(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
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
                // Fetch latest appointment
                const appointmentsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/appointments`);
                const qLatest = query(
                    appointmentsCollectionRef,
                    where('status', 'in', ['pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started']),
                );
                const latestSnapshot = await getDocs(qLatest);
                const upcomingAppts = latestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];

                // Sort in memory by date and then time slot
                upcomingAppts.sort((a, b) => {
                    const dateA = new Date(`${a.requested_date} ${a.requested_time_slot.split(' ')[0]}`); // Assuming time slot starts with HH:MM
                    const dateB = new Date(`${b.requested_date} ${b.requested_time_slot.split(' ')[0]}`);
                    return dateA.getTime() - dateB.getTime();
                });

                if (upcomingAppts.length > 0) {
                    const latestAppt = upcomingAppts[0];
                    let serviceName = 'Unknown Service';
                    let doctorName = 'Unassigned';

                    // Fetch service details
                    const serviceDocRef = doc(db, `artifacts/${appId}/services`, latestAppt.service_id);
                    const serviceSnap = await getDoc(serviceDocRef);
                    serviceName = serviceSnap.exists() ? (serviceSnap.data() as Service).name : serviceName;

                    // Fetch doctor details if assigned
                    if (latestAppt.doctor_id) {
                        const doctorUserDocRef = doc(db, `artifacts/${appId}/users/${latestAppt.doctor_id}/users`, latestAppt.doctor_id);
                        const doctorProfileSnap = await getDoc(doctorUserDocRef);
                        doctorName = doctorProfileSnap.exists() ? (doctorProfileSnap.data() as UserProfile).full_name || (doctorProfileSnap.data() as UserProfile).email : doctorName;
                    }

                    setLatestAppointment({
                        ...latestAppt,
                        serviceName,
                        doctorName,
                    });
                } else {
                    setLatestAppointment(null);
                }

                setUpcomingAppointmentsCount(upcomingAppts.length);

                // Fetch unread notifications count (placeholder logic)
                const notificationsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/notifications`);
                const qNotifications = query(notificationsCollectionRef, where('read', '==', false));
                const notificationsSnapshot = await getDocs(qNotifications);
                setUnreadNotificationsCount(notificationsSnapshot.size);

            } catch (err: any) {
                console.error("Error fetching patient dashboard data:", err);
                setErrorDashboard(err.message);
            } finally {
                setLoadingDashboard(false);
            }
        };

        if (user && db && appId && currentPage === 'dashboard') {
            fetchDashboardData();
        }
    }, [user, db, appId, currentPage]);


    const renderPatientPage = () => {
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
                if (!user || user.profile?.role !== 'patient') {
                    return <MessageDisplay message={{ text: "Access Denied. You must be a Patient to view this page.", type: "error" }} />;
                }

                return (
                    <div className="container py-4">
                        <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                            <h2 className="h3 fw-bold text-success mb-4 text-center">Patient Dashboard</h2>
                            <MessageDisplay message={message} />

                            <div className="text-center mb-4">
                                <img
                                    src={user?.photoURL || "https://placehold.co/100x100/007bff/ffffff?text=P"}
                                    onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/007bff/ffffff?text=P"; }}
                                    alt="Profile"
                                    className="rounded-circle mb-3"
                                    style={{ width: '100px', height: '100px', objectFit: 'cover', border: '3px solid #007bff' }}
                                />
                                <h4 className="fw-bold text-dark">{user?.profile?.full_name || user?.email || 'Patient'}</h4>
                                <p className="text-muted mb-1">Role: {user?.profile?.role}</p>
                                <p className="small text-break text-muted">User ID: <span className="font-monospace">{user?.uid}</span></p>
                            </div>

                            <div className="row g-4 mb-5">
                                <div className="col-md-4">
                                    <div className="card h-100 bg-primary text-white shadow-sm rounded-3">
                                        <div className="card-body d-flex flex-column justify-content-between">
                                            <h5 className="card-title fw-bold">Book New Service</h5>
                                            <p className="card-text">Quickly schedule your next dental appointment.</p>
                                            <button className="btn btn-light text-primary mt-3" onClick={() => navigate('bookService')}>Book Now</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="card h-100 bg-info text-white shadow-sm rounded-3">
                                        <div className="card-body d-flex flex-column justify-content-between">
                                            <h5 className="card-title fw-bold">My Bookings</h5>
                                            <p className="card-text">View and manage your upcoming and past appointments.</p>
                                            <p className="card-text fs-4 fw-bold">{upcomingAppointmentsCount} Upcoming</p>
                                            <button className="btn btn-light text-info mt-3" onClick={() => navigate('myBookings')}>View Bookings</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="card h-100 bg-secondary text-white shadow-sm rounded-3">
                                        <div className="card-body d-flex flex-column justify-content-between">
                                            <h5 className="card-title fw-bold">My Addresses</h5>
                                            <p className="card-text">Manage your saved addresses for quick booking.</p>
                                            <button className="btn btn-light text-secondary mt-3" onClick={() => navigate('myAddresses')}>Manage Addresses</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4 mb-5">
                                <div className="col-md-6">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-primary">Latest Appointment Status</h5>
                                            {latestAppointment ? (
                                                <>
                                                    <p className="card-text mb-1"><strong>Service:</strong> {latestAppointment.serviceName}</p>
                                                    <p className="card-text mb-1"><strong>Date:</strong> {latestAppointment.requested_date}</p>
                                                    <p className="card-text mb-1"><strong>Time:</strong> {latestAppointment.requested_time_slot}</p>
                                                    <p className="card-text mb-1"><strong>Doctor:</strong> {latestAppointment.doctorName}</p>
                                                    <p className="card-text mb-3"><strong>Status:</strong> <span className={`badge ${getStatusBadgeClass(latestAppointment.status)}`}>{latestAppointment.status.replace(/_/g, ' ').toUpperCase()}</span></p>
                                                    {latestAppointment.appointment_type && (
                                                        <p className="card-text mb-3"><strong>Type:</strong> {latestAppointment.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}</p>
                                                    )}
                                                    <button className="btn btn-outline-primary" onClick={() => navigate('appointmentStatus', { appointment: latestAppointment })}>View Details</button>
                                                </>
                                            ) : (
                                                <p className="text-muted">No upcoming appointments. Book one now!</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-success">Notifications & Announcements</h5>
                                            <ul className="list-group list-group-flush">
                                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                                    Unread Notifications
                                                    <span className="badge bg-danger rounded-pill">{unreadNotificationsCount}</span>
                                                </li>
                                                <li className="list-group-item">Your next appointment on {latestAppointment?.requested_date || 'N/A'} is {latestAppointment?.status.replace(/_/g, ' ') || 'not yet confirmed'}.</li>
                                                <li className="list-group-item">New offers available! Check out our 'Special Offers' section.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-4 mb-4">
                                <div className="col-md-12">
                                    <div className="card h-100 shadow-sm rounded-3">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-primary">My Health Data</h5>
                                            <p className="card-text text-muted">Access your prescriptions, health records, and consultation history.</p>
                                            <div className="d-grid gap-2 mt-3">
                                                <button className="btn btn-outline-primary" onClick={() => navigate('myPrescriptions')}>My Prescriptions</button>
                                                <button className="btn btn-outline-primary" onClick={() => navigate('myHealthRecords')}>My Health Records</button>
                                                <button className="btn btn-outline-primary" onClick={() => navigate('myConsultations')}>My Consultations</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="d-flex justify-content-center mt-4">
                                <button className="btn btn-link" onClick={logout}>Logout</button>
                            </div>
                        </div>
                    </div>
                );
            case 'bookService':
                return <BookServicePage navigate={navigate} />;
            case 'myBookings':
                return <MyBookingsPage navigate={navigate} />;
            case 'myAddresses':
                return <MyAddressesPage navigate={navigate} />;
            case 'appointmentStatus':
                return <AppointmentStatusPage navigate={navigate} appointment={pageData?.appointment} />;
            case 'payment':
                return <PaymentPage navigate={navigate} appointmentId={pageData.appointmentId} amount={pageData.amount} />;
            case 'feedback':
                return <FeedbackPage navigate={navigate} appointmentId={pageData.appointmentId} doctorId={pageData.doctorId} />;
            case 'helpFAQ':
                return <HelpFAQPage navigate={navigate} />;
            case 'myPrescriptions':
                return <MyPrescriptionsPage navigate={navigate} />;
            case 'myHealthRecords':
                return <MyHealthRecordsPage navigate={navigate} />;
            case 'myConsultations':
                return <MyConsultationsPage navigate={navigate} />;
            case 'prescriptionViewer':
                return <PrescriptionViewerPage navigate={navigate} patientId={pageData.patientId} prescriptionId={pageData.prescriptionId} />;
            case 'teleconsultationCall':
                return <TeleconsultationCallPage navigate={navigate} meetingLink={pageData.meetingLink} />;
            default:
                return <MessageDisplay message={{ text: "Page not found.", type: "error" }} />;
        }
    };

    return (
        <div className="container py-4">
            {renderPatientPage()}
        </div>
    );
};

// My Addresses Page (Patient) - This serves as the Address Management Page
export const MyAddressesPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
    const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
    const [addressFormData, setAddressFormData] = useState<Partial<Address>>({});
    const [showDeleteAddressModal, setShowDeleteAddressModal] = useState<Address | null>(null);

    const fetchAddresses = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const addressesCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/addresses`);
            const snapshot = await getDocs(addressesCollectionRef);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Address[];
            setAddresses(data);
        } catch (err: any) {
            console.error("Error fetching addresses:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchAddresses();
        }
    }, [user, db, appId]);

    const handleAddAddressClick = () => {
        setCurrentAddress(null);
        setAddressFormData({
            address_line_1: '',
            address_line_2: '',
            city: '',
            state: '',
            zip_code: '',
            label: '',
            is_default: false,
        });
        setShowAddressModal(true);
    };

    const handleEditAddressClick = (address: Address) => {
        setCurrentAddress(address);
        setAddressFormData(address);
        setShowAddressModal(true);
    };

    const handleAddressFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const newValue = (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setAddressFormData(prev => ({
            ...prev,
            [name]: newValue
        }));
    };

    const handleSaveAddress = async () => {
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            return;
        }
        if (!addressFormData.address_line_1 || !addressFormData.city || !addressFormData.state || !addressFormData.zip_code || !addressFormData.label) {
            setMessage({ text: "Please fill all required address fields.", type: "error" });
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const batch = writeBatch(db);

            if (addressFormData.is_default) {
                for (const addr of addresses) {
                    if (addr.is_default && addr.id !== currentAddress?.id) {
                        const oldDefaultRef = doc(db, `artifacts/${appId}/users/${user.uid}/addresses`, addr.id);
                        batch.update(oldDefaultRef, { is_default: false, updated_at: serverTimestamp() });
                    }
                }
            }

            if (currentAddress) {
                const addressDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/addresses`, currentAddress.id);
                batch.update(addressDocRef, {
                    ...addressFormData,
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Address updated successfully!', type: 'success' });
            } else {
                const addressesCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/addresses`);
                batch.set(doc(addressesCollectionRef), {
                    ...addressFormData,
                    user_id: user.uid,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Address added successfully!', type: 'success' });
            }
            await batch.commit();
            setShowAddressModal(false);
            fetchAddresses();
        } catch (err: any) {
            console.error("Error saving address:", err);
            setError(err.message);
            setMessage({ text: `Error saving address: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAddress = async () => {
        if (!showDeleteAddressModal?.id || !db || !appId || !user?.uid) {
            setError("Missing address ID or Firebase not initialized.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const addressDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/addresses`, showDeleteAddressModal.id);
            await deleteDoc(addressDocRef);
            setShowDeleteAddressModal(null);
            setMessage({ text: 'Address deleted successfully!', type: 'success' });
            fetchAddresses();
        } catch (err: any) {
                console.error("Error deleting address:", err);
            setError(err.message);
            setMessage({ text: `Error deleting address: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading addresses...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'patient') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Patient to view this page.", type: "warning" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">My Addresses</h2>

                <button className="btn btn-success mb-4" onClick={handleAddAddressClick}>Add New Address</button>

                {addresses.length === 0 ? (
                    <p className="text-muted text-center">No addresses saved yet.</p>
                ) : (
                    <div className="row g-3">
                        {addresses.map(addr => (
                            <div className="col-md-6" key={addr.id}>
                                <div className={`card h-100 shadow-sm ${addr.is_default ? 'border-success border-2' : ''}`}>
                                    <div className="card-body">
                                        <h5 className="card-title d-flex justify-content-between align-items-center">
                                            {addr.label}
                                            {addr.is_default && <span className="badge bg-success ms-2">Default</span>}
                                        </h5>
                                        <p className="card-text mb-0">{addr.address_line_1}</p>
                                        {addr.address_line_2 && <p className="card-text mb-0">{addr.address_line_2}</p>}
                                        <p className="card-text mb-0">{addr.city}, {addr.state} {addr.zip_code}</p>
                                        <div className="mt-3">
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditAddressClick(addr)}>Edit</button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => setShowDeleteAddressModal(addr)}>Delete</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showAddressModal && (
                <CustomModal
                    title={currentAddress ? 'Edit Address' : 'Add New Address'}
                    message={
                        <form>
                            <div className="mb-3">
                                <label htmlFor="addressLine1" className="form-label">Address Line 1:</label>
                                <input type="text" className="form-control" id="addressLine1" name="address_line_1" value={addressFormData.address_line_1 || ''} onChange={handleAddressFormChange} required />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="addressLine2" className="form-label">Address Line 2 (Optional):</label>
                                <input type="text" className="form-control" id="addressLine2" name="address_line_2" value={addressFormData.address_line_2 || ''} onChange={handleAddressFormChange} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="city" className="form-label">City:</label>
                                <input type="text" className="form-control" id="city" name="city" value={addressFormData.city || ''} onChange={handleAddressFormChange} required />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="state" className="form-label">State:</label>
                                <input type="text" className="form-control" id="state" name="state" value={addressFormData.state || ''} onChange={handleAddressFormChange} required />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="zipCode" className="form-label">Zip Code:</label>
                                <input type="text" className="form-control" id="zipCode" name="zip_code" value={addressFormData.zip_code || ''} onChange={handleAddressFormChange} required />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="label" className="form-label">Label (e.g., Home, Office):</label>
                                <input type="text" className="form-control" id="label" name="label" value={addressFormData.label || ''} onChange={handleAddressFormChange} required />
                            </div>
                            <div className="form-check mb-3">
                                <input type="checkbox" className="form-check-input" id="isDefault" name="is_default" checked={addressFormData.is_default || false} onChange={handleAddressFormChange} />
                                <label className="form-check-label" htmlFor="isDefault">Set as Default Address</label>
                            </div>
                        </form>
                    }
                    onConfirm={handleSaveAddress}
                    onCancel={() => setShowAddressModal(false)}
                    confirmText="Save Address"
                >
                </CustomModal>
            )}

            {showDeleteAddressModal && (
                <CustomModal
                    title="Confirm Delete Address"
                    message={`Are you sure you want to delete the address labeled "${showDeleteAddressModal.label}"? This action cannot be undone.`}
                    onConfirm={handleDeleteAddress}
                    onCancel={() => setShowDeleteAddressModal(null)}
                    confirmText="Yes, Delete"
                    cancelText="No, Keep"
                />
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Book Service Page (Patient)
export const BookServicePage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1);

    // MODIFIED: Ensure address_id can be string or null
    const [bookingData, setBookingData] = useState<{
        service_id: string;
        address_id: string | null;
        requested_date: string;
        requested_time_slot: string;
        estimated_cost: number;
        serviceName?: string;
        addressDetails?: Address | null;
        appointment_type: 'in_person' | 'teleconsultation';
        patientPhoneNumber?: string; // NEW: Add patient phone number to booking data
    }>({
        service_id: '',
        address_id: null,
        requested_date: '',
        requested_time_slot: '',
        estimated_cost: 0,
        appointment_type: 'in_person',
        patientPhoneNumber: '', // Initialize
    });
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

    // 24/7 Time Slots Generation
    const timeSlots = [];
    for (let i = 0; i < 24; i++) {
        const startHour = i;
        const endHour = (i + 1) % 24; // Handles the wrap-around for 23:00 - 00:00

        const formatHour = (hour: number) => {
            const h = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
            const ampm = hour < 12 || hour === 24 ? 'AM' : 'PM';
            return `${h.toString().padStart(2, '0')}:00 ${ampm}`;
        };

        const startTime = formatHour(startHour);
        const endTime = formatHour(endHour);

        timeSlots.push(`${startTime} - ${endTime}`);
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                // Fetch Services
                const servicesCollectionRef = collection(db, `artifacts/${appId}/services`);
                const servicesSnapshot = await getDocs(servicesCollectionRef);
                const fetchedServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
                setServices(fetchedServices);

                // Fetch Offers
                const offersCollectionRef = collection(db, `artifacts/${appId}/offers`);
                const offersSnapshot = await getDocs(offersCollectionRef);
                const fetchedOffers = offersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Offer[];
                setOffers(fetchedOffers);

                // Fetch Addresses for the current user
                const addressesCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/addresses`);
                const addressesSnapshot = await getDocs(addressesCollectionRef);
                const fetchedAddresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Address[];
                setAddresses(fetchedAddresses);

                // Fetch user profile to get phone number
                const userProfileDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
                const userProfileSnap = await getDoc(userProfileDocRef);
                if (userProfileSnap.exists()) {
                    const profileData = userProfileSnap.data() as UserProfile;
                    setBookingData(prev => ({ ...prev, patientPhoneNumber: profileData.phone_number || '' }));
                }

                // Set default address if any exist and it's an in-person appointment
                if (fetchedAddresses.length > 0 && bookingData.appointment_type === 'in_person') {
                    const defaultAddr = fetchedAddresses.find(addr => addr.is_default) || fetchedAddresses[0];
                    setSelectedAddress(defaultAddr);
                    // MODIFIED: Explicitly cast to string | null
                    setBookingData(prev => ({ ...prev, address_id: defaultAddr.id as string | null, addressDetails: defaultAddr }));
                } else if (bookingData.appointment_type === 'teleconsultation') {
                    // Ensure address_id is null for teleconsultation
                    setBookingData(prev => ({ ...prev, address_id: null, addressDetails: undefined }));
                    setSelectedAddress(null);
                }

            } catch (err: any) {
                console.error("Error fetching data for booking:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchData();
        }
    }, [user, db, appId, bookingData.appointment_type]);

    const handleServiceSelect = (service: Service) => {
        setSelectedService(service);
        setBookingData(prev => ({ ...prev, service_id: service.id, estimated_cost: service.base_price, serviceName: service.name }));
        setStep(2); // Move to appointment type selection
    };

    const handleAppointmentTypeChange = (type: 'in_person' | 'teleconsultation') => {
        // NEW: Restrict teleconsultation to "Consult" service only
        if (type === 'teleconsultation' && selectedService?.name?.toLowerCase() !== 'consult') {
            setMessage({ text: "Teleconsultation is only available for 'Consult' service.", type: "warning" });
            return; // Prevent selection of teleconsultation for other services
        }

        setBookingData(prev => ({
            ...prev,
            appointment_type: type,
            // MODIFIED: Explicitly ensure type compatibility for address_id
            address_id: type === 'teleconsultation' ? null : (selectedAddress?.id || null),
            addressDetails: type === 'teleconsultation' ? undefined : selectedAddress,
        }));
        if (type === 'in_person' && addresses.length === 0) {
            setMessage({ text: "Please add an address first to book an in-person appointment.", type: "warning" });
            // Optionally, prevent moving forward or prompt to add address
        }
        setStep(3); // Move to address or date/time selection
    };

    const handleAddressSelect = (address: Address) => {
        setSelectedAddress(address);
        setBookingData(prev => ({ ...prev, address_id: address.id, addressDetails: address }));
        setStep(4); // Move to date/time selection
    };

    const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setBookingData(prev => ({ ...prev, [name]: value }));
    };

    // NEW: Handle phone number input change
    const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBookingData(prev => ({ ...prev, patientPhoneNumber: e.target.value }));
    };

    const handleConfirmBooking = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            setLoading(false);
            return;
        }
        if (!bookingData.service_id || !bookingData.requested_date || !bookingData.requested_time_slot) {
            setMessage({ text: "Please fill all booking details.", type: "error" });
            setLoading(false);
            return;
        }
        if (bookingData.appointment_type === 'in_person' && !bookingData.address_id) {
            setMessage({ text: "Please select an address for in-person appointments.", type: "error" });
            setLoading(false);
            return;
        }
        // NEW: Validate phone number
        if (!bookingData.patientPhoneNumber || bookingData.patientPhoneNumber.trim() === '') {
            setMessage({ text: "Please provide your phone number to book an appointment.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const appointmentsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/appointments`);
            await addDoc(appointmentsCollectionRef, {
                patient_id: user.uid,
                service_id: bookingData.service_id,
                address_id: bookingData.address_id, // Will be null for teleconsultation
                requested_date: bookingData.requested_date,
                requested_time_slot: bookingData.requested_time_slot,
                estimated_cost: bookingData.estimated_cost,
                status: 'pending_assignment',
                payment_status: 'pending',
                appointment_type: bookingData.appointment_type, // Save the type
                patient_phone_number: bookingData.patientPhoneNumber, // NEW: Save phone number
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });

            // NEW: Update user's profile with the phone number if it's new or updated
            if (user?.profile?.phone_number !== bookingData.patientPhoneNumber) {
                const userProfileDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/users`, user.uid);
                await updateDoc(userProfileDocRef, {
                    phone_number: bookingData.patientPhoneNumber,
                    updated_at: serverTimestamp(),
                });
            }

            setMessage({ text: 'Appointment booked successfully! Waiting for doctor assignment.', type: 'success' });
            navigate('myBookings');
        } catch (err: any) {
            console.error("Error booking service:", err);
            setError(err.message);
            setMessage({ text: `Error booking service: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading services and addresses...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'patient') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Patient to view this page.", type: "warning" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Book New Service</h2>

                {step === 1 && (
                    <>
                        {offers.length > 0 && (
                            <div className="mb-5">
                                <h4 className="fw-bold text-dark mb-3">Special Offers!</h4>
                                <div id="offerCarousel" className="carousel slide" data-bs-ride="carousel">
                                    <div className="carousel-inner rounded-3 shadow-sm">
                                        {offers.map((offer, index) => (
                                            <div className={`carousel-item ${index === 0 ? 'active' : ''}`} key={offer.id}>
                                                <img src={offer.image_url || "https://placehold.co/600x200/cccccc/000000?text=Offer"} className="d-block w-100" alt={offer.title}
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
                        <h4 className="h5 fw-bold mb-3">Step 1: Select a Service</h4>
                        {services.length === 0 ? (
                            <p className="text-muted text-center">No services available yet.</p>
                        ) : (
                            <div className="row g-3">
                                {services.map(service => (
                                    <div className="col-md-4" key={service.id}>
                                        <div className="card h-100 shadow-sm service-card" onClick={() => handleServiceSelect(service)} style={{ cursor: 'pointer' }}>
                                            <img src={service.image || "https://placehold.co/150x100/e9ecef/000000?text=Service"} className="card-img-top" alt={service.name} onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/150x100/e9ecef/000000?text=Service"; }} />
                                            <div className="card-body d-flex flex-column">
                                                <h5 className="card-title">{service.name}</h5>
                                                <p className="card-text text-muted flex-grow-1">{service.description}</p>
                                                <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                                                    <span className="fw-bold text-primary fs-5">₹{service.base_price.toFixed(2)}</span>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => handleServiceSelect(service)}
                                                    >
                                                        Select
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {step === 2 && (
                    <>
                        <h4 className="h5 fw-bold mb-3">Step 2: Select Appointment Type</h4>
                        {selectedService && <p>You selected: <strong>{selectedService.name}</strong> (₹{selectedService.base_price.toFixed(2)})</p>}

                        <div className="mb-4">
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="appointmentType"
                                    id="inPersonRadio"
                                    value="in_person"
                                    checked={bookingData.appointment_type === 'in_person'}
                                    onChange={() => handleAppointmentTypeChange('in_person')}
                                />
                                <label className="form-check-label" htmlFor="inPersonRadio">
                                    In-person Consultation (Doctor visits your address)
                                </label>
                            </div>
                            {/* NEW: Conditionally render Teleconsultation option */}
                            {selectedService?.name?.toLowerCase() === 'consult' && (
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="appointmentType"
                                        id="teleconsultationRadio"
                                        value="teleconsultation"
                                        checked={bookingData.appointment_type === 'teleconsultation'}
                                        onChange={() => handleAppointmentTypeChange('teleconsultation')}
                                    />
                                    <label className="form-check-label" htmlFor="teleconsultationRadio">
                                        Teleconsultation (Video Call)
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                            {/* No "Next" button here, selection automatically moves to step 3 */}
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <h4 className="h5 fw-bold mb-3">Step 3: {bookingData.appointment_type === 'in_person' ? 'Select an Address' : 'Select Date & Time'}</h4>
                        {selectedService && <p>Service: <strong>{selectedService.name}</strong></p>}
                        <p>Appointment Type: <strong>{bookingData.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}</strong></p>

                        {bookingData.appointment_type === 'in_person' && (
                            addresses.length === 0 ? (
                                <p className="text-muted text-center">No addresses saved. Please add one in "My Addresses" first.</p>
                            ) : (
                                <div className="row g-3">
                                    {addresses.map(addr => (
                                        <div className="col-md-6" key={addr.id}>
                                            <div className={`card h-100 shadow-sm address-card ${selectedAddress?.id === addr.id ? 'border-success border-2' : ''}`} onClick={() => handleAddressSelect(addr)} style={{ cursor: 'pointer' }}>
                                                <div className="card-body">
                                                    <h5 className="card-title d-flex justify-content-between align-items-center">
                                                        {addr.label}
                                                        {addr.is_default && <span className="badge bg-info ms-2">Default</span>}
                                                    </h5>
                                                    <p className="card-text mb-0">{addr.address_line_1}</p>
                                                    {addr.address_line_2 && <p className="card-text mb-0">{addr.address_line_2}</p>}
                                                    <p className="card-text mb-0">{addr.city}, {addr.state} {addr.zip_code}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {bookingData.appointment_type === 'teleconsultation' && (
                            <>
                                <div className="mb-3">
                                    <label htmlFor="requestedDate" className="form-label">Preferred Date:</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        id="requestedDate"
                                        name="requested_date"
                                        value={bookingData.requested_date}
                                        onChange={handleDateTimeChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="requestedTimeSlot" className="form-label">Preferred Time Slot:</label>
                                    <select
                                        className="form-select"
                                        id="requestedTimeSlot"
                                        name="requested_time_slot"
                                        value={bookingData.requested_time_slot}
                                        onChange={handleDateTimeChange}
                                        required
                                    >
                                        <option value="">Select a time slot</option>
                                        {timeSlots.map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="d-flex justify-content-between mt-4">
                            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                            {bookingData.appointment_type === 'in_person' && selectedAddress && (
                                <button className="btn btn-primary" onClick={() => setStep(4)}>Next</button>
                            )}
                            {bookingData.appointment_type === 'teleconsultation' && bookingData.requested_date && bookingData.requested_time_slot && (
                                <button className="btn btn-primary" onClick={() => setStep(4)}>Review & Confirm</button>
                            )}
                        </div>
                    </>
                )}

                {step === 4 && (
                    <>
                        <h4 className="h5 fw-bold mb-3">Step 4: Review Your Booking</h4>
                        <ul className="list-group list-group-flush mb-4">
                            <li className="list-group-item"><strong>Service:</strong> {bookingData.serviceName}</li>
                            <li className="list-group-item"><strong>Estimated Cost:</strong> ₹{bookingData.estimated_cost.toFixed(2)}</li>
                            <li className="list-group-item"><strong>Appointment Type:</strong> {bookingData.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}</li>
                            {bookingData.appointment_type === 'in_person' && bookingData.addressDetails && (
                                <li className="list-group-item"><strong>Address:</strong>
                                    <>
                                        <br />{bookingData.addressDetails.address_line_1}
                                        {bookingData.addressDetails.address_line_2 && <>, {bookingData.addressDetails.address_line_2}</>}
                                        <br />{bookingData.addressDetails.city}, {bookingData.addressDetails.state} {bookingData.addressDetails.zip_code}
                                    </>
                                </li>
                            )}
                            <li className="list-group-item"><strong>Requested Date:</strong> {bookingData.requested_date}</li>
                            <li className="list-group-item"><strong>Requested Time:</strong> {bookingData.requested_time_slot}</li>
                        </ul>

                        {/* NEW: Phone Number Input */}
                        <div className="mb-3">
                            <label htmlFor="patientPhoneNumber" className="form-label">Your Phone Number:</label>
                            <input
                                type="tel" // Use type="tel" for phone numbers
                                className="form-control"
                                id="patientPhoneNumber"
                                name="patientPhoneNumber"
                                value={bookingData.patientPhoneNumber || ''}
                                onChange={handlePhoneNumberChange}
                                placeholder="e.g., +91 9876543210"
                                required
                            />
                            <small className="form-text text-muted">This number will be used by the clinic/doctor for communication.</small>
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button className="btn btn-secondary" onClick={() => setStep(3)}>Back to {bookingData.appointment_type === 'in_person' ? 'Address' : 'Date/Time'}</button>
                            <button className="btn btn-success" onClick={handleConfirmBooking} disabled={loading}>
                                {loading ? <LoadingSpinner /> : 'Confirm Booking'}
                            </button>
                        </div>
                    </>
                )}
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Define an extended Appointment type for local use in MyBookingsPage
interface EnrichedAppointment extends Appointment {
    teleconsultationLink?: string; // Add the optional teleconsultationLink
}

// My Bookings Page (Patient)
export const MyBookingsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]); // MODIFIED: Use EnrichedAppointment
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('upcoming');
    const [showCancelModal, setShowCancelModal] = useState<Appointment | null>(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState<Appointment | null>(null);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComments, setFeedbackComments] = useState('');

    const fetchMyBookings = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const appointmentsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/appointments`);
            let q = query(appointmentsCollectionRef);

            if (filterStatus === 'upcoming') {
                q = query(q, where('status', 'in', ['pending_assignment', 'assigned', 'confirmed', 'on_the_way', 'arrived', 'service_started']));
            } else if (filterStatus === 'completed') {
                q = query(q, where('status', '==', 'completed'));
            } else if (filterStatus === 'cancelled') {
                q = query(q, where('status', 'in', ['cancelled_by_patient', 'declined_by_doctor', 'rescheduled']));
            }

            const snapshot = await getDocs(q);
            let fetchedAppointments: EnrichedAppointment[] = []; // MODIFIED: Use EnrichedAppointment

            // Fetch all doctors and services once to reduce reads in loop
            const doctorsMap = new Map<string, UserProfile>();
            const servicesMap = new Map<string, Service>();

            const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
            allUsersSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        doctorsMap.set(docSnap.id, profileData);
                    }
                });

            const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`));
            servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));


            for (const docSnap of snapshot.docs) {
                const apptData = docSnap.data() as Appointment;
                let serviceName = servicesMap.get(apptData.service_id)?.name || 'Unknown Service';
                let doctorName = apptData.doctor_id ? (doctorsMap.get(apptData.doctor_id)?.full_name || doctorsMap.get(apptData.doctor_id)?.email || 'Unknown Doctor') : 'Unassigned';
                let addressDetails: Address | undefined;
                let teleconsultationLink: string | undefined;

                // Fetch address details (specific to the patient) if it's an in-person appointment
                if (apptData.appointment_type === 'in_person' && apptData.address_id) {
                    const addressesCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/addresses`);
                    const addressDocRef = doc(addressesCollectionRef, apptData.address_id);
                    const addressSnap = await getDoc(addressDocRef);
                    if (addressSnap.exists()) {
                        addressDetails = addressSnap.data() as Address;
                    }
                } else if (apptData.appointment_type === 'teleconsultation' && apptData.teleconsultation_id) {
                    const teleconsultationDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments/${docSnap.id}/teleconsultations`, apptData.teleconsultation_id);
                    const teleconsultationSnap = await getDoc(teleconsultationDocRef);
                    if (teleconsultationSnap.exists()) {
                        teleconsultationLink = (teleconsultationSnap.data() as Teleconsultation).meeting_link;
                    }
                }

                fetchedAppointments.push({
                    ...apptData,
                    id: docSnap.id,
                    serviceName,
                    doctorName,
                    addressDetails,
                    teleconsultationLink, // Add the link to the enriched appointment object
                });
            }
            setAppointments(fetchedAppointments);
        } catch (err: any) {
            console.error("Error fetching my bookings:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchMyBookings();
        }
    }, [user, db, appId, filterStatus]);

    const handleCancelBooking = async () => {
        if (!showCancelModal?.id || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing appointment ID or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, showCancelModal.id);
            await updateDoc(appointmentDocRef, {
                status: 'cancelled_by_patient',
                cancellation_reason: 'Cancelled by patient',
                updated_at: serverTimestamp(),
            });
            setShowCancelModal(null);
            setMessage({ text: 'Appointment cancelled successfully.', type: 'success' });
            fetchMyBookings();
        } catch (err: any) {
            console.error("Error cancelling appointment:", err);
            setError(err.message);
            setMessage({ text: `Error cancelling appointment: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleRescheduleClick = (appointment: Appointment) => {
        setMessage({ text: `Reschedule functionality for ${appointment.serviceName} on ${appointment.requested_date} at ${appointment.requested_time_slot} is coming soon!`, type: "info" });
    };

    const handleFeedbackClick = (appointment: Appointment) => {
        setShowFeedbackModal(appointment);
        setFeedbackRating(0);
        setFeedbackComments('');
    };

    const handleSubmitFeedback = async () => {
        if (!showFeedbackModal?.id || !db || !appId || !user?.uid || !showFeedbackModal.doctor_id || feedbackRating === 0) {
            setMessage({ text: "Missing data for feedback or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const batch = writeBatch(db);

            // 1. Add feedback document
            const feedbackCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/feedback`);
            batch.set(doc(feedbackCollectionRef), {
                patient_id: user.uid,
                appointment_id: showFeedbackModal.id,
                doctor_id: showFeedbackModal.doctor_id,
                rating: feedbackRating,
                comments: feedbackComments,
                created_at: serverTimestamp(),
            });

            // 2. Update doctor's average rating and total reviews (if doctorId is present)
            if (showFeedbackModal.doctor_id) {
                const doctorDocRef = doc(db, `artifacts/${appId}/users/${showFeedbackModal.doctor_id}/users`, showFeedbackModal.doctor_id);
                const doctorSnap = await getDoc(doctorDocRef);
                if (doctorSnap.exists()) {
                    const doctorProfile = doctorSnap.data() as UserProfile;
                    const currentTotalReviews = doctorProfile.total_reviews || 0;
                    const currentAverageRating = doctorProfile.average_rating || 0;

                    const newTotalReviews = currentTotalReviews + 1;
                    const newAverageRating = ((currentAverageRating * currentTotalReviews) + feedbackRating) / newTotalReviews;

                    batch.update(doctorDocRef, {
                        average_rating: newAverageRating,
                        total_reviews: newTotalReviews,
                        updated_at: serverTimestamp(),
                    });
                }
            }

            await batch.commit();

            setShowFeedbackModal(null);
            setMessage({ text: 'Feedback submitted successfully!', type: 'success' });
            fetchMyBookings();
        } catch (err: any) {
            console.error("Error submitting feedback:", err);
            setError(err.message);
            setMessage({ text: `Error submitting feedback: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinCall = (meetingLink: string) => {
        // Open the Jitsi meeting link in a new tab
        window.open(meetingLink, '_blank');
        // Optionally, navigate to a page that embeds Jitsi, but opening in new tab is simpler
        // navigate('teleconsultationCall', { meetingLink });
    };

    const isJoinCallActive = (appt: EnrichedAppointment) => { // MODIFIED: Use EnrichedAppointment
        if (appt.appointment_type === 'teleconsultation' && appt.teleconsultationLink && appt.status === 'confirmed') {
            const startTime = appt.requested_time_slot.split(' - ')[0]; // Get "HH:MM AM/PM"
            const apptDateTime = new Date(`${appt.requested_date} ${startTime}`);
            const now = new Date();
            const fifteenMinutesBefore = new Date(apptDateTime.getTime() - 15 * 60 * 1000);
            const oneHourAfter = new Date(apptDateTime.getTime() + 60 * 60 * 1000);
            return now >= fifteenMinutesBefore && now <= oneHourAfter;
        }
        return false;
    };


    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading your bookings...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'patient') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Patient to view this page.", type: "warning" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">My Bookings</h2>

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
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Doctor</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(appt => (
                                    <tr key={appt.id}>
                                        <td>{appt.serviceName}</td>
                                        <td>{appt.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}</td>
                                        <td>{appt.requested_date}</td>
                                        <td>{appt.requested_time_slot}</td>
                                        <td>{appt.doctorName}</td>
                                        <td><span className={`badge ${getStatusBadgeClass(appt.status)}`}>{appt.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                                        <td><span className={`badge ${appt.payment_status === 'paid' ? 'bg-success' : 'bg-secondary'}`}>{appt.payment_status.toUpperCase()}</span></td>
                                        <td>
                                            {appt.appointment_type === 'in_person' && ['pending_assignment', 'assigned', 'confirmed'].includes(appt.status) && (
                                                <>
                                                    <button className="btn btn-sm btn-outline-danger me-2" onClick={() => setShowCancelModal(appt)}>Cancel</button>
                                                    <button className="btn btn-sm btn-outline-info" onClick={() => handleRescheduleClick(appt)}>Reschedule</button>
                                                </>
                                            )}
                                            {appt.appointment_type === 'teleconsultation' && appt.status === 'confirmed' && isJoinCallActive(appt) && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleJoinCall(appt.teleconsultationLink!)}>Join Call</button>
                                            )}
                                            {appt.status === 'completed' && appt.payment_status === 'paid' && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleFeedbackClick(appt)}>Give Feedback</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCancelModal && (
                <CustomModal
                    title="Confirm Cancellation"
                    message={`Are you sure you want to cancel your appointment for ${showCancelModal.serviceName} on ${showCancelModal.requested_date} at ${showCancelModal.requested_time_slot}?`}
                    onConfirm={handleCancelBooking}
                    onCancel={() => setShowCancelModal(null)}
                    confirmText="Yes, Cancel"
                    cancelText="No, Keep"
                >
                </CustomModal>
            )}

            {showFeedbackModal && (
                <CustomModal
                    title={`Give Feedback for ${showFeedbackModal.serviceName}`}
                    message=""
                    onConfirm={handleSubmitFeedback}
                    onCancel={() => setShowFeedbackModal(null)}
                    confirmText="Submit Feedback"
                >
                    <div className="mb-3">
                        <label htmlFor="rating" className="form-label">Rating (1-5 Stars):</label>
                        <input
                            type="number"
                            className="form-control"
                            id="rating"
                            min="1"
                            max="5"
                            value={feedbackRating}
                            onChange={(e) => setFeedbackRating(parseInt(e.target.value))}
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="comments" className="form-label">Comments (Optional):</label>
                        <textarea
                            className="form-control"
                            id="comments"
                            rows={3}
                            value={feedbackComments}
                            onChange={(e) => setFeedbackComments(e.target.value)}
                        ></textarea>
                    </div>
                </CustomModal>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Appointment Status Page
export const AppointmentStatusPage: React.FC<{ navigate: (page: string | number, data?: any) => void; appointment?: Appointment }> = ({ navigate, appointment: initialAppointment }) => {
    const { user, db, appId, setMessage } = useAuth();
    // MODIFIED: Use EnrichedAppointment for the state
    const [appointment, setAppointment] = useState<EnrichedAppointment | undefined>(initialAppointment as EnrichedAppointment | undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState<string>('');
    const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState<string>('');
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [teleconsultationLink, setTeleconsultationLink] = useState<string | undefined>(undefined);

    // 24/7 Time Slots Generation (copied from BookServicePage for consistency)
    const timeSlots = [];
    for (let i = 0; i < 24; i++) {
        const startHour = i;
        const endHour = (i + 1) % 24; // Handles the wrap-around for 23:00 - 00:00

        const formatHour = (hour: number) => {
            const h = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
            const ampm = hour < 12 || hour === 24 ? 'AM' : 'PM';
            return `${h.toString().padStart(2, '0')}:00 ${ampm}`;
        };

        const startTime = formatHour(startHour);
        const endTime = formatHour(endHour);

        timeSlots.push(`${startTime} - ${endTime}`);
    }

    useEffect(() => {
        const fetchAppointmentDetails = async () => {
            if (!initialAppointment?.id || !db || !appId || !user?.uid) {
                setError("Appointment ID or Firebase not initialized.");
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, initialAppointment.id);
                const docSnap = await getDoc(appointmentDocRef);
                if (docSnap.exists()) {
                    const apptData = docSnap.data() as Appointment;
                    let serviceName = 'Unknown Service';
                    let doctorName = 'Unassigned';
                    let addressDetails: Address | undefined;

                    // Fetch service details
                    const serviceDocRef = doc(db, `artifacts/${appId}/services`, apptData.service_id);
                    const serviceSnap = await getDoc(serviceDocRef);
                    serviceName = serviceSnap.exists() ? (serviceSnap.data() as Service).name : serviceName;

                    // Fetch doctor details if assigned
                    if (apptData.doctor_id) {
                        const doctorUserDocRef = doc(db, `artifacts/${appId}/users/${apptData.doctor_id}/users`, apptData.doctor_id);
                        const doctorProfileSnap = await getDoc(doctorUserDocRef);
                        doctorName = doctorProfileSnap.exists() ? (doctorProfileSnap.data() as UserProfile).full_name || (doctorProfileSnap.data() as UserProfile).email : doctorName;
                    }

                    // Fetch address details for in-person appointments
                    if (apptData.appointment_type === 'in_person' && apptData.address_id) {
                        const addressDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/addresses`, apptData.address_id);
                        const addressSnap = await getDoc(addressDocRef);
                        if (addressSnap.exists()) {
                            addressDetails = addressSnap.data() as Address;
                        }
                    } else if (apptData.appointment_type === 'teleconsultation' && apptData.teleconsultation_id) {
                        const teleconsultationDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments/${apptData.id}/teleconsultations`, apptData.teleconsultation_id);
                        const teleconsultationSnap = await getDoc(teleconsultationDocRef);
                        if (teleconsultationSnap.exists()) {
                            setTeleconsultationLink((teleconsultationSnap.data() as Teleconsultation).meeting_link);
                        }
                    }

                    // MODIFIED: Cast to EnrichedAppointment
                    setAppointment({
                        ...apptData,
                        id: docSnap.id,
                        serviceName,
                        doctorName,
                        addressDetails,
                        teleconsultationLink: teleconsultationLink, // Pass the fetched link
                    } as EnrichedAppointment); // Explicitly cast
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
    }, [initialAppointment, user, db, appId, teleconsultationLink]); // Added teleconsultationLink to dependency array

    const handleReschedule = async () => {
        if (!appointment?.id || !db || !appId || !user?.uid || !rescheduleDate || !rescheduleTimeSlot) {
            setMessage({ text: "Missing data for reschedule or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, appointment.id);
            await updateDoc(appointmentDocRef, {
                requested_date: rescheduleDate,
                requested_time_slot: rescheduleTimeSlot,
                status: 'rescheduled',
                updated_at: serverTimestamp(),
            });
            setShowRescheduleModal(false);
            setMessage({ text: 'Appointment rescheduled successfully!', type: 'success' });
            navigate('myBookings');
        } catch (err: any) {
            console.error("Error rescheduling appointment:", err);
            setError(err.message);
            setMessage({ text: `Error rescheduling appointment: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!appointment?.id || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing appointment ID or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, appointment.id);
            await updateDoc(appointmentDocRef, {
                status: 'cancelled_by_patient',
                cancellation_reason: 'Cancelled by patient from status page',
                updated_at: serverTimestamp(),
            });
            setShowCancelModal(false);
            setMessage({ text: 'Appointment cancelled successfully.', type: 'success' });
            navigate('myBookings');
        } catch (err: any) {
            console.error("Error cancelling appointment:", err);
            setError(err.message);
            setMessage({ text: `Error cancelling appointment: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinCall = () => {
        if (teleconsultationLink) {
            window.open(teleconsultationLink, '_blank');
        } else {
            setMessage({ text: "Teleconsultation link not available yet.", type: "warning" });
        }
    };

    const isJoinCallActive = (appt: EnrichedAppointment) => { // MODIFIED: Use EnrichedAppointment
        if (appt.appointment_type === 'teleconsultation' && appt.teleconsultationLink && appt.status === 'confirmed') {
            const apptDateTime = new Date(`${appt.requested_date} ${appt.requested_time_slot.split(' ')[0]}`);
            const now = new Date();
            const fifteenMinutesBefore = new Date(apptDateTime.getTime() - 15 * 60 * 1000);
            const oneHourAfter = new Date(apptDateTime.getTime() + 60 * 60 * 1000);
            return now >= fifteenMinutesBefore && now <= oneHourAfter;
        }
        return false;
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading appointment details...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'patient') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Patient to view this page.", type: "warning" }} />;
    }
    if (!appointment) return <MessageDisplay message={{ text: "No appointment data provided or found.", type: "info" }} />;

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Appointment Status</h2>

                <div className="mb-3">
                    <strong>Service:</strong> {appointment.serviceName}
                </div>
                <div className="mb-3">
                    <strong>Doctor:</strong> {appointment.doctorName}
                </div>
                <div className="mb-3">
                    <strong>Appointment Type:</strong> {appointment.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}
                </div>
                {appointment.appointment_type === 'in_person' && (
                    <div className="mb-3">
                        <strong>Address:</strong> {appointment.addressDetails?.address_line_1}, {appointment.addressDetails?.city}
                    </div>
                )}
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
                    {appointment.appointment_type === 'in_person' && ['pending_assignment', 'assigned', 'confirmed'].includes(appointment.status) && (
                        <>
                            <button className="btn btn-warning" onClick={() => setShowRescheduleModal(true)}>Reschedule</button>
                            <button className="btn btn-danger" onClick={() => setShowCancelModal(true)}>Cancel</button>
                        </>
                    )}
                    {appointment.appointment_type === 'teleconsultation' && appointment.status === 'confirmed' && isJoinCallActive(appointment) && (
                        <button className="btn btn-success" onClick={handleJoinCall}>Join Teleconsultation</button>
                    )}
                    {appointment.status === 'completed' && appointment.payment_status === 'pending' && (
                        <button className="btn btn-success" onClick={() => navigate('payment', { appointmentId: appointment.id, amount: appointment.estimated_cost })}>Make Payment</button>
                    )}
                    {appointment.status === 'completed' && appointment.payment_status === 'paid' && appointment.doctor_id && (
                        <button className="btn btn-info" onClick={() => navigate('feedback', { appointmentId: appointment.id, doctorId: appointment.doctor_id })}>Give Feedback</button>
                    )}
                </div>
            </div>

            {showRescheduleModal && (
                <CustomModal
                    title="Reschedule Appointment"
                    message=""
                    onConfirm={handleReschedule}
                    onCancel={() => setShowRescheduleModal(false)}
                    confirmText="Confirm Reschedule"
                >
                    <div className="mb-3">
                        <label htmlFor="rescheduleDate" className="form-label">New Date:</label>
                        <input
                            type="date"
                            className="form-control"
                            id="rescheduleDate"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="rescheduleTimeSlot" className="form-label">New Time Slot:</label>
                        <select
                            className="form-select"
                            id="rescheduleTimeSlot"
                            value={rescheduleTimeSlot}
                            onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                            required
                        >
                            <option value="">Select a time slot</option>
                            {timeSlots.map(slot => (
                                <option key={slot} value={slot}>{slot}</option>
                            ))}
                        </select>
                    </div>
                </CustomModal>
            )}

            {showCancelModal && (
                <CustomModal
                    title="Confirm Cancellation"
                    message="Are you sure you want to cancel this appointment? This action cannot be undone."
                    onConfirm={handleCancel}
                    onCancel={() => setShowCancelModal(false)}
                    confirmText="Yes, Cancel"
                    cancelText="No, Keep"
                >
                </CustomModal>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('myBookings')}>Back to My Bookings</button>
            </div>
        </div>
    );
};

// Payment Page (Patient)
export const PaymentPage: React.FC<{ navigate: (page: string | number, data?: any) => void; appointmentId: string; amount: number }> = ({ navigate, appointmentId, amount }) => {
    const { user, db, appId, message, setMessage } = useAuth();
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');

    const handlePayment = async () => {
        setLoading(true);
        setMessage({ text: '', type: 'info' });

        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            setLoading(false);
            return;
        }
        if (!paymentMethod || (paymentMethod === 'card' && (!cardNumber || !expiryDate || !cvv))) {
            setMessage({ text: "Please fill all payment details.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            // Simulate payment processing
            await new Promise(resolve => setTimeout(resolve, 1500));

            const batch = writeBatch(db);

            // 1. Update appointment status to paid
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, appointmentId);
            batch.update(appointmentDocRef, {
                payment_status: 'paid',
                updated_at: serverTimestamp(),
            });

            // 2. Record the payment
            const feeConfigDocRef = doc(db, `artifacts/${appId}/public/data/fee_configurations`, 'current_config');
            const feeConfigSnap = await getDoc(feeConfigDocRef);
            let platformFeePercentage = 0.15;
            let doctorSharePercentage = 0.70;
            let adminFeePercentage = 0.15;

            if (feeConfigSnap.exists()) {
                const config = feeConfigSnap.data() as FeeConfiguration;
                platformFeePercentage = config.platform_fee_percentage;
                doctorSharePercentage = config.doctor_share_percentage;
                adminFeePercentage = config.admin_fee_percentage;
            }

            const paymentsCollectionRef = collection(db, `artifacts/${appId}/public/data/payments`);
            batch.set(doc(paymentsCollectionRef), {
                patient_id: user.uid,
                appointment_id: appointmentId,
                amount: amount,
                currency: 'INR',
                payment_method: paymentMethod,
                payment_gateway_transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                status: 'successful',
                platform_fee_amount: amount* platformFeePercentage,
                doctor_fee_amount: amount* doctorSharePercentage,
                admin_fee_amount: amount * adminFeePercentage,
                transaction_date: serverTimestamp(),
            });

            await batch.commit();

            setMessage({ text: `Payment of ₹${amount.toFixed(2)} successful!`, type: "success" });
            navigate('myBookings');
        } catch (err: any) {
            console.error("Error processing payment:", err);
            setMessage({ text: `Payment failed: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Make Payment</h2>

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <strong>Appointment ID:</strong> {appointmentId}
                </div>
                <div className="mb-3">
                    <strong>Amount Due:</strong> ₹{amount.toFixed(2)}
                </div>

                <div className="mb-3">
                    <label htmlFor="paymentMethod" className="form-label">Payment Method:</label>
                    <select
                        id="paymentMethod"
                        className="form-select"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        required
                    >
                        <option value="">Select Method</option>
                        <option value="card">Credit/Debit Card</option>
                        <option value="upi">UPI</option>
                        <option value="netbanking">Net Banking</option>
                    </select>
                </div>

                {paymentMethod === 'card' && (
                    <>
                        <div className="mb-3">
                            <label htmlFor="cardNumber" className="form-label">Card Number:</label>
                            <input type="text" className="form-control" id="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="XXXX XXXX XXXX XXXX" required />
                        </div>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="expiryDate" className="form-label">Expiry Date (MM/YY):</label>
                                <input type="text" className="form-control" id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} placeholder="MM/YY" required />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="cvv" className="form-label">CVV:</label>
                                <input type="text" className="form-control" id="cvv" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="XXX" required />
                            </div>
                        </div>
                    </>
                )}

                <button className="btn btn-success w-100 mt-3" onClick={handlePayment} disabled={loading}>
                    {loading ? <LoadingSpinner /> : `Pay ₹${amount.toFixed(2)}`}
                </button>
            </div>

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('myBookings')}>Back to My Bookings</button>
            </div>
        </div>
    );
};

// Feedback Page (Patient)
export const FeedbackPage: React.FC<{ navigate: (page: string | number, data?: any) => void; appointmentId: string; doctorId: string }> = ({ navigate, appointmentId, doctorId }) => {
    const { user, db, appId, message, setMessage } = useAuth();
    const [loading, setLoading] = useState(false);
    const [rating, setRating] = useState(0);
    const [comments, setComments] = useState('');

    const handleSubmitFeedback = async () => {
        setLoading(true);
        setMessage({ text: '', type: 'info' });

        if (!db || !appId || !user?.uid || !appointmentId || !doctorId || rating === 0) {
            setMessage({ text: "Missing feedback data or Firebase not initialized.", type: "error" });
            setLoading(false);
            return;
        }

        try {
            const batch = writeBatch(db);

            // 1. Add feedback document
            const feedbackCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/feedback`);
            batch.set(doc(feedbackCollectionRef), {
                patient_id: user.uid,
                appointment_id: appointmentId,
                doctor_id: doctorId,
                rating: rating,
                comments: comments,
                created_at: serverTimestamp(),
            });

            // 2. Update doctor's average rating and total reviews
            const doctorDocRef = doc(db, `artifacts/${appId}/users/${doctorId}/users`, doctorId);
            const doctorSnap = await getDoc(doctorDocRef);
            if (doctorSnap.exists()) {
                const doctorProfile = doctorSnap.data() as UserProfile;
                const currentTotalReviews = doctorProfile.total_reviews || 0;
                const currentAverageRating = doctorProfile.average_rating || 0;

                const newTotalReviews = currentTotalReviews + 1;
                const newAverageRating = ((currentAverageRating * currentTotalReviews) + rating) / newTotalReviews;

                batch.update(doctorDocRef, {
                    average_rating: newAverageRating,
                    total_reviews: newTotalReviews,
                    updated_at: serverTimestamp(),
                });
            }

            await batch.commit();

            setMessage({ text: "Feedback submitted successfully!", type: "success" });
            navigate('myBookings');
        } catch (err: any) {
            console.error("Error submitting feedback:", err);
            setMessage({ text: `Failed to submit feedback: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Give Feedback</h2>

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <strong>Appointment ID:</strong> {appointmentId}
                </div>
                <div className="mb-3">
                    <strong>Doctor ID:</strong> {doctorId}
                </div>

                <div className="mb-3">
                    <label htmlFor="rating" className="form-label">Rating (1-5 Stars):</label>
                    <input
                        type="number"
                        className="form-control"
                        id="rating"
                        min="1"
                        max="5"
                        value={rating}
                        onChange={(e) => setRating(parseInt(e.target.value))}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="comments" className="form-label">Comments (Optional):</label>
                    <textarea
                        className="form-control"
                        id="comments"
                        rows={3}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                    ></textarea>
                </div>

                <button className="btn btn-success w-100 mt-3" onClick={handleSubmitFeedback} disabled={loading}>
                    {loading ? <LoadingSpinner /> : 'Submit Feedback'}
                </button>
            </div>

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('myBookings')}>Back to My Bookings</button>
            </div>
        </div>
    );
};

// Help & FAQ Page (Patient)
export const HelpFAQPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-success mb-4 text-center">Help & FAQ</h2>

                <div className="accordion" id="faqAccordion">
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingOne">
                            <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
                                How do I book a new service?
                            </button>
                        </h2>
                        <div id="collapseOne" className="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                Navigate to the "Book Service" section from your dashboard. Select the service you need, then choose your preferred address, date, and time slot. Review your booking and confirm.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingTwo">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                                How can I view my past appointments?
                            </button>
                        </h2>
                        <div id="collapseTwo" className="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                Go to "My Bookings" from your dashboard. You can use the filter option to view "Completed" or "Cancelled/Rescheduled" appointments.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingThree">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                                What if I need to reschedule or cancel an appointment?
                            </button>
                        </h2>
                        <div id="collapseThree" className="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                In "My Bookings", find the upcoming appointment you wish to change. You will see options to "Reschedule" or "Cancel" if the appointment status allows.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingFour">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFour" aria-expanded="false" aria-controls="collapseFour">
                                How do I manage my addresses?
                            </button>
                        </h2>
                        <div id="collapseFour" className="accordion-collapse collapse" aria-labelledby="headingFour" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                Access "My Addresses" from your dashboard. Here you can add new addresses, edit existing ones, or set a default address.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingFive">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFive" aria-expanded="false" aria-controls="collapseFive">
                                How can I give feedback for a service?
                            </button>
                        </h2>
                        <div id="collapseFive" className="accordion-collapse collapse" aria-labelledby="headingFive" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                After an appointment is completed and paid, you can find the "Give Feedback" option next to it in "My Bookings".
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingSix">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSix" aria-expanded="false" aria-controls="collapseSix">
                                Where can I view my prescriptions?
                            </button>
                        </h2>
                        <div id="collapseSix" className="accordion-collapse collapse" aria-labelledby="headingSix" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                You can view all your prescribed medications in the "My Prescriptions" section from your dashboard.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingSeven">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSeven" aria-expanded="false" aria-controls="collapseSeven">
                                How do I access my health records?
                            </button>
                        </h2>
                        <div id="collapseSeven" className="accordion-collapse collapse" aria-labelledby="headingSeven" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                Your health records, including diagnoses and test results, are available under "My Health Records" in your dashboard.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingEight">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEight" aria-expanded="false" aria-controls="collapseEight">
                                Can I review past consultation notes?
                            </button>
                        </h2>
                        <div id="collapseEight" className="accordion-collapse collapse" aria-labelledby="headingEight" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                Yes, detailed notes from your past consultations can be found in the "My Consultations" section of your dashboard.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingNine">
                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseNine" aria-expanded="false" aria-controls="collapseNine">
                                How do teleconsultations work?
                            </button>
                        </h2>
                        <div id="collapseNine" className="accordion-collapse collapse" aria-labelledby="headingNine" data-bs-parent="#faqAccordion">
                            <div className="accordion-body">
                                When booking a service, you can choose "Teleconsultation". Once confirmed by a doctor, you will see a "Join Call" button in "My Bookings" and "Appointment Status" pages. This button will become active shortly before your scheduled appointment time, allowing you to join a secure video call with your doctor.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};


// --- NEW COMPONENTS FOR PATIENT HEALTH DATA ---

// My Prescriptions Page
export const MyPrescriptionsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrescriptions = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                const prescriptionsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/prescriptions`);
                const q = query(prescriptionsCollectionRef, where('patient_id', '==', user.uid));
                const snapshot = await getDocs(q);
                let fetchedPrescriptions: Prescription[] = [];

                const doctorsMap = new Map<string, UserProfile>();
                const doctorsSnapshot = await getDocs(query(collectionGroup(db, 'users'), where('role', '==', 'doctor')));
                doctorsSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        doctorsMap.set(docSnap.id, profileData);
                    }
                });

                for (const docSnap of snapshot.docs) {
                    const prescriptionData = docSnap.data() as Prescription;
                    const doctorName = doctorsMap.get(prescriptionData.doctor_id)?.full_name || doctorsMap.get(prescriptionData.doctor_id)?.email || 'Unknown Doctor';
                    fetchedPrescriptions.push({ ...prescriptionData, id: docSnap.id, doctorName });
                }
                setPrescriptions(fetchedPrescriptions);
            } catch (err: any) {
                console.error("Error fetching prescriptions:", err);
                setError(err.message);
                setMessage({ text: `Error fetching prescriptions: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchPrescriptions();
        }
    }, [user, db, appId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading prescriptions...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;

    return (
        <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
            <h2 className="h3 fw-bold text-primary mb-4 text-center">My Prescriptions</h2>
            {prescriptions.length === 0 ? (
                <p className="text-muted text-center">No prescriptions found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Prescribed Date</th>
                                <th>Expires Date</th>
                                <th>Prescribed By</th>
                                <th>Medications</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prescriptions.map(p => (
                                <tr key={p.id}>
                                    <td>{p.prescribed_date}</td>
                                    <td>{p.expires_date || 'N/A'}</td>
                                    <td>{p.doctorName}</td>
                                    <td>
                                        {p.medications && p.medications.length > 0 ? (
                                            <ul className="list-unstyled mb-0">
                                                {p.medications.map((med, idx) => (
                                                    <li key={idx}>
                                                        <strong>{med.medication_name}:</strong> {med.dosage}, {med.frequency}. <em>{med.instructions}</em>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            'No medications listed.'
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => navigate('prescriptionViewer', { patientId: user?.uid, prescriptionId: p.id })}
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
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// My Health Records Page
export const MyHealthRecordsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHealthRecords = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                const healthRecordsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/health_records`);
                const q = query(healthRecordsCollectionRef, where('patient_id', '==', user.uid));
                const snapshot = await getDocs(q);
                let fetchedRecords: HealthRecord[] = [];

                const doctorsMap = new Map<string, UserProfile>();
                const doctorsSnapshot = await getDocs(query(collectionGroup(db, 'users'), where('role', '==', 'doctor')));
                doctorsSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        doctorsMap.set(docSnap.id, profileData);
                    }
                });

                for (const docSnap of snapshot.docs) {
                    const recordData = docSnap.data() as HealthRecord;
                    const doctorName = recordData.doctor_id ? (doctorsMap.get(recordData.doctor_id)?.full_name || doctorsMap.get(recordData.doctor_id)?.email || 'Unknown Doctor') : 'Patient Added';
                    fetchedRecords.push({ ...recordData, id: docSnap.id, doctorName });
                }
                setHealthRecords(fetchedRecords);
            } catch (err: any) {
                console.error("Error fetching health records:", err);
                setError(err.message);
                setMessage({ text: `Error fetching health records: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchHealthRecords();
        }
    }, [user, db, appId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading health records...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;

    return (
        <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
            <h2 className="h3 fw-bold text-primary mb-4 text-center">My Health Records</h2>
            {healthRecords.length === 0 ? (
                <p className="text-muted text-center">No health records found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Description</th>
                                <th>Added By</th>
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
                                    <td>{r.doctorName}</td>
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
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// My Consultations Page
export const MyConsultationsPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConsultations = async () => {
            setLoading(true);
            setError(null);
            if (!db || !appId || !user?.uid) {
                setError("Firestore not initialized or user not logged in.");
                setLoading(false);
                return;
            }
            try {
                const consultationsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/consultations`);
                const q = query(consultationsCollectionRef, where('patient_id', '==', user.uid));
                const snapshot = await getDocs(q);
                let fetchedConsultations: Consultation[] = [];

                const doctorsMap = new Map<string, UserProfile>();
                const doctorsSnapshot = await getDocs(query(collectionGroup(db, 'users'), where('role', '==', 'doctor')));
                doctorsSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) {
                        doctorsMap.set(docSnap.id, profileData);
                    }
                });

                const servicesMap = new Map<string, Service>();
                const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`));
                servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));

                for (const docSnap of snapshot.docs) {
                    const consultationData = docSnap.data() as Consultation;
                    const doctorName = doctorsMap.get(consultationData.doctor_id)?.full_name || doctorsMap.get(consultationData.doctor_id)?.email || 'Unknown Doctor';

                    let serviceName = 'N/A';
                    if (consultationData.appointment_id) {
                        const appointmentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/appointments`, consultationData.appointment_id);
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
                console.error("Error fetching consultations:", err);
                setError(err.message);
                setMessage({ text: `Error fetching consultations: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) {
            fetchConsultations();
        }
    }, [user, db, appId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading consultations...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;

    return (
        <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
            <h2 className="h3 fw-bold text-primary mb-4 text-center">My Consultations</h2>
            {consultations.length === 0 ? (
                <p className="text-muted text-center">No consultations found.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Doctor</th>
                                <th>Service</th>
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
                                    <td>{c.doctorName}</td>
                                    <td>{c.serviceName}</td>
                                    <td>{c.diagnosis || 'N/A'}</td>
                                    <td>{c.recommendations || 'N/A'}</td>
                                    <td>{c.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};
