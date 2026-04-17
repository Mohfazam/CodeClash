# CodeClash - Complete Deployment Guide

## Quick Decision Guide

Choose your deployment option based on your needs:

| Option | Ease | Cost | Scalability | Best For |
|--------|------|------|-------------|----------|
| **Railway** | ⭐⭐⭐ (Easiest) | $5-20/mo | Medium | Startups, MVPs, quick deployment |
| **Render** | ⭐⭐⭐ | Free-$7/mo | Medium | Free tier projects, testing |
| **Vercel + Railway** | ⭐⭐ | $5-20/mo | Medium-High | Professional full-stack apps |
| **Heroku** | ⭐⭐⭐ | $7+/mo | Medium | Traditional PaaS (outdated) |
| **AWS** | ⭐ (Complex) | $10-30/mo | Very High | Enterprise, maximum control |
| **DigitalOcean** | ⭐⭐ | $12+/mo | High | Medium-sized apps, good value |
| **Docker + Kubernetes** | ❌ (Advanced) | Variable | Unlimited | Massive scale (not needed yet) |

**Recommendation for Now:** 🚀 **Railway** or **Render** (simplest, fastest)

---

## Detailed Deployment Instructions

### Railway (Recommended - Easiest)

#### Why Railway?
- ✅ Free PostgreSQL included (other platforms charge extra)
- ✅ Auto-deploy on every GitHub push
- ✅ Built-in secrets management
- ✅ Simple dashboard
- ✅ Good for startup phase ($5-20/month)

#### Step-by-Step:

**1. Sign Up**
```
Go to: https://railway.app
Click: "Start New Project"
Authorize: GitHub access
```

**2. Create Backend Service**
```
Dashboard → "New" → "GitHub Repo"
├─ Select your CodeClash repo
├─ Specify deploy path: /backend
└─ Continue
```

**3. Add PostgreSQL Database**
```
Dashboard → "New" → "PostgreSQL"
├─ Railway auto-creates database
├─ Get DATABASE_URL from Variables tab
└─ Copy to clipboard
```

**4. Configure Environment Variables**
```
Backend Service → Variables tab → Add:

DATABASE_URL=postgresql://... (auto-populated)
JWT_SECRET=your_random_secret_here_min_32_chars
GROQ_API_KEY=gsk_your_groq_key_here
NODE_ENV=production
PORT=3001
```

**5. Add Start Script** (if not automatic)
```
Backend Service → Settings → Deploy → Run Command
Value: npm start
```

**6. Deploy**
```
Backend Service → Deploy tab → Deploy
│
└─ Railway auto-builds from GitHub
   ├─ npm install
   ├─ npm run build (if applicable)
   └─ npm start
```

**7. Get Live URL**
```
Backend Service → Settings → Domains
Example: https://codeclash-backend-prod.up.railway.app
```

**8. Connect Frontend**
```
Frontend .env.local:
NEXT_PUBLIC_API_URL=https://codeclash-backend-prod.up.railway.app
```

**9. Deploy Frontend to Vercel**
```
Go to: https://vercel.app
Import project
├─ Select your repo
├─ Root directory: ./frontend
├─ Build: npm run build
└─ Deploy
```

**10. Verify Live**
```
Open: https://your-vercel-domain.vercel.app
Should load frontend + connect to backend
```

---

### Render (Free Tier Option)

#### Why Render?
- ✅ Completely free tier with 750 free hours/month
- ✅ Auto-deploys from GitHub
- ✅ Good for testing/development
- ❌ Goes to sleep after 15 mins (free tier)
- ⚠️ Limited CPU/RAM on free tier

#### Step-by-Step:

**1. Sign Up**
```
https://render.com
Sign up with GitHub
```

**2. Create Web Service**
```
Dashboard → New → Web Service
├─ Connect GitHub
├─ Select CodeClash repo
├─ Branch: main
└─ Continue
```

**3. Configure**
```
Name: codeclash-backend
Environment: Node
Region: Select closest to users
Build Command: npm install
Start Command: npm start
Free tier: Yes (select)
```

**4. Add Environment Variables**
```
Environment → Add Variable:

DATABASE_URL=postgresql://... (see step 5)
JWT_SECRET=random_secret_32_chars
GROQ_API_KEY=your_key
NODE_ENV=production
```

