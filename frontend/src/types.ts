// frontend/src/types.ts
import { Timestamp, FieldValue } from 'firebase/firestore';

// Define types for better type safety
export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'patient' | 'doctor' | 'admin' | 'superadmin';
    status: 'active' | 'inactive' | 'pending_approval'; // Added pending_approval for doctors
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
    last_login_at: Timestamp | FieldValue;
    phone_number?: string;
    profile_picture_url?: string;
    // Doctor specific fields
    license_number?: string;
    specialization?: string;
    years_of_experience?: number;
    bio?: string;
    assigned_zones?: string[];
    availability_schedule?: string; // JSON string
    is_available_now?: boolean;
    average_rating?: number; // Aggregated rating from feedback
    total_reviews?: number; // Total number of reviews
}

export interface Service {
    id: string;
    name: string;
    description: string;
    base_price: number;
    estimated_duration_minutes: number;
    image: string;
    created_at: Timestamp | FieldValue; // Added timestamps
    updated_at: Timestamp | FieldValue;
}

export interface Offer {
    id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    created_at: Timestamp | FieldValue; // Added timestamps
    updated_at: Timestamp | FieldValue;
}

export interface Address {
    id: string;
    user_id: string; // Changed from patient_id to user_id for broader use
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    zip_code: string;
    label: string; // e.g., "Home", "Office"
    is_default: boolean;
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
}

export interface Appointment {
    id: string;
    patient_id: string;
    service_id: string;
    address_id: string | null; // MODIFIED: Can be null for teleconsultation
    requested_date: string; // YYYY-MM-DD
    requested_time_slot: string; // e.g., "09:00 AM - 10:00 AM"
    estimated_cost: number;
    status: 'pending_assignment' | 'assigned' | 'confirmed' | 'on_the_way' | 'arrived' | 'service_started' | 'completed' | 'cancelled_by_patient' | 'declined_by_doctor' | 'rescheduled';
    payment_status: 'pending' | 'paid' | 'refunded'; // MODIFIED: Added 'refunded'
    doctor_id: string | null; // MODIFIED: Explicitly allow null for unassigned
    assigned_at?: Timestamp | FieldValue;
    confirmed_at?: Timestamp | FieldValue;
    started_at?: Timestamp | FieldValue;
    completed_at?: Timestamp | FieldValue;
    cancellation_reason?: string;
    reschedule_reason?: string;
    payment_id?: string;
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;

    // NEW: Teleconsultation fields
    appointment_type: 'in_person' | 'teleconsultation'; // NEW: Type of appointment
    teleconsultation_id?: string; // NEW: Reference to the Teleconsultation document if type is 'teleconsultation'

    // Enriched fields for UI display (not stored in Firestore directly, but added client-side)
    patientName?: string;
    serviceName?: string;
    addressDetails?: Address;
    doctorName?: string;
}

export interface Payment {
    id: string;
    appointment_id: string;
    patient_id: string;
    doctor_id: string | null; // MODIFIED: Added doctor_id
    service_id: string; // MODIFIED: Added service_id
    amount: number;
    currency: string;
    payment_gateway_transaction_id?: string; // MODIFIED: Made optional for manual payments
    status: 'successful' | 'failed' | 'refunded'; // MODIFIED: Added 'refunded'
    payment_method: string;
    platform_fee_amount?: number; // MODIFIED: Made optional
    doctor_fee_amount?: number; // MODIFIED: Made optional
    admin_fee_amount?: number; // MODIFIED: Made optional
    transaction_date: Timestamp | FieldValue;
    recorded_by?: string; // UID of admin/superadmin who recorded it
    created_at?: Timestamp | FieldValue; // MODIFIED: Added created_at
    updated_at?: Timestamp | FieldValue; // MODIFIED: Added updated_at
}

export interface Feedback {
    id: string;
    patient_id: string;
    appointment_id: string;
    doctor_id: string; // MODIFIED: Made mandatory as feedback is usually for a doctor
    rating: number; // 1-5 stars
    comments?: string;
    created_at: Timestamp | FieldValue;
    updated_at?: Timestamp | FieldValue; // MODIFIED: Added updated_at
}

export interface FeeConfiguration {
    id: string;
    platform_fee_percentage: number; // Stored as decimal, e.g., 0.15 for 15%
    doctor_share_percentage: number;
    admin_fee_percentage: number;
    effective_from: Timestamp | FieldValue;
    created_by: string; // User ID of superadmin who set it
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
}

// NEW INTERFACE for individual medication items within a prescription
export interface MedicationItem {
    medication_name: string;
    dosage: string; // e.g., "10mg", "2 tablets"
    frequency: string; // e.g., "Once daily", "Twice a day after meals"
    instructions: string; // e.g., "Take with food", "Do not exceed 3 doses in 24 hours"
}

// UPDATED Prescription interface
export interface Prescription {
    id: string;
    patient_id: string;
    doctor_id: string;
    appointment_id?: string; // Optional, if prescription is not tied to a specific appointment
    medications: MedicationItem[]; // Array of medication items
    prescribed_date: string; // YYYY-MM-DD
    expires_date?: string; // YYYY-MM-DD, optional
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
    // Enriched fields for display (not stored in Firestore)
    doctorName?: string;
    patientName?: string;
}

export interface HealthRecord {
    id: string;
    patient_id: string;
    doctor_id?: string; // Optional, if record is patient-added or not tied to a specific doctor
    record_type: 'diagnosis' | 'test_result' | 'allergy' | 'medical_history' | 'vaccination' | 'other';
    record_date: string; // YYYY-MM-DD
    title?: string; // e.g., "Initial Diagnosis", "Blood Test Results"
    description: string; // Detailed notes or results
    attachment_url?: string; // URL to a file in cloud storage (e.g., medical report PDF)
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
    // Enriched fields for display (not stored in Firestore)
    doctorName?: string;
    patientName?: string;
}

export interface Consultation {
    id: string;
    appointment_id: string; // Each consultation is tied to an appointment
    patient_id: string;
    doctor_id: string;
    consultation_date: string; // YYYY-MM-DD
    consultation_time: string; // e.g., "09:30 AM"
    notes: string; // Detailed consultation notes
    diagnosis?: string; // Doctor's diagnosis
    recommendations?: string; // Treatment recommendations
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
    // Enriched fields for display (not stored in Firestore)
    doctorName?: string;
    patientName?: string;
    serviceName?: string;
}

// NEW: Teleconsultation Interface
export interface Teleconsultation {
    id: string; // Unique ID for the teleconsultation session
    appointment_id: string; // Link to the parent Appointment
    patient_id: string;
    doctor_id: string;
    meeting_link: string; // The Jitsi Meet URL
    start_time?: Timestamp | FieldValue; // When the call actually started
    end_time?: Timestamp | FieldValue;   // When the call actually ended
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
    platform_used: 'Jitsi'; // Or 'Google Meet', 'WebRTC' etc.
    notes?: string; // Notes about the teleconsultation session itself (e.g., technical issues)
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
}
