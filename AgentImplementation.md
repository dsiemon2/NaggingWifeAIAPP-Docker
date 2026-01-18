# Agent Implementation - NaggingWife AI

## Project Overview

**Type**: Personal Assistant App
**Purpose**: Humorous "nagging wife" AI for reminders about dates, chores, wishlists, and gift ordering

## Tech Stack

```
Backend:     Node.js + Express + TypeScript
Database:    PostgreSQL + Prisma ORM
Voice:       OpenAI Realtime API (WebSockets)
Auth:        JWT + bcrypt + Passport.js (Google/Microsoft OAuth)
Frontend:    EJS templates + Bootstrap 5 + Bootstrap Icons
Container:   Docker + Docker Compose
Port:        8089
Base Path:   /NaggingWife/
```

## Key Components

- `src/routes/admin.ts` - Admin routes with full RBAC
- `src/routes/` - User-facing routes
- `prisma/schema.prisma` - Family/user schema

## RBAC Roles (Family-themed)
- SUPER_ADMIN
- GROUP_ADMIN
- PARTNER
- MEMBER

## Key Features

- Important dates (birthdays, anniversaries)
- Wife's wishlist tracking
- Chores & honey-do list
- Gift order integration (1800flowers, Amazon)
- Seasonal reminders
- "Regular guy" ads (hunting, fishing, tools)
- Age verification (minors cannot access billing)

---

## Recommended Agents

### MUST IMPLEMENT (Priority 1)

| Agent | File | Use Case |
|-------|------|----------|
| **Backend Architect** | engineering/backend-architect.md | Reminder system, gift integrations, RBAC |
| **DevOps Automator** | engineering/devops-automator.md | Docker, PostgreSQL management |
| **AI Engineer** | engineering/ai-engineer.md | Humorous "nagging" personality, voice interaction |
| **Database Admin** | data/database-admin.md | PostgreSQL, dates/wishlist schema |
| **Security Auditor** | security/security-auditor.md | OAuth security, age verification, payment links |
| **Bug Debugger** | quality/bug-debugger.md | Reminder timing, notification issues |

### SHOULD IMPLEMENT (Priority 2)

| Agent | File | Use Case |
|-------|------|----------|
| **Frontend Developer** | engineering/frontend-developer.md | User dashboard, wishlist UI |
| **API Tester** | testing/api-tester.md | API validation, OAuth flows |
| **Code Reviewer** | quality/code-reviewer.md | TypeScript patterns |
| **UI Designer** | design/ui-designer.md | Playful but functional interface |
| **Content Creator** | marketing/content-creator.md | **Important** - Humorous nagging messages |
| **Whimsy Injector** | design/whimsy-injector.md | Fun interactions, personality |

### COULD IMPLEMENT (Priority 3)

| Agent | File | Use Case |
|-------|------|----------|
| **UX Researcher** | design/ux-researcher.md | User engagement |
| **Analytics Reporter** | studio-operations/analytics-reporter.md | Usage patterns |

---

## Agent Prompts Tailored for This Project

### Backend Architect Prompt Addition
```
Project Context:
- Humorous reminder app with "nagging wife" personality
- Features: Important dates, Wishlist, Chores, Gift ordering
- External integrations: 1800flowers, Amazon (affiliate links)
- Family-themed RBAC (PARTNER, MEMBER roles)
- Seasonal reminder logic (Valentine's, Mother's Day, etc.)
- Age verification for billing access
```

### AI Engineer Prompt Addition
```
Project Context:
- OpenAI for "nagging wife" personality
- Voice interaction with humorous, playful tone
- Reminder escalation (gentle -> insistent -> "you're in trouble")
- Gift suggestions based on wishlist
- Personality should be funny but not mean
- Example: "Honey, you forgot to take out the trash AGAIN. What am I going to do with you?"
```

### Content Creator Prompt Addition (IMPORTANT)
```
Project Context:
- Write humorous "nagging" reminder messages
- Tone: Playful, loving, but persistent
- Categories:
  - Important dates: "Her birthday is in 3 days. THREE DAYS. Do you have a gift?"
  - Chores: "The lawn isn't going to mow itself, sweetie."
  - Wishlist: "She's been eyeing that purse for weeks. Just saying..."
- Seasonal campaigns for holidays
- "Regular guy" ad copy for monetization
```

### Whimsy Injector Prompt Addition
```
Project Context:
- Add fun micro-interactions
- Playful animations for reminders
- Achievement badges ("Remembered Anniversary - 5 Year Streak!")
- Easter eggs for engaged users
- Sound effects for notifications (optional)
- Gamification: "Husband Points" system
```

---

## Marketing & Growth Agents (When Production Ready)

Add these when the project is ready for public release/marketing:

### Social Media & Marketing

| Agent | File | Use Case |
|-------|------|----------|
| **TikTok Strategist** | marketing/tiktok-strategist.md | Viral "husband fails" content, relatable humor |
| **Instagram Curator** | marketing/instagram-curator.md | Meme content, couples humor |
| **Twitter/X Engager** | marketing/twitter-engager.md | Relatable married life content |
| **Reddit Community Builder** | marketing/reddit-community-builder.md | r/marriage, r/relationships humor |
| **Content Creator** | marketing/content-creator.md | **Already recommended** - Humorous nagging messages |
| **SEO Optimizer** | marketing/seo-optimizer.md | Landing page, app store optimization |
| **Visual Storyteller** | design/visual-storyteller.md | Marketing imagery, couple scenarios |

### Growth & Analytics

| Agent | File | Use Case |
|-------|------|----------|
| **Growth Hacker** | marketing/growth-hacker.md | Viral loops, referral programs |
| **Trend Researcher** | product/trend-researcher.md | Relationship app trends |
| **Finance Tracker** | studio-operations/finance-tracker.md | Affiliate revenue, subscription metrics |
| **Analytics Reporter** | studio-operations/analytics-reporter.md | Engagement, reminder effectiveness |

---

## Not Recommended for This Project

| Agent | Reason |
|-------|--------|
| Mobile App Builder | Web-based for now |

---

## Implementation Commands

```bash
# Invoke agents from project root
claude --agent engineering/backend-architect
claude --agent engineering/ai-engineer
claude --agent marketing/content-creator  # Important for humor
claude --agent design/whimsy-injector     # Important for fun
claude --agent data/database-admin
claude --agent security/security-auditor
```