**5. Create PostgreSQL Database**
```
Dashboard → New → PostgreSQL
├─ Name: codeclash-db
├─ Region: Same as web service
├─ Database: codeclash
├─ User: postgres_user
└─ Copy CONNECTION_STRING
```

**6. Deploy**
```
Web Service → Manual Deploy → Deploy latest commit
Or: Auto-deploy enabled (redeploys on GitHub push)
```

**7. Get URL**
```
Web Service → Settings → Render Domain
Example: https://codeclash-backend.onrender.com
```

---

### AWS (Full Control - More Complex)

#### Why AWS?
- ✅ Maximum control and customization
- ✅ Excellent for scaling
- ✅ Free tier eligible (first year)
- ❌ More setup required
- ❌ Easier to mess up and incur charges

#### Architecture:
```
┌─────────────────────────────────────┐
│  Route53 (DNS)                      │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Elastic Load Balancer (future)     │
└────────────┬────────────────────────┘
             │
    ┌────────▼──────────┐
    │  EC2 Instance     │
    │  (Node.js server) │
    └────────┬──────────┘
             │
    ┌────────▼──────────┐
    │  RDS PostgreSQL   │
    │  (Database)       │
    └───────────────────┘
```

#### Prerequisites:
- AWS Account (free tier available)
- Domain name (optional)
- SSH client
- AWS CLI (optional but helpful)

#### Step 1: Launch EC2 Instance

```bash
# Using AWS Console:
1. Go to: EC2 Dashboard
2. Launch Instance
3. Select: Ubuntu 22.04 LTS (Free tier eligible)
4. Instance type: t3.micro (free tier)
5. Key pair: Create new "codeclash-key.pem"
   (Download and save safely - you'll need it)
6. Network settings:
   - Allow SSH from: 0.0.0.0/0 (or your IP only)
   - Allow HTTP: 0.0.0.0/0
   - Allow HTTPS: 0.0.0.0/0
   - Add custom: TCP 3001 (backend)
7. Storage: 30GB (free tier)
8. Launch Instance
```

#### Step 2: Connect to Instance

```bash
# Make key readable
chmod 400 codeclash-key.pem

# SSH into instance
ssh -i codeclash-key.pem ubuntu@your-ec2-public-ip

# You should see:
# ubuntu@ip-172-31-42-234:~$
```

#### Step 3: Install Node.js & Dependencies

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Verify installations
node --version   # Should be v18.x
npm --version    # Should be 9.x
```

#### Step 4: Clone & Setup Backend

```bash
# Clone repository
git clone https://github.com/your-username/CodeClash.git
cd CodeClash/backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/codeclash
JWT_SECRET=$(openssl rand -base64 32)
GROQ_API_KEY=your-groq-key-here
CORS_ORIGIN=https://your-domain.com
EOF

# Run migrations
npx drizzle-kit push
```

#### Step 5: Create RDS PostgreSQL Database

```bash
# Using AWS Console:
1. Go to: RDS Dashboard
2. Create database
3. Engine: PostgreSQL
4. Version: 14.x (compatible)
5. DB instance class: db.t3.micro (free tier)
6. Storage: 20GB (free tier)
7. DB instance identifier: codeclash-db
8. Master username: postgres
9. Master password: STRONG_PASSWORD (save this!)
10. VPC: Same as your EC2 instance
11. Security group: Allow inbound from EC2 instance
12. Storage: Enable automatic backups (7 days)
13. Create database

# Get endpoint
4. Go to RDS → Databases → codeclash-db
5. Copy Endpoint (something like: codeclash-db.c9akciq32.us-east-1.rds.amazonaws.com)
```

#### Step 6: Connect EC2 to RDS

```bash
# Test connection
psql -h codeclash-db.c9akciq32.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d codeclash

# If prompted for password, enter your RDS password
# Should connect successfully
```

#### Step 7: Start Backend with PM2

```bash
# In backend directory
cd ~/CodeClash/backend

# Start with PM2
pm2 start npm --name "codeclash" -- start

# Check status
pm2 status

# Save for auto-restart
pm2 save

# Enable auto-start on reboot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# View logs
pm2 logs codeclash
```

#### Step 8: Setup Nginx Reverse Proxy

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/codeclash > /dev/null << EOF
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (we'll add these next)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable configuration
sudo ln -s /etc/nginx/sites-available/codeclash /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 9: Add SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal should be configured automatically
# Verify:
sudo systemctl list-timers | grep certbot
```

