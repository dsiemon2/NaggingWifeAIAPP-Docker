# Admin Guide - NaggingWife AI

## Accessing the Admin Panel

### Docker Access
1. Start the containers: `docker compose up -d`
2. Open: `http://localhost:8089/NaggingWife/admin/login`
3. Login with your credentials

### Demo Accounts
| Email | Password | Role |
|-------|----------|------|
| superadmin@system.local | superadmin123 | Super Admin |
| john@family.local | admin123 | Family Admin |
| sarah@family.local | partner123 | Partner |

---

## Dashboard

The dashboard provides an at-a-glance overview:

### Statistics
- **Important Dates**: Upcoming birthdays, anniversaries
- **Chores**: Pending honey-do tasks
- **Wishlist Items**: Active gift ideas
- **Gift Orders**: Recent purchases

### Upcoming Events
Shows the next 10 important dates with:
- Date name
- Days until event
- Category (Birthday, Anniversary, etc.)
- Quick actions

---

## Family Life

### Important Dates

Manage all important dates to remember:

- **View All**: List of dates with category filtering
- **Add Date**: Create a new important date
  - Title (e.g., "Sarah's Birthday")
  - Date selection
  - Category (Birthday, Anniversary, Holiday, Other)
  - Notes and reminder preferences

**Categories:**
- `BIRTHDAY` - Family birthdays
- `ANNIVERSARY` - Wedding anniversaries, special dates
- `HOLIDAY` - Christmas, Thanksgiving, Valentine's Day
- `OTHER` - Custom important dates

### Wife's Wishlist

Manage gift ideas and preferences:

- **Add Item**: Add new wishlist items
  - Item name and description
  - Store/URL link
  - Price estimate
  - Priority level (High, Medium, Low)
  - Size/Color preferences

**Priority Levels:**
- `HIGH` - "I really want this!"
- `MEDIUM` - "Would be nice"
- `LOW` - "Just an idea"

### Chores & Honey-Do's

Track tasks and household responsibilities:

- **Add Chore**: Create new tasks
  - Task name
  - Description
  - Due date
  - Priority
  - Assigned to

**Chore Statuses:**
- `TODO` - Not started
- `IN_PROGRESS` - Working on it
- `COMPLETED` - Done!
- `OVERDUE` - Past due date

### Gift Orders

Track gift purchases:

- **Add Order**: Log a gift purchase
  - Store (1800flowers, Amazon, etc.)
  - Item description
  - Order number
  - Status (Ordered, Shipped, Delivered)
  - Tracking link

---

## Reminders & Ads

### Seasonal Reminders

Configure holiday and seasonal prompts:

- **Holidays**: Christmas, Valentine's Day, Mother's Day
- **Seasons**: Spring cleaning, Winter prep
- **Events**: Back to school, Tax season

Each reminder has:
- Title and message
- Start/End dates
- Frequency (One-time, Yearly)
- Enabled toggle

### Ads Management

Manage "regular guy" promotional ads:

- **Categories**: Hunting, Fishing, Tools, Sports
- **Ad Configuration**:
  - Title and image
  - Link URL
  - Display frequency
  - Active dates

---

## AI Configuration

### Greeting

Configure welcome message and initial prompts:

- **Greeting Text**: What the AI says first
- **Personality Mode**: Helpful, Firm, Gentle, or Nagging

### Voices & Languages

Select AI voice for interactions:

| Voice | Gender | Description |
|-------|--------|-------------|
| Alloy | Neutral | Balanced, professional |
| Echo | Male | Clear, authoritative |
| Nova | Female | Warm, friendly |
| Shimmer | Female | Soft, approachable |

**Languages:**
24 languages supported, all enabled by default.

### AI Config

Global AI settings:

- **Model**: GPT-4o Realtime, GPT-4o
- **Temperature**: Creativity level (0.0-2.0)
- **Max Tokens**: Response length limit
- **Assistant Mode**: Helpful, Firm, Gentle, Nagging

### AI Tools

Define tools the AI can use:

**Available Tools:**
- `order_flowers` - Order flowers from 1800flowers
- `add_reminder` - Add a new reminder
- `add_chore` - Add a chore to the list
- `add_to_wishlist` - Add item to wishlist
- `send_reminder` - Send SMS/email reminder
- `sync_calendar` - Sync with external calendar

### Knowledge Base

Upload documents for AI reference:

- Family preferences
- Gift history
- Important information

### AI Agents

Create AI personas:

| Agent | Purpose |
|-------|---------|
| Nagging Wife | Classic reminder mode |
| Helpful Helper | Friendly assistance |
| Gentle Reminder | Soft nudges |

### Functions

Custom JavaScript functions for automation:

```javascript
// Calculate days until event
function daysUntil(dateString) {
  const target = new Date(dateString);
  const today = new Date();
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
```

### Logic Rules

Automated workflows:

**Example Rules:**
| Rule | Trigger | Action |
|------|---------|--------|
| Birthday Alert | 7 days before | Send reminder |
| Overdue Chore | Past due date | Increase nag frequency |
| Gift Delivered | Status change | Mark wishlist item fulfilled |

---

## Integrations

### Webhooks

Send events to external systems:

- Slack notifications
- Calendar integration
- Smart home triggers

### SMS Settings

Configure text reminders:

- Provider (Twilio, etc.)
- From number
- Reminder timing
- Message templates

### Call Transfer

Set up transfer to real person:

- Transfer phone number
- Transfer conditions
- Escalation rules

### DTMF Menu

Phone keypad options:

| Key | Action |
|-----|--------|
| 1 | Repeat message |
| 2 | Next reminder |
| 0 | Transfer call |

### Payments

Payment processing configuration:

- Stripe integration
- PayPal settings
- Square configuration

---

## Management

### Users

Manage family members:

**Roles:**
- `SUPER_ADMIN` - Platform owner, full access
- `GROUP_ADMIN` - Family account owner
- `PARTNER` - Spouse, full family features
- `MEMBER` - Kids/relatives, limited access

**Age Verification:**
- Users have a `birthDate` field
- MEMBER users under 18 have restricted billing access

### Groups

Manage family groups:

- Create new family groups
- View group members
- Manage group settings

---

## System

### Settings

Global application settings organized in 3 tabs:

**Store Info:**
- Family name
- Description
- Contact info
- Timezone

**Branding:**
- Logo URL
- Primary/Secondary colors
- Theme customization

**Payment Gateways:**
- Enable/disable payments
- Gateway credentials
- Test mode toggles

### Features

Toggle application features:

- **FAQ Section**: Enable/disable FAQ display
- **Sticky Bar**: Promotional banner settings
- **Live Chat**: Chat widget configuration
- **Notifications**: Email, SMS, Push settings
- **Social Media**: Platform URLs and sharing

---

## Best Practices

### Important Dates Management
1. Enter dates as soon as you learn them
2. Set reminder preferences (1 week, 3 days, 1 day before)
3. Include gift ideas in notes
4. Link to wishlist items

### Wishlist Organization
1. Keep items organized by priority
2. Include specific sizes, colors, models
3. Add store links for easy ordering
4. Mark items as "ordered" when purchased

### Chore Tracking
1. Be specific with task descriptions
2. Set realistic due dates
3. Update status as you work
4. Add notes for complex tasks

### Gift Order Tracking
1. Log orders immediately after purchase
2. Include tracking numbers
3. Set delivery alerts
4. Mark as "gift wrapped" if applicable
