// frontend/src/AuthForm.tsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';

// Inline SVG for a simple dental logo
export const DentalLogo: React.FC = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 1024 1024">
            <path transform="scale(2 2)" d="M126.568 149.338C108.45 152.081 123.248 122.576 96.3182 117C93.2957 116.374 89.7105 116.747 86.9142 115.166C83.0412 113.057 81.3176 107.162 83.7616 103.381C88.2953 96.3663 110.637 101.38 115.281 79.9748C116.524 74.2449 115.481 68.6157 122.88 67.2993C133.549 65.0459 132.956 73.0698 134.225 79.9166C138.415 102.54 162.569 95.6736 165.819 104.339C170.906 117.902 154.305 115.403 148.26 117.914C128.156 125.714 137.51 145.465 126.568 149.338ZM124.067 100.137C121.534 104.46 121.134 104.878 116.948 107.555C122.657 110.817 123.025 114.195 123.882 114.705L124.067 114.633C126.527 110.53 127.582 109.808 131.811 107.555C126.53 104.581 127.346 104.647 124.067 100.137Z"/>
            <path transform="scale(2 2)" d="M389.115 150.46C371.35 152.621 387.665 124.935 358.417 116.836C353.06 115.352 340.968 115.584 345.186 104.684C348.57 95.9377 373.145 103.185 377.699 79.8003C378.91 73.5821 378.252 69.7971 385.104 67.2993C403.899 65.618 389.971 92.8582 416.311 98.823C421.349 99.9638 434.663 100.282 428.862 111.252C425.437 117.728 419.425 115.257 413.722 117.389C390.094 126.224 401.473 146.451 389.115 150.46ZM387.573 99.4932C382.923 104.948 386.141 102.139 379.826 107.555C386.538 113.012 383.559 111.365 387.573 116.57C388.966 114.873 389.335 113.397 390.009 111.348C391.642 110.113 393.521 108.8 395.092 107.555C391.491 105.14 387.966 99.6265 387.573 99.4932Z"/>
            <path transform="scale(2 2)" d="M150.578 200.432C163.183 176.636 177.743 162.683 206.592 159.775C221.359 158.591 234.899 162.561 248.138 168.625C256.954 172.663 264.214 168.726 272.288 165.252C306.587 150.495 345.72 165.581 360.419 200.432C370.143 195.969 426.53 170.741 435.715 170.305C448.04 169.72 458.439 180.817 458.002 193.004C457.502 211.519 449.997 229.435 435.438 241.186C433.394 242.836 430.968 244.58 429.167 246.428L428.93 246.673C428.396 250.376 427.776 255.229 426.869 258.792C421.43 280.146 402.344 299.298 379.968 301.947C375.927 302.425 369.605 302.244 365.435 302.243L345.908 302.228C341.243 321.545 335.236 338.187 332.967 358.706C331.309 374.777 331.838 390.937 331.719 407.064C331.518 434.081 303.756 440.652 292.634 422.775C288.749 416.53 281.9 394.09 279.567 386.338C277.017 378.557 274.04 370.975 271.881 363.094C267.978 348.471 250.577 345.007 242.806 355.952C240.216 359.6 239.039 366.026 237.603 370.416L226.242 404.515C224.478 409.656 222.948 415.472 220.384 420.462C211.203 438.327 185.523 435.721 179.866 416.632C178.501 412.026 179.372 402.875 179.251 397.772C178.443 363.62 179.149 342.14 165.666 308.479C164.867 306.484 163.684 304.237 163.098 302.228C142.772 302.261 126.646 304.123 108.992 291.897C89.7336 278.559 85.75 265.626 81.5895 244.627C68.2561 234.575 59.2223 223.199 55.5868 206.276C53.4655 196.402 52.1829 185.093 59.8047 177.152C66.7209 169.951 75.5811 168.59 84.7484 172.197C104.895 180.126 131.485 190.912 150.578 200.432ZM207.445 176.766C204.246 177.23 201.873 177.714 198.807 178.734C197.507 194.856 202.087 194.663 216.331 195.996C226.686 196.897 235.629 203.575 245.512 206.086C273.632 213.23 288.076 187.446 310.109 197.666C348.393 215.422 323.349 253.797 310.762 279.674C306.771 287.879 299.243 298.465 314.084 301.421C323.082 300.063 328.049 287.267 331.843 279.576C341.247 260.515 351.756 243.319 348.519 221.028C344.629 194.232 319.825 173.582 292.5 177.464C279.856 179.458 270.687 187.913 257.126 188.223C239.954 188.616 227.346 174.715 207.445 176.766ZM72.7828 188.019C70.4225 191.96 71.9731 200.083 72.997 204.343C76.5116 218.862 88.6669 232.916 103.7 235.858C110.5 237.223 121.465 233.388 124.039 242.46C127.985 256.369 107.519 252.783 100.629 253.224C104.774 266.1 111.411 273.947 123.401 280.551C125.21 281.547 130.603 283.348 131.811 284.255C138.618 284.464 149.379 284.301 155.732 284.941C149.142 261.29 142.623 243.157 146.527 217.238C130.164 211.541 83.0624 187.208 72.7828 188.019ZM435.7 188.019C432.6 188.969 428.11 191.195 424.946 192.511L378.615 211.886C374.456 213.593 369.936 215.275 365.916 217.238C367.696 234.295 365.224 249.563 359.479 265.837C357.209 272.267 354.419 278.398 352.583 284.941L370.108 284.95C373.089 284.958 376.94 285.085 379.826 284.941L380.149 284.76C394.784 276.651 405.045 274.211 409.731 254.196L409.238 254.145C405.989 253.822 401.867 254.273 398.588 254.396C390.286 254.708 385.338 245.378 390.511 239.104C396.94 231.304 421.262 243.46 436.366 212.017C438.229 208.045 445.495 186.812 435.7 188.019Z"/>
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
                    <img alt="wingdent-glo logo" src="wingdent-glo.png" width={1024} height={1024}/>
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
