# Nagging Wife AI

Humorous AI assistant for remembering dates, chores, and gift planning.

**Production Domain:** www.naggingwifeai.com

## Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express 4.19
- **Language:** TypeScript 5.6
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5.19
- **WebSockets:** ws 8.18.0
- **AI:** OpenAI Realtime API

### Frontend
- **Templating:** EJS 3.1
- **CSS Framework:** Bootstrap 5
- **Icons:** Bootstrap Icons

### Payment Gateways
Stripe, PayPal, Braintree, Square, Authorize.net

### SMS/Notifications
- **Twilio** - SMS reminders for dates and chores

## Ports

| Service | Port | Description |
|---------|------|-------------|
| Nginx Proxy | 8089 | Main entry point |
| App Server | 3000 | Internal - Main application |
| Admin Server | 3001 | Internal - Admin panel |
| PostgreSQL | Internal | Database (Docker internal) |

## Local Development URLs

- **Landing Page:** http://localhost:8089/NaggingWife/
- **Admin Panel:** http://localhost:8089/NaggingWife/admin?token=admin

## Docker Setup

```bash
# Start all services
docker compose up -d

# Rebuild and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Author

Daniel Siemon
