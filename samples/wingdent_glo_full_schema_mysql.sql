create database IF NOT EXISTS wingdentglo;

use wingdentglo;

-- MySQL full schema for Wingdent-Glo platform

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  otp_code VARCHAR(10),
  otp_expiry DATETIME,
  role ENUM('superadmin', 'admin', 'doctor', 'patient') NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(20),
  zone_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

-- Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  zone_id CHAR(36),
  is_primary BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) UNIQUE,
  license_number VARCHAR(100),
  specialization VARCHAR(255),
  experience_years INT,
  approved BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Doctor availability
CREATE TABLE IF NOT EXISTS doctor_availability (
  id CHAR(36) PRIMARY KEY,
  doctor_id CHAR(36),
  day_of_week ENUM('mon','tue','wed','thu','fri','sat','sun'),
  start_time TIME,
  end_time TIME,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Service Pricing Breakdown
CREATE TABLE IF NOT EXISTS service_pricing (
  id CHAR(36) PRIMARY KEY,
  service_id CHAR(36),
  doctor_fee DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  admin_fee DECIMAL(10, 2),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Banners
CREATE TABLE IF NOT EXISTS banners (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255),
  image_url TEXT,
  link TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by CHAR(36),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY,
  patient_id CHAR(36),
  doctor_id CHAR(36),
  service_id CHAR(36),
  address_id CHAR(36),
  status ENUM('pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled') NOT NULL,
  scheduled_at DATETIME,
  rescheduled_at DATETIME,
  zone_id CHAR(36),
  payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
  FOREIGN KEY (patient_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id CHAR(36) PRIMARY KEY,
  appointment_id CHAR(36),
  doctor_id CHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY,
  appointment_id CHAR(36),
  total_amount DECIMAL(10, 2),
  payment_method VARCHAR(50),
  paid_at DATETIME,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Order History
CREATE TABLE IF NOT EXISTS order_history (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  appointment_id CHAR(36),
  action VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Medical History
CREATE TABLE IF NOT EXISTS medical_history (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id CHAR(36) PRIMARY KEY,
  admin_id CHAR(36),
  action TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  appointment_id CHAR(36),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);
