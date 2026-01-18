# NaggingWife AI - Claude Code Conventions

## Project Overview
- **Port:** 8089
- **URL Prefix:** /NaggingWife/
- **Type:** Fun/Entertainment
- **Purpose:** Humorous "nagging wife" AI for reminders about dates, chores, wishlists, and gift ordering
- **Database:** PostgreSQL (Docker)
- **Status:** Active with full RBAC authentication

## Quick Access URLs
- **Landing Page:** http://localhost:8089/NaggingWife/
- **User Login:** http://localhost:8089/NaggingWife/auth/login
- **Admin Login:** http://localhost:8089/NaggingWife/admin/login
- **Admin Dashboard:** http://localhost:8089/NaggingWife/admin?token=admin
- **Chat Interface:** http://localhost:8089/NaggingWife/chat?token=<JWT_TOKEN>

## CRITICAL: Multi-Tenancy Model

**This project uses "Groups" instead of "Companies":**

| Standard | NaggingWife |
|----------|-------------|
| `companyId` | `groupId` |
| `Company` model | `Group` model |
| `COMPANY_ADMIN` role | `GROUP_ADMIN` role |
| `MANAGER` role | `MEMBER` role |
| `getCompanyId()` | `getGroupId()` |
| `user.company` | `user.group` |

When copying code from other projects, always replace Company references with Group.

## Authentication & RBAC System

### User Roles (Family-themed)
| Role | Description | Access |
|------|-------------|--------|
| `SUPER_ADMIN` | Platform owner | Full system access |
| `GROUP_ADMIN` | Family account owner (Dad/Mom) | Manage family + all features |
| `PARTNER` | Spouse | Full family features |
| `MEMBER` | Kids/relatives | Limited access, billing restricted for minors |

### Age Verification
- Users have a `birthDate` field for age verification
- MEMBER users under 18 cannot see billing sections
- `isAdult(birthDate)` helper function in `src/types/index.ts`

### Test Users (from seed.ts)
| Email | Password | Role |
|-------|----------|------|
| superadmin@system.local | superadmin123 | SUPER_ADMIN |
| john@family.local | admin123 | GROUP_ADMIN |
| sarah@family.local | partner123 | PARTNER |
| emma@family.local | member123 | MEMBER (22 years old) |
| bobby@family.local | member123 | MEMBER (14 years old - minor) |

### JWT Authentication
- Tokens include: userId, email, name, role, groupId, birthDate
- Cookie name: `adminToken`
- Simple token `admin` still works for backward compatibility

## Key Features
- Important dates (birthdays, anniversaries)
- Wife's wishlist management
- Chores & honey-do's tracking
- Gift orders (1800flowers, Amazon, etc.)
- Seasonal reminders
- Regular guy ads (hunting, fishing, tools)
- OAuth support (Google, Microsoft) - configurable

## Payment Gateways
All 5 payment gateways are fully integrated:

| Gateway | Status | Test Mode Support |
|---------|--------|-------------------|
| **Stripe** | Full integration | Sandbox/Production |
| **PayPal** | Full integration | Sandbox/Production |
| **Square** | Full integration | Sandbox/Production |
| **Braintree** | Full integration | Sandbox/Production |
| **Authorize.net** | Full integration | Test/Live mode |

### Payment Services Location
```
src/services/payments/
├── stripe.service.ts     # Stripe payment processing
├── paypal.service.ts     # PayPal order management
├── square.service.ts     # Square payment processing
├── braintree.service.ts  # Braintree transactions
├── authorize.service.ts  # Authorize.net processing
├── payment.service.ts    # Unified payment orchestrator
└── index.ts              # Service exports
```

### Database Models
- `PaymentSettings` - Global payment gateway configuration
- `PaymentGateway` - Per-provider settings (legacy)
- `Payment` - Transaction records

## Assistant Modes
Available modes in AppConfig.assistantMode:
- `helpful` - Friendly and supportive
- `firm` - Direct and no-nonsense
- `gentle` - Soft reminders
- `nagging` - Classic nagging wife mode

## Tech Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Frontend:** EJS templates + Bootstrap 5 + Bootstrap Icons
- **Real-time:** WebSockets (OpenAI Realtime API)
- **Auth:** JWT + bcrypt + Passport.js
- **Container:** Docker with nginx reverse proxy

