// frontend/src/MapView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';

// Define props for the MapView component
interface MapViewProps {
    lat: number; // Latitude to display
    lng: number; // Longitude to display
    label?: string; // Optional label for the marker/map title
}

// Declare L from Leaflet globally to avoid TypeScript errors
// This assumes Leaflet is loaded via a CDN script tag in index.html
declare const L: any;

export const MapView: React.FC<MapViewProps> = ({ lat, lng, label }) => {
    const mapRef = useRef<any>(null); // Ref to store the Leaflet map instance
    const mapContainerRef = useRef<HTMLDivElement>(null); // Ref for the map div element
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

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

            if (lat === undefined || lng === undefined || lat === null || lng === null) {
                setMessage({ text: "Location coordinates are not available for this address.", type: "warning" });
                setLoading(false);
                return;
            }

            try {
                await loadLeaflet(); // Ensure Leaflet is loaded

                if (!mapContainerRef.current) {
                    throw new Error("Map container ref is null.");
                }

                // Initialize the map if it hasn't been initialized yet
                if (!mapRef.current) {
                    mapRef.current = L.map(mapContainerRef.current!).setView([lat, lng], 15); // Set view with provided coords and a good zoom level

                    // Add OpenStreetMap tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(mapRef.current);

                    // Add a marker at the specified location
                    L.marker([lat, lng]).addTo(mapRef.current)
                        .bindPopup(label || 'Location')
                        .openPopup();

                } else {
                    // If map already exists, just update its view and marker position
                    mapRef.current.setView([lat, lng], mapRef.current.getZoom());
                    // Remove existing markers
                    mapRef.current.eachLayer((layer: any) => {
                        if (layer instanceof L.Marker) {
                            mapRef.current.removeLayer(layer);
                        }
                    });
                    L.marker([lat, lng]).addTo(mapRef.current)
                        .bindPopup(label || 'Location')
                        .openPopup();
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
        };
    }, [lat, lng, label]); // Re-initialize if coordinates or label change

    return (
        <div className="p-2">
            {message && <MessageDisplay message={message} />}
            <div
                ref={mapContainerRef}
                style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px' }}
            >
                {loading && (
                    <div className="d-flex justify-content-center align-items-center h-100 bg-light">
                        <LoadingSpinner /><p className="ms-2 mb-0">Loading map...</p>
                    </div>
                )}
            </div>
            {lat !== null && lng !== null && (
                <div className="text-center text-muted small">
                    Latitude: {lat.toFixed(6)}, Longitude: {lng.toFixed(6)}
                </div>
            )}
        </div>
    );
};
