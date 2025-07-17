// frontend/src/SuperAdminComponents.tsx
import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, collectionGroup, Timestamp, setDoc } from 'firebase/firestore'; // Import Timestamp
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay, CustomModal } from './CommonComponents';
import { Service, Offer, Appointment, Payment, FeeConfiguration, UserProfile } from './types'; // Import necessary types
import { ServiceManagementPage, OfferManagementPage, AppointmentOversightPage } from './AdminComponents';
import { DashboardProps } from './PatientComponents'; // Import DashboardProps for consistency

// Superadmin User Management Page (more privileges than Admin's UserManagement)
export const SuperAdminUserManagementPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId } = useAuth();
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) { // Ensure db and appId are available
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
            average_rating: userToEdit.average_rating, // Include for display
            total_reviews: userToEdit.total_reviews,   // Include for display
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
            setError("Missing user ID or Firebase not initialized.");
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
            alert('User profile updated successfully!');
            fetchUsers(); // Refresh the list
        } catch (err: any) {
            console.error("Error saving user:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!showDeleteUserModal?.id || !db || !appId || !user?.uid) {
            setError("Missing user ID or Firebase not initialized.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${showDeleteUserModal.id}/users`, showDeleteUserModal.id);
            await deleteDoc(userDocRef); // Delete the profile document

            setShowDeleteUserModal(null);
            alert('User deleted successfully!');
            fetchUsers();
        } catch (err: any) {
            console.error("Error deleting user:", err);
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
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'superadmin') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Superadmin User Management</h2>
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
                        <option value="superadmin">Superadmin</option>
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
                                    <th>Rating</th> {/* Added Rating Column */}
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
                                            {u.role === 'doctor' ? (
                                                <span>{u.average_rating?.toFixed(1) || 'N/A'} ({u.total_reviews || 0} reviews)</span>
                                            ) : 'N/A'}
                                        </td> {/* Display Rating */}
                                        <td>
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditClick(u)}>Edit</button>
                                            {u.id !== user.uid && ( // Superadmin cannot delete themselves
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
                            <select className="form-select" id="editRole" name="role" value={editFormData.role || ''} onChange={handleEditFormChange} disabled={showEditUserModal.id === user.uid}>
                                <option value="patient">Patient</option>
                                <option value="doctor">Doctor</option>
                                <option value="admin">Admin</option>
                                <option value="superadmin">Superadmin</option>
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
                                <div className="mb-3">
                                    <label htmlFor="editAverageRating" className="form-label">Average Rating:</label>
                                    <input type="number" className="form-control" id="editAverageRating" name="average_rating" value={editFormData.average_rating?.toFixed(1) || 'N/A'} disabled />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="editTotalReviews" className="form-label">Total Reviews:</label>
                                    <input type="number" className="form-control" id="editTotalReviews" name="total_reviews" value={editFormData.total_reviews || 0} disabled />
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

// Superadmin Financial Oversight Page
export const FinancialOversightPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId } = useAuth();
    const [totalRevenue, setTotalRevenue] = useState<number>(0);
    const [platformFees, setPlatformFees] = useState<number>(0);
    const [adminFees, setAdminFees] = useState<number>(0);
    const [doctorPayouts, setDoctorPayouts] = useState<number>(0);
    const [paymentTransactions, setPaymentTransactions] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFinancialData = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            let revenue = 0;
            let platform = 0;
            let admin = 0;
            let doctor = 0;
            const transactions: Payment[] = [];

            // Query all 'payments' subcollections
            const paymentsSnapshot = await getDocs(query(collectionGroup(db, 'payments'), where('status', '==', 'successful'))); // Corrected: Use getDocs()

            for (const docSnap of paymentsSnapshot.docs) {
                const pathSegments = docSnap.ref.path.split('/');
                if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                    const paymentData = docSnap.data() as Payment;
                    revenue += paymentData.amount || 0;
                    platform += paymentData.platform_fee_amount || 0;
                    admin += paymentData.admin_fee_amount || 0;
                    doctor += paymentData.doctor_fee_amount || 0;
                    transactions.push({ ...paymentData, id: docSnap.id });
                }
            }

            setTotalRevenue(revenue);
            setPlatformFees(platform);
            setAdminFees(admin);
            setDoctorPayouts(doctor);
            setPaymentTransactions(transactions);

        } catch (err: any) {
            console.error("Error fetching financial data:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) { // Ensure db and appId are available
            fetchFinancialData();
        }
    }, [user, db, appId]);

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading financial data...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'superadmin') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Financial Oversight</h2>
                <MessageDisplay message={message} />

                <div className="row text-center mb-5">
                    <div className="col-md-3">
                        <div className="p-3 border rounded-3 shadow-sm bg-light">
                            <p className="text-muted mb-1">Total Revenue</p>
                            <h4 className="fw-bold text-success">₹{totalRevenue.toFixed(2)}</h4>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="p-3 border rounded-3 shadow-sm bg-light">
                            <p className="text-muted mb-1">Platform Fees</p>
                            <h4 className="fw-bold text-info">₹{platformFees.toFixed(2)}</h4>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="p-3 border rounded-3 shadow-sm bg-light">
                            <p className="text-muted mb-1">Admin Fees</p>
                            <h4 className="fw-bold text-warning">₹{adminFees.toFixed(2)}</h4>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="p-3 border rounded-3 shadow-sm bg-light">
                            <p className="text-muted mb-1">Doctor Payouts</p>
                            <h4 className="fw-bold text-danger">₹{doctorPayouts.toFixed(2)}</h4>
                        </div>
                    </div>
                </div>

                <h4 className="h5 fw-bold mb-3">All Successful Transactions</h4>
                {paymentTransactions.length === 0 ? (
                    <p className="text-muted text-center">No successful transactions recorded yet.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Transaction ID</th>
                                    <th>Appointment ID</th>
                                    <th>Patient ID</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentTransactions.map(payment => (
                                    <tr key={payment.id}>
                                        <td>{payment.payment_gateway_transaction_id}</td>
                                        <td>{payment.appointment_id}</td>
                                        <td>{payment.patient_id}</td>
                                        <td>₹{payment.amount.toFixed(2)}</td>
                                        <td>{payment.payment_method}</td>
                                        <td>{(payment.transaction_date instanceof Timestamp) ? payment.transaction_date.toDate().toLocaleDateString() : 'N/A'}</td>
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

// Superadmin Fee Configuration Page
export const FeeConfigurationPage: React.FC<{ navigate: (page: string, data?: any) => void }> = ({ navigate }) => {
    const { user, message, db, appId } = useAuth();
    const [feeConfig, setFeeConfig] = useState<FeeConfiguration | null>(null); // Ideally, a dedicated interface for FeeConfig
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        platform_fee_percentage: 0,
        doctor_share_percentage: 0,
        admin_fee_percentage: 0,
    });

    const feeConfigDocId = 'current_config'; // A fixed ID for the single fee configuration document

    const fetchFeeConfig = async () => {
        setLoading(true);
        setError(null);
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            setLoading(false);
            return;
        }
        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/fee_configurations`, feeConfigDocId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as FeeConfiguration;
                setFeeConfig(data);
                setFormData({
                    platform_fee_percentage: data.platform_fee_percentage * 100,
                    doctor_share_percentage: data.doctor_share_percentage * 100,
                    admin_fee_percentage: data.admin_fee_percentage * 100,
                });
            } else {
                // Set default if no config exists
                setFeeConfig(null);
                setFormData({
                    platform_fee_percentage: 15,
                    doctor_share_percentage: 70,
                    admin_fee_percentage: 15,
                });
            }
        } catch (err: any) {
            console.error("Error fetching fee configuration:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && db && appId) { // Ensure db and appId are available
            fetchFeeConfig();
        }
    }, [user, db, appId]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    const handleSaveFeeConfig = async () => {
        if (!db || !appId || !user?.uid) {
            setError("Firestore not initialized or user not logged in.");
            return;
        }
        setLoading(true);
        setError(null);

        const totalPercentage = formData.platform_fee_percentage + formData.doctor_share_percentage + formData.admin_fee_percentage;
        if (Math.abs(totalPercentage - 100) > 0.01) { // Allow for minor floating point inaccuracies
            setError("Total percentages must add up to 100%.");
            setLoading(false);
            return;
        }

        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/fee_configurations`, feeConfigDocId);
            await setDoc(docRef, {
                id: feeConfigDocId,
                platform_fee_percentage: formData.platform_fee_percentage / 100,
                doctor_share_percentage: formData.doctor_share_percentage / 100,
                admin_fee_percentage: formData.admin_fee_percentage / 100,
                effective_from: serverTimestamp(),
                created_by: user.uid,
                created_at: feeConfig?.created_at || serverTimestamp(), // Keep original creation time if updating
                updated_at: serverTimestamp(),
            }, { merge: true });
            alert('Fee configuration saved successfully!');
            fetchFeeConfig(); // Re-fetch to update state
        } catch (err: any) {
            console.error("Error saving fee configuration:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center min-vh-100">
            <div className="text-center p-5">
                <LoadingSpinner /><p className="mt-3 text-muted">Loading fee configuration...</p>
            </div>
        </div>
    );
    if (error) return <MessageDisplay message={{ text: error, type: "error" }} />;
    if (!user || user.profile?.role !== 'superadmin') {
        return <MessageDisplay message={{ text: "Access Denied. You must be a Superadmin to view this page.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">Fee Configuration</h2>
                <MessageDisplay message={message} />

                <form onSubmit={(e) => { e.preventDefault(); handleSaveFeeConfig(); }}>
                    <div className="mb-3">
                        <label htmlFor="platformFee" className="form-label">Platform Fee Percentage (%):</label>
                        <input
                            type="number"
                            className="form-control"
                            id="platformFee"
                            name="platform_fee_percentage"
                            value={formData.platform_fee_percentage}
                            onChange={handleFormChange}
                            min="0"
                            max="100"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="doctorShare" className="form-label">Doctor Share Percentage (%):</label>
                        <input
                            type="number"
                            className="form-control"
                            id="doctorShare"
                            name="doctor_share_percentage"
                            value={formData.doctor_share_percentage}
                            onChange={handleFormChange}
                            min="0"
                            max="100"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="adminFee" className="form-label">Admin Fee Percentage (%):</label>
                        <input
                            type="number"
                            className="form-control"
                            id="adminFee"
                            name="admin_fee_percentage"
                            value={formData.admin_fee_percentage}
                            onChange={handleFormChange}
                            min="0"
                            max="100"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="alert alert-info text-center">
                        Total: {(formData.platform_fee_percentage + formData.doctor_share_percentage + formData.admin_fee_percentage).toFixed(2)}%
                    </div>
                    <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                        {loading && <LoadingSpinner />}
                        Save Configuration
                    </button>
                </form>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};


// SuperAdminDashboard Component
export const SuperAdminDashboard: React.FC<DashboardProps> = ({ navigate, currentPage, pageData }) => {
    const { user, logout } = useAuth();
    // const [currentPage, setCurrentPage] = useState('dashboard'); // Removed local state, use props
    // const [pageData, setPageData] = useState<any>(null); // Removed local state, use props

    // const navigate = (page: string, data: any = null) => { // Removed local navigate, use props
    //     setCurrentPage(page);
    //     setPageData(data);
    // };

    const renderSuperAdminPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return (
                    <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="h3 fw-bold text-primary mb-0">Superadmin Dashboard</h2>
                        </div>
                        <div className="text-center mb-4">
                            <img
                                src={user?.photoURL || "https://placehold.co/100x100/000000/ffffff?text=SA"}
                                onError={(e: any) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/000000/ffffff?text=SA"; }}
                                alt="Profile"
                                className="rounded-circle mb-3"
                                style={{ width: '100px', height: '100px', objectFit: 'cover', border: '3px solid #000000' }}
                            />
                            <h4 className="fw-bold text-dark">{user?.profile?.full_name || user?.email || 'Superadmin'}</h4>
                            <p className="text-muted mb-1">Role: {user?.profile?.role}</p>
                            <p className="small text-break text-muted">User ID: <span className="font-monospace">{user?.uid}</span></p>
                        </div>

                        <div className="row g-4 mb-4">
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Superadmin Tools</h5>
                                        <div className="d-grid gap-2 mt-3">
                                            <button className="btn btn-primary" onClick={() => navigate('userManagement')}>User Management (All Roles)</button>
                                            <button className="btn btn-outline-primary" onClick={() => navigate('serviceManagement')}>Service Management</button>
                                            <button className="btn btn-outline-info" onClick={() => navigate('offerManagement')}>Offer Management</button>
                                            <button className="btn btn-outline-secondary" onClick={() => navigate('appointmentOversight')}>Appointment Oversight</button>
                                            <button className="btn btn-outline-success" onClick={() => navigate('financialOversight')}>Financial Oversight</button>
                                            <button className="btn btn-outline-warning" onClick={() => navigate('feeConfiguration')}>Fee Configuration</button>
                                            {/* <button className="btn btn-outline-dark" onClick={() => navigate('zoneManagement')}>Zone Management</button> */}
                                            {/* <button className="btn btn-outline-dark" onClick={() => navigate('systemSettings')}>System Settings</button> */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        <h5 className="card-title text-primary">Platform Overview</h5>
                                        <ul className="list-group list-group-flush">
                                            <li className="list-group-item">Total Users: <strong>{/* Fetch from Firestore */}</strong></li>
                                            <li className="list-group-item">Total Revenue (Last 30 days): <strong>₹{/* Fetch from Firestore */}</strong></li>
                                            <li className="list-group-item">Active Doctors: <strong>{/* Fetch from Firestore */}</strong></li>
                                            <li className="list-group-item">Pending Doctor Approvals: <strong>{/* Fetch from Firestore */}</strong></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'userManagement':
                return <SuperAdminUserManagementPage navigate={navigate} />;
            case 'serviceManagement':
                // Re-using Admin's ServiceManagement, as it's generic enough
                return <ServiceManagementPage navigate={navigate} />;
            case 'offerManagement':
                // Re-using Admin's OfferManagement
                return <OfferManagementPage navigate={navigate} />;
            case 'appointmentOversight':
                // Re-using Admin's AppointmentOversight
                return <AppointmentOversightPage navigate={navigate} />;
            case 'financialOversight':
                return <FinancialOversightPage navigate={navigate} />;
            case 'feeConfiguration':
                return <FeeConfigurationPage navigate={navigate} />;
            // case 'zoneManagement':
            //     return <ZoneManagementPage navigate={navigate} />; // To be implemented
            // case 'systemSettings':
            //     return <SystemSettingsPage navigate={navigate} />; // To be implemented
            default:
                return <MessageDisplay message={{ text: "Page not found.", type: "error" }} />;
        }
    };

    return (
        <div className="container py-4">
            {renderSuperAdminPage()}
        </div>
    );
};