#### Step 10: Point Domain to EC2

```
In your domain registrar (GoDaddy, Namecheap, etc):
1. Go to DNS settings
2. Create A record:
   Name: your-domain.com
   Type: A
   Value: Your-EC2-Public-IP-Address
   TTL: 3600

3. Create A record:
   Name: www
   Type: A
   Value: Your-EC2-Public-IP-Address
   TTL: 3600

Wait 5-15 minutes for DNS propagation
```

#### Step 11: Verify Deployment

```bash
# Check backend is running
curl https://your-domain.com/api/health
# Should return: {"status":"ok"}

# Check logs
pm2 logs codeclash

# Monitor performance
pm2 monit
```

#### Step 12: Setup Auto-Backups

```bash
# RDS automatically backs up (7 days retention by default)

# For additional safety, set up automated snapshots:
# AWS Console → RDS → Automated backups → Edit
# → Backup retention period: 30 days
# → Copy automated backups to another region (optional)
```

#### Step 13: Monitor & Maintain

```bash
# Set up CloudWatch alarms
AWS Console → CloudWatch → Alarms → Create Alarm
├─ Monitor: CPU utilization, disk space
├─ Alert: Send email if >80% usage
└─ Action: Auto-scale (if using load balancer)

# View logs
AWS Console → EC2 → Instances → codeclash
└─ Connect → EC2 Instance Connect
   $ pm2 logs codeclash

# Update code
cd ~/CodeClash/backend
git pull origin main
npm install
npm start  # PM2 restarts it automatically
```

#### AWS Estimated Costs (Free Tier Year 1)

```
Free Tier (12 months):
├─ EC2 t3.micro: FREE (750 hrs/month)
├─ RDS db.t3.micro: FREE (750 hrs/month)
├─ Data transfer: FREE (1GB/month)
└─ TOTAL: $0

After free tier (estimated):
├─ EC2 t3.micro: $10/month
├─ RDS db.t3.micro: $10/month
├─ Data transfer: $1-5/month
├─ Backups: $1-3/month
└─ TOTAL: ~$22-28/month
```

---

### DigitalOcean (Good Value)

#### Why DigitalOcean?
- ✅ Simple, clean interface
- ✅ Good pricing ($5-15/month)
- ✅ App Platform (simpler than AWS)
- ✅ 1-click deployments
- ✅ Managed PostgreSQL available

#### Step-by-Step:

**1. Sign Up**
```
https://digitalocean.com
Use code: MAKE2024 (may get $200 credit)
```

**2. Create App**
```
Dashboard → Apps → Create App
├─ Connect GitHub
├─ Select CodeClash repo
├─ Region: Closest to users
└─ Continue
```

**3. Configure Service**
```
Source → GitHub
├─ Repo: CodeClash
├─ Branch: main
├─ Source type: Dockerfile (or Node.js)
└─ Build from path: /backend
```

**4. Set Build Command**
```
Build command: npm install
Run command: npm start
HTTP Port: 3001
```

**5. Add Environment**
```
Environment → Add:
├─ DATABASE_URL
├─ JWT_SECRET
├─ GROQ_API_KEY
├─ NODE_ENV=production
└─ PORT=3001
```

**6. Add Database Component**
```
Components → Add → PostgreSQL
├─ Version: 14.x
├─ Size: Basic ($15/mo)
└─ Cluster name: codeclash-db
```

**7. Link Database**
```
Web service → Environment → DATABASE_URL
← Auto-populated from PostgreSQL component
```

**8. Deploy**
```
Create App → Wait for build/deploy
Takes ~2-3 minutes
```

**9. Get URL**
```
App overview → Live URL
Example: https://codeclash-backend-xyz.ondigitalocean.app
```

**10. Update Frontend**
```
NEXT_PUBLIC_API_URL=https://codeclash-backend-xyz.ondigitalocean.app
Deploy to Vercel
```

#### DigitalOcean Costs
```
App Platform: $12/month minimum
Database (PostgreSQL): $15/month
├─ Or use included managed DB (cheaper)
TOTAL: ~$12-20/month
```

---

## Frontend Deployment Options

### Option 1: Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Go to Vercel
https://vercel.com

# Import project
1. Click "New Project"
2. Select your CodeClash repo
3. Configure:
   Root: ./frontend
   Build: npm run build
   Output: .next (Next.js default)
   Environment:
   ├─ NEXT_PUBLIC_API_URL=your-backend-url
   └─ Vercel auto-detects Next.js
