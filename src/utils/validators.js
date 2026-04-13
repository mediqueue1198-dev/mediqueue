import { z } from 'zod'

// ─── AUTH SCHEMAS ─────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Enter a valid phone number').max(20),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  role: z.enum(['patient', 'doctor', 'mediator']),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

// ─── COMPLETE PROFILE SCHEMA (for Google OAuth users) ───────────────────────────
export const completeProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Enter a valid phone number').max(20),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  confirm_password: z.string().optional(),
  role: z.enum(['patient', 'doctor', 'mediator']),
}).refine(d => !d.password || d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

// ─── APPOINTMENT SCHEMAS ──────────────────────────────────────────────────────
export const appointmentSchema = z.object({
  doctor_id: z.string().min(1, 'Please select a doctor'),
  scheduled_time: z.string().min(1, 'Please select a date and time'),
  visit_type: z.enum(['first_visit', 'follow_up', 'emergency'], {
    errorMap: () => ({ message: 'Please select a visit type' }),
  }),
  patient_type: z.enum(['self', 'family']).default('self'),
  family_member_id: z.string().uuid().optional().nullable(),
  symptoms: z.string().min(5, 'Please describe your symptoms (min 5 chars)').max(500),
  notes: z.string().max(500).optional(),
})

// ─── WALK-IN SCHEMA ───────────────────────────────────────────────────────────
export const walkInSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  phone: z.string().min(7, 'Valid phone required'),
  doctor_id: z.string().min(1, 'Please select a doctor'),
  symptoms: z.string().min(3, 'Symptoms required'),
  is_emergency: z.boolean().default(false),
})

// ─── PROFILE SCHEMA ───────────────────────────────────────────────────────────
export const patientProfileSchema = z.object({
  full_name: z.string().min(2, 'Name required'),
  phone: z.string().min(7, 'Phone required'),
  date_of_birth: z.string().min(1, 'Date of birth required'),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).optional(),
  allergies: z.string().optional(), // comma-separated
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relation: z.string().optional(),
})

// ─── MEDICAL RECORD SCHEMA ────────────────────────────────────────────────────
export const medicalRecordSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnosis required'),
  notes: z.string().optional(),
  prescription: z.array(z.object({
    name: z.string().min(1, 'Medicine name required'),
    dosage: z.string().min(1, 'Dosage required'),
    frequency: z.string().min(1, 'Frequency required'),
    duration: z.string().min(1, 'Duration required'),
  })).optional(),
})

// ─── MESSAGE SCHEMA ───────────────────────────────────────────────────────────
export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(1000),
})

// ─── FAMILY MEMBER SCHEMA ─────────────────────────────────────────────────────
export const familyMemberSchema = z.object({
  name: z.string().min(2, 'Name required'),
  relationship: z.string().min(1, 'Relationship required'),
  date_of_birth: z.string().min(1, 'Date of birth required'),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).optional(),
  notes: z.string().optional(),
})