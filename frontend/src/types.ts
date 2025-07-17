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
    user_id: string;
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
    address_id: string;
    requested_date: string; // YYYY-MM-DD
    requested_time_slot: string; // e.g., "09:00 AM - 10:00 AM"
    estimated_cost: number;
    status: 'pending_assignment' | 'assigned' | 'confirmed' | 'on_the_way' | 'arrived' | 'service_started' | 'completed' | 'cancelled_by_patient' | 'declined_by_doctor' | 'rescheduled';
    payment_status: 'pending' | 'paid' | 'failed';
    doctor_id?: string;
    assigned_at?: Timestamp | FieldValue;
    actual_start_time?: Timestamp | FieldValue;
    actual_end_time?: Timestamp | FieldValue;
    cancellation_reason?: string;
    reschedule_reason?: string;
    payment_id?: string;
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
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
    amount: number;
    currency: string;
    payment_gateway_transaction_id: string;
    status: 'successful' | 'failed';
    payment_method: string;
    platform_fee_amount: number;
    doctor_fee_amount: number;
    admin_fee_amount: number;
    transaction_date: Timestamp | FieldValue;
    recorded_by?: string; // UID of admin/superadmin who recorded it
}

export interface Feedback {
    id: string;
    patient_id: string;
    appointment_id: string;
    doctor_id?: string;
    rating: number; // 1-5 stars
    comments?: string;
    created_at: Timestamp | FieldValue;
}

export interface FeeConfiguration {
    id: string;
    platform_fee_percentage: number; // Stored as decimal, e.g., 0.15 for 15%
    doctor_share_percentage: number;
    admin_fee_percentage: number;
    effective_from: Timestamp | FieldValue;
    created_by: string;
    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
}