4. Deploy

# Done! Automatic preview + production deployments
# Every push to main = auto-deploy
```

**Cost:** Free tier very generous. $20/month for pro features

### Option 2: Netlify

```bash
# Same as Vercel
1. https://netlify.com
2. Sign up with GitHub
3. New site → Select repo
4. Build settings:
   Build command: npm run build
   Publish directory: .next
5. Deploy
```

**Cost:** Free tier with limitations. $19+/month for pro

### Option 3: GitHub Pages (Static Only)

Only works if frontend is pure static (not Next.js server)

```bash
# Not recommended for CodeClash (Next.js needs server)
# Use Vercel or Netlify instead
```

---

## Troubleshooting Deployments

### Backend Won't Start

**Problem: "Cannot find module"**
```bash
# Solution: Dependencies not installed
npm install

# or on server:
ssh into instance
cd backend
npm install
npm start
```

**Problem: "Database connection refused"**
```bash
# Check DATABASE_URL is correct
echo $DATABASE_URL

# Verify database is running/accessible
# Test connection:
psql -h your-db-host -U postgres -d codeclash -c "SELECT 1"

# Check firewall allows DB port 5432
```

**Problem: "Port already in use"**
```bash
# Check what's using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

### Frontend Won't Connect to Backend

**Problem: "Failed to fetch from API"**
```
Frontend console error: 
CORS error or network error

Solution:
1. Check NEXT_PUBLIC_API_URL is set correctly
2. Check backend CORS_ORIGIN matches frontend URL
3. Verify backend is actually running:
   curl https://backend-url/api/health
```

**Problem: "Mixed Content Error"**
```
Frontend: https://yoursite.com
Backend: http://backend.com (not https)

Solution: Backend MUST use HTTPS
Update DATABASE_URL to use https:// protocol
```

### Database Issues

**Problem: "Too many connections"**
```
DB has max connections reached

Solution:
1. Increase connection pool size
2. Enable connection pooling (PgBouncer)
3. Upgrade database tier
```

**Problem: "Disk space full"**
```
RDS database full

Solution:
1. Check: SELECT pg_size_pretty(pg_database_size(current_database()));
2. Delete old logs/events
3. Upgrade storage
```

---

## Monitoring Your Deployment

### Essential Monitoring

**1. Uptime Monitoring**
```
Tool: UptimeRobot (free)
URL: https://your-backend.com/api/health
Check every: 5 minutes
Alert: Email if down >5 mins
```

**2. Error Tracking**
```
Tool: Sentry (free tier)

npm install @sentry/node

In index.ts:
import * as Sentry from "@sentry/node";
Sentry.init({
  dsn: "your-sentry-dsn",
  tracesSampleRate: 1.0,
});
```

**3. Performance Monitoring**
```
Tool: New Relic (free tier)

Monitors:
├─ Response time
├─ Throughput
├─ Error rate
└─ Resource usage
```

**4. Logs Aggregation**
```
Tool: LogRocket, Datadog, or cloud provider's logs

View all logs from:
├─ Application
├─ Server
├─ Database
└─ Errors in one place
```

### Critical Alerts

Set up alerts for:
- ❌ Downtime (backend offline)
- 🔴 High error rate (>5% errors)
- 💾 Disk space low (<10% remaining)
- 📊 High CPU (>80%)
- 🐢 Slow response time (>2s)
- 🔐 Authentication failures

---

## Scaling as You Grow

### When to Scale

```
Phase 1: <1000 users
├─ Single server (Railway/Render)
├─ Single database
└─ No caching needed

Phase 2: 1000-10K users
├─ Load balancer (2-3 servers)
├─ Redis caching layer
├─ Database read replicas
└─ CDN for static assets

Phase 3: 10K-100K users
├─ Kubernetes (auto-scaling)
├─ Dedicated database cluster
├─ Message queues (for heavy jobs)
└─ Full CDN + regions
```

### Horizontal Scaling (Add More Servers)

```bash
# Current: 1 server = 100 concurrent users

# With load balancer:
Server 1 ─┐
          ├─ Load Balancer ─ Database
Server 2 ─┤
Server 3 ─┘

# Result: 300 concurrent users (3x)
```

### Vertical Scaling (Bigger Server)

```
Upgrade from t3.micro to t3.small to t3.medium
Each level = 2x more CPU/memory
Downtime: Usually none (cloud providers handle gracefully)
```

