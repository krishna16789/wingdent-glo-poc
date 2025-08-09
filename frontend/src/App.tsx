import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import AuthForm from './AuthForm'; // Import the AuthForm component
import { PatientDashboard } from './PatientComponents';
import { DoctorDashboard } from './DoctorComponents';
import { AdminDashboard } from './AdminComponents';
import { SuperAdminDashboard } from './SuperAdminComponents'; // Import SuperAdminDashboard
import { LoadingSpinner, MessageDisplay } from './CommonComponents';
import { AIAnalyzerPage } from './AIAnalyzerPage'; // Import the new AIAnalyzerPage

const App: React.FC = () => {
    const { user, loading, message, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState<string | number>('dashboard'); // Default page
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
    const [pageData, setPageData] = useState<any>(null); // State to pass data to pages
    const [isProfileNavOpen, setIsProfileNavOpen] = useState(false);
    const [showSplash, setShowSplash] = useState(true); // New state for the splash screen
    const profileNavRef = useRef<HTMLDivElement>(null);

    // This useEffect hook manages the splash screen's duration.
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2500); // Display splash screen for 2.5 seconds

        // Cleanup the timer to prevent memory leaks if the component unmounts early.
        return () => clearTimeout(timer);
    }, []);

    // This useEffect hook handles clicks outside the profile navigation drawer to close it.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileNavRef.current && !profileNavRef.current.contains(event.target as Node)) {
                setIsProfileNavOpen(false);
            }
        };

        if (isProfileNavOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileNavOpen]);

    // Function to navigate between pages within the dashboard
    const navigate = (page: string | number, data?: any) => {
        setCurrentPage(page);
        setPageData(data);
    };

    const toggleProfileNav = () => {
        setIsProfileNavOpen(prev => !prev);
    };

    // Determine the user's role and render the appropriate dashboard
    const renderDashboard = () => {
        if (!user || !user.profile) {
            return <MessageDisplay message={{ text: "User profile not loaded.", type: "error" }} />;
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
                        return <MessageDisplay message={{ text: "Unknown user role.", type: "error" }} />;
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
            case 'teleconsultationCall':
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
            case 'teleconsultationCall':
            case 'addConsultation':
                return <DoctorDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            // Specific pages for Admin role
            case 'userManagement':
            case 'serviceManagement':
            case 'offerManagement':
            case 'adminPatientOversight':
            case 'adminPatientHealthDataView':
            case 'teleconsultationCall':
            case 'appointmentOversight':
                return <AdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            // Specific pages for SuperAdmin role
            case 'financialOversight':
            case 'feeConfiguration':
                return <SuperAdminDashboard navigate={navigate} currentPage={currentPage} pageData={pageData} />;
            case 'aiAnalyzerPage': // NEW: Route for AI Analyzer
                return <AIAnalyzerPage navigate={navigate} />;
            default:
                return <MessageDisplay message={{ text: "Page not found or invalid route.", type: "error" }} />;
        }
    };

    // --- NEW Splash Screen Rendering Logic ---
    if (showSplash) {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center min-vh-100 bg-white text-center">
                <img src="wingdent-glo.png" alt="Wingdent-Glo Logo" className="rounded-circle mb-3 animate-pulse" style={{ width: '100px', height: '100px' }} />
                <h2 className="fw-bold text-primary">Wingdent-Glo</h2>
                <p className="text-secondary mt-2">India's first AI powered Dental Platform Connecting Patients and Doctors</p>
            </div>
        );
    }
    // --- END NEW Splash Screen Rendering Logic ---


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
        <div className="min-vh-100 d-flex flex-column">
            {/* Modern Header */}
            <header className="d-flex align-items-center justify-content-between p-3 bg-white shadow-sm sticky-top d-flex d-lg-none">
                <div className="d-flex align-items-center">
                    <img src="wingdent-glo.png" alt="Wingdent-Glo Logo" className="rounded me-2" style={{ width: '40px', height: '40px' }} />
                    <h5 className="mb-0 fw-bold text-primary">Wingdent-Glo</h5>
                </div>
                <div className="d-flex align-items-center">
                    <button className="btn btn-link position-relative me-3 text-dark" onClick={() => navigate('notifications')}>
                        <i className="fas fa-bell fa-lg"></i>
                        {unreadNotificationsCount > 0 && (
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                {unreadNotificationsCount}
                                <span className="visually-hidden">unread messages</span>
                            </span>
                        )}
                    </button>
                    <button className="btn btn-link text-dark" onClick={toggleProfileNav}>
                        <i className="fas fa-user-circle fa-lg"></i>
                    </button>
                </div>
            </header>

            {/* Profile Navigation Drawer */}
            {isProfileNavOpen? <div ref={profileNavRef} className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isProfileNavOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 border-b d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="font-bold mb-0">{user?.profile?.full_name || user?.email || 'User'}</h5>
                        <p className="text-sm text-gray-500 mb-0">{user?.profile?.role || 'N/A'}</p>
                    </div>
                    <button className="btn btn-sm btn-link text-dark" onClick={toggleProfileNav}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <ul className="p-2 list-unstyled">
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-gray-100 d-flex align-items-center" onClick={() => { navigate('myBookings'); toggleProfileNav(); }}>
                            <i className="fas fa-calendar-alt me-2 text-primary"></i>My Bookings
                        </button>
                    </li>
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-gray-100 d-flex align-items-center" onClick={() => { navigate('myPrescriptions'); toggleProfileNav(); }}>
                            <i className="fas fa-file-medical me-2 text-primary"></i>My Prescriptions
                        </button>
                    </li>
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-gray-100 d-flex align-items-center" onClick={() => { navigate('myHealthRecords'); toggleProfileNav(); }}>
                            <i className="fas fa-book-medical me-2 text-primary"></i>My Health Records
                        </button>
                    </li>
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-gray-100 d-flex align-items-center" onClick={() => { navigate('myConsultations'); toggleProfileNav(); }}>
                            <i className="fas fa-notes-medical me-2 text-primary"></i>My Consultations
                        </button>
                    </li>
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-gray-100 d-flex align-items-center" onClick={() => { navigate('myAddresses'); toggleProfileNav(); }}>
                            <i className="fas fa-map-marker-alt me-2 text-primary"></i>My Addresses
                        </button>
                    </li>
                    <li className="my-2">
                        <button className="w-full text-left p-2 rounded hover:bg-red-100 text-red-600 d-flex align-items-center" onClick={() => { logout(); toggleProfileNav(); }}>
                            <i className="fas fa-sign-out-alt fa-fw me-2"></i> Logout
                        </button>
                    </li>
                </ul>
            </div>: null}
            {isProfileNavOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleProfileNav}></div>}

            {/* Desktop Navbar (Hidden on mobile) */}
            <nav className="d-none d-lg-block navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
                <div className="container-fluid">
                    <a className="navbar-brand d-flex align-items-center" href="#" onClick={() => navigate('dashboard')}>
                        <img alt="wingdent-glo logo" src="wingdent-glo.png" style={{ backgroundColor: "white", width: "40px", height: "40px" }} />
                        <span className="h4 mb-0 text-white ms-2">Wingdent-Glo</span>
                    </a>
                    <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
                        <li className="nav-item">
                            <span className="navbar-text me-lg-3 text-white">{user?.email} ({user?.profile?.role || 'N/A'})</span>
                        </li>
                        <li className="nav-item">
                            <button onClick={() => navigate('aiAnalyzerPage')} className="btn btn-outline-info w-100 w-lg-auto me-lg-2 mt-2 mt-lg-0">
                                AI Analyzer
                            </button>
                        </li>
                        <li className="nav-item">
                            <button onClick={logout} className="btn btn-outline-light w-100 w-lg-auto mt-2 mt-lg-0">
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="container flex-grow-1 py-4">
                <MessageDisplay message={message} />
                {renderDashboard()}
                <div className='d-flex justify-content-center'>&copy; Wingdent Pvt Ltd</div>
            </main>

            {/* Bottom Navigation Bar (Hidden on desktop) */}
            <nav className="d-lg-none bg-white shadow-lg fixed-bottom border-top">
                <div className="d-flex justify-content-around align-items-center">
                    <button className={`btn flex-fill py-3 rounded-0 ${currentPage === 'dashboard' ? 'text-primary' : 'text-muted'}`} onClick={() => navigate('dashboard')}>
                        <i className="fas fa-home d-block mx-auto mb-1" />
                        <small>Home</small>
                    </button>
                    <button className={`btn flex-fill py-3 rounded-0 ${currentPage === 'myBookings' ? 'text-primary' : 'text-muted'}`} onClick={() => navigate('myBookings')}>
                        <i className="fas fa-calendar-alt d-block mx-auto mb-1" />
                        <small>Bookings</small>
                    </button>
                    <button className={`btn flex-fill py-3 rounded-0 ${currentPage === 'aiAnalyzerPage' ? 'text-primary' : 'text-muted'}`} onClick={() => navigate('aiAnalyzerPage')}>
                        <i className="fas fa-microchip d-block mx-auto mb-1" />
                        <small>AI</small>
                    </button>
                    <button className={`btn flex-fill py-3 rounded-0 ${currentPage === 'helpFAQ' ? 'text-primary' : 'text-muted'}`} onClick={() => navigate('helpFAQ')}>
                        <i className="fas fa-question-circle d-block mx-auto mb-1" />
                        <small>Help</small>
                    </button>
                    <button className={`btn flex-fill py-3 rounded-0 text-primary`} onClick={logout}>
                        <i className="fas fa-arrow-right-from-bracket d-block mx-auto mb-1" />
                        <small>Logout</small>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default App;
