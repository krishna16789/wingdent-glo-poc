// frontend/src/AuthForm.tsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';

// Inline SVG for a simple dental logo
const DentalLogo: React.FC = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="d-block mx-auto mb-4"
        style={{ width: '6rem', height: '6rem', color: '#007bff' }} // Bootstrap primary color
    >
        <path
            fillRule="evenodd"
            d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.25c0 .138.112.25.25.25H12a.75.75 0 01.75.75v6.125a6.75 6.75 0 01-1.087.872.75.75 0 00-.233.513v2.813a.75.75 0 001.07.684l2.816-1.333c.252-.12.563-.12.815 0l2.816 1.333c.332.157.72-.036.72-.46V15.375a.75.75 0 00-.233-.513 6.75 6.75 0 01-1.087-.872V6.625a.75.75 0 01.75-.75h5.75a.25.25 0 00.25-.25V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM12 6.75a.75.75 0 01.75.75v.75a.75.75 0 01-1.5 0V7.5a.75.75 0 01.75-.75z"
            clipRule="evenodd"
        />
    </svg>
);

const AuthForm: React.FC = () => {
    const {
        signIn,
        signUp,
        signInWithGoogle,
        sendMagicLink,
        loading,
        message,
        authMode,
        setAuthMode,
        otpSent,
        email,
        setEmail,
        setOtpSent
    } = useAuth();

    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('patient'); // Default role for signup is 'patient'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [specialization, setSpecialization] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [bio, setBio] = useState('');


    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (authMode === 'signup') {
            const profileData = {
                full_name: fullName,
                role: role,
                status: role === 'doctor' ? 'pending_approval' : 'active', // Doctors need approval
                phone_number: phoneNumber,
                specialization: role === 'doctor' ? specialization : undefined,
                license_number: role === 'doctor' ? licenseNumber : undefined,
                years_of_experience: role === 'doctor' && yearsOfExperience ? parseInt(yearsOfExperience) : undefined,
                bio: role === 'doctor' ? bio : undefined,
                is_available_now: role === 'doctor' ? false : undefined,
                average_rating: role === 'doctor' ? 0 : undefined,
                total_reviews: role === 'doctor' ? 0 : undefined,
            };
            await signUp(email, password, fullName);
        } else if (authMode === 'login') {
            await signIn(email, password);
        } else if (authMode === 'otp') {
            await sendMagicLink(email);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        // Reset otpSent if user changes email after a link was sent
        if (otpSent) {
            setOtpSent(false);
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light p-3">
            <div className="card shadow-lg p-4 p-md-5 rounded-3" style={{ maxWidth: '450px', width: '100%' }}>
                <div className="text-center mb-4">
                    <DentalLogo />
                    <h1 className="h3 fw-bold text-dark mb-1">Wingdent-Glo</h1>
                    <p className="text-muted">Your Smile, Our Priority. Seamless Dental Care.</p>
                </div>

                <MessageDisplay message={message} />

                {loading && <LoadingSpinner />}

                {!loading && (
                    <form onSubmit={handleAuthSubmit} className="needs-validation" noValidate>
                        <div className="mb-3">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={handleEmailChange}
                                className="form-control"
                                placeholder="you@example.com"
                            />
                        </div>

                        {authMode !== 'otp' && (
                            <div className="mb-3">
                                <label htmlFor="password" className="form-label">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="form-control"
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        {authMode === 'signup' && (
                            <>
                                <div className="mb-3">
                                    <label htmlFor="fullName" className="form-label">Full Name</label>
                                    <input
                                        id="fullName"
                                        name="fullName"
                                        type="text"
                                        autoComplete="name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="form-control"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="phoneNumber" className="form-label">Phone Number</label>
                                    <input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="form-control"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="role" className="form-label">Register As</label>
                                    <select
                                        id="role"
                                        name="role"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="patient">Patient</option>
                                        <option value="doctor">Doctor</option>
                                    </select>
                                </div>

                                {role === 'doctor' && (
                                    <>
                                        <div className="mb-3">
                                            <label htmlFor="specialization" className="form-label">Specialization</label>
                                            <input
                                                id="specialization"
                                                name="specialization"
                                                type="text"
                                                value={specialization}
                                                onChange={(e) => setSpecialization(e.target.value)}
                                                className="form-control"
                                                placeholder="e.g., General Dentist"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="licenseNumber" className="form-label">License Number</label>
                                            <input
                                                id="licenseNumber"
                                                name="licenseNumber"
                                                type="text"
                                                value={licenseNumber}
                                                onChange={(e) => setLicenseNumber(e.target.value)}
                                                className="form-control"
                                                placeholder="Medical License ID"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="yearsOfExperience" className="form-label">Years of Experience</label>
                                            <input
                                                id="yearsOfExperience"
                                                name="yearsOfExperience"
                                                type="number"
                                                value={yearsOfExperience}
                                                onChange={(e) => setYearsOfExperience(e.target.value)}
                                                placeholder="e.g., 5"
                                                min="0"
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label htmlFor="bio" className="form-label">Bio (Optional)</label>
                                            <textarea
                                                id="bio"
                                                name="bio"
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                rows={3}
                                                placeholder="Tell us about yourself..."
                                                className="form-control"
                                            ></textarea>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        <div className="d-grid gap-2 mb-3">
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                disabled={loading}
                            >
                                {loading ? <LoadingSpinner /> : (
                                    authMode === 'login' ? 'Sign In' :
                                    authMode === 'signup' ? 'Sign Up' :
                                    (otpSent ? 'Resend Link' : 'Send Magic Link')
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {!loading && (
                    <div className="mt-4">
                        <div className="text-center my-3">
                            <span className="text-muted">Or continue with</span>
                        </div>

                        <div className="d-grid gap-2 mb-3">
                            <button
                                onClick={signInWithGoogle}
                                className="btn btn-outline-secondary btn-lg d-flex align-items-center justify-content-center"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" style={{ width: '1.2em', height: '1.2em', marginRight: '0.5em' }} />
                                Sign in with Google
                            </button>
                        </div>

                        <div className="text-center mt-3">
                            {authMode === 'login' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setAuthMode('signup')}
                                        className="btn btn-link p-0 align-baseline"
                                    >
                                        Sign Up
                                    </button>
                                    <br />
                                    <button
                                        type="button"
                                        onClick={() => setAuthMode('otp')}
                                        className="btn btn-link p-0 align-baseline mt-2"
                                    >
                                        Login with Magic Link
                                    </button>
                                </>
                            ) : authMode === 'signup' ? (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setAuthMode('login')}
                                        className="btn btn-link p-0 align-baseline"
                                    >
                                        Sign In
                                    </button>
                                </>
                            ) : ( // authMode === 'otp'
                                <>
                                    Remember your password?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setAuthMode('login'); setOtpSent(false); }}
                                        className="btn btn-link p-0 align-baseline"
                                    >
                                        Sign In
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthForm;
