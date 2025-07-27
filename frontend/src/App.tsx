import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import AuthForm, { DentalLogo } from './AuthForm'; // Import the AuthForm component
import { PatientDashboard } from './PatientComponents';
import { DoctorDashboard } from './DoctorComponents';
import { AdminDashboard } from './AdminComponents';
import { SuperAdminDashboard } from './SuperAdminComponents'; // Import SuperAdminDashboard
import { LoadingSpinner, MessageDisplay } from './CommonComponents';
import { AIAnalyzerPage } from './AIAnalyzerPage'; // Import the new AIAnalyzerPage

const App: React.FC = () => {
    const { user, loading, message, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState<string | number>('dashboard'); // Default page
    const [pageData, setPageData] = useState<any>(null); // State to pass data to pages

    // Function to navigate between pages within the dashboard
    const navigate = (page: string | number, data?: any) => {
        setCurrentPage(page);
        setPageData(data);
    };

    // Determine the user's role and render the appropriate dashboard
    const renderDashboard = () => {
        if (!user || !user.profile) {
            // This case should ideally be handled by AuthContext ensuring profile is loaded
            // or by redirecting to login if user is null.
            // If user exists but profile is momentarily null, a loading state might be better.
            return <MessageDisplay message={{text:"User profile not loaded.",type:"error"}} />;
        }

        switch (currentPage) {
            case 'dashboard': // This is the default dashboard view based on role
                switch (user.profile.role) {
                    case 'patient':
                        return <PatientDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
                    case 'doctor':
                        return <DoctorDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
                    case 'admin':
                        return <AdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
                    case 'superadmin':
                        return <SuperAdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
                    default:
                        return <MessageDisplay message={{text:"Unknown user role." ,type:"error"}} />;
                }
            // Specific pages for Patient role
            case 'bookService':
            case 'myBookings':
            case 'myAddresses':
            case 'appointmentStatus':
            case 'myPrescriptions':
            case 'myHealthRecords':
            case 'myConsultations':
            case 'prescriptionViewer':
            case 'payment':
            case 'feedback':
            case 'helpFAQ':
                return <PatientDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            // Specific pages for Doctor role
            case 'myAppointments':
            case 'pendingAppointments':
            case 'manageAvailability':
            case 'doctorProfile':
            case 'patientFeedback':
            case 'doctorReports':
            case 'appointmentDetails':
            case 'patientHealthDataView':    
            case 'managePatientRecords':
            case 'addPrescription':
            case 'addHealthRecord':
            case 'addConsultation':
                return <DoctorDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            // Specific pages for Admin role
            case 'userManagement':
            case 'serviceManagement':
            case 'offerManagement':
            case 'adminPatientOversight':
            case 'adminPatientHealthDataView':
            case 'appointmentOversight':
                return <AdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            // Specific pages for SuperAdmin role
            case 'financialOversight':
            case 'feeConfiguration':
                return <SuperAdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            case 'aiAnalyzerPage': // NEW: Route for AI Analyzer
                return <AIAnalyzerPage navigate={navigate} />;
            default:
                return <MessageDisplay message={{text:"Page not found or invalid route.",type:"error"}} />;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <LoadingSpinner />
            </div>
        );
    }

    // If user is not logged in, show the AuthForm
    if (!user) {
        return <AuthForm />;
    }

    // If user is logged in, show the main application layout
    return (
        <div className="min-vh-100 bg-light d-flex flex-column">
            {/* Navbar */}
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div className="container-fluid">
                    {/* Brand and Toggler for Mobile */}
                    <div className="d-flex w-100 justify-content-between justify-content-lg-start align-items-center">
                        <a className="navbar-brand d-flex align-items-center" href="#" onClick={() => navigate('dashboard')}> {/* mx-auto for centering on mobile, mx-lg-0 for left align on large */}
                            <div className="me-2" style={{backgroundColor:"white", width: "40px", height:"40px"}}>
                            <img alt="wingdent-glo logo" src="wingdent-glo.png" width={1024} height={1024}/></div> {/* Smaller logo for navbar */}
                            <span className="h4 mb-0 text-white">Wingdent-Glo</span> {/* h4 for slightly smaller text */}
                        </a>
                        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                            <span className="navbar-toggler-icon"></span>
                        </button>
                    </div>

                    {/* Collapsible content for navigation items */}
                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
                            <li className="nav-item">
                                <span className="navbar-text me-lg-3 text-white">
                                    {user.email} ({user.profile?.role || 'N/A'})
                                </span>
                            </li>
                            {user.profile?.id && (
                                <li className="nav-item">
                                    <span className="navbar-text me-lg-3 text-white-50 small">
                                        User ID: {user.profile.id}
                                    </span>
                                </li>
                            )}
                            <li className="nav-item">
                                <button
                                    onClick={() => navigate('aiAnalyzerPage')}
                                    className="btn btn-outline-info w-100 w-lg-auto me-lg-2 mt-2 mt-lg-0"
                                >
                                    AI Analyzer
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    onClick={logout}
                                    className="btn btn-outline-light w-100 w-lg-auto mt-2 mt-lg-0"
                                >
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="container flex-grow-1 py-4">
                <MessageDisplay message={message} />
                {renderDashboard()}
            </main>
        </div>
    );
};

export default App;
