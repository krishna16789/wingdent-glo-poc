// frontend/src/PrescriptionViewerPage.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore'; // ADDED getDocs import
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';
import { Prescription, UserProfile } from './types'; // Removed unused 'Service' import

// Define props for the PrescriptionViewerPage
interface PrescriptionViewerPageProps {
    navigate: (page: string | number, data?: any) => void; // MODIFIED: Added 'number' to page type
    patientId: string;
    prescriptionId: string;
}

export const PrescriptionViewerPage: React.FC<PrescriptionViewerPageProps> = ({ navigate, patientId, prescriptionId }) => {
    const { user, db, appId, setMessage } = useAuth();
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [patientProfile, setPatientProfile] = useState<UserProfile | null>(null);
    const [doctorProfile, setDoctorProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrescriptionData = async () => {
            setLoading(true);
            setError(null);

            if (!db || !appId || !patientId || !prescriptionId) {
                setError("Missing necessary IDs or Firestore not initialized.");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch the Prescription
                const prescriptionDocRef = doc(db, `artifacts/${appId}/users/${patientId}/prescriptions`, prescriptionId);
                const prescriptionSnap = await getDoc(prescriptionDocRef);

                if (!prescriptionSnap.exists()) {
                    setError("Prescription not found.");
                    setLoading(false);
                    return;
                }

                const fetchedPrescription = { id: prescriptionSnap.id, ...prescriptionSnap.data() } as Prescription;
                setPrescription(fetchedPrescription);

                // 2. Pre-fetch all users to find patient and doctor profiles efficiently
                const usersMap = new Map<string, UserProfile>();
                const allUsersSnapshot = await getDocs(collectionGroup(db, 'users'));
                allUsersSnapshot.docs.forEach(docSnap => {
                    const profileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    const pathSegments = docSnap.ref.path.split('/');
                    if (pathSegments[1] === appId) { // Ensure it belongs to this app's structure
                        usersMap.set(docSnap.id, profileData);
                    }
                });

                // 3. Get Patient Profile
                const patient = usersMap.get(fetchedPrescription.patient_id);
                if (patient) {
                    setPatientProfile(patient);
                } else {
                    console.warn("Patient profile not found for prescription:", fetchedPrescription.patient_id);
                }

                // 4. Get Doctor Profile
                if (fetchedPrescription.doctor_id) {
                    const doctor = usersMap.get(fetchedPrescription.doctor_id);
                    if (doctor) {
                        setDoctorProfile(doctor);
                    } else {
                        console.warn("Doctor profile not found for prescription:", fetchedPrescription.doctor_id);
                    }
                }

            } catch (err: any) {
                console.error("Error fetching prescription data:", err);
                setError(err.message);
                setMessage({ text: `Error loading prescription: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (user && db && appId) { // Ensure authentication and Firestore are ready
            fetchPrescriptionData();
        }
    }, [user, db, appId, patientId, prescriptionId]); // Re-run if these props change

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100">
                <div className="text-center p-5">
                    <LoadingSpinner /><p className="mt-3 text-muted">Loading prescription...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return <MessageDisplay message={{ text: error, type: "error" }} />;
    }

    if (!prescription) {
        return <MessageDisplay message={{ text: "Prescription data could not be loaded.", type: "info" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4 printable-area">
                <div className="text-center mb-5">
                    <h1 className="h2 fw-bold text-primary">Prescription</h1>
                    <p className="text-muted">Date: {prescription.prescribed_date}</p>
                </div>

                <div className="row mb-4 border-bottom pb-3">
                    <div className="col-md-6">
                        <h4 className="h5 fw-bold text-success">Patient Information</h4>
                        <p className="mb-1"><strong>Name:</strong> {patientProfile?.full_name || 'N/A'}</p>
                        <p className="mb-1"><strong>Email:</strong> {patientProfile?.email || 'N/A'}</p>
                        <p className="mb-1"><strong>Phone:</strong> {patientProfile?.phone_number || 'N/A'}</p>
                    </div>
                    <div className="col-md-6 text-md-end">
                        <h4 className="h5 fw-bold text-info">Prescribed By</h4>
                        <p className="mb-1"><strong>Doctor:</strong> {doctorProfile?.full_name || 'N/A'}</p>
                        <p className="mb-1"><strong>Specialization:</strong> {doctorProfile?.specialization || 'N/A'}</p>
                        <p className="mb-1"><strong>License No.:</strong> {doctorProfile?.license_number || 'N/A'}</p>
                        <p className="mb-1"><strong>Email:</strong> {doctorProfile?.email || 'N/A'}</p>
                    </div>
                </div>

                <div className="mb-5">
                    <h4 className="h5 fw-bold text-primary mb-3">Medications</h4>
                    {prescription.medications && prescription.medications.length > 0 ? (
                        <table className="table table-bordered table-striped">
                            <thead>
                                <tr>
                                    <th>Medication</th>
                                    <th>Dosage</th>
                                    <th>Frequency</th>
                                    <th>Instructions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prescription.medications.map((med, index) => (
                                    <tr key={index}>
                                        <td>{med.medication_name}</td>
                                        <td>{med.dosage}</td>
                                        <td>{med.frequency}</td>
                                        <td>{med.instructions}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-muted">No medications listed in this prescription.</p>
                    )}
                </div>

                <div className="mb-5">
                    <h4 className="h5 fw-bold text-primary mb-3">Additional Notes</h4>
                    <p className="text-muted">
                        Please follow the instructions carefully. If you experience any adverse reactions, contact your doctor immediately.
                        This prescription is valid until {prescription.expires_date || 'further notice'}.
                    </p>
                </div>

                <div className="text-center mt-5">
                    <p className="text-muted small">Generated by Wingdent-Glo on {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
            </div>

            <div className="d-flex justify-content-center mt-4 no-print">
                <button className="btn btn-primary me-3" onClick={handlePrint}>Print Prescription</button>
                <button className="btn btn-link" onClick={() => navigate("dashboard")}>Back</button> {/* Navigate back */}
            </div>

            {/* Basic CSS for printing - can be moved to a separate CSS file if preferred */}
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 20px;
                        box-shadow: none !important; /* Remove shadow for print */
                    }
                    .no-print {
                        display: none !important;
                    }
                    .card {
                        border: none !important;
                    }
                    .table-bordered th, .table-bordered td {
                        border: 1px solid #dee2e6 !important;
                    }
                }
                `}
            </style>
        </div>
    );
};
