<div align="center">
  <h1>MediQueue 🏥⏳</h1>
  <p><strong>A Modern, Real-Time Hospital Queue Management System</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
    <img src="https://img.shields.io/badge/Zustand-State-black?style=for-the-badge&logo=react" alt="Zustand" />
  </p>
</div>

---

## 🎯 About The Project

**MediQueue** is an enterprise-grade, real-time hospital queue management platform designed to eliminate waiting room congestion and streamline patient-doctor interactions. Built with a modern React stack and powered by Supabase, it provides tailored, role-based dashboards for Patients, Doctors, and Hospital Administrators (Mediators). 

By leveraging **real-time database subscriptions** and an **intelligent, starvation-proof queueing algorithm**, MediQueue ensures fair patient distribution and provides live updates to all stakeholders, demonstrating a strong grasp of complex state management and full-stack integration.

### ✨ What Makes This Project Stand Out?

- **Real-Time Data Sync:** Implemented via Supabase Realtime channels. If a doctor updates a queue status, all connected displays and patient devices update instantaneously.
- **Complex Queueing Algorithm:** Beyond simple FIFO, the system handles priority scoring, doctor break modes, auto-requeuing for skipped patients, and prevents queue starvation.
- **Robust Authentication Flow:** Custom Role-Based Access Control (RBAC) tightly integrated with Google OAuth and traditional Email/Password authentication.
- **Enterprise-Level Security:** Strict Row Level Security (RLS) policies at the database level to ensure data privacy, demonstrating an understanding of secure backend architectures.
- **Modern UI/UX:** Built a completely responsive, accessible, and visually striking interface using Tailwind CSS, proving an eye for modern design aesthetics.

---

## 🚀 Key Features

### 👥 Multi-Role Architecture
- **Patients:** Live queue tracking, intelligent estimated wait times (EWT), digital prescriptions access, and cross-device syncing.
- **Doctors:** Intuitive queue control, dynamic break-time management, and daily analytics dashboards.
- **Administrators (Mediators):** God-view of the entire queue, walk-in registration flows, and load-balancing tools.

### 🧠 Smart Queue Management
- **Starvation-Proof Logic:** Ensures fair treatment schedules even under heavy load.
- **Live Status Tracking:** Granular state transitions (`Waiting` → `In Consultation` → `Completed` / `Skipped`).
- **Edge-Case Handling:** Graceful handling of edge cases like noshows, unexpected doctor breaks, and emergency walk-ins.

### 🛡 Security & Validation
- **Auth Providers:** Dual login capabilities (Google OAuth + Email).
- **Data Protection:** Database-enforced RLS guarantees users only access authorized data chunks.
- **Robust Forms:** Type-safe, end-to-end validated forms via Zod and React Hook Form.

---

## 💻 Tech Stack Deep Dive

| Layer | Technology | Why I Chose It |
| :--- | :--- | :--- |
| **Frontend** | React (v19) | For a highly interactive, component-driven UI utilizing the latest React features. |
| **Language** | TypeScript | To catch bugs at compile-time, enforce self-documenting code, and ensure strict type-safety across the app. |
| **State Management**| Zustand | Selected for its minimalistic API, solving prop-drilling without the immense boilerplate of Redux. |
| **Styling** | Tailwind CSS | Utility-first CSS for rapid, scalable, and highly custom frontend development without leaving the JSX. |
| **Forms** | React Hook Form + Zod | For performant, unmanaged form state scaling coupled with bulletproof schema validation. |
| **Backend & DB** | Supabase (PostgreSQL) | Managed Postgres with built-in Auth, instant APIs, and crucial Realtime websocket capabilities. |

---

## 🏗 System Architecture Highlights
- **Database Schema:** A highly relational model mapping Users, Profiles, Appointments, and Queue Entries.
- **Automated Triggers:** Extensive use of PL/pgSQL database triggers to automatically manage appointment statuses and sync state.
- **Modular Frontend Architecture:** Clean separation of concerns with isolated Context/Zustand stores, encapsulated custom hooks (e.g., `useQueue`), and granular UI components.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/mediqueue1198-dev/mediqueue.git

# 2. Navigate into the project
cd mediqueue

# 3. Install dependencies
npm install

# 4. Setup environment variables
cp .env.example .env
# (Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env)

# 5. Start the development server
npm run dev
```

### Database Provisioning
Simply copy the contents of `supabase/master_schema.sql` and run it in your Supabase SQL Editor. This will instantly provision all required tables, functions, triggers, and RLS policies.

---

## 👨‍💻 Let's Connect!

I am actively open to **Software Engineering** and **Frontend Developer** opportunities! 
If you find my architectural choices, code quality, or feature implementation in this project interesting, I'd love to chat.

- **GitHub:** [@mediqueue1198-dev](https://github.com/mediqueue1198-dev) 
- **Email:** [mediqueue1198@gmail.com](mailto:mediqueue1198@gmail.com) 

<p align="center">
  <i>Demonstrating clean code, scalable architecture, and modern web technologies.</i>
</p>