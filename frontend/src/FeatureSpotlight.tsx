import React, { useState, useEffect, useRef } from 'react';

// This component displays a manually-controlled carousel of features using Bootstrap styling.
const features = [
    {
        title: "Start-up India Recognised",
        description: "India's first dental startup for home services and first application to introduce AI in dental analysis",
        icon: "fas fa-trophy"
    },
    {
        title: "Easy Appointment Booking At Home",
        description: "Schedule your next home dental visit with just a few taps. Find the right time and doctor for you.",
        icon: "fas fa-calendar-check"
    },
    {
        title: "Secure Health Records",
        description: "Your health data is safe with us. Access your prescriptions and records anytime, anywhere.",
        icon: "fas fa-shield-alt"
    },
    {
        title: "Teleconsultation",
        description: "Consult with a doctor remotely through a secure, private video call.",
        icon: "fas fa-video"
    },
    {
        title: "AI-Powered Analyzer",
        description: "Get smart insights and analysis on your oral hygeine instantaneously by adding a pic",
        icon: "fas fa-brain"
    },
    {
        title: "Centralized Management",
        description: "Keep track of all your appointments, payments, and feedback in one convenient place.",
        icon: "fas fa-tasks"
    }
];

export const FeatureSpotlight: React.FC = () => {
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // This effect handles the automatic advancement of the features.
    useEffect(() => {
        // Start the timer to advance to the next feature every 5 seconds.
        timerRef.current = setInterval(() => {
            setCurrentFeatureIndex(prevIndex => (prevIndex + 1) % features.length);
        }, 5000); // Change feature every 5 seconds

        // Cleanup function to clear the timer when the component unmounts
        // or when the dependencies change, preventing memory leaks.
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

    // Function to handle manual navigation (resets the timer)
    const handleManualNavigation = (newIndex: number) => {
        // Clear the existing timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        // Set the new index
        setCurrentFeatureIndex(newIndex);
        // Restart the timer
        timerRef.current = setInterval(() => {
            setCurrentFeatureIndex(prevIndex => (prevIndex + 1) % features.length);
        }, 5000);
    };

    const goToPrevious = () => {
        handleManualNavigation((currentFeatureIndex - 1 + features.length) % features.length);
    };

    const goToNext = () => {
        handleManualNavigation((currentFeatureIndex + 1) % features.length);
    };

    const currentFeature = features[currentFeatureIndex];

    return (
        <div
            className="card text-white shadow-lg border-0 mb-4 p-4 p-md-5 position-relative"
            style={{
                backgroundImage: 'linear-gradient(to right, #007bff, #6f42c1)', // Custom gradient
                borderRadius: '1.5rem',
                minHeight: '200px' // Ensure card has a minimum height to prevent collapse
            }}
        >
            <div className="card-body text-center d-flex flex-column align-items-center justify-content-center">
                <i className={`${currentFeature.icon} display-4 mb-3`} style={{fontSize: '4rem'}}></i>
                <h2 className="card-title fw-bold">{currentFeature.title}</h2>
                <p className="card-text fw-light opacity-75">{currentFeature.description}</p>
            </div>

            {/* Previous Button */}
            <button
                className="carousel-control-prev"
                type="button"
                onClick={goToPrevious}
                style={{ top: '50%', transform: 'translateY(-50%)', left: '1rem', right: 'auto' }}
            >
                <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                <span className="visually-hidden">Previous</span>
            </button>

            {/* Next Button */}
            <button
                className="carousel-control-next"
                type="button"
                onClick={goToNext}
                style={{ top: '50%', transform: 'translateY(-50%)', right: '1rem', left: 'auto' }}
            >
                <span className="carousel-control-next-icon" aria-hidden="true"></span>
                <span className="visually-hidden">Next</span>
            </button>

            {/* Feature Indicators (Dots) */}
            <div className="position-absolute bottom-0 start-50 translate-middle-x d-flex p-3">
                {features.map((_, index) => (
                    <button
                        key={index}
                        type="button"
                        className={`mx-1 rounded-circle p-2 ${currentFeatureIndex === index ? 'bg-white' : 'bg-secondary'}`}
                        style={{ width: '10px', height: '10px' }}
                        onClick={() => handleManualNavigation(index)}
                        aria-label={`Go to feature ${index + 1}`}
                    ></button>
                ))}
            </div>
        </div>
    );
};
