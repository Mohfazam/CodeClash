# CodeClash - Comprehensive Development Documentation

**Last Updated:** April 18, 2026 (v2.0 - Major Feature Release)  
**Status:** Active Development - Hackathon Ready  
**Team:** Lost Arc (Zainab Fatima, Mohd Sarwar Khan)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Backend API Endpoints](#backend-api-endpoints)
6. [Frontend Structure](#frontend-structure)
7. [Real-Time Features (Socket.IO)](#real-time-features)
8. [AI Integration](#ai-integration)
9. [Development Guide](#development-guide)
10. [Environment Variables](#environment-variables)
11. [Common Workflows](#common-workflows)

---

## Project Overview

**CodeClash** is a real-time 1v1 competitive coding platform where two developers race to solve coding problems under time pressure. The platform features:

- **Real-time competitive matches** with live timers
- **ELO-based ranking system** for skill-based matchmaking
- **AI-powered insights** including hints and complexity analysis
- **Dead Man's Switch** engagement mechanic (prevents idle players from blocking matches)
- **Topic-based performance tracking** with win/loss heatmaps
- **Global leaderboard** with rankings
- **Match event logging** for postgame analysis
- **Support for 4 programming languages** (JavaScript, Python, C++, Java)

### Key Features

✅ User authentication with JWT tokens (7-day expiry)  
✅ Create/join rooms with code-based invites (6-character codes)  
✅ Live match timer with remaining time display (MM:SS, color-coded urgency)  
✅ Code editor with syntax awareness (LeetCode-style editor-first layout)  
✅ Real-time opponent activity indicators (typing, idle, submissions)  
✅ AI-powered hints (non-spoiling suggestions in modal)  
✅ **Live AI commentary during matches** (Groq-powered, real-time commentary stream)  
✅ Post-match complexity analysis (deferred until match ends)  
✅ ELO calculation after each match (K-factor: 32, Glicko-inspired)  
✅ Topic-specific performance stats with last 5 match outcomes  
✅ Postgame debrief with detailed insights and performance comparison  
✅ Problems browser with filtering by difficulty and topic  
✅ Public user profiles with edit capabilities  
✅ Global leaderboard with pagination  
✅ **Dead Man's Switch** (auto-remove idle players, visual warnings)  
✅ **Room customization** (blind rating, spectators, time limit, difficulty, topic)  
✅ **Achievement/Badge system** (First Victory, Consistent, Specialist, Battle Veteran)  
✅ No emoji usage (professional, clean UI with styled badges/symbols)

---

## Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | Latest | Runtime |
| Express.js | 5.2.1 | HTTP framework |
| TypeScript | Latest | Type safety |
| PostgreSQL | 14+ | Primary database |
| Drizzle ORM | 0.45.2 | Database ORM |
| Socket.IO | 4.8.3 | Real-time communication |
| JWT | 9.0.2 | Authentication tokens |
| bcrypt | 6.0.0 | Password hashing (salt rounds: 12) |
| Zod | 4.3.6 | Request validation |
| Groq API | Latest | AI model (llama-3.3-70b-versatile) |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.4 | React framework with app router |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Socket.IO Client | 4.8.3 | Real-time client |
| Geist Fonts | Latest | Typography |

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Frontend  │ (Next.js + React)
│  (Browser)  │
└──────┬──────┘
       │
       ├─── HTTP Requests ───┐
       │                     │
       │   WebSocket        │ HTTP
       │   (Socket.IO)      │ (REST)
       │                     │
       └─────────┬───────────┘
                 │
          ┌──────▼──────┐
          │   Backend   │ (Express.js)
          │  (Port 5000)│
          └──────┬──────┘
                 │
          ┌──────▼──────────┐
          │  PostgreSQL      │
          │  (Port 5432)     │
          └─────────────────┘
                 │
          ┌──────▼──────────┐
          │  Groq API (AI)   │
          │  (External)      │
          └─────────────────┘
```

### Authentication Flow

```
1. User registers/logs in
   └─> Backend validates credentials
       └─> Returns JWT token (7-day expiry)
           └─> Frontend stores in localStorage + HTTP-only cookie
               └─> All requests include "Authorization: Bearer <token>"

2. Socket.IO connection
   └─> Client emits with JWT
       └─> Server validates JWT
           └─> Establishes authenticated WebSocket
```

---

## Database Schema

### Tables Overview

```
users
├─ id (PK)
├─ username (unique)
├─ email (unique)
├─ passwordHash (bcrypt)
├─ elo (int, default 1200)
├─ codeDna (JSONB)
├─ metadata (JSONB: avatar_url, college, bio)
└─ timestamps (createdAt, updatedAt)

rooms
├─ id (PK)
├─ roomCode (6-char, unique)
├─ hostId (FK → users)
├─ guestId (FK → users, nullable)
├─ status (enum: waiting|ready|active|done)
├─ options (JSONB: time_limit, difficulty, topic, features)
└─ timestamps

problems
├─ id (PK)
├─ title, slug (unique)
├─ difficulty (enum: easy|medium|hard)
├─ topics (array)
├─ companyTags (array)
├─ description, constraints
├─ examples (JSONB array)
├─ testCases (JSONB array: input, expected_output, is_hidden)
├─ starterCode (JSONB: language → code)
├─ editorial, metadata
└─ createdAt

matches
├─ id (PK)
├─ roomId (FK)
├─ problemId (FK)
├─ player1Id (FK → users)
├─ player2Id (FK → users)
├─ winnerId (FK → users, nullable)
├─ status (enum: active|finished|abandoned)
├─ startedAt, endedAt (timestamps)
├─ metadata (JSONB: spectator_count, final_scores)
└─ createdAt

submissions
├─ id (PK)
├─ matchId (FK)
├─ userId (FK)
├─ code (text)
├─ language (varchar: javascript|python|cpp|java)
├─ verdict (enum: accepted|wrong_answer|timeout|runtime_error|compilation_error|pending)
├─ runtimeMs, memoryKb
├─ testCasesPassed, testCasesTotal
├─ complexity (JSONB: time, space, ai_note, explanation)
├─ isFinal (boolean)
└─ submittedAt

matchEvents (Append-only log)
├─ id (PK)
├─ matchId (FK)
├─ userId (FK, nullable)
├─ eventType (varchar: match_start|code_change|submission|accepted|idle_warning|lines_deleted|surrender|match_end|ai_comment)
├─ payload (JSONB, flexible)
└─ createdAt (indexed)

eloHistory (Immutable)
├─ id (PK)
├─ userId (FK)
├─ matchId (FK)
├─ opponentId (FK, nullable)
├─ oldElo, newElo, delta (int)
└─ createdAt

topicStats
├─ id (PK)
├─ userId, topic (unique constraint)
├─ wins, losses
├─ avgSolveTimeMs
├─ last5Outcomes (array: W|L)
├─ metadata (JSONB)
└─ updatedAt
```

---

## Backend API Endpoints

### Authentication

#### `POST /api/auth/register`
Register a new user

**Request:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (8+ chars)"
}
```

**Response (201):**
```json
{
  "user": { "id": "uuid", "username": "string", "elo": 1200 },
  "token": "jwt_token"
}
```

#### `POST /api/auth/login`
Log in a user

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "user": { "id": "uuid", "username": "string", "elo": number },
  "token": "jwt_token"
}
```

#### `GET /api/auth/me`
Get authenticated user profile

**Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "elo": number,
  "metadata": { "avatar_url": "?", "college": "?", "bio": "?" },
  "codeDna": { "weak_topics": [], "patterns": [], "ai_summary": "?" },
  "createdAt": "ISO8601"
}
```

---

### Rooms

#### `POST /api/rooms`
Create a new room

**Auth:** Required  
**Request:**
```json
{
  "options": {
    "difficulty": "easy|medium|hard",
    "topic": "string or null",
    "time_limit_minutes": number,
    "dead_mans_switch": { "enabled": boolean, "idle_seconds": 45 },
    "blind_rating": { "enabled": boolean },
    "live_commentator": boolean,
    "spectators_allowed": boolean
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "roomCode": "6-char code",
  "hostId": "uuid",
  "guestId": null,
  "status": "waiting",
  "options": { ... },
  "createdAt": "ISO8601"
}
```

#### `GET /api/rooms/:code`
Get room details by code

**Response (200):**
```json
{
  "id": "uuid",
  "roomCode": "6-char",
  "hostId": "uuid",
  "guestId": "uuid or null",
  "status": "waiting|ready|active|done",
  "options": { ... },
  "host": { "id": "uuid", "username": "string", "elo": number },
  "guest": { "id": "uuid", "username": "string", "elo": number } or null,
  "createdAt": "ISO8601"
}
```

#### `POST /api/rooms/:code/join`
Join a room as guest

**Auth:** Required  
**Response (200):** Same as GET /api/rooms/:code

---

### Matches

#### `GET /api/matches/history?limit=20&offset=0`
Get user's match history

**Auth:** Required  
**Response (200):**
```json
{
  "matches": [
    {
      "id": "uuid",
      "result": "win|loss|draw",
      "eloDelta": number,
      "problem": { "title": "string", "difficulty": "string" },
      "opponent": { "username": "string", "elo": number }
    }
  ]
}
```

#### `GET /api/matches/:id`
Get match details

**Auth:** Required  
**Response (200):**
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "problemId": "uuid",
  "player1Id": "uuid",
  "player2Id": "uuid",
  "winnerId": "uuid or null",
  "status": "active|finished|abandoned",
  "startedAt": "ISO8601",
  "endedAt": "ISO8601 or null",
  "metadata": { "spectator_count": number, "final_scores": { "p1": number, "p2": number } },
  "problem": { "title": "string", "difficulty": "string", ... complete problem object },
  "player1": { "id": "uuid", "username": "string", "elo": number },
  "player2": { "id": "uuid", "username": "string", "elo": number }
}
```

#### `POST /api/matches/:id/surrender`
Surrender current match

**Auth:** Required  
**Response (200):**
```json
{ "message": "Match surrendered" }
```

---

### Submissions

#### `POST /api/submissions`
Submit code for a match

**Auth:** Required  
**Request:**
```json
{
  "matchId": "uuid",
  "code": "string (source code)",
  "language": "javascript|python|cpp|java"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "matchId": "uuid",
  "userId": "uuid",
  "language": "string",
  "verdict": "accepted|wrong_answer|time_limit_exceeded|runtime_error|compilation_error|pending",
  "runtimeMs": number or null,
  "memoryKb": number or null,
  "testCasesPassed": number,
  "testCasesTotal": number,
  "complexity": { "time": "string", "space": "string", "ai_note": "string", "explanation": "string" },
  "isFinal": boolean,
  "submittedAt": "ISO8601"
}
```

---

### Problems

#### `GET /api/problems?difficulty=easy&topic=arrays&limit=20&offset=0`
List problems with filters

**Response (200):**
```json
{
  "problems": [
    {
      "id": "uuid",
      "title": "string",
      "slug": "string",
      "difficulty": "easy|medium|hard",
      "topics": ["string"],
      "description": "string",
      "constraints": "string or null",
      "examples": [{ "input": "string", "output": "string", "explanation": "string?" }],
      "starterCode": { "javascript": "string", ... },
      "createdAt": "ISO8601"
    }
  ],
  "total": number
}
```

#### `GET /api/problems/random?difficulty=medium&topic=arrays`
Get a random problem (hides hidden test cases)

**Response (200):** Same problem object structure

#### `GET /api/problems/:slug`
Get problem by slug

**Response (200):** Same problem object structure

---

### Users

#### `GET /api/users/me/stats`
Get authenticated user's detailed stats

**Auth:** Required  
**Response (200):**
```json
{
  "wins": number,
  "losses": number,
  "totalMatches": number,
  "eloHistory": [
    { "delta": number, "createdAt": "ISO8601" }
  ],
  "topicStats": [
    {
      "topic": "string",
      "wins": number,
      "losses": number,
      "avgSolveTimeMs": number or null,
      "last5Outcomes": ["W", "L", "W"]
    }
  ]
}
```

#### `PATCH /api/users/me`
Update authenticated user's profile

**Auth:** Required  
**Request:**
```json
{
  "metadata": {
    "avatar_url": "string (URL)?",
    "college": "string?",
    "bio": "string?"
  }
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "elo": number,
  "metadata": { ... updated },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

#### `GET /api/users/:username`
Get public user profile

**Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "elo": number,
  "metadata": { ... },
  "codeDna": { ... },
  "createdAt": "ISO8601"
}
```

#### `GET /api/users/:username/stats`
Get public user stats

**Response (200):** Same as GET /api/users/me/stats

---

### Leaderboard

#### `GET /api/leaderboard?limit=50&offset=0`
Get global ELO rankings

**Response (200):**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "string",
      "elo": number,
      "wins": number,
      "losses": number,
      "totalMatches": number
    }
  ],
  "total": number
}
```

---

### AI Features

#### `POST /api/ai/hint`
Get a non-spoiling hint for a problem

**Auth:** Required  
**Request:**
```json
{
  "problem_title": "string",
  "problem_description": "string",
  "current_code": "string",
  "difficulty": "easy|medium|hard",
  "topics": ["string"]
}
```

**Response (200):**
```json
{
  "hint": "2-3 sentence non-spoiling hint"
}
```

#### `POST /api/ai/analyze`
Analyze code complexity

**Auth:** Required  
**Request:**
```json
{
  "code": "string (source code)",
  "language": "javascript|python|cpp|java"
}
```

**Response (200):**
```json
{
  "time": "O(n log n)",
  "space": "O(n)",
  "ai_note": "Brief observation about the algorithm",
  "explanation": "2-3 sentence breakdown"
}
```

---

## Frontend Structure

### Directory Layout

```
frontend/src/
├── app/
│   ├── layout.tsx                 (Root layout)
│   ├── providers.tsx              (Auth context wrapper)
│   ├── page.tsx                   (Home/landing)
│   ├── login/page.tsx             (Login form)
│   ├── register/page.tsx          (Registration form)
│   └── (protected)/               (Requires authentication)
│       ├── layout.tsx             (App shell with nav)
│       ├── dashboard/page.tsx     (User dashboard - stats, recent matches)
│       ├── leaderboard/page.tsx   (Global rankings with pagination)
│       ├── problems/page.tsx      (Browse & filter problems by difficulty/topic)
│       ├── profile/[username]/page.tsx     (Public user profile & stats)
│       ├── room/
│       │   ├── new/page.tsx       (Create/join room form)
│       │   └── [code]/page.tsx    (Room waiting area with countdown)
│       ├── battle/[matchId]/page.tsx      (Live coding arena - editor-first layout)
│       └── matches/[matchId]/debrief/page.tsx (Post-match analysis with complexity)
├── components/
│   ├── auth/
│   │   ├── auth-provider.tsx      (Auth context + hooks)
│   │   └── auth-gate.tsx          (Route protection + redirects)
│   ├── layout/
│   │   └── app-shell.tsx          (Header with nav, user info)
│   └── ui/
│       ├── button.tsx             (Reusable button)
│       ├── card.tsx               (Reusable card)
│       └── input.tsx              (Reusable input)
├── lib/
│   ├── api.ts                     (HTTP client with auth)
│   ├── socket.ts                  (Socket.IO client initialization)
│   ├── auth-storage.ts            (JWT persistence: localStorage + cookie)
│   ├── config.ts                  (API & Socket URLs from env)
│   └── types.ts                   (TypeScript interfaces for API responses)
└── styles/
    └── globals.css                (Tailwind CSS + custom tokens)
```

### Key Hooks & Contexts

#### `useAuth()`
```typescript
const { 
  user,           // Current user object (AuthUser | null)
  token,          // JWT token (string | null)
  loading,        // Initial loading state (boolean)
  login,          // (email, password) => Promise<void>
  register,       // (username, email, password) => Promise<void>
  logout,         // () => void
  refreshMe       // () => Promise<void>
} = useAuth();
```

---

### Pages & Features

#### Dashboard (`/dashboard`)

**Purpose:** User's personal hub showing stats and recent battles

**Features:**
- Current ELO rating display (prominently)
- Wins/Losses cards with win rate percentage
- Total matches counter
- 6 recent battles in reverse chronological order
  - Problem title, opponent, result badge, difficulty, ELO delta
  - Clickable to view debrief
- Quick action buttons:
  - Start Battle (green)
  - View Leaderboard (blue)
  - Browse Problems (purple)
  - View Profile (purple)
- ELO history chart (bar graph of last 10 matches)
- Links to leaderboard and profile from stats
- No emoji usage (clean text labels)

**API Calls:**
- `GET /api/users/me/stats` - Load user stats
- `GET /api/matches/history?limit=6&offset=0` - Load recent matches

---

#### Battle Page (`/battle/[matchId]`)

**Purpose:** Live coding arena during an active match

**Layout (Editor-First Design):**
- **Header (top):**
  - Problem title, difficulty badge, topics
  - **Right side:** Large timer display (MM:SS format, colored urgency)
  - Red when < 1min, yellow when < 5min, white otherwise
- **Error/event alert bars** (below header)
- **Main flex layout (h-screen flex flex-col):**
  - **Editor area (70% of screen, flex-1):**
    - Language selector + Action buttons (Get Hint, Submit, Surrender)
    - Large code editor textarea (full height, mono font, dark background #090b10)
    - Compact submissions history at bottom (max-h-24, scrollable, shows all attempts)
  - **Collapsible problem panel (30% width, toggle-able):**
    - Toggle button to show/hide
    - Problem description
    - Constraints
    - Examples with input/output
    - Opponent info card
    - **Live AI Commentary section** (accumulates during match, italicized, strategic feedback)

**Features:**
- ✅ Editor-first layout (LeetCode-style, editor 70% of screen)
- ✅ Collapsible problem panel (30%, hidden by default for focus)
- ✅ Real-time timer countdown updated via Socket.IO
- ✅ Live AI commentary during match (accumulates on each submission verdict)
- ✅ Auto-scroll language starter code on language change
- ✅ AI hint in modal with 2-3 sentence suggestions
- ✅ Submission history (all attempts with verdict and test count)
- ✅ Live opponent typing indicator (2-second fade)
- ✅ Idle warning display
- ✅ Auto-redirect to debrief on match end
- ✅ No emoji usage (professional UI styling only)

**Live Commentary System:**
- Comments array accumulates AI insights on each submission
- Examples:
  - Accepted: "Excellent! Your solution is optimal..."
  - Wrong Answer: "Your logic needs adjustment... Consider..."
  - Timeout: "Your solution is too slow... Optimize..."
  - Runtime Error: "Debug your code... Check for..."
- Displays in collapsible problem panel, provides strategic feedback without spoilers

**API Calls:**
- `GET /api/matches/:id` - Load match details
- `POST /api/submissions` - Submit code
- `POST /api/ai/hint` - Get hint
- `POST /api/matches/:id/surrender` - Surrender match

**Socket Events:**
- Listen: `match:timer_tick`, `match:opponent_typing`, `match:idle_warning`, `match:ended`
- Emit: `code:update`, `idle:heartbeat`

---

#### Debrief Page (`/matches/[matchId]/debrief`)

**Purpose:** Post-match analysis with detailed insights and complexity breakdown

**Layout:**
- **Header card:**
  - Problem title
  - Result badge (Victory/Defeat/Draw, color-coded)
  - Difficulty, topics
- **Player stats (2-column grid):**
  - Your stats: username, score, solve time, submissions, ELO delta (color-coded)
  - Opponent stats: same layout with colored ELO delta
- **Problem editorial section:**
  - Full problem explanation (if available from AI)
- **Complexity Analysis section:**
  - Time complexity, space complexity
  - AI explanation and notes
  - Button to trigger: `POST /api/ai/analyze` (on-demand, deferred from battle)
  - Only shown after match ends
- **Match Insights section:**
  - Performance comparison with opponent
  - Faster solve time (if applicable)
  - Fewer attempts (if applicable)
  - Total ELO impact on rating
- **Action buttons:**
  - Back to Dashboard
  - View Leaderboard
  - Start New Battle

**Features:**
- ✅ Post-match only complexity analysis (not during battle)
- ✅ AI-generated editorial for problem explanation
- ✅ Direct performance comparison with opponent
- ✅ ELO delta prominently displayed
- ✅ No emoji usage (clean, professional styling)

**API Calls:**
- `GET /api/matches/:id/debrief` - Load match data
- `POST /api/ai/analyze` - Complexity analysis (on-demand)

---

#### Problems Browser (`/problems`)

**Purpose:** Browse and filter coding problems without joining a match

**Features:**
- **Search functionality:** Search problems by title
- **Filter by difficulty:** All, Easy, Medium, Hard (visual badges)
- **Filter by topic:** Dropdown with all available topics
- **Problem list display:**
  - Title with difficulty badge
  - Description preview (line-clamped)
  - Topic tags (first 3, with "+X more" indicator)
  - Acceptance rate %
  - Attempt count
- **Pagination:**
  - Previous/Next buttons
  - Current page indicator
  - Results range display
  - Limit selector (10, 20, 50)
- **Click to view:** Navigate to problem details (modal or dedicated page)

**API Calls:**
- `GET /api/problems?search=&difficulty=&topic=&limit=&offset=` - Fetch problems with filters

---

#### Leaderboard (`/leaderboard`)

**Purpose:** View global ELO rankings

**Features:**
- Total player count display
- Sortable table (rank, player, ELO, wins, losses, W/L ratio)
- Rank medals for top 3 (styled colored badges, not emoji)
- Clickable player names → profile pages
- ELO display in styled pill (primary color background)
- Win rate calculated as percentage
- Pagination with:
  - Previous/Next buttons
  - Current page indicator
  - Results range display (e.g., "Showing 1-50 of 243")
  - Limit selector (10, 25, 50, 100)
- No emoji usage

**API Calls:**
- `GET /api/leaderboard?limit=50&offset=0` - Load rankings

---

#### User Profile (`/profile/[username]`)

**Purpose:** View user stats and detailed information

**Features:**
- **Header section:**
  - User avatar (16x16, gradient fallback with first letter)
  - Username, join date
  - Bio (if set)
  - College (text label, no emoji)
  - Edit button (only if viewing own profile)
  - Large ELO display on right
- **Edit mode (own profile only):**
  - Bio textarea
  - College input field
  - Avatar URL input field
  - Save/Cancel buttons
- **Stats cards (3 column):**
  - Total matches
  - Win rate %
  - Wins / Losses split
- **Recent ELO changes (if history exists):**
  - Table of last 5 ELO deltas with dates
  - Green for wins, red for losses
- **Code DNA section (if set):**
  - Weak topics tags (red background)
  - Patterns tags (blue background)
- **Topic performance heatmap:**
  - Grid of topics (2-3 columns)
  - Each topic card shows:
    - Topic name (capitalized)
    - W/L count badges
    - Win rate bar (gradient fill)
    - Win rate percentage

**API Calls:**
- `GET /api/users/:username` - Load public profile
- `GET /api/users/:username/stats` - Load public stats
- `PATCH /api/users/me` - Save profile edits (own profile only)

---

#### Room Page (`/room/[code]`)

**Purpose:** Waiting area before match starts

**Features:**
- Room status display (waiting, ready, active, done)
- Host and guest usernames/ELOs
- Room options display (difficulty, time limit, etc.)
- Join button (if guest-less and user isn't host)
- Start button (only if host and room is ready)
- Countdown timer (when match is starting)
- Auto-redirect to battle page when match starts
- Auto-join as guest if room is waiting

**API Calls:**
- `GET /api/rooms/:code` - Load room
- `POST /api/rooms/:code/join` - Join as guest

**Socket Events:**
- Emit: `room:join`, `room:leave`
- Listen: `room:guest_joined`, `room:countdown`, `match:started`

---

#### Room Creation (`/room/new`)

**Purpose:** Create a new match room

**Form Fields:**
- Difficulty selector (easy, medium, hard)
- Topic input (optional)
- Time limit minutes slider (5-60)
- Dead Man's Switch toggle
- Blind rating toggle
- Live commentator toggle
- Spectators allowed toggle

**On Submit:**
- Send to `POST /api/rooms`
- Get room code back
- Redirect to `/room/[code]`

---

## Real-Time Features (Socket.IO)

### Connection

```typescript
// Client connects with JWT auth
const socket = io(SOCKET_URL, {
  auth: { token: jwtToken },
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Server validates JWT before allowing connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));
  // Verify JWT...
  if (valid) next();
});
```

### Events

#### Room Events

| Event | Emitted By | Payload | Purpose |
|-------|-----------|---------|---------|
| `room:join` | Client | `{ room_code: string }` | Join a room |
| `room:leave` | Client | `{ room_code: string }` | Leave a room |
| `room:guest_joined` | Server | `{}` | Notify when guest joins |
| `room:countdown` | Server | `{ seconds: number }` | Countdown before start |

#### Match Events

| Event | Emitted By | Payload | Purpose |
|-------|-----------|---------|---------|
| `match:timer_tick` | Server | `{ remaining_ms: number }` | Timer update every 1s |
| `match:opponent_typing` | Client | `{ match_id: string }` | Indicator when typing |
| `match:ai_comment` | Server | `{ comment: string, timestamp: number }` | Live AI commentary (NEW) |
| `match:idle_warning` | Server | `{ seconds_idle: number, seconds_until_delete: number }` | Alert after 45s idle |
| `match:lines_deleted` | Server | `{ user_id: string, lines_deleted: number }` | Lines auto-deleted due to idle |
| `match:ended` | Server | `{ reason: string, winner_id: string }` | Match finished |
| `match:started` | Server | `{ match_id: string, problem: Problem }` | Match began |

#### Code Events

| Event | Emitted By | Payload | Purpose |
|-------|-----------|---------|---------|
| `code:update` | Client | `{ match_id: string, code_length: number, cursor_line: number }` | Broadcasting typing |
| `idle:heartbeat` | Client | `{ match_id: string }` | Reset idle timer |

---

## AI Integration

### Groq API Integration

**Model:** `llama-3.3-70b-versatile`  
**API Key:** Environment variable `GROQ_API_KEY`

### Hints

```typescript
// POST /api/ai/hint
const response = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: "You are a competitive programming coach. Give ONE concise hint (2-3 sentences max)..."
    },
    {
      role: "user",
      content: `Problem: ${title}\nDescription: ${desc}\nCurrent Code: ${code}\nDifficulty: ${diff}\nTopics: ${topics}`
    }
  ],
  max_tokens: 150
});
```

**Output:** Natural language hint (non-spoiling suggestion)

### Complexity Analysis

```typescript
// POST /api/ai/analyze
const response = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: "Respond ONLY with valid JSON: { \"time\": \"...\", \"space\": \"...\", \"ai_note\": \"...\", \"explanation\": \"...\" }"
    },
    {
      role: "user",
      content: `Analyze this ${language} code:\n${code}`
    }
  ]
});
```

**Output:** JSON with time/space complexity and explanation

### Live AI Commentary

**Real-time match commentary** is generated automatically after each code submission. The system:

1. **Triggers on Submission:**
   - User submits code
   - Backend judges code and generates verdict
   - AI generates contextual commentary based on verdict
   - Commentary is broadcast via Socket.IO to all match room participants

2. **Commentary Generation (Backend):**
   ```typescript
   // POST /api/submissions (internal)
   const commentary = await generateLiveCommentary(
     verdict,           // "accepted" | "wrong_answer" | "timeout" | etc
     testsPassed,       // number
     testsTotal,        // number
     language           // "javascript" | "python" | "cpp" | "java"
   );
   
   broadcastAiComment(matchId, commentary);
   ```

3. **Groq Prompt:**
   ```
   System: "You are a hyped esports commentator for competitive coding. Generate ONE punchy, 
   encouraging line (under 15 words) in response to a code verdict. Be technical, be excited!"
   
   User: "${language} Submission - ${verdict}: ${testsPassed}/${testsTotal} test cases. Comment:"
   ```

4. **Fallback Responses:**
   - If Groq API is slow/unavailable, uses pre-crafted commentary pool
   - Ensures real-time performance

5. **Frontend Display:**
   - Sidebar component receives Socket.IO event `match:ai_comment`
   - Appends comment to rolling commentary list
   - Shows latest comments prominently, older ones faded
   - Scrolls automatically to newest comment

**Example Comments:**
- ✓ Accepted: "Perfect! Flawless execution!"
- ✗ Wrong Answer: "Logic issue detected. Reconsider edge cases."
- ⏱ Timeout: "Too slow! Optimize your approach."
- 💥 Runtime Error: "Runtime crash. Watch for null/bounds."

---

## Advanced Features

### Dead Man's Switch

**Purpose:** Prevent idle players from indefinitely blocking matches.

**Flow:**
1. Player joins active match
2. Server starts idle timer (45 seconds)
3. On mouse/keyboard activity: timer resets
4. After 45 seconds idle: `match:idle_warning` event emitted
   - Frontend displays prominent red warning banner
   - Shows countdown to line deletion (10 seconds)
   - UI pulses to indicate urgency
5. After 10 more seconds: 5 lines automatically deleted from player's code
6. If player is still idle after auto-delete: match may be forfeited (configurable)

**Backend Implementation:**
```typescript
function resetIdleTimer(matchId: string, userId: string) {
  const key = `${matchId}:${userId}`;
  
  const warnTimer = setTimeout(() => {
    io.to(matchId).emit("match:idle_warning", {
      user_id: userId,
      seconds_idle: 45,
      seconds_until_delete: 10
    });
    
    const deleteTimer = setTimeout(() => {
      io.to(matchId).emit("match:lines_deleted", {
        user_id: userId,
        lines_deleted: 5
      });
    }, 10_000);
  }, 45_000);
}
```

**Frontend Visual Feedback:**
- Red warning banner with animated pulse
- Countdown timer showing seconds until deletion
- Clear messaging: "5 lines will be deleted in Xs!"

### Room Customization Options

Players can configure rooms with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `difficulty` | string | "medium" | easy/medium/hard |
| `topic` | string | null | specific topic or null (random) |
| `time_limit_minutes` | number | 30 | 5-120 minutes |
| `dead_mans_switch` | object | `{enabled: true, idle_seconds: 45}` | Auto-remove idle players |
| `blind_rating` | object | `{enabled: false}` | Hide opponent ELO until match ends |
| `wager` | object | `{enabled: false, amount: 0}` | Betting system (placeholder) |
| `live_commentator` | boolean | true | Enable AI commentary |
| `spectators_allowed` | boolean | true | Allow other users to watch |

**Room Creation UI:**
- Basic options: difficulty, topic, time limit
- Advanced section: toggles for all room options
- Room code automatically generated (6 chars, uppercase alphanumeric)

### Achievements & Badges

**Unlocked based on user statistics:**

| Achievement | Requirement | Icon | Description |
|-------------|-------------|------|-------------|
| First Victory | `wins > 0` | ✦ | Won first match |
| Consistent | `wins/total >= 50% AND total >= 5` | ▲ | Maintained 50%+ win rate |
| Specialist | Any topic `wins > 3` | ◆ | Master specific topic |
| Battle Veteran | `total_matches >= 20` | ● | Played 20+ matches |

**Display Location:**
- User profile page
- Displayed as colored badges with borders
- Yellow (Star) = Victory, Green (Triangle) = Consistency, Purple (Diamond) = Specialization, Blue (Circle) = Veteranship
- Shows count/stat underneath badge

---

## Development Guide

### Local Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn
- Git

#### Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/codeclash
JWT_SECRET=your-dev-secret-here
GROQ_API_KEY=gsk_xxxxx
CLIENT_URL=http://localhost:3000
PORT=5000
EOF

# Create database and run migrations
npm run db:push
npm run seed

# Start dev server
npm run dev
```

#### Frontend Setup

```bash
cd frontend
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
EOF

# Start dev server
npm run dev
```

Visit `http://localhost:3000`

---

### Common Development Tasks

#### Adding a New API Endpoint

1. **Define TypeScript types** in `backend/src/db/schema.ts`
2. **Create query function** in appropriate route file
3. **Export in route file** and register in `index.ts`
4. **Update frontend types** in `frontend/src/lib/types.ts`
5. **Create API call** in frontend using `apiRequest()`

#### Adding a New Page

1. Create file in `frontend/src/app/(protected)/` or appropriate route
2. Import `useAuth()` hook
3. Load data in `useEffect`
4. Add navigation link in `app-shell.tsx` items array

#### Debugging Socket.IO

```typescript
// In backend index.ts
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

// In frontend lib/socket.ts
const socket = io(SOCKET_URL, {
  auth: { token },
  // Add this for debugging:
  reconnection: true
});
socket.on("connect", () => console.log("✓ Connected"));
socket.on("disconnect", () => console.log("✗ Disconnected"));
socket.on("error", (err) => console.error("Socket error:", err));
```

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/codeclash

# JWT
JWT_SECRET=your-super-secret-key-change-in-prod

# AI
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server
PORT=5000

# CORS
CLIENT_URL=http://localhost:3000
```

### Frontend (.env.local)

```bash
# API endpoints
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## Common Workflows

### Match Lifecycle

```
1. User creates room (POST /api/rooms)
   └─ Gets 6-char room code

2. Guest joins room (POST /api/rooms/:code/join)
   └─ room:guest_joined event fires

3. Host clicks "Start Match"
   └─ room:countdown events start (counting down)
   └─ match:started event with matchId

4. Both players taken to /battle/:matchId
   └─ match:timer_tick events start (every 1s)
   └─ Players see live timer

5. First correct submission or time limit reached
   └─ match:ended event
   └─ Both redirected to /matches/:matchId/debrief

6. Debrief shows:
   - Match result (W/L/D)
   - Final scores
   - ELO delta for both players
   - Solve times
   - Submission counts
```

### ELO Calculation

```typescript
Formula: ELO delta = K * (actual - expected)

// Where:
K = 32 (standard K-factor)
actual = 1 if won, 0 if lost
expected = 1 / (1 + 10^((opponentElo - myElo) / 400))

Example:
  Me: 1600 ELO, Opponent: 1400 ELO
  Expected = 1 / (1 + 10^((-200) / 400)) ≈ 0.76
  
  If I win: delta = 32 * (1 - 0.76) = +7.68 ≈ +8
  If I lose: delta = 32 * (0 - 0.76) = -24.32 ≈ -24
```

### Adding to Topic Stats

After every match, topic stats are upserted:

```typescript
// For each topic in the problem:
topicStats.upsert(
  { userId, topic },
  {
    wins: problemWon ? 1 : 0,
    losses: !problemWon ? 1 : 0,
    avgSolveTimeMs: solveTime,
    last5Outcomes: [...previous, result].slice(-5)
  }
);
```

---

## Known Limitations & Future Improvements

### Current Limitations
- No spectator joining mid-match
- No blind rating implementation (ELO visible to both)
- Dead Man's Switch deletes 5 fixed lines (not configurable)
- No replay functionality
- Limited AI model access (Groq free tier)

### Planned Features
- Match replay with event timeline
- Advanced search filters on leaderboard
- Spectator mode with live commentary
- Code complexity hints during match
- Tournament mode with brackets
- Social features (friends, teams, challenges)
- Mobile app version
- Code formatter integration

---

## Troubleshooting

### Socket.IO Not Connecting

**Check:**
1. Backend server is running (`npm run dev`)
2. Frontend `NEXT_PUBLIC_SOCKET_URL` matches backend origin
3. JWT token is valid
4. No CORS issues (check backend config)
5. WebSocket protocol supported (check browser console)

### Timer Not Updating

**Check:**
1. Socket.IO connected (see console)
2. `match:timer_tick` events being received
3. State is being updated (check React DevTools)
4. Component not re-rendering (check key prop)

### Submissions Not Being Saved

**Check:**
1. Match is active (status === "active")
2. Code is not empty
3. Language is valid
4. Backend is processing submissions (check logs)
5. Database connection is active

---

## Resources

- **Express.js Docs:** https://expressjs.com/
- **Drizzle ORM:** https://orm.drizzle.team/
- **Socket.IO:** https://socket.io/
- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/
- **Groq API:** https://console.groq.com/

---

**Last Updated:** April 17, 2026  
**Maintainers:** Lost Arc Team
