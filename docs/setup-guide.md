# Setup Guide - NaggingWife AI

## Prerequisites

- Docker and Docker Compose
- OpenAI API key with access to GPT-4o Realtime API

---

## Docker Installation (Recommended)

### 1. Start the Application

```bash
cd NaggingWifeAIAPP-Docker
docker compose up -d
```

This starts 4 containers:
- `naggingwife_db` - PostgreSQL database
- `naggingwife_app` - Main application (landing, auth, chat)
- `naggingwife_admin` - Admin panel
- `naggingwife_proxy` - Nginx reverse proxy

### 2. Access the Application

| Page | URL |
|------|-----|
| Landing Page | http://localhost:8089/NaggingWife/ |
| User Login | http://localhost:8089/NaggingWife/auth/login |
| Admin Login | http://localhost:8089/NaggingWife/admin/login |
| Chat Interface | http://localhost:8089/NaggingWife/chat?token=<JWT> |

### 3. Test Accounts

| Email | Password | Role |
|-------|----------|------|
| superadmin@system.local | superadmin123 | SUPER_ADMIN |
| john@family.local | admin123 | GROUP_ADMIN |
| sarah@family.local | partner123 | PARTNER |
| emma@family.local | member123 | MEMBER (22yo) |
| bobby@family.local | member123 | MEMBER (14yo) |

---

## Docker Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f naggingwife_app
docker compose logs -f naggingwife_admin
```

### Rebuild
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Reset Database
```bash
# Warning: Deletes all data!
docker compose down -v
docker compose up -d
```

### Access Container Shell
```bash
docker exec -it naggingwife_app sh
docker exec -it naggingwife_admin sh
```

---

## Development Installation

### 1. Install Dependencies

```bash
cd NaggingWifeAIAPP-Docker
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
notepad .env  # Windows
nano .env     # Mac/Linux
```

Required settings:
```env
OPENAI_API_KEY=sk-your-key-here
JWT_SECRET=your-jwt-secret
PORT=3000
ADMIN_PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/naggingwife
BASE_PATH=/NaggingWife
```

### 3. Initialize Database

```bash
# Create database and tables
npx prisma db push

# Seed with sample data
npx prisma db seed
```

### 4. Start Development Servers

```bash
# Terminal 1 - Main app
npm run dev

# Terminal 2 - Admin server
npm run dev:admin
```

---

## First Run Checklist

1. Open admin login: http://localhost:8089/NaggingWife/admin/login
2. Login as john@family.local / admin123
3. **Dashboard**: View overview statistics
4. **Important Dates**: Add family birthdays and anniversaries
5. **Wishlist**: Add wife's gift preferences
6. **Chores**: Create honey-do list items
7. **AI Config**: Configure AI personality mode
8. **Voices**: Choose AI voice
9. Test chat interface with user login

---

## Setting Up Important Dates

1. Go to **Admin > Important Dates**
2. Click **Add Date**
3. Enter:
   - Title (e.g., "Sarah's Birthday")
   - Date
   - Category (Birthday, Anniversary, Holiday)
   - Reminder preferences
4. Save the date

**Categories:**
- Birthday - Family member birthdays
- Anniversary - Wedding anniversaries
- Holiday - Valentine's Day, Christmas, etc.
- Other - Custom dates

---

## Setting Up the Wishlist

1. Go to **Admin > Wife's Wishlist**
2. Click **Add Item**
3. Enter:
   - Item name and description
   - Store/URL
   - Price estimate
   - Priority (High, Medium, Low)
   - Size/Color preferences
4. Save the item

---

## Configuring AI Personality

### Assistant Modes

1. Go to **Admin > AI Config**
2. Select Assistant Mode:

| Mode | Description |
|------|-------------|
| Helpful | Friendly and supportive |
| Firm | Direct and no-nonsense |
| Gentle | Soft reminders |
| Nagging | Classic nagging wife mode |

### Voice Selection

1. Go to **Admin > Voices**
2. Select from:
   - Nova (Female, warm)
   - Shimmer (Female, soft)
   - Alloy (Neutral)
   - Echo (Male)

---

## Testing the Chat Interface

### User Login Test
1. Open http://localhost:8089/NaggingWife/auth/login
2. Login as john@family.local / admin123
3. Click "Quick Actions" to test:
   - "Upcoming Dates"
   - "My Chores"
   - "Wishlist"
   - "Reminders"
4. Type custom messages

### Admin Panel Test
1. Open http://localhost:8089/NaggingWife/admin/login
2. Login as john@family.local / admin123
3. Navigate through all menu items
4. Add sample data to each section
5. Verify data appears correctly

---

## Common Issues

### "Cannot connect to database"
- Ensure PostgreSQL container is running: `docker compose ps`
- Check database URL in environment variables
- Wait 30 seconds after first startup for DB initialization

### "Login returns 404"
- Ensure nginx proxy is running
- Check BASE_PATH is set correctly (/NaggingWife)
- Verify API routes include basePath prefix

### "WebSocket connection failed"
- Ensure app container is running
- Check for firewall blocking port 8089
- Verify nginx WebSocket configuration

### "OpenAI API error"
- Verify OPENAI_API_KEY in environment
- Check API key has GPT-4o access
- Verify sufficient API credits

### "JWT Invalid"
- Ensure JWT_SECRET is set
- Check token expiration
- Clear browser localStorage and re-login

### "Admin panel shows Unauthorized"
- Use /admin/login instead of ?token=admin
- Login with valid credentials
- Check user has admin role

---

## Database Management

### View Database
```bash
npx prisma studio
```

### Reset Database (Docker)
```bash
docker compose down -v
docker compose up -d
```

### Reset Database (Development)
```bash
npx prisma migrate reset
npx prisma db push
npx prisma db seed
```

---

## Integration Setup

### Webhooks
1. Go to **Admin > Webhooks**
2. Add webhook URL
3. Select events to trigger
4. Set secret key

### SMS Reminders
1. Go to **Admin > SMS Settings**
2. Select provider (Twilio)
3. Enter credentials
4. Set reminder timing
5. Customize message template

### Calendar Sync
Configure external calendar integration for important dates.

---

## Security Notes

- Change default passwords after first login
- Don't expose admin panel publicly without HTTPS
- API keys should never be committed to git
- Enable JWT token expiration
- Use strong JWT_SECRET in production

---

## Docker Service Details

| Service | Internal Port | Container Name |
|---------|---------------|----------------|
| PostgreSQL | 5432 | naggingwife_db |
| Main App | 3000 | naggingwife_app |
| Admin Panel | 3001 | naggingwife_admin |
| Nginx Proxy | 80 -> 8089 | naggingwife_proxy |

---

## Production Deployment

### Environment Variables
```env
NODE_ENV=production
OPENAI_API_KEY=sk-...
JWT_SECRET=secure-random-string
DATABASE_URL=postgresql://user:password@db:5432/naggingwife
PORT=3000
ADMIN_PORT=3001
BASE_PATH=/NaggingWife
```

### HTTPS Configuration
Add SSL certificates to nginx configuration for production.

### Backup Database
```bash
docker exec naggingwife_db pg_dump -U postgres naggingwife > backup.sql
```

### Restore Database
```bash
docker exec -i naggingwife_db psql -U postgres naggingwife < backup.sql
```

---

## Support

For issues and feature requests, check the project documentation or contact your administrator.
