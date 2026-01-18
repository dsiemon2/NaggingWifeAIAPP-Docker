# NaggingWife AI - Fun/Entertainment Assistant

**Type:** Fun/Entertainment Application
**Port:** 8089
**URL Prefix:** `/NaggingWife/`
**Database:** PostgreSQL
**Status:** Production Ready with Full Authentication

---

## Quick Start

```bash
# Start the application
docker compose up -d

# Rebuild from scratch
docker compose down && docker compose build --no-cache && docker compose up -d

# View logs
docker compose logs -f

# Reset database (removes all data)
docker compose down -v && docker compose up -d
```

---

## Access URLs

| Page | URL |
|------|-----|
| Landing Page | http://localhost:8089/NaggingWife/ |
| User Login | http://localhost:8089/NaggingWife/auth/login |
| Admin Login | http://localhost:8089/NaggingWife/admin/login |
| Admin Dashboard | http://localhost:8089/NaggingWife/admin?token=admin |
| Chat Interface | http://localhost:8089/NaggingWife/chat?token=<JWT_TOKEN> |

---

## Test Accounts

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| superadmin@system.local | superadmin123 | SUPER_ADMIN | Platform owner |
| john@family.local | admin123 | GROUP_ADMIN | Family admin (Dad) |
| sarah@family.local | partner123 | PARTNER | Spouse (Mom) |
| emma@family.local | member123 | MEMBER | Adult child (22yo) |
| bobby@family.local | member123 | MEMBER | Minor child (14yo) |

---

## Features Overview

### Family Life
- **Important Dates** - Birthdays, anniversaries, events with countdown
- **Wife's Wishlist** - Gift ideas and preferences with priority
- **Chores & Honey-Do's** - Task management with status tracking
- **Gift Orders** - Order tracking (1800flowers, Amazon, etc.)

### Reminders & Ads
- **Seasonal Reminders** - Holiday and seasonal prompts
- **Ads Management** - Regular guy ads (hunting, fishing, tools)

### AI Configuration
- **Voices & Languages** - 24 languages supported
- **AI Config** - Model settings, temperature, tokens
- **AI Tools** - Function calling tools
- **Knowledge Base** - Document management
- **AI Agents** - Agent configurations
- **Functions** - Custom function definitions
- **Logic Rules** - Conditional logic for AI responses

### Integrations
- **Webhooks** - External integrations
- **SMS Settings** - Twilio/messaging configuration
- **Call Transfer** - Transfer numbers and conditions
- **DTMF Menu** - Touch-tone menu options
- **Payment Processing** - Stripe/PayPal/Square

### Management
- **Users** - User account management
- **Groups** - Multi-tenant organization

### System
- **Settings** - Store info, branding, payment gateways
- **Features** - Toggle FAQ, sticky bar, chat, notifications

---

## Authentication System

### User Roles (Family-themed)
| Role | Description | Access |
|------|-------------|--------|
| `SUPER_ADMIN` | Platform owner | Full system access |
| `GROUP_ADMIN` | Family account owner | Manage family + all features |
| `PARTNER` | Spouse | Full family features |
| `MEMBER` | Kids/relatives | Limited access |

### Age Verification
- Users have a `birthDate` field
- MEMBER users under 18 have restricted billing access
- Implemented via `isAdult(birthDate)` helper function

### Login Flows
1. **User Login** (`/auth/login`) -> Chat Interface
2. **Admin Login** (`/admin/login`) -> Admin Dashboard

Both login pages feature:
- Demo login buttons for quick testing
- OAuth buttons (Google/Microsoft)
- Purple/pink gradient theme

---

## Database Schema

### Key Models
- `User` - System users with roles and birthDate
- `Group` - Multi-tenant groups (NOT Company)
- `ImportantDate` - Special dates to remember
- `WishlistItem` - Wife's wishlist items
- `Chore` - Honey-do tasks with status
- `GiftOrder` - Gift purchase tracking
- `SeasonalReminder` - Holiday reminders
- `Ad` - Promotional ads
- `AppConfig` - AI configuration
- `Language` - 24 supported languages
- `AIAgent`, `AITool`, `Function`, `LogicRule` - AI settings

### Multi-Tenancy (IMPORTANT)
Uses `Group` model instead of `Company`:
- `groupId` instead of `companyId`
- `GROUP_ADMIN` role instead of `COMPANY_ADMIN`
- `MEMBER` role instead of `MANAGER`
- `PARTNER` role for spouse access

---

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Frontend:** EJS templates + Bootstrap 5 + Bootstrap Icons
- **Auth:** JWT + bcrypt + Passport.js (Google/Microsoft OAuth)
- **Container:** Docker with nginx reverse proxy
- **Real-time:** WebSockets (OpenAI Realtime API)

---

## Color Theme

| Element | Color | Hex |
|---------|-------|-----|
| Primary | Purple | `#9333ea` |
| Secondary | Violet | `#7c3aed` |
| Accent | Pink | `#e91e63` |
| Background Gradient | Purple to Pink | `linear-gradient(135deg, #8e2de2 0%, #e91e63 100%)` |

---

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| naggingwife_db | 5432 | PostgreSQL database |
| naggingwife_app | 3000 | Main application (landing, auth, chat) |
| naggingwife_admin | 3001 | Admin panel |
| naggingwife_proxy | 8089 | Nginx reverse proxy |

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Claude Code conventions and implementation notes
- [admin-guide.md](./admin-guide.md) - Admin panel user guide
- [setup-guide.md](./setup-guide.md) - Development setup guide
- [relationship-tips.md](./relationship-tips.md) - Psychology behind happy relationships