### Caching with Redis

```typescript
// Before: Each request queries database
const leaderboard = await db.query('SELECT * FROM users ORDER BY elo DESC');

// After: Cache results for 1 minute
const leaderboard = await redis.get('leaderboard');
if (!leaderboard) {
  leaderboard = await db.query('SELECT * FROM users ORDER BY elo DESC');
  await redis.set('leaderboard', leaderboard, 'EX', 60); // 60 sec
}
return leaderboard;

// Result: 10x faster, 10x less database load
```

---

## Disaster Recovery

### Backup Strategy

**Database Backups:**
```
Frequency: Daily
Retention: 30 days
Testing: Monthly restore test
Location: Different region (for disaster recovery)

Commands:
# Manual backup
pg_dump -h your-db-host -U postgres codeclash > backup.sql

# Restore from backup
psql -h new-db-host -U postgres -d codeclash < backup.sql
```

**Code Backups:**
```
Git is your code backup
├─ Main branch = production
├─ Multiple copies on GitHub
└─ Code can be re-deployed anytime
```

### Disaster Recovery Plan

```
Scenario: Production server crashes

Recovery steps:
1. Create new server (takes 5 mins)
2. Point DNS to new server
3. Restore database from backup (5-10 mins)
4. Deploy code (git pull) (2-3 mins)
5. Total downtime: ~15 minutes

To minimize downtime:
├─ Use multi-region deployment
├─ Use load balancer (automatic failover)
├─ Keep recent backups
└─ Test recovery monthly
```

---

## Cost Optimization

### Reduce Your Monthly Bill

```
Current setup (Railway):
├─ Backend service: $5-7/mo
├─ PostgreSQL: $15/mo
└─ TOTAL: ~$20-22/mo

Ways to reduce:
1. Use Render free tier (0-7/mo)
2. Use SQLite initially (0/mo, then migrate)
3. Use auto-scaling (pay for what you use)
4. Buy annual plans (30% discount)

Optimized cost:
├─ Backend: Free (Render)
├─ Frontend: Free (Vercel)
├─ Database: $7/mo (Render)
└─ TOTAL: $7/mo until users scale up
```

---

## Production Checklist

Before going live to real users:

### Security
- [ ] HTTPS/SSL certificate configured
- [ ] Environment variables not in code
- [ ] Database password not shared
- [ ] JWT secret is random 32+ characters
- [ ] CORS configured for your frontend domain only
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] No console logs with sensitive data
- [ ] Database backups enabled

### Performance
- [ ] Database indexes on frequently queried columns
- [ ] Connection pooling enabled
- [ ] Caching layer configured (Redis)
- [ ] CDN for static assets (optional for now)
- [ ] Load testing done (simulating 100+ concurrent users)
- [ ] Response time <500ms (p99)

### Reliability
- [ ] Error monitoring set up (Sentry)
- [ ] Uptime monitoring set up (UptimeRobot)
- [ ] Automated backups enabled
- [ ] Logs aggregation configured
- [ ] Health check endpoint (/api/health)
- [ ] Graceful shutdown on SIGTERM
- [ ] Process manager configured (PM2/systemd)

### Operations
- [ ] Documentation for deployments
- [ ] Runbook for common issues
- [ ] On-call escalation policy
- [ ] Status page for users
- [ ] Regular backup restoration tests
- [ ] Database size monitoring

---

## Getting Help

### Useful Resources

**Railway:**
- Docs: https://docs.railway.app
- Community: https://community.railway.app
- Discord: https://discord.gg/railway

**AWS:**
- EC2 Guide: https://docs.aws.amazon.com/ec2/
- RDS Guide: https://docs.aws.amazon.com/rds/
- AWS Free Tier: https://aws.amazon.com/free

**DigitalOcean:**
- Docs: https://docs.digitalocean.com
- Community: https://www.digitalocean.com/community

**Vercel:**
- Docs: https://vercel.com/docs
- Support: https://vercel.com/support

### Debugging Tools

```bash
# Check server status
curl https://your-domain.com/api/health

# Check logs
pm2 logs codeclash

# Check database connection
psql -h your-db-host -U postgres -d codeclash

# Check port availability
lsof -i :3001

# Monitor system resources
top
df -h
free -h
```

---

*Last updated: April 2026*
*Deployment guide version: 2.0*
