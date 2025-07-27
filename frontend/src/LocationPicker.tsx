// frontend/src/LocationPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';

// Define props for the LocationPicker component
interface LocationPickerProps {
    // Callback function to return the selected latitude and longitude
    onLocationSelect: (location: { lat: number; lng: number }) => void;
    // Optional initial latitude for the map center
    initialLat?: number | null; // Changed to allow null
    // Optional initial longitude for the map center
    initialLng?: number | null; // Changed to allow null
    // Optional function to call when the picker is cancelled/closed
    onCancel?: () => void;
}

// Declare L from Leaflet globally to avoid TypeScript errors
// This assumes Leaflet is loaded via a CDN script tag in index.html
declare const L: any;

export const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, initialLat, initialLng, onCancel }) => {
    const [latitude, setLatitude] = useState<number | null>(initialLat || null);
    const [longitude, setLongitude] = useState<number | null>(initialLng || null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
    const mapRef = useRef<any>(null); // Ref to store the Leaflet map instance
    const markerRef = useRef<any>(null); // Ref to store the Leaflet marker instance
    const mapContainerRef = useRef<HTMLDivElement>(null); // Ref for the map div element

    // Default map center if no initial coordinates are provided (e.g., a central location)
    const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // Center of India

    useEffect(() => {
        // Function to load Leaflet script and CSS dynamically
        const loadLeaflet = () => {
            return new Promise<void>((resolve, reject) => {
                // Check if Leaflet is already loaded
                if (typeof L !== 'undefined') {
                    resolve();
                    return;
                }

                // Load Leaflet CSS
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
                document.head.appendChild(link);

                // Load Leaflet JS
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
                script.onload = () => resolve();
                script.onerror = (err) => reject(err);
                document.body.appendChild(script);
            });
        };

        const initializeMap = async () => {
            setLoading(true);
            setMessage(null);

            try {
                await loadLeaflet(); // Ensure Leaflet is loaded

                if (!mapContainerRef.current) {
                    throw new Error("Map container ref is null.");
                }

                // Determine initial map view coordinates
                const initialMapLat = initialLat !== null ? initialLat : defaultCenter.lat;
                const initialMapLng = initialLng !== null ? initialLng : defaultCenter.lng;
                const initialZoom = (initialLat !== null && initialLng !== null) ? 15 : 5; // Zoom in if initial coords exist

                // Initialize the map if it hasn't been initialized yet
                if (!mapRef.current) {
                    mapRef.current = L.map(mapContainerRef.current!).setView([initialMapLat, initialMapLng], initialZoom);

                    // Add OpenStreetMap tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(mapRef.current);

                    // Add a click listener to the map
                    mapRef.current.on('click', (e: any) => {
                        const { lat, lng } = e.latlng;
                        setLatitude(lat);
                        setLongitude(lng);
                        updateMarker(lat, lng);
                    });
                } else {
                    // If map already exists, just update its view
                    mapRef.current.setView([initialMapLat, initialMapLng], initialZoom);
                }

                // Add initial marker if coordinates are provided
                if (initialLat !== null && initialLng !== null) {
                    updateMarker(initialLat, initialLng);
                }

            } catch (err: any) {
                console.error("Error initializing map or loading Leaflet:", err);
                setMessage({ text: `Failed to load map: ${err.message}`, type: "error" });
            } finally {
                setLoading(false);
            }
        };

        initializeMap();

        // Cleanup function
        return () => {
            if (mapRef.current) {
                mapRef.current.remove(); // Remove the map instance
                mapRef.current = null;
            }
            // Note: Dynamically loaded scripts/css are not removed here for simplicity,
            // as they might be used by other components or persist across modal open/close.
        };
    }, [initialLat, initialLng]); // Re-initialize if initial coordinates change

    // Function to update or create the marker on the map
    const updateMarker = (lat?: number, lng?: number) => {
        if (!mapRef.current) return;

        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
        }
        mapRef.current.setView([lat, lng], mapRef.current.getZoom()); // Center map on marker
    };

    // Handle "Get Current Location" button click
    const handleGetCurrentLocation = () => {
        setLoading(true);
        setMessage(null);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: currentLat, longitude: currentLng } = position.coords;
                    setLatitude(currentLat);
                    setLongitude(currentLng);
                    updateMarker(currentLat, currentLng);
                    mapRef.current.setView([currentLat, currentLng], 15); // Zoom in on current location
                    setMessage({ text: "Current location detected!", type: "success" });
                    setLoading(false);
                },
                (err) => {
                    console.error("Error getting current location:", err);
                    setMessage({ text: `Error getting location: ${err.message}. Please enable location services.`, type: "error" });
                    setLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            setMessage({ text: "Geolocation is not supported by your browser.", type: "error" });
            setLoading(false);
        }
    };

    const handleSelectLocation = () => {
        if (latitude !== null && longitude !== null) {
            onLocationSelect({ lat: latitude, lng: longitude });
        } else {
            setMessage({ text: "Please select a location on the map or get your current location.", type: "warning" });
        }
    };

    return (
        <div className="p-4">
            <h4 className="fw-bold text-center mb-4">Select Location on Map</h4>
            {message && <MessageDisplay message={message} />}

            <div className="d-flex justify-content-center mb-3">
                <button className="btn btn-primary me-2" onClick={handleGetCurrentLocation} disabled={loading}>
                    {loading ? <LoadingSpinner /> : 'Get Current Location'}
                </button>
                <button className="btn btn-outline-secondary" onClick={() => mapRef.current.setView([defaultCenter.lat, defaultCenter.lng], 5)}>
                    Reset Map View
                </button>
            </div>

            <div ref={mapContainerRef} style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px' }}>
                {loading && (
                    <div className="d-flex justify-content-center align-items-center h-100 bg-light">
                        <LoadingSpinner /><p className="ms-2 mb-0">Loading map...</p>
                    </div>
                )}
            </div>

            <div className="mb-3">
                <label className="form-label">Latitude:</label>
                <input type="text" className="form-control" value={latitude !== null ? latitude.toFixed(6) : ''} readOnly placeholder="Click on map or get current location" />
            </div>
            <div className="mb-3">
                <label className="form-label">Longitude:</label>
                <input type="text" className="form-control" value={longitude !== null ? longitude.toFixed(6) : ''} readOnly placeholder="Click on map or get current location" />
            </div>

            <div className="d-flex justify-content-end mt-4">
                <button className="btn btn-success me-2" onClick={handleSelectLocation} disabled={latitude === null || longitude === null || loading}>
                    Select This Location
                </button>
                {onCancel && (
                    <button className="btn btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
