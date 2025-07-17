
-- Wingdent-Glo SQL Schema
-- Generated on 2025-07-10T01:53:18.409458

-- Enable UUID generation (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    email TEXT,
    role TEXT CHECK (role IN ('superadmin', 'admin', 'doctor', 'patient')) NOT NULL,
    otp_code TEXT,
    otp_expiry TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctors Table
CREATE TABLE doctors (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    license_number TEXT NOT NULL,
    experience_years INT,
    rating FLOAT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    available_slots JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients Table
CREATE TABLE patients (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    default_address_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones Table
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    pincode_list TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    label TEXT,
    address_line TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    zone_id UUID REFERENCES zones(id),
    geo_location POINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services Table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2),
    doctor_fee DECIMAL(10, 2),
    platform_fee DECIMAL(10, 2),
    admin_fee DECIMAL(10, 2),
    duration_minutes INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    service_id UUID REFERENCES services(id),
    address_id UUID REFERENCES addresses(id),
    scheduled_time TIMESTAMP,
    status TEXT CHECK (status IN ('requested', 'assigned', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
    rescheduled_from UUID REFERENCES appointments(id),
    payment_status TEXT,
    rating FLOAT,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id),
    amount DECIMAL(10, 2),
    method TEXT,
    doctor_share DECIMAL(10, 2),
    platform_share DECIMAL(10, 2),
    admin_share DECIMAL(10, 2),
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'settled')),
    transaction_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical History Table
CREATE TABLE medical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type TEXT CHECK (type IN ('condition', 'allergy', 'procedure', 'note')),
    title TEXT,
    description TEXT,
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    attachment_url TEXT
);

-- Prescriptions Table
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id),
    doctor_id UUID REFERENCES users(id),
    patient_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attachment_url TEXT
);

-- Prescription Medications Table
CREATE TABLE prescription_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID REFERENCES prescriptions(id),
    medicine_name TEXT,
    dosage TEXT,
    duration_days INT,
    instructions TEXT
);

-- Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id),
    invoice_number TEXT UNIQUE,
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    total_amount DECIMAL(10, 2),
    breakdown JSONB,
    payment_status TEXT,
    payment_id UUID REFERENCES payments(id),
    pdf_url TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order History Table
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    service_id UUID REFERENCES services(id),
    status TEXT CHECK (status IN ('completed', 'cancelled', 'refunded')),
    doctor_name TEXT,
    amount_paid DECIMAL(10, 2),
    payment_method TEXT,
    prescription_id UUID REFERENCES prescriptions(id),
    invoice_id UUID REFERENCES invoices(id),
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banners Table
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    image_url TEXT,
    description TEXT,
    target_link TEXT,
    active_from TIMESTAMP,
    active_to TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id)
);
