// frontend/src/TeleconsultationCallPage.tsx
import React, { useEffect } from 'react';
import { MessageDisplay } from './CommonComponents'; // Assuming CommonComponents has MessageDisplay

// Define props for the TeleconsultationCallPage
interface TeleconsultationCallPageProps {
    navigate: (page: string | number, data?: any) => void;
    meetingLink: string;
}

export const TeleconsultationCallPage: React.FC<TeleconsultationCallPageProps> = ({ navigate, meetingLink }) => {
    useEffect(() => {
        // If no meeting link is provided, navigate back or show an error
        if (!meetingLink) {
            // Using -1 to go back in history, or you could navigate to a specific error page/dashboard
            navigate("dashboard");
        }
    }, [meetingLink, navigate]);

    if (!meetingLink) {
        return <MessageDisplay message={{ text: "No meeting link provided for teleconsultation.", type: "error" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4 text-center">
                <h2 className="h3 fw-bold text-primary mb-4">Your Teleconsultation Call</h2>
                <p className="lead">You are about to join your video consultation.</p>
                <p className="text-muted">Please ensure your microphone and camera are enabled.</p>

                <div className="my-4">
                    <a
                        href={meetingLink}
                        target="_blank" // Open in a new tab
                        rel="noopener noreferrer" // Security best practice for target="_blank"
                        className="btn btn-success btn-lg"
                        onClick={() => {
                            console.log("User clicked to join Jitsi call:", meetingLink);
                            // Optionally, you might want to track this event or update a status
                        }}
                    >
                        Join Call Now
                    </a>
                </div>

                <p className="text-muted small">
                    If the call doesn't open automatically, click the button above.
                    This will open the video call in a new browser tab.
                </p>
            </div>
            <div className="d-flex justify-content-center mt-4">
                {/* Button to go back to previous page, e.g., My Bookings */}
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};
