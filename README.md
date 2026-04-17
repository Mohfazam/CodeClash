# Hackathon — [DEV ARENA]

Welcome to the official hackathon repository by [GDG,UCE-OU].
This repository serves as the starting point for all participating teams.
Title of your repository shall be : team-(your team name)

## Team Details

After forking, fill in your team details below in your fork's README

- **Team Name:** Lost Arc
- **Team Lead:** Zainab Fatima
- **Team Members:**
  - Member 1: Zainab Fatima
  - Member 2: Mohd Sarwar Khan

---


## Getting Started

### Demo Video: https://meet.google.com/pkn-msup-acq

### Step 1 — Fork this Repository
- Click the **Fork** button at the top right of this page
- Select your GitHub account to fork into
- You will be redirected to your own copy of this repository

### Step 2 — Clone your Fork Locally
```bash
git clone https://github.com/your-username/hackathon-repo
cd hackathon-repo
```

### Step 3 — Start Building
- Work on your project inside your forked repository
- Commit and push your changes regularly

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

---

## Problem Statement

Competitive programming is broken in one key way. It is a solo activity.

Developers practice on platforms like LeetCode and HackerRank, solving problems alone with no real-time competition, no meaningful feedback, and no clear measure of skill against peers.

This creates three major issues:

- No real competition  
  You solve problems, but you never know how you perform under pressure against another developer  

- Weak motivation  
  No stakes, no urgency, no reason to stay consistent  

- Poor skill visibility  
  Problem count does not reflect actual ability or decision-making under time constraints  

As a result, many developers stagnate or drop off.

---

## Solution

CodeClash turns DSA practice into a real-time competitive experience.

Two developers face the same problem at the same time. One wins. One loses.

Key features:

- Real-time 1v1 battles  
  Compete against another developer live on the same problem  

- ELO-based ranking system  
  Every match affects your rating. Skill progression is measurable  

- AI-powered insights  
  Get post-match analysis including mistakes, timing, and complexity  

- Event-driven tracking  
  Every action is logged and analyzed for deeper insights  

- Engagement mechanics  
  Features like Dead Man’s Switch prevent passive play and enforce activity  

CodeClash is not just practice. It is competition, feedback, and growth combined.

## Installation & Setup

### Prerequisites

