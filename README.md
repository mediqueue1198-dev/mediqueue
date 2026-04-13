# MediQueue - Smart Hospital Queue Management System

## Features
- **Authentication**: Email/password + Google OAuth
- **Multi-Role Access**: Separate dashboards for Patients, Doctors, and Hospital Staff
- **Smart Appointments**: AI-powered slot generation with load balancing
- **Walk-in Management**: Quick patient registration for walk-in visits
- **Real-time Queue**: Live queue updates with intelligent priority scoring
- **Analytics**: Comprehensive reporting and earnings tracking
- **Public Display**: Live queue display board for waiting areas
- **Messaging**: Internal messaging between patients, doctors, and staff
- **Medical Records**: Doctor consultation notes and prescriptions
- **Family Members**: Manage family member appointments

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.4 | UI Framework |
| React Router | 7.14.0 | Routing |
| TypeScript | 5.4.5 | Type Safety |
| Zustand | 5.0.12 | State Management |
| Tailwind CSS | 3.4.19 | Styling |
| Lucide React | 1.7.0 | Icons |
| Recharts | 3.8.1 | Charts |
| React Hook Form | 7.72.1 | Form handling |
| Zod | 4.3.6 | Validation |
| React Hot Toast | 2.6.0 | Notifications |

### Backend (Supabase)
| Service | Purpose |
|---------|---------|
| PostgreSQL | Database |
| Auth | User authentication |
| Row Level Security | Data protection |
| Realtime | Live queue updates |

### Development
| Tool | Purpose |
|------|---------|
| Vite | Build tool |
| ESLint | Code linting |
| Vitest | Testing |

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/mediqueue1198-dev/mediqueue.git

# Navigate to project
cd mediqueue

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Add your Supabase credentials:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_anon_key

# Enable Google OAuth in Supabase Dashboard:
# 1. Go to Authentication → Providers → Google
# 2. Add Google Client ID and Secret
# 3. Configure redirect URIs:
#    - http://localhost:5173/auth/callback/google (development)
#    - https://your-production-domain.com/auth/callback/google (production)

# Security Warning: The `.env` file contains sensitive credentials. NEVER commit this file to version control. Ensure it is listed in `.gitignore` (which it is in this project). Always keep your credentials secret.
```

### Database Setup

```bash
# Run migrations in Supabase SQL Editor
# 1. Copy the contents of supabase/master_schema.sql
# 2. Paste and Execute in the Supabase SQL Editor
```

### Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Security Features

- **Row Level Security (RLS)** - Database-level protection
- **Role-based Access** - Patient/Doctor/Staff separation
- **Protected Routes** - Frontend route guards
- **Secure Auth** - Supabase authentication with Google OAuth support
- **Input Validation** - Zod schema validation

## User Roles and Authentication

MediQueue supports three primary user roles:
- **Patient**: Access to patient dashboard, appointment booking, queue status, medical records
- **Doctor**: Access to doctor queue, consultation screen, earnings, patient history
- **Mediator (Staff)**: Access to queue control, walk-in registration, doctor management, reports

### Authentication Methods
1. **Email/Password**: Traditional registration and login
2. **Google OAuth**: Sign in with Google account

### Google OAuth Flow
1. User clicks "Sign in with Google" on login page
2. User authenticates with Google and grants permissions
3. After consent, user is redirected back to the application
4. If it's the first time using Google OAuth, user is prompted to complete their profile (select role, provide phone number, etc.)
5. Once profile is complete, user is redirected to their respective dashboard based on selected role

## Google OAuth Configuration

To enable Google authentication:

1. **In Supabase Dashboard**:
   - Go to Authentication → Providers
   - Enable Google provider
   - Add your Google Client ID and Secret
   - Add redirect URIs for development and production

2. **In Google Cloud Console**:
   - Create a project and enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:5173/auth/callback/google` (for development)

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**MediQueue Project**
- GitHub: [@mediqueue1198-dev](https://github.com/mediqueue1198-dev)
- Email: [project@mediqueue.com](mailto:project@mediqueue.com)

---
<p align="center">
  Made with ❤️ by MediQueue Team
</p>