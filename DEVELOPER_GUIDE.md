# 🛠️ MediQueue Developer Guide

Welcome to the **MediQueue** developer documentation. This guide provides a deep dive into the system architecture, business logic, and operational workflows to help you understand, maintain, and scale the platform.

---

## 🏗️ System Architecture

### 1. Frontend (React + Vite + TypeScript)
- **Framework:** React 19 (using modern hooks and patterns).
- **Styling:** Vanilla CSS + Tailwind CSS for utility-first responsiveness.
- **State Management:** 
  - **Zustand:** Used for global state (Auth, Queue, Appointments).
  - **Supabase Realtime:** Syncs database changes directly to Zustand stores.
- **Form Handling:** `react-hook-form` + `zod` for strict schema validation.

### 2. Backend (Supabase / PostgreSQL)
- **Database:** PostgreSQL with a highly relational schema.
- **Auth:** Supabase Auth (Google OAuth + Email/Pass).
- **Security:** Strict **Row Level Security (RLS)** ensuring data isolation between roles.
- **Business Logic:** Offloaded to the database via **RPCs (Remote Procedure Calls)** and **Database Triggers** for maximum performance and atomicity.

---

## 🔄 Core Workflows

### 1. Patient Journey
1.  **Onboarding:** Users sign up and create a Profile.
2.  **Booking:** Patients browse doctors and book an appointment (`appointments` table).
3.  **Queue Entry:** On the day of the appointment, the patient checks in (either via dashboard or mediator). 
4.  **Live Tracking:** Patients track their position and **Estimated Wait Time (EWT)** in real-time.
5.  **Consultation:** Once called, status moves to `in_consultation`.

### 2. Doctor Operations
1.  **Availability:** Doctors manage their "Active" status and "Break" modes.
2.  **Queue Control:** Doctors use the `call_next_patient` RPC to move the queue forward.
3.  **Consultation:** Doctors record findings, which are saved to `consultation_history` and `medical_records`.
4.  **Earnings:** Fees are automatically tracked and aggregated in the `DoctorEarnings` view.

### 3. Mediator (Receptionist) Flow
1.  **Authorization:** Mediators must be "Approved" by a Doctor to manage their queue.
2.  **Walk-In Registration:** Mediators can register patients without an account using symptomatic labels.
3.  **Conflict Resolution:** Mediators have the authority to reorder, skip, or remove patients from any assigned doctor's queue.

---

## 🗄️ Database Logic & Schema

### Single Source of Truth
The `supabase/master_schema.sql` file contains the entire database definition. 

### Key Components:
- **`queue_entries` Table:** The heart of the system. Tracks status, priority, and timestamps.
- **`call_next_patient()` RPC:** An atomic function that:
  - Finds the highest priority patient.
  - Updates the current patient to `completed`.
  - Transitions the next patient to `in_consultation`.
  - Updates the `updated_at` column for real-time triggers.
- **RLS Policies:**
  - Patients can only see their own records.
  - Doctors can see all patients assigned to them.
  - Mediators can see data for doctors who have "Approved" their assignment.

---

## ⚡ Real-time Synchronization

MediQueue uses a "Store-First" approach to real-time:
1.  A component calls a service (e.g., `queueService.callNext`).
2.  The database updates.
3.  The `useRealtime` hook detects the change via Supabase Broadcast/Replication.
4.  The Zustand store (`useQueueStore`) updates its local state.
5.  React re-renders the UI across all connected devices (TV Display, Patient App, Doctor App).

---

## 🛠️ Development Standards

- **TypeScript:** Avoid `any`. Use the types defined in `src/types/`.
- **Components:** Use the UI library in `src/components/ui/` (Button, Card, Input, etc.) to maintain design consistency.
- **Modals:** Always use `Modal`, `ModalBody`, and `ModalFooter` to ensure correct alignment and borders.
- **Error Handling:** Use `toast` for user feedback and `ErrorBoundary` for component crashes.

---

## 🚀 Scaling the System

To add a new feature:
1.  Update the `master_schema.sql` (if DB changes are needed).
2.  Add a new service in `src/services/`.
3.  Create/Update a Zustand store in `src/store/`.
4.  Implement the UI using the established design system.

---

*MediQueue is built for stability, security, and speed.*