Ensure you have the following installed:
- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14+) - [Download](https://www.postgresql.org/)
- **Git** - [Download](https://git-scm.com/)
- **npm** or **yarn** (comes with Node.js)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/CodeClash
cd CodeClash
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section below)

# Set up PostgreSQL database
# Make sure PostgreSQL is running, then create the database:
npx drizzle-kit push

# Start backend server
npm start
```

**Backend runs on:** `http://localhost:3000`

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file (if needed)
# Frontend connects to backend at http://localhost:3000

# Start development server
npm run dev
```

**Frontend runs on:** `http://localhost:3000` (development)

### Environment Variables

**Backend (.env):**
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/codeclash
NODE_ENV=development
PORT=3001

# JWT
JWT_SECRET=your-secret-key-here-min-32-chars-long

# Groq API
GROQ_API_KEY=your-groq-api-key-here

# Optional: Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Optional: CORS
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Database Setup

```bash
# Navigate to backend directory
cd backend

# Run migrations
npx drizzle-kit push

# Seed database (optional - adds sample problems)
npm run seed
```

### Verify Installation

1. **Backend Test:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return: `{ "status": "ok" }`

2. **Frontend Test:**
   Open http://localhost:3000 in your browser

---

## Deployment Guide

### Option 1: Deploy Backend to Railway (Recommended for Beginners)

Railway is the easiest option with built-in PostgreSQL support.

#### Steps:

1. **Sign Up** - Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create New Project**
   - Click "Start New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub
   - Select your CodeClash repository

3. **Add PostgreSQL**
   - In Railway dashboard, click "Add Service"
   - Select "PostgreSQL"
   - Railway automatically creates a database

4. **Configure Backend**
   - Click "Add Service" → "GitHub Repo"
   - Select the `backend` directory
   - Set environment variables:
     - `DATABASE_URL` → Will be auto-populated
     - `JWT_SECRET` → Generate a random 32+ char string
     - `GROQ_API_KEY` → Add your Groq API key
     - `NODE_ENV` → Set to "production"

5. **Deploy Frontend**
   - Similarly add frontend service (Vercel is better for frontend though)
   - Or use Railway for both

6. **Get Live URL**
   - Railway gives you a public URL like: `https://codeclash-backend-prod.up.railway.app`
   - Update frontend's `API_URL` to this URL

**Cost:** Railway offers free tier with limited usage. ~$5-10/month for production

---

### Option 2: Deploy to Vercel (Frontend) + Railway (Backend)

Best practice for full-stack apps.

#### Frontend on Vercel:

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Import Project"
4. Select your CodeClash repository
5. Configure:
   - Root directory: `./frontend`
   - Build command: `npm run build`
   - Output directory: `.next`
   - Environment: `NEXT_PUBLIC_API_URL=https://your-railway-backend-url`
6. Deploy!

#### Backend on Railway:
- Follow Option 1 steps above

**Cost:** Vercel free tier is generous. Railway ~$5/month

---

### Option 3: Deploy to Heroku (Traditional PaaS)

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Navigate to backend
cd backend

# Create Heroku app
heroku create codeclash-backend

# Add PostgreSQL add-on
heroku addons:create heroku-postgresql:hobby-dev -a codeclash-backend

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key -a codeclash-backend
heroku config:set GROQ_API_KEY=your-groq-key -a codeclash-backend
heroku config:set NODE_ENV=production -a codeclash-backend

# Create Procfile (if not exists)
echo "web: npm start" > Procfile

# Deploy
git push heroku main

# View logs
heroku logs -a codeclash-backend --tail
```

**Backend URL:** `https://codeclash-backend.herokuapp.com`

**Cost:** Heroku free tier has been discontinued. Paid plans start at $7/month

---

### Option 4: Deploy to AWS (EC2 + RDS)

More control, slightly more complex.

#### Steps:

1. **Create EC2 Instance**
   - Go to AWS console
   - EC2 → Launch Instance
   - Choose Ubuntu 22.04 LTS
   - Instance type: t3.micro (free tier eligible)
   - Configure security group:
     - Allow SSH (22)
     - Allow HTTP (80)
     - Allow HTTPS (443)
     - Allow custom TCP 3001

2. **Connect and Setup**
   ```bash
   # SSH into your instance
   ssh -i your-key.pem ubuntu@your-instance-ip

   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install Git
   sudo apt install -y git

   # Clone your repo
   git clone https://github.com/your-username/CodeClash
   cd CodeClash/backend

   # Install dependencies
   npm install

   # Create .env
   nano .env
   # Paste your environment variables

   # Create RDS PostgreSQL database (see next step)

   # Install PM2 (process manager)
   sudo npm install -g pm2

   # Start server with PM2
   pm2 start npm --name "codeclash-backend" -- start
   pm2 save
   ```

3. **Create RDS PostgreSQL Database**
   - RDS → Databases → Create database
   - Engine: PostgreSQL
   - DB instance class: db.t3.micro (free tier)
   - Set master username: postgres
   - Set master password: strong-password
   - Database name: codeclash

4. **Connect to Database**
   ```bash
   # Get RDS endpoint from AWS console
   # Update DATABASE_URL in .env:
   DATABASE_URL=postgresql://postgres:password@your-rds-endpoint:5432/codeclash

   # Run migrations
   npx drizzle-kit push
   ```

5. **Setup Reverse Proxy (Nginx)**
   ```bash
   # Install Nginx
   sudo apt install -y nginx

   # Create config file
   sudo nano /etc/nginx/sites-available/codeclash

   # Paste:
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }

   # Enable config
   sudo ln -s /etc/nginx/sites-available/codeclash /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

6. **Setup SSL Certificate (Let's Encrypt)**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

**Cost:** t3.micro EC2 + db.t3.micro RDS = ~$10-15/month

---

### Option 5: Deploy to DigitalOcean (App Platform)

Simpler than AWS, similar pricing.

#### Steps:

1. **Sign up** at [digitalocean.com](https://digitalocean.com)

2. **Create App**
   - Click "Create" → "Apps"
   - Connect GitHub repo
   - Select repository and branch

3. **Configure Service**
   - Source: GitHub repo
   - Build command: `npm install && npm run build`
   - Run command: `npm start`
   - Environment: Add your env variables

4. **Add Database**
   - Click "Create" → "Databases" → PostgreSQL
   - Cluster name: codeclash-db
   - Connect to your app

5. **Deploy**
   - Click "Deploy" button
   - Wait for build and deploy

**Cost:** $5-12/month for small app + $15/month for managed database

---

### Option 6: Deploy to Render (Simple & Affordable)

Free tier available with limited features.

#### Steps:

1. **Sign up** at [render.com](https://render.com)

2. **Connect GitHub**
   - Click "New+" → "Web Service"
   - Connect GitHub account
   - Select CodeClash repository

3. **Configure**
   - Name: codeclash-backend
   - Environment: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables

4. **Add PostgreSQL**
   - Click "New+" → "PostgreSQL"
   - Database name: codeclash
   - Connect to your web service

5. **Deploy**
   - Click "Create Web Service"
   - Render builds and deploys automatically

**Cost:** Free tier with sleep after 15 mins inactivity. $7/month for persistent instance

---

## Production Checklist

Before deploying to production, ensure:

- [ ] Environment variables are set (never commit .env)
- [ ] Database is backed up
- [ ] HTTPS is enabled
- [ ] CORS is configured for your frontend domain
- [ ] Rate limiting is enabled
- [ ] Logging is configured
- [ ] Error monitoring is set up (Sentry)
- [ ] Database connection pooling is enabled
- [ ] Caching layer is configured (Redis)
- [ ] Monitoring/uptime checks are active

### Production Environment Variables

```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:strong-password@prod-db-host:5432/codeclash
JWT_SECRET=very-long-random-secret-min-32-characters-long
GROQ_API_KEY=gsk_xxx...
STRIPE_SECRET_KEY=sk_live_...
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

---

## Monitoring & Maintenance

### Monitor Your Deployment

1. **Error Tracking** - Set up Sentry
   ```bash
   npm install @sentry/node
   ```

2. **Uptime Monitoring** - Use UptimeRobot
   - Monitor: `https://your-backend-url/health`
   - Alert if down >5 mins

3. **Database Backups**
   - Railway: Automatic daily backups
   - RDS: Enable automated backups (7 days retention)
   - Render: Automatic backups

4. **View Logs**
   - Railway: Dashboard → Logs tab
   - Heroku: `heroku logs --tail`
   - AWS: CloudWatch Logs
   - Render: Dashboard → Logs tab

### Scale as You Grow

```
Phase 1 (0-1000 users):
└─ Single server (Railway/Render free tier)
  
Phase 2 (1000-10K users):
├─ Horizontal scaling (add more servers)
├─ Redis caching layer
└─ Read replicas for database

Phase 3 (10K+ users):
├─ Kubernetes (auto-scaling)
├─ CDN for static files
└─ Dedicated database servers
```

---

## Submission Guidelines

- All code must be pushed to your **forked repository**
- Your repository must be **public**
- **Submission Deadline:** [17th april 3:59pm]

---

## 📋 Rules & Regulations

- Use of AI is permitted
- Use of open source libraries is permitted
- Plagiarism will lead to immediate disqualification
- The decision of the judges will be final

---
## Contact

For any queries, reach out to us at:
- **contact number** : [7981972900]

---

> Good luck to all participating teams! 