## File Structure
```
src/
  routes/
    admin.ts        - Admin panel routes with RBAC
    auth.ts         - Authentication API routes
    authViews.ts    - Auth page routes (login, register, etc.)
    oauth.ts        - OAuth provider routes
    users.ts        - User management API
  middleware/
    auth.ts         - JWT authentication middleware
    rbac.ts         - Role-based access control
    tenant.ts       - Multi-tenant isolation
  services/
    userService.ts  - User CRUD operations
    payments/       - Payment gateway services (Stripe, PayPal, Square, Braintree, Authorize.net)
  types/
    index.ts        - TypeScript types including Role, JwtPayload, isAdult()
views/
  admin/
    _sidebar.ejs    - Admin sidebar (all menu items visible)
    login.ejs       - Admin login page
    dashboard.ejs   - Main dashboard
    ...             - Other admin pages
  auth/
    login.ejs       - User login page
    register.ejs    - Registration page
    ...
  user-chat.ejs     - Chat interface for logged-in users
  index.ejs         - Landing page
prisma/
  schema.prisma     - Database schema with UserRole enum
  seed.ts           - Database seeding with test users
docker/
  nginx.conf        - Reverse proxy configuration
  entrypoint.sh     - Container startup script
```

## Admin Sidebar Menu Structure
All menu items are visible to all authenticated users:

1. **Dashboard & Analytics**
   - Dashboard, Analytics

2. **Family Life**
   - Important Dates, Wife's Wishlist, Chores & Honey-Do's, Gift Orders

3. **Reminders & Ads**
   - Seasonal Reminders, Ads Management

4. **Configuration**
   - Greeting

5. **AI Settings**
   - Voices & Languages, AI Config, AI Tools, Knowledge Base, AI Agents, Functions, Logic Rules

6. **Integrations**
   - Webhooks, SMS Settings, Call Transfer, DTMF Menu, Payments, Payment Processing

7. **Management**
   - Users, Groups

8. **System**
   - Settings, Features

## Docker Commands
```bash
# Build and start
docker compose up -d

# Rebuild from scratch
docker compose down && docker compose build --no-cache && docker compose up -d

# View logs
docker compose logs -f

# Reset database (removes all data)
docker compose down -v && docker compose up -d
```

## Important Implementation Notes

### basePath Variable
All EJS templates and API calls must use the `basePath` variable (`/NaggingWife`) for proper routing through nginx.

Example in JavaScript:
```javascript
const basePath = '<%= basePath %>';
fetch(basePath + '/api/auth/login', {...})
```

Example in EJS links:
```html
<a href="<%= basePath %>/admin/dashboard?token=<%= token %>">Dashboard</a>
```

### Sidebar Scrollbar
All admin pages include scrollbar support for the sidebar:
```css
.sidebar {
  min-height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  position: sticky;
  top: 0;
}
```

### Login Flow
1. **User Login** (`/NaggingWife/auth/login`) -> Redirects to Chat Interface
2. **Admin Login** (`/NaggingWife/admin/login`) -> Redirects to Admin Dashboard

Both login pages share the same design with:
- Demo login buttons for quick testing
- OAuth buttons (Google/Microsoft)
- Purple/pink gradient theme
- Heart icon branding

---

## Agent Capabilities

When working on this project, apply these specialized behaviors:

### Backend Architect
- Design Express routes for family-themed features (wishlists, chores, dates)
- Implement PostgreSQL with Prisma ORM patterns
- Structure RBAC with family roles (GROUP_ADMIN, PARTNER, MEMBER)
- Handle age verification for billing restrictions

### AI Engineer
- Design AI persona modes: helpful, firm, gentle, nagging
- Implement humorous but helpful reminder voice interactions
- Use OpenAI Realtime API for "nagging wife" personality
- Balance humor with actual usefulness

### Database Admin
- PostgreSQL schema for family data (dates, wishlists, chores, orders)
- Multi-tenant isolation with Groups (not Companies)
- Handle birthDate for age verification (minors can't see billing)
- Seed realistic family demo data

### Security Auditor
- Protect family data with proper tenant isolation
- Validate JWT tokens with role-based access
- Secure OAuth integrations (Google, Microsoft)
- Review MEMBER role restrictions for minors

### Content Creator (Whimsy Injector)
- Write humorous reminder messages that are still helpful
- Create "nagging" scenarios that feel authentic but fun
- Design seasonal reminder templates
- Balance humor with practical reminders

### UI Designer
- Purple/pink gradient theme with heart branding
- Family-friendly interface design
- Role-appropriate menu visibility
- Fun but functional user experience
