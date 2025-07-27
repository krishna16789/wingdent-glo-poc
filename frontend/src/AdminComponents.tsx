// frontend/src/AdminComponents.tsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, collectionGroup, Timestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay, CustomModal } from './CommonComponents';
import { Service, Offer, Appointment, Payment, FeeConfiguration, Address, Prescription, HealthRecord, Consultation, UserProfile, Teleconsultation } from './types'; // Import Teleconsultation type
import { DashboardProps } from './PatientComponents'; // Import DashboardProps for consistency

// Import the new PrescriptionViewerPage
import { PrescriptionViewerPage } from './PrescriptionViewerPage'; // NEW IMPORT
import { TeleconsultationCallPage } from './TeleconsultationCallPage';

// User Management Page (Admin/Superadmin)
export const UserManagementPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId, setMessage } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterRole, setFilterRole] = useState<string>('all');
    const [showEditUserModal, setShowEditUserModal] = useState<UserProfile | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<UserProfile>>({});
    const [showDeleteUserModal, setShowDeleteUserModal] = useState<UserProfile | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            let usersQuery = query(collectionGroup(db, 'users'));

            if (filterRole !== 'all') {
                usersQuery = query(usersQuery, where('role', '==', filterRole));
            }

            const snapshot = await getDocs(usersQuery);
            let fetchedUsers: UserProfile[] = [];

            for (const docSnap of snapshot.docs) {
                const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId && pathSegments[3] === docSnap.id) { // Ensure it belongs to this app's structure
                    fetchedUsers.push(profileData);
                }
            }
            setUsers(fetchedUsers);

        } catch (err: any) {
            console.error("Error fetching users:", err);
            setError(err.message);
            setMessage({ text: `Error fetching users: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchUsers();
        }
    }, [user, db, appId, filterRole]);

    const handleEditClick = (userToEdit: UserProfile) => {
        setShowEditUserModal(userToEdit);
        setEditFormData({
            full_name: userToEdit.full_name,
            email: userToEdit.email,
            role: userToEdit.role,
            status: userToEdit.status,
            phone_number: userToEdit.phone_number,
            license_number: userToEdit.license_number,
            specialization: userToEdit.specialization,
            years_of_experience: userToEdit.years_of_experience,
            bio: userToEdit.bio,
            is_available_now: userToEdit.is_available_now,
            average_rating: userToEdit.average_rating,
            total_reviews: userToEdit.total_reviews,
        });
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setEditFormData((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSaveUser = async () => {
        if (!showEditUserModal?.id || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing user ID or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${showEditUserModal.id}/users`, showEditUserModal.id);
            await updateDoc(userDocRef, {
                ...editFormData,
                updated_at: serverTimestamp(),
            });
            setShowEditUserModal(null);
            setMessage({ text: 'User profile updated successfully!', type: 'success' });
            fetchUsers();
        } catch (err: any) {
            console.error("Error saving user:", err);
            setError(err.message);
            setMessage({ text: `Error saving user: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!showDeleteUserModal?.id || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing user ID or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${showDeleteUserModal.id}/users`, showDeleteUserModal.id);
            await deleteDoc(userDocRef);

            setShowDeleteUserModal(null);
            setMessage({ text: 'User deleted successfully!', type: 'success' });
            fetchUsers();
        } catch (err: any) {
            console.error("Error deleting user:", err);
            setError(err.message);
            setMessage({ text: `Error deleting user: ${err.message}`, type: "error" });
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
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">User Management</h2>
                <MessageDisplay message={message} />

                <div className="mb-4">
                    <label htmlFor="roleFilter" className="form-label">Filter by Role:</label>
                    <select
                        id="roleFilter"
                        className="form-select"
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        <option value="patient">Patient</option>
                        <option value="doctor">Doctor</option>
                        <option value="admin">Admin</option>
                        {user.profile?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                    </select>
                </div>

                {users.length === 0 ? (
                    <p className="text-muted text-center">No users found for the selected role.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.full_name}</td>
                                        <td>{u.email}</td>
                                        <td><span className={`badge ${u.role === 'superadmin' ? 'bg-dark' : u.role === 'admin' ? 'bg-primary' : u.role === 'doctor' ? 'bg-success' : 'bg-info'}`}>{u.role}</span></td>
                                        <td><span className={`badge ${u.status === 'active' ? 'bg-success' : 'bg-danger'}`}>{u.status}</span></td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditClick(u)}>Edit</button>
                                            {user.profile?.role === 'superadmin' && u.role !== 'superadmin' && (
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => setShowDeleteUserModal(u)}>Delete</button>
                                            )}
                                            {user.profile?.role === 'admin' && u.role !== 'admin' && u.role !== 'superadmin' && (
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => setShowDeleteUserModal(u)}>Delete</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showEditUserModal && (
                <CustomModal
                    title={`Edit User: ${showEditUserModal.full_name}`}
                    message=""
                    onConfirm={handleSaveUser}
                    onCancel={() => setShowEditUserModal(null)}
                    confirmText="Save Changes"
                >
                    <form>
                        <div className="mb-3">
                            <label htmlFor="editFullName" className="form-label">Full Name:</label>
                            <input type="text" className="form-control" id="editFullName" name="full_name" value={editFormData.full_name || ''} onChange={handleEditFormChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="editEmail" className="form-label">Email:</label>
                            <input type="email" className="form-control" id="editEmail" name="email" value={editFormData.email || ''} onChange={handleEditFormChange} disabled />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="editRole" className="form-label">Role:</label>
                            <select className="form-select" id="editRole" name="role" value={editFormData.role || ''} onChange={handleEditFormChange} disabled={user.profile?.role === 'admin' && (showEditUserModal.role === 'admin' || showEditUserModal.role === 'superadmin')}>
                                <option value="patient">Patient</option>
                                <option value="doctor">Doctor</option>
                                <option value="admin" disabled={user.profile?.role !== 'superadmin'}>Admin</option>
                                <option value="superadmin" disabled={user.profile?.role !== 'superadmin'}>Superadmin</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="editStatus" className="form-label">Status:</label>
                            <select className="form-select" id="editStatus" name="status" value={editFormData.status || ''} onChange={handleEditFormChange}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                {editFormData.role === 'doctor' && <option value="pending_approval">Pending Approval</option>}
                            </select>
                        </div>
                        {/* Additional fields for Doctor profile */}
                        {editFormData.role === 'doctor' && (
                            <>
                                <div className="mb-3">
                                    <label htmlFor="editLicense" className="form-label">License Number:</label>
                                    <input type="text" className="form-control" id="editLicense" name="license_number" value={editFormData.license_number || ''} onChange={handleEditFormChange} />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="editSpecialization" className="form-label">Specialization:</label>
                                    <input type="text" className="form-control" id="editSpecialization" name="specialization" value={editFormData.specialization || ''} onChange={handleEditFormChange} />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="editExperience" className="form-label">Years of Experience:</label>
                                    <input type="number" className="form-control" id="editExperience" name="years_of_experience" value={editFormData.years_of_experience || ''} onChange={handleEditFormChange} />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="editBio" className="form-label">Bio:</label>
                                    <textarea className="form-control" id="editBio" name="bio" rows={3} value={editFormData.bio || ''} onChange={handleEditFormChange}></textarea>
                                </div>
                                <div className="form-check mb-3">
                                    <input type="checkbox" className="form-check-input" id="editIsAvailableNow" name="is_available_now" checked={editFormData.is_available_now || false} onChange={handleEditFormChange} />
                                    <label className="form-check-label" htmlFor="editIsAvailableNow">Available Now</label>
                                </div>
                            </>
                        )}
                    </form>
                </CustomModal>
            )}

            {showDeleteUserModal && (
                <CustomModal
                    title="Confirm User Deletion"
                    message={`Are you sure you want to delete user: ${showDeleteUserModal.full_name} (${showDeleteUserModal.email})? This action cannot be undone.`}
                    onConfirm={handleDeleteUser}
                    onCancel={() => setShowDeleteUserModal(null)}
                    confirmText="Yes, Delete User"
                    cancelText="No, Keep User"
                />
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Service Management Page (Admin/Superadmin)
export const ServiceManagementPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId, setMessage } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
    const [currentService, setCurrentService] = useState<Service | null>(null);
    const [serviceFormData, setServiceFormData] = useState<Partial<Service>>({});

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const servicesCollectionRef = collection(db, `artifacts/${appId}/services`);
            const snapshot = await getDocs(servicesCollectionRef);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
            setServices(data);
        } catch (err: any) {
            console.error("Error fetching services:", err);
            setError(err.message);
            setMessage({ text: `Error fetching services: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchServices();
        }
    }, [user, db, appId]);

    const handleAddServiceClick = () => {
        setCurrentService(null);
        setServiceFormData({ name: '', description: '', base_price: 0, estimated_duration_minutes: 0, image: '' });
        setShowServiceModal(true);
    };

    const handleEditServiceClick = (service: Service) => {
        setCurrentService(service);
        setServiceFormData(service);
        setShowServiceModal(true);
    };

    const handleServiceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setServiceFormData(prev => ({
            ...prev,
            [name]: name === 'base_price' || name === 'estimated_duration_minutes' ? parseFloat(value) : value
        }));
    };

    const handleSaveService = async () => {
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (currentService) {
                const serviceDocRef = doc(db, `artifacts/${appId}/services`, currentService.id);
                await updateDoc(serviceDocRef, {
                    ...serviceFormData,
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Service updated successfully!', type: 'success' });
            } else {
                const servicesCollectionRef = collection(db, `artifacts/${appId}/services`);
                await addDoc(servicesCollectionRef, {
                    ...serviceFormData,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Service added successfully!', type: 'success' });
            }
            setShowServiceModal(false);
            fetchServices();
        } catch (err: any) {
            console.error("Error saving service:", err);
            setError(err.message);
            setMessage({ text: `Error saving service: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteService = async (serviceId: string) => {
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const serviceDocRef = doc(db, `artifacts/${appId}/services`, serviceId);
            await deleteDoc(serviceDocRef);
            setMessage({ text: 'Service deleted successfully!', type: 'success' });
            fetchServices();
        } catch (err: any) {
            console.error("Error deleting service:", err);
            setError(err.message);
            setMessage({ text: `Error deleting service: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading services...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Service Management</h2>
                <MessageDisplay message={message} />

                <button className="btn btn-primary mb-4" onClick={handleAddServiceClick}>Add New Service</button>

                {services.length === 0 ? (
                    <p className="text-muted text-center">No services defined yet.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
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
                                        <td>₹{service.base_price.toFixed(2)}</td>
                                        <td>{service.estimated_duration_minutes}</td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditServiceClick(service)}>Edit</button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteService(service.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showServiceModal && (
                <CustomModal
                    title={currentService ? 'Edit Service' : 'Add New Service'}
                    message=""
                    onConfirm={handleSaveService}
                    onCancel={() => setShowServiceModal(false)}
                    confirmText="Save"
                >
                    <form>
                        <div className="mb-3">
                            <label htmlFor="serviceName" className="form-label">Service Name:</label>
                            <input type="text" className="form-control" id="serviceName" name="name" value={serviceFormData.name || ''} onChange={handleServiceFormChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="serviceDescription" className="form-label">Description:</label>
                            <textarea className="form-control" id="serviceDescription" name="description" rows={3} value={serviceFormData.description || ''} onChange={handleServiceFormChange} required></textarea>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="servicePrice" className="form-label">Base Price (₹):</label>
                            <input type="number" className="form-control" id="servicePrice" name="base_price" value={serviceFormData.base_price || 0} onChange={handleServiceFormChange} required min="0" step="0.01" />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="serviceDuration" className="form-label">Estimated Duration (minutes):</label>
                            <input type="number" className="form-control" id="serviceDuration" name="estimated_duration_minutes" value={serviceFormData.estimated_duration_minutes || 0} onChange={handleServiceFormChange} required min="1" />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="serviceImage" className="form-label">Image URL (Optional):</label>
                            <input type="text" className="form-control" id="serviceImage" name="image" value={serviceFormData.image || ''} onChange={handleServiceFormChange} />
                        </div>
                    </form>
                </CustomModal>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Offer Management Page (Admin/Superadmin)
export const OfferManagementPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId, setMessage } = useAuth();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showOfferModal, setShowOfferModal] = useState<boolean>(false);
    const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
    const [offerFormData, setOfferFormData] = useState<Partial<Offer>>({});

    const fetchOffers = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const offersCollectionRef = collection(db, `artifacts/${appId}/offers`);
            const snapshot = await getDocs(offersCollectionRef);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Offer[];
            setOffers(data);
        } catch (err: any) {
            console.error("Error fetching offers:", err);
            setError(err.message);
            setMessage({ text: `Error fetching offers: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchOffers();
        }
    }, [user, db, appId]);

    const handleAddOfferClick = () => {
        setCurrentOffer(null);
        setOfferFormData({ title: '', description: '', image_url: '', link_url: '' });
        setShowOfferModal(true);
    };

    const handleEditOfferClick = (offer: Offer) => {
        setCurrentOffer(offer);
        setOfferFormData(offer);
        setShowOfferModal(true);
    };

    const handleOfferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setOfferFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveOffer = async () => {
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (currentOffer) {
                const offerDocRef = doc(db, `artifacts/${appId}/offers`, currentOffer.id);
                await updateDoc(offerDocRef, {
                    ...offerFormData,
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Offer updated successfully!', type: 'success' });
            } else {
                const offersCollectionRef = collection(db, `artifacts/${appId}/offers`);
                await addDoc(offersCollectionRef, {
                    ...offerFormData,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
                setMessage({ text: 'Offer added successfully!', type: 'success' });
            }
            setShowOfferModal(false);
            fetchOffers();
        } catch (err: any) {
            console.error("Error saving offer:", err);
            setError(err.message);
            setMessage({ text: `Error saving offer: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOffer = async (offerId: string) => {
        if (!db || !appId || !user?.uid) {
            setMessage({ text: "Firestore not initialized or user not logged in.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const offerDocRef = doc(db, `artifacts/${appId}/offers`, offerId);
            await deleteDoc(offerDocRef);
            setMessage({ text: 'Offer deleted successfully!', type: 'success' });
            fetchOffers();
        } catch (err: any) {
            console.error("Error deleting offer:", err);
            setError(err.message);
            setMessage({ text: `Error deleting offer: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading offers...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Offer Management</h2>
                <MessageDisplay message={message} />

                <button className="btn btn-primary mb-4" onClick={handleAddOfferClick}>Add New Offer</button>

                {offers.length === 0 ? (
                    <p className="text-muted text-center">No offers defined yet.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
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
                                        <td><img src={offer.image_url} alt={offer.title} style={{ width: '80px', height: 'auto' }} onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/80x40/cccccc/000000?text=No+Image"; }} /></td>
                                        <td><a href={offer.link_url} target="_blank" rel="noopener noreferrer">{offer.link_url ? 'View Link' : 'N/A'}</a></td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditOfferClick(offer)}>Edit</button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteOffer(offer.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showOfferModal && (
                <CustomModal
                    title={currentOffer ? 'Edit Offer' : 'Add New Offer'}
                    message=""
                    onConfirm={handleSaveOffer}
                    onCancel={() => setShowOfferModal(false)}
                    confirmText="Save"
                >
                    <form>
                        <div className="mb-3">
                            <label htmlFor="offerTitle" className="form-label">Offer Title:</label>
                            <input type="text" className="form-control" id="offerTitle" name="title" value={offerFormData.title || ''} onChange={handleOfferFormChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="offerDescription" className="form-label">Description:</label>
                            <textarea className="form-control" id="offerDescription" name="description" rows={3} value={offerFormData.description || ''} onChange={handleOfferFormChange} required></textarea>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="offerImage" className="form-label">Image URL:</label>
                            <input type="url" className="form-control" id="offerImage" name="image_url" value={offerFormData.image_url || ''} onChange={handleOfferFormChange} required />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="offerLink" className="form-label">Link URL (Optional):</label>
                            <input type="url" className="form-control" id="offerLink" name="link_url" value={offerFormData.link_url || ''} onChange={handleOfferFormChange} />
                        </div>
                    </form>
                </CustomModal>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// Appointment Oversight Page (Admin/Superadmin)
export const AppointmentOversightPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId, setMessage } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showAssignDoctorModal, setShowAssignDoctorModal] = useState<Appointment | null>(null);
    const [availableDoctors, setAvailableDoctors] = useState<UserProfile[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

    // State for Record Payment Modal
    const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<Appointment | null>(null);
    const [paymentFormData, setPaymentFormData] = useState({
        amount: 0,
        payment_method: '',
        transaction_id: '',
    });
    const [feeConfig, setFeeConfig] = useState<FeeConfiguration | null>(null);

    // Fetch Fee Configuration on component mount
    useEffect(() => {
        const fetchFeeConfig = async () => {
            if (!db || !appId) return;
            try {
                const docRef = doc(db, `artifacts/${appId}/public/data/fee_configurations`, 'current_config');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setFeeConfig(docSnap.data() as FeeConfiguration);
                } else {
                    console.warn("Fee configuration not found. Using default percentages.");
                    setFeeConfig({
                        id: 'current_config',
                        platform_fee_percentage: 0.15, // 15%
                        doctor_share_percentage: 0.70, // 70%
                        admin_fee_percentage: 0.15,  // 15%
                        effective_from: Timestamp.now(),
                        created_by: user?.uid || 'system',
                        created_at: Timestamp.now(),
                        updated_at: Timestamp.now(),
                    });
                }
            } catch (err: any) {
                console.error("Error fetching fee configuration:", err);
                setError(err.message);
                setMessage({ text: `Failed to load fee configuration: ${err.message}`, type: "error" });
            }
        };
        if (user && db && appId) {
            fetchFeeConfig();
        }
    }, [user, db, appId]);


    const fetchAppointments = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            // Pre-fetch all services once
            const servicesMap = new Map<string, Service>();
            const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`));
            servicesSnapshot.docs.forEach(docSnap => servicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Service));

            // Pre-fetch all users (patients and doctors) once
            const usersMap = new Map<string, UserProfile>();
            const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
            allUsersSnapshot.docs.forEach(docSnap => {
                const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                    usersMap.set(docSnap.id, profileData);
                }
            });

            let appointmentsQuery = query(collectionGroup(db, 'appointments'));

            if (filterStatus !== 'all') {
                appointmentsQuery = query(appointmentsQuery, where('status', '==', filterStatus));
            }

            const snapshot = await getDocs(appointmentsQuery);
            let allAppointments: Appointment[] = [];

            for (const docSnap of snapshot.docs) {
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId) {
                    const apptData = docSnap.data() as Appointment;
                    
                    // Get patient name
                    const patientName = usersMap.get(apptData.patient_id)?.full_name || usersMap.get(apptData.patient_id)?.email || 'Unknown Patient';

                    // Get service name from the pre-fetched map
                    const serviceName = servicesMap.get(apptData.service_id)?.name || 'Unknown Service';

                    // Get doctor name
                    const doctorName = apptData.doctor_id ? (usersMap.get(apptData.doctor_id)?.full_name || usersMap.get(apptData.doctor_id)?.email || 'Unassigned') : 'Unassigned';
                    
                    let addressDetails: Address | undefined;

                    // Fetch address details (still need to fetch individually as they are in patient's subcollection)
                    if (apptData.patient_id && apptData.address_id) {
                        const addressDocRef = doc(db, `artifacts/${appId}/users/${apptData.patient_id}/addresses`, apptData.address_id);
                        const addressSnap = await getDoc(addressDocRef);
                        if (addressSnap.exists()) {
                            addressDetails = addressSnap.data() as Address;
                        }
                    }

                    allAppointments.push({
                        ...apptData,
                        id: docSnap.id,
                        patientName,
                        serviceName,
                        doctorName,
                        addressDetails,
                    });
                }
            }
            setAppointments(allAppointments);
        } catch (err: any) {
            console.error("Error fetching all appointments:", err);
            setError(err.message);
            setMessage({ text: `Error fetching all appointments: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableDoctors = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId) {
            setError("Firestore not initialized.");
            setLoading(false);
            return;
        }
        try {
            const doctorsQuery = query(
                collectionGroup(db, 'users'),
                where('role', '==', 'doctor'),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(doctorsQuery);
            const doctors = snapshot.docs
                .filter(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    return pathSegments[1] === appId && pathSegments[3] === docSnap.id;
                })
                .map(doc => ({ id: doc.id, ...doc.data() })) as UserProfile[];
            setAvailableDoctors(doctors);
        } catch (err: any) {
            console.error("Error fetching available doctors:", err);
            setError(err.message);
            setMessage({ text: `Error fetching available doctors: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) {
            fetchAppointments();
            fetchAvailableDoctors();
        }
    }, [user, db, appId, filterStatus]);

    const handleAssignDoctorClick = (appointment: Appointment) => {
        setShowAssignDoctorModal(appointment);
        setSelectedDoctorId(appointment.doctor_id || '');
    };

    const handleAssignDoctor = async () => {
        if (!showAssignDoctorModal?.id || !selectedDoctorId || !db || !appId || !user?.uid) {
            setMessage({ text: "Missing appointment or doctor ID, or Firebase not initialized.", type: "error" });
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${showAssignDoctorModal.patient_id}/appointments`, showAssignDoctorModal.id);
            const batch = writeBatch(db); // Use a batch for multiple updates

            // Update the main appointment document
            batch.update(appointmentDocRef, {
                doctor_id: selectedDoctorId,
                status: 'assigned',
                assigned_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });

            // NEW: If it's a teleconsultation, generate Jitsi link and create Teleconsultation document
            if (showAssignDoctorModal.appointment_type === 'teleconsultation') {
                const jitsiRoomName = `WingdentGlo_${appId}_${showAssignDoctorModal.id}_${Date.now()}`;
                const meetingLink = `https://meet.jit.si/${jitsiRoomName}`;

                const teleconsultationsCollectionRef = collection(db, `artifacts/${appId}/users/${showAssignDoctorModal.patient_id}/appointments/${showAssignDoctorModal.id}/teleconsultations`);
                const newTeleconsultationDocRef = doc(teleconsultationsCollectionRef); // Auto-generate ID
                const teleconsultationId = newTeleconsultationDocRef.id;

                batch.set(newTeleconsultationDocRef, {
                    appointment_id: showAssignDoctorModal.id,
                    patient_id: showAssignDoctorModal.patient_id,
                    doctor_id: selectedDoctorId,
                    meeting_link: meetingLink,
                    status: 'scheduled',
                    platform_used: 'Jitsi',
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                } as Teleconsultation); // Cast to Teleconsultation type

                // Update the main appointment document with teleconsultation_id
                batch.update(appointmentDocRef, {
                    teleconsultation_id: teleconsultationId, // Store the reference to the subcollection document
                });
            }

            await batch.commit(); // Commit all batch operations

            setShowAssignDoctorModal(null);
            setMessage({ text: 'Doctor assigned successfully!', type: 'success' });
            fetchAppointments();
        } catch (err: any) {
            console.error("Error assigning doctor:", err);
            setError(err.message);
            setMessage({ text: `Error assigning doctor: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleRecordPaymentClick = (appointment: Appointment) => {
        setShowRecordPaymentModal(appointment);
        setPaymentFormData({
            amount: appointment.estimated_cost,
            payment_method: '',
            transaction_id: '',
        });
    };

    const handlePaymentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPaymentFormData(prev => ({
            ...prev,
            [name]: name === 'amount' ? parseFloat(value) : value
        }));
    };

    const handleRecordPayment = async () => {
        if (!showRecordPaymentModal || !db || !appId || !user?.uid || !feeConfig) {
            setMessage({ text: "Missing data for payment recording or Firebase not initialized.", type: "error" });
            return;
        }
        if (paymentFormData.amount <= 0 || !paymentFormData.payment_method) {
            setMessage({ text: "Please enter a valid amount and select a payment method.", type: "error" });
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const appointment = showRecordPaymentModal;
            const totalAmount = paymentFormData.amount;

            const platformFee = totalAmount * (feeConfig.platform_fee_percentage || 0);
            const doctorShare = totalAmount * (feeConfig.doctor_share_percentage || 0);
            const adminFee = totalAmount * (feeConfig.admin_fee_percentage || 0);

            const appointmentDocRef = doc(db, `artifacts/${appId}/users/${appointment.patient_id}/appointments`, appointment.id);
            await updateDoc(appointmentDocRef, {
                payment_status: 'paid',
                updated_at: serverTimestamp(),
            });

            const paymentsCollectionRef = collection(db, `artifacts/${appId}/public/data/payments`);
            await addDoc(paymentsCollectionRef, {
                appointment_id: appointment.id,
                patient_id: appointment.patient_id,
                doctor_id: appointment.doctor_id || null,
                service_id: appointment.service_id,
                amount: totalAmount,
                currency: 'INR',
                payment_gateway_transaction_id: paymentFormData.transaction_id || `OFFLINE-${Date.now()}`,
                status: 'successful',
                payment_method: paymentFormData.payment_method,
                platform_fee_amount: platformFee,
                doctor_fee_amount: doctorShare,
                admin_fee_amount: adminFee,
                transaction_date: serverTimestamp(),
                recorded_by: user.uid,
            });

            setShowRecordPaymentModal(null);
            setMessage({ text: 'Payment recorded successfully!', type: 'success' });
            fetchAppointments();
        } catch (err: any) {
            console.error("Error recording payment:", err);
            setError(err.message);
            setMessage({ text: `Error recording payment: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };


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

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading appointments...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Appointment Oversight</h2>
                <MessageDisplay message={message} />

                <div className="mb-4">
                    <label htmlFor="statusFilter" className="form-label">Filter by Status:</label>
                    <select
                        id="statusFilter"
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending_assignment">Pending Assignment</option>
                        <option value="assigned">Assigned</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="on_the_way">On the Way</option>
                        <option value="arrived">Arrived</option>
                        <option value="service_started">Service Started</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled_by_patient">Cancelled by Patient</option>
                        <option value="declined_by_doctor">Declined by Doctor</option>
                        <option value="rescheduled">Rescheduled</option>
                    </select>
                </div>

                {appointments.length === 0 ? (
                    <p className="text-muted text-center">No appointments found for the selected status.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Service</th>
                                    <th>Type</th> {/* NEW COLUMN */}
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Address</th>
                                    <th>Doctor</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.map(appt => (
                                    <tr key={appt.id}>
                                        <td>{appt.patientName}</td>
                                        <td>{appt.serviceName}</td>
                                        {/* MODIFIED: Safely display appointment type */}
                                        <td>{appt.appointment_type === 'teleconsultation' ? 'Teleconsultation' : 'In-person'}</td>
                                        <td>{appt.requested_date}</td>
                                        <td>{appt.requested_time_slot}</td>
                                        <td>
                                            {/* MODIFIED: Display address only for in-person appointments */}
                                            {appt.appointment_type === 'in_person' ? (
                                                appt.addressDetails ? (
                                                    <>
                                                        {appt.addressDetails.address_line_1}<br />
                                                        {appt.addressDetails.address_line_2 && `${appt.addressDetails.address_line_2}<br />`}
                                                        {appt.addressDetails.city}, {appt.addressDetails.state} {appt.addressDetails.zip_code}
                                                    </>
                                                ) : 'N/A'
                                            ) : 'N/A (Teleconsultation)'}
                                        </td>
                                        <td>{appt.doctorName}</td>
                                        <td><span className={`badge ${getStatusBadgeClass(appt.status)}`}>{appt.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                                        <td><span className={`badge ${appt.payment_status === 'paid' ? 'bg-success' : 'bg-secondary'}`}>{appt.payment_status.toUpperCase()}</span></td>
                                        <td>
                                            {appt.status === 'pending_assignment' && (
                                                <button className="btn btn-sm btn-primary" onClick={() => handleAssignDoctorClick(appt)}>Assign Doctor</button>
                                            )}
                                            {appt.status === 'completed' && appt.payment_status === 'pending' && (
                                                <button className="btn btn-sm btn-success ms-2" onClick={() => handleRecordPaymentClick(appt)}>Record Payment</button>
                                            )}
                                            {/* Admin can view teleconsultation link if it exists */}
                                            {appt.appointment_type === 'teleconsultation' && (
                                                <button
                                                    className="btn btn-sm btn-outline-info ms-2"
                                                    // Admin can generate on the fly for viewing, as the actual link is in subcollection
                                                    onClick={() => navigate('teleconsultationCall', { meetingLink: `https://meet.jit.si/WingdentGlo_${appId}_${appt.id}` })}
                                                >
                                                    View Call Link
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAssignDoctorModal && (
                <CustomModal
                    title={`Assign Doctor to ${showAssignDoctorModal.serviceName} for ${showAssignDoctorModal.patientName}`}
                    message={
                        <>
                            <p><strong>Appointment Type:</strong> {showAssignDoctorModal.appointment_type === 'in_person' ? 'In-person' : 'Teleconsultation'}</p>
                            {showAssignDoctorModal.appointment_type === 'in_person' && (
                                <p><strong>Appointment Address:</strong></p>
                            )}
                            {showAssignDoctorModal.appointment_type === 'in_person' && showAssignDoctorModal.addressDetails ? (
                                <p>
                                    {showAssignDoctorModal.addressDetails.address_line_1}<br />
                                    {showAssignDoctorModal.addressDetails.address_line_2 && `${showAssignDoctorModal.addressDetails.address_line_2}<br />`}
                                    {showAssignDoctorModal.addressDetails.city}, {showAssignDoctorModal.addressDetails.state} {showAssignDoctorModal.addressDetails.zip_code}
                                </p>
                            ) : (
                                showAssignDoctorModal.appointment_type === 'in_person' && <p>Address details not available.</p>
                            )}
                            <p>Select a doctor to assign to this appointment.</p>
                        </>
                    }
                    onConfirm={handleAssignDoctor}
                    onCancel={() => setShowAssignDoctorModal(null)}
                    confirmText="Assign Doctor"
                >
                    <div className="mb-3">
                        <label htmlFor="selectDoctor" className="form-label">Available Doctors:</label>
                        <select
                            id="selectDoctor"
                            className="form-select"
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            required
                        >
                            <option value="">Select a doctor...</option>
                            {availableDoctors.map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                    {doctor.full_name} ({doctor.specialization || 'N/A'})
                                </option>
                            ))}
                        </select>
                        {availableDoctors.length === 0 && <p className="text-danger mt-2">No active doctors available.</p>}
                    </div>
                </CustomModal>
            )}

            {showRecordPaymentModal && (
                <CustomModal
                    title={`Record Payment for ${showRecordPaymentModal.serviceName}`}
                    message={`Patient: ${showRecordPaymentModal.patientName}`}
                    onConfirm={handleRecordPayment}
                    onCancel={() => setShowRecordPaymentModal(null)}
                    confirmText="Record Payment"
                >
                    <form className="mt-3">
                        <div className="mb-3">
                            <label htmlFor="paymentAmount" className="form-label">Amount (₹):</label>
                            <input
                                type="number"
                                className="form-control"
                                id="paymentAmount"
                                name="amount"
                                value={paymentFormData.amount}
                                onChange={handlePaymentFormChange}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="paymentMethod" className="form-label">Payment Method:</label>
                            <select
                                className="form-select"
                                id="paymentMethod"
                                name="payment_method"
                                value={paymentFormData.payment_method}
                                onChange={handlePaymentFormChange}
                                required
                            >
                                <option value="">Select Method</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="UPI">UPI</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="transactionId" className="form-label">Transaction ID (Optional):</label>
                            <input
                                type="text"
                                className="form-control"
                                id="transactionId"
                                name="transaction_id"
                                value={paymentFormData.transaction_id}
                                onChange={handlePaymentFormChange}
                                placeholder="e.g., UPI ref no., bank txn id"
                            />
                        </div>
                    </form>
                </CustomModal>
            )}

            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};

// NEW: AdminPatientOversightPage - Lists all patients for admin to view their records
export const AdminPatientOversightPage: React.FC<{ navigate: (page: string | number, data?: any) => void }> = ({ navigate }) => {
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
                const patientsQuery = query(
                    collectionGroup(db, 'users'),
                    where('role', '==', 'patient')
                );
                const snapshot = await getDocs(patientsQuery);
                const fetchedPatients: UserProfile[] = [];
                snapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId && pathSegments[3] === docSnap.id) {
                        fetchedPatients.push(profileData);
                    }
                });
                setPatients(fetchedPatients);
                setFilteredPatients(fetchedPatients);
            }
            catch (err: any) {
                console.error("Error fetching patients for admin oversight:", err);
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
                <LoadingSpinner /><p className="mt-3 text-muted">Loading patients for oversight...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Patient Health Oversight</h2>

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
                                onClick={() => navigate('adminPatientHealthDataView', { patientId: patient.id, patientName: patient.full_name || patient.email })}
                            >
                                <div>
                                    <h5 className="mb-1">{patient.full_name || patient.email}</h5>
                                    <small className="text-muted">{patient.email} {patient.phone_number && `| ${patient.phone_number}`}</small>
                                </div>
                                <span className="badge bg-primary rounded-pill">View Health Records</span>
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

// NEW: AdminPatientHealthDataViewPage - Displays a specific patient's health data for admin
export const AdminPatientHealthDataViewPage: React.FC<{ navigate: (page: string | number, data?: any) => void; patientId: string; patientName: string }> = ({ navigate, patientId, patientName }) => {
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

                const servicesSnapshot = await getDocs(collection(db, `artifacts/${appId}/services`));
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
                console.error("Error fetching patient health data for admin:", err);
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
    if (!user || (user.profile?.role !== 'admin' && user.profile?.role !== 'superadmin')) {
        return <MessageDisplay message={{ text: "Access Denied. You must be an Admin or Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Health Data for {patientName}</h2>

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
                                    <th>Prescribed By</th>
                                    <th>Medications</th>
                                    <th>Actions</th> {/* NEW: Actions column */}
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
                                    <th>Added By</th>
                                    <th>Attachment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {healthRecords.map(r => (
                                    <tr key={r.id}>
                                        <td>{r.record_date}</td>
                                        <td>{r.record_type.replace(/_/g, ' ').toUpperCase()}</td>
                                        <td>{r.title}</td>
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
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('adminPatientOversight')}>Back to Patient List</button>
            </div>
        </div>
    );
};


// AdminDashboard Component
export const AdminDashboard: React.FC<DashboardProps> = ({ navigate, currentPage, pageData }) => {
    const { user, logout, message, db, appId } = useAuth();

    const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState<number>(0);
    const [activeDoctorsCount, setActiveDoctorsCount] = useState<number>(0);
    const [totalPatientsCount, setTotalPatientsCount] = useState<number>(0);
    const [loadingStats, setLoadingStats] = useState(true);
    const [errorStats, setErrorStats] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            setLoadingStats(true);
            setErrorStats(null);
            if (!db || !appId || !user?.uid) {
                setErrorStats("Firestore not initialized or user not logged in.");
                setLoadingStats(false);
                return;
            }
            try {
                // Fetch Pending Appointments
                const pendingAppointmentsQuery = query(
                    collectionGroup(db, 'appointments'),
                    where('status', '==', 'pending_assignment')
                );
                const pendingAppointmentsSnapshot = await getDocs(pendingAppointmentsQuery);
                let countPending = 0;
                pendingAppointmentsSnapshot.docs.forEach(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                        countPending++;
                    }
                });
                setPendingAppointmentsCount(countPending);

                // Fetch Active Doctors
                const activeDoctorsQuery = query(
                    collectionGroup(db, 'users'),
                    where('role', '==', 'doctor'),
                    where('status', '==', 'active')
                );
                const activeDoctorsSnapshot = await getDocs(activeDoctorsQuery);
                let countActiveDoctors = 0;
                activeDoctorsSnapshot.docs.forEach(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                        countActiveDoctors++;
                    }
                });
                setActiveDoctorsCount(countActiveDoctors);

                // Fetch Total Patients
                const totalPatientsQuery = query(
                    collectionGroup(db, 'users'),
                    where('role', '==', 'patient')
                );
                const totalPatientsSnapshot = await getDocs(totalPatientsQuery);
                let countTotalPatients = 0;
                totalPatientsSnapshot.docs.forEach(docSnap => {
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                        countTotalPatients++;
                    }
                });
                setTotalPatientsCount(countTotalPatients);

            } catch (err: any) {
                console.error("Error fetching admin dashboard stats:", err);
                setErrorStats(err.message);
            } finally {
                setLoadingStats(false);
            }
        };

        if (user && db && appId && currentPage === 'dashboard') {
            fetchDashboardStats();
        }
    }, [user, db, appId, currentPage]);


    const renderAdminPage = () => {
        switch (currentPage) {
            case 'dashboard':
                if (loadingStats) return (
                    <div className="d-flex justify-content-center align-items-center min-vh-100">
                        <div className="text-center p-5">
                            <LoadingSpinner /><p className="mt-3 text-muted">Loading dashboard stats...</p>
                        </div>
                    </div>
                );
                if (errorStats) return <MessageDisplay message={{ text: errorStats, type: "error" }} />;

                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="h3 fw-bold text-primary mb-0">Admin Dashboard</h2>
                        </div>
                        <div className="text-center mb-4">
                            <img
                                src={user?.photoURL || "https://placehold.co/100x100/dc3545/ffffff?text=A"}
                                onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/dc3545/ffffff?text=A"; }}
                                alt="Profile"
                                className="rounded-circle mb-3"
                                style={{ width: '100px', height: '100px', objectFit: 'cover', border: '3px solid #dc3545' }}
                            />
                            <h4 className="fw-bold text-dark">{user?.profile?.full_name || user?.email || 'Admin'}</h4>
                            <p className="text-muted mb-1">Role: {user?.profile?.role}</p>
                            <p className="small text-break text-muted">User ID: <span className="font-monospace">{user?.uid}</span></p>
                        </div>

                        <div className="row g-4 mb-4">
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Management Tools</h5>
                                        <div className="d-grid gap-2 mt-3">
                                            <button className="btn btn-primary" onClick={() => navigate('userManagement')}>User Management</button>
                                            <button className="btn btn-outline-primary" onClick={() => navigate('serviceManagement')}>Service Management</button>
                                            <button className="btn btn-outline-info" onClick={() => navigate('offerManagement')}>Offer Management</button>
                                            <button className="btn btn-outline-secondary" onClick={() => navigate('appointmentOversight')}>Appointment Oversight</button>
                                            <button className="btn btn-outline-success" onClick={() => navigate('adminPatientOversight')}>Patient Health Oversight</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Quick Stats</h5>
                                        <ul className="list-group list-group-flush">
                                            <li className="list-group-item">Pending Appointments: <strong>{pendingAppointmentsCount}</strong></li>
                                            <li className="list-group-item">Active Doctors: <strong>{activeDoctorsCount}</strong></li>
                                            <li className="list-group-item">Total Patients: <strong>{totalPatientsCount}</strong></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'userManagement':
                return <UserManagementPage navigate={navigate} />;
            case 'serviceManagement':
                return <ServiceManagementPage navigate={navigate} />;
            case 'offerManagement':
                return <OfferManagementPage navigate={navigate} />;
            case 'appointmentOversight':
                return <AppointmentOversightPage navigate={navigate} />;
            case 'adminPatientOversight':
                return <AdminPatientOversightPage navigate={navigate} />;
            case 'adminPatientHealthDataView':
                return <AdminPatientHealthDataViewPage navigate={navigate} patientId={pageData.patientId} patientName={pageData.patientName} />;
            case 'prescriptionViewer':
                return <PrescriptionViewerPage navigate={navigate} patientId={pageData.patientId} prescriptionId={pageData.prescriptionId} />;
            case 'teleconsultationCall': // NEW CASE for Admin to view/test call link
                return <TeleconsultationCallPage navigate={navigate} meetingLink={pageData.meetingLink} />;
            default:
                return <MessageDisplay message={{ text: "Page not found.", type: "error" }} />;
        }
    };

    return (
        <div className="container py-4">
            {renderAdminPage()}
        </div>
    );
};
