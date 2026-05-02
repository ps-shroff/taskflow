# ⚡ TaskFlow — Team Task Manager

A full-stack team task management app with role-based access control. Built with Node.js, Express, Prisma (SQLite), and a vanilla JS SPA frontend.

## 🚀 Live Demo

> **[https://your-app.railway.app](https://your-app.railway.app)** ← Replace after deployment

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Authentication | JWT-based signup/login with bcrypt password hashing |
| 👥 Role-Based Access | Global Admin / Member + per-project Admin / Member roles |
| 📁 Projects | Create, edit, delete projects; manage members |
| ✅ Tasks | Create, assign, update status/priority/due date; delete |
| 📊 Dashboard | Live stats: total projects, tasks by status, overdue count |
| ⚠️ Overdue Detection | Tasks past due date highlighted in red |
| 🗂️ Kanban Board | Toggle between table and kanban view |
| 🔎 Filters | Filter tasks by status, priority, assignee |
| 🛡️ Admin Panel | Promote/demote users (global admin only) |
| 📱 Responsive | Works on mobile and desktop |

---

## 🏗️ Tech Stack

- **Backend**: Node.js + Express
- **ORM**: Prisma
- **Database**: SQLite (dev) / PostgreSQL (prod via Railway)
- **Auth**: JWT + bcryptjs
- **Frontend**: Vanilla HTML/CSS/JS (no build step, served by Express)

---

## 📦 Project Structure

```
taskflow/
├── prisma/
│   └── schema.prisma       # DB schema (User, Project, Task, ProjectMember)
├── src/
│   ├── index.js            # Express entry point
│   ├── middleware/
│   │   └── auth.js         # JWT + RBAC middleware
│   └── routes/
│       ├── auth.js         # POST /signup, /login, GET /me
│       ├── projects.js     # CRUD projects + member management
│       ├── tasks.js        # CRUD tasks with access checks
│       ├── users.js        # List users, change global role
│       └── dashboard.js    # Aggregated stats
├── public/
│   └── index.html          # Full SPA frontend
├── Dockerfile
├── railway.json
└── README.md
```

---

## 🔐 Role-Based Access Control

### Global Roles
| Permission | Admin | Member |
|---|---|---|
| See all projects/tasks | ✅ | ❌ |
| Change user roles | ✅ | ❌ |
| Delete any project | ✅ | ❌ |

### Project-Level Roles
| Permission | Project Admin/Owner | Project Member |
|---|---|---|
| Add/remove members | ✅ | ❌ |
| Edit/delete project | ✅ | ❌ |
| Create/edit/delete tasks | ✅ | Own tasks only |
| Update task status | ✅ | Assigned tasks |

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/taskflow.git
cd taskflow

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env: set JWT_SECRET to a strong random string

# 4. Initialize database
npm run setup
# (runs: prisma generate + prisma db push)

# 5. Start development server
npm run dev
# App runs on http://localhost:3000
```

> 💡 **First user to sign up automatically becomes Admin.**

---

## 🌐 Deploy to Railway

### Option 1: Railway CLI (fastest)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variables
railway variables set JWT_SECRET="your-strong-secret-key-here"
railway variables set DATABASE_URL="file:./prod.db"

# Deploy
railway up
```

### Option 2: GitHub + Railway Dashboard

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables:
   - `JWT_SECRET` = any strong random string (e.g. `openssl rand -base64 32`)
   - `DATABASE_URL` = `file:./prod.db`
5. Railway auto-detects the Dockerfile and deploys!

### Using PostgreSQL on Railway (recommended for production)

1. In Railway dashboard → Add Plugin → PostgreSQL
2. Railway auto-injects `DATABASE_URL` as a Postgres connection string
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Redeploy — Prisma handles the rest

---

## 📡 API Reference

### Auth
```
POST /api/auth/signup    { name, email, password }
POST /api/auth/login     { email, password }
GET  /api/auth/me        (requires Bearer token)
```

### Projects
```
GET    /api/projects
POST   /api/projects                  { name, description }
GET    /api/projects/:id
PUT    /api/projects/:id              { name, description, status }
DELETE /api/projects/:id
POST   /api/projects/:id/members      { userId, role }
DELETE /api/projects/:id/members/:uid
```

### Tasks
```
GET    /api/tasks?projectId=&status=&priority=&assigneeId=
POST   /api/tasks        { title, description, projectId, assigneeId, priority, status, dueDate }
GET    /api/tasks/:id
PUT    /api/tasks/:id    { title, description, status, priority, assigneeId, dueDate }
DELETE /api/tasks/:id
```

### Dashboard & Users
```
GET /api/dashboard
GET /api/users
PUT /api/users/:id/role   { role: "ADMIN"|"MEMBER" }
```

---

## 📹 Demo Video Script (2-5 min)

1. Sign up as first user (auto-Admin) → show Admin badge
2. Create a project, add description
3. Invite another user as Member
4. Create tasks with different priorities/due dates
5. Show Kanban view → drag-equivalent status changes
6. Show "My Tasks" page with overdue highlighting
7. Show Admin panel → promote a user
8. Login as Member → show restricted access

---

## 📝 License

MIT
