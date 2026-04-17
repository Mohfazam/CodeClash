# CodeClash — Full Development Roadmap & Continuation Guide

**Created:** April 17, 2026  
**Purpose:** This document tracks ALL planned features, what's been implemented, and what remains. Use this to continue development if a session ends.

---

## Table of Contents
1. [Phase Overview](#phase-overview)
2. [Phase 1: Bug Fixes & Socket Reliability](#phase-1-bug-fixes--socket-reliability)
3. [Phase 2: Dashboard Enhancement](#phase-2-dashboard-enhancement)
4. [Phase 3: Battle Arena Overhaul](#phase-3-battle-arena-overhaul)
5. [Phase 4: Debrief Page Overhaul](#phase-4-debrief-page-overhaul)
6. [Phase 5: Profile, Problems, Landing & Polish](#phase-5-profile-problems-landing--polish)
7. [File-by-File Change Reference](#file-by-file-change-reference)
8. [New Backend AI Endpoints](#new-backend-ai-endpoints)
9. [Creative Feature Ideas (Future)](#creative-feature-ideas-future)
10. [Technical Notes](#technical-notes)

---

## Phase Overview

| Phase | Status | Priority | Description |
|-------|--------|----------|-------------|
| Phase 1 | 🟢 DONE | CRITICAL | Bug fixes: timer, commentary, profile, sockets |
| Phase 2 | 🟢 DONE | HIGH | Dashboard redesign with stats, charts, rank tiers |
| Phase 3 | 🟢 DONE | HIGH | Battle arena: Monaco editor, shortcuts, animations |
| Phase 4 | 🟢 DONE | MEDIUM | Debrief: code review, AI insights, share/rematch |
| Phase 5 | 🟡 PARTIAL | MEDIUM | Profile ✅, problems ✅, landing page 🔴, global CSS ✅ |

---

## Phase 1: Bug Fixes & Socket Reliability

### Status: 🔴 NOT STARTED

### Bug 1: Timer Not Working
**File:** `frontend/src/app/(protected)/battle/[matchId]/page.tsx`  
**Root Cause:** The battle page waits for socket `match:timer_tick` events to display the timer, but the initial timer value is never set. If the socket disconnects/reconnects, the room membership is lost and no ticks arrive.  
**Fix:**
1. On match load, calculate `remainingMs` from `match.startedAt` + room time limit - current time
2. Start a local `setInterval` as fallback timer that decrements every second
3. When socket ticks arrive, they override the local timer (server is authoritative)
4. Add `timeLimitMs` to the match response or derive from room options

```typescript
// Calculate initial remaining time from match data
const startedAt = new Date(match.startedAt).getTime();
const timeLimitMs = (match.options?.time_limit_minutes ?? 30) * 60 * 1000;
const elapsed = Date.now() - startedAt;
const initialRemaining = Math.max(0, timeLimitMs - elapsed);
setRemainingMs(initialRemaining);

// Local fallback interval
const fallbackInterval = setInterval(() => {
  setRemainingMs(prev => prev !== null ? Math.max(0, prev - 1000) : null);
}, 1000);
```

### Bug 2: Live Commentary Not Working
**File:** `frontend/src/app/(protected)/battle/[matchId]/page.tsx`  
**Root Cause:** Commentary relies entirely on socket events. If socket connection drops, all commentary is lost.  
**Fix:**
1. On mount, fetch existing AI commentary from `GET /api/matches/:id/events` and filter for `ai_comment` events
2. Socket events ADD to this list (dedup by timestamp)
3. Shows commentary history even after reconnection

```typescript
// Fetch existing commentary on mount
const events = await apiRequest<MatchEvent[]>({ path: `/api/matches/${matchId}/events`, token });
const existingComments = events
  .filter(e => e.eventType === 'ai_comment')
  .map(e => ({
    id: e.id,
    type: 'commentary',
    user: 'AI Commentator',
    message: (e.payload as any).comment,
    timestamp: new Date(e.createdAt).getTime(),
    color: 'text-cyan-400',
  }));
setCommentary(existingComments);
```

### Bug 3: Profile Not Working
**File:** `frontend/src/app/(protected)/profile/[username]/page.tsx`  
**Root Cause:** For other users' profiles, the frontend falls back to `Promise.resolve(null)` instead of calling the stats endpoint. Also, the public profile endpoint already includes `topicStats` but the frontend ignores it.  
**Fix:**
1. For ALL profiles (own or other), call `GET /api/users/${username}` — this returns user + topicStats
2. For own profile, ALSO call `GET /api/users/me/stats` to get eloHistory, wins, losses
3. For other profiles, compute wins/losses from the returned profile data or add a public stats endpoint

**Backend addition needed:** Add `GET /api/users/:username/stats` endpoint in `backend/src/routes/users.ts`:
```typescript
router.get("/:username/stats", async (req, res) => {
  // Same logic as /me/stats but lookup by username instead of req.user.id
  const [user] = await db.select().from(users).where(eq(users.username, req.params.username)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  // ... fetch wins, losses, eloHistory, topicStats for user.id
});
```

### Bug 4: Socket Room Management
**File:** `frontend/src/lib/socket.ts`  
**Root Cause:** `getSocket()` creates a new socket when `!socket.connected`, which drops all room memberships. The new socket doesn't rejoin any rooms.  
**Fix:**
1. Add a `pendingRooms` Set that tracks which rooms we've joined
2. On socket `connect` event, auto-rejoin all `pendingRooms`
3. Expose `joinRoom()` and `leaveRoom()` helpers
4. Don't recreate socket just because it's temporarily disconnected — let Socket.IO's built-in reconnection handle it

```typescript
const pendingRooms = new Set<string>();

export function joinRoom(token: string, roomCode: string) {
  pendingRooms.add(roomCode);
  const socket = getSocket(token);
  socket.emit("room:join", { room_code: roomCode });
}

// On reconnect, rejoin all rooms
socket.on("connect", () => {
  for (const room of pendingRooms) {
    socket.emit("room:join", { room_code: room });
  }
});
```

### Additional: Install Monaco Editor
```bash
cd frontend
npm install @monaco-editor/react monaco-editor
```

---

## Phase 2: Dashboard Enhancement

### Status: 🟢 COMPLETED

**File:** `frontend/src/app/(protected)/dashboard/page.tsx`

### Features to Implement:

#### 2.1 Rank Tier System
ELO-based rank tiers with animated gradient badges:
| Tier | ELO Range | Color |
|------|-----------|-------|
| Bronze | 0-999 | #CD7F32 |
| Silver | 1000-1199 | #C0C0C0 |
| Gold | 1200-1399 | #FFD700 |
| Platinum | 1400-1599 | #00CED1 |
| Diamond | 1600-1799 | #B9F2FF |
| Master | 1800-1999 | #FF6B6B |
| Legend | 2000+ | #FFD700 → #FF6B6B gradient |

```typescript
function getRankTier(elo: number) {
  if (elo >= 2000) return { name: 'Legend', color: 'from-yellow-400 to-red-500', icon: '♛' };
  if (elo >= 1800) return { name: 'Master', color: 'from-red-400 to-pink-500', icon: '♚' };
  if (elo >= 1600) return { name: 'Diamond', color: 'from-cyan-300 to-blue-400', icon: '◆' };
  if (elo >= 1400) return { name: 'Platinum', color: 'from-teal-300 to-cyan-400', icon: '▲' };
  if (elo >= 1200) return { name: 'Gold', color: 'from-yellow-300 to-amber-400', icon: '★' };
  if (elo >= 1000) return { name: 'Silver', color: 'from-gray-300 to-gray-400', icon: '●' };
  return { name: 'Bronze', color: 'from-orange-400 to-amber-600', icon: '■' };
}
```

#### 2.2 ELO Sparkline Chart
Canvas-based mini line chart (no external libraries):
- Plot last 20 ELO changes as a line
- Green fill below line when going up, red when going down
- Hover shows exact ELO value
- Smooth bezier curves between points

#### 2.3 Win Streak Counter
- Track consecutive wins
- Show fire emoji animation when streak > 3
- "Current Streak: 🔥5" badge

#### 2.4 Skill Radar Chart
Canvas-drawn radar/spider chart:
- 6 axes: Arrays, Strings, Trees, Graphs, DP, Sorting
- Fill based on win rate per topic
- Compare against global average (future)

#### 2.5 Daily Challenge Widget
- Call `GET /api/problems/random` on mount
- Show problem title, difficulty, topics
- "Solve Now" button → creates room with that problem
- Refreshes every 24h (use localStorage timestamp)

#### 2.6 Quick Match Button
- Large pulsing "⚔️ Find Battle" button
- Creates room with default options and shows room code
- Copy-to-clipboard for room code

#### 2.7 Enhanced Recent Battles
Each battle card shows:
- Problem title & difficulty badge
- Opponent name & ELO
- Result badge (WIN/LOSS/DRAW) with color
- ELO delta with arrow
- Time taken
- Submission count
- Click to view debrief

---

## Phase 3: Battle Arena Overhaul

### Status: 🟢 COMPLETED

**File:** `frontend/src/app/(protected)/battle/[matchId]/page.tsx`

### Features to Implement:

#### 3.1 Monaco Editor Integration
Replace `<textarea>` with Monaco Editor:
```tsx
import Editor from '@monaco-editor/react';

<Editor
  height="100%"
  language={language}
  theme="vs-dark"
  value={code}
  onChange={(value) => handleCodeChange(value ?? '')}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    suggestOnTriggerCharacters: true,
    readOnly: !!matchEnded,
  }}
/>
```

Monaco language map:
```typescript
const monacoLanguageMap: Record<string, string> = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};
```

#### 3.2 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Submit code |
| Ctrl+H | Get hint |
| Ctrl+Shift+S | Surrender (opens confirm) |
| Ctrl+P | Toggle problem panel |
| Ctrl+B | Toggle commentary panel |

Implementation: Use `useEffect` with `keydown` event listener.

#### 3.3 Submission Verdict Animation
Full-screen flash animation on submit result:
- Green flash + "ACCEPTED ✓" for accepted
- Red flash + "WRONG ANSWER ✗" for wrong_answer
- Orange flash + "RUNTIME ERROR" for runtime_error
- Fades out after 1.5s

#### 3.4 Typing Speed Tracker
- Count keystrokes in the code editor
- Calculate WPM (words per minute) using rolling 60s window
- Display small WPM counter in the toolbar

#### 3.5 Match Progress Bar
- Shows `testCasesPassed / testCasesTotal` as a progress bar
- Updates after each submission
- Color transitions from red (0%) to green (100%)

#### 3.6 Enhanced Problem Panel
- Collapsible with smooth animation
- Resizable width (drag handle)
- Sticky header with problem title
- Better example formatting with copy buttons

---

## Phase 4: Debrief Page Overhaul

### Status: 🟢 COMPLETED

**File:** `frontend/src/app/(protected)/matches/[matchId]/debrief/page.tsx`

### Features to Implement:

#### 4.1 Enhanced Overview Tab
- **Head-to-Head Bars:** Animated horizontal bars comparing score, time, submissions
- **ELO Change Visualization:** `1200 → 1225 (+25)` with animated arrow
- **Victory/Defeat Animation:** CSS-only confetti for victory, subtle red pulse for defeat

#### 4.2 Code Review Tab (NEW)
- Show your final submission with syntax highlighting (Monaco in read-only mode)
- AI-powered code review: call `POST /api/ai/review` (new endpoint)
  - Line-by-line feedback
  - Efficiency suggestions
  - Bug identification
  - Best practices

AI Review Endpoint:
```typescript
// POST /api/ai/review
router.post("/review", requireAuth, async (req, res) => {
  const { code, language, problem_title, verdict } = req.body;
  const review = await callGroq(
    "You are a senior code reviewer. Review this competitive programming solution. " +
    "Provide: 1) Overall grade (A-F), 2) Code quality notes, 3) Efficiency improvements, " +
    "4) Bug identification, 5) What they did well. Be specific with line references. " +
    "Format as JSON: { grade, quality, efficiency, bugs, strengths }",
    `Problem: ${problem_title}\nLanguage: ${language}\nVerdict: ${verdict}\n\nCode:\n${code}`,
    400
  );
  res.json({ review: JSON.parse(review) });
});
```

#### 4.3 Enhanced Timeline
- Visual timeline with colored dots:
  - 🟢 Green = accepted submission
  - 🔴 Red = wrong answer
  - 🟡 Yellow = hint used
  - 🤖 Cyan = AI commentary
  - 🏳️ White = surrender
- Time elapsed shown between each event
- Submission details expandable on click

#### 4.4 Alternative Approaches (AI)
New endpoint: `POST /api/ai/optimal`
```typescript
router.post("/optimal", requireAuth, async (req, res) => {
  const { problem_title, problem_description, difficulty, topics } = req.body;
  const solution = await callGroq(
    "You are an expert competitive programmer. Give 2-3 different approaches to solve this problem. " +
    "For each: name the approach, explain the idea in 2-3 sentences, give time/space complexity. " +
    "Format as JSON array: [{ approach, explanation, time_complexity, space_complexity }]",
    `Problem: ${problem_title}\nDifficulty: ${difficulty}\nTopics: ${topics.join(', ')}\n\n${problem_description}`,
    500
  );
  res.json({ approaches: JSON.parse(solution) });
});
```

#### 4.5 Improvement Roadmap (AI)
New endpoint: `POST /api/ai/weakness`
```typescript
router.post("/weakness", requireAuth, async (req, res) => {
  // Analyze user's last 10 matches to find patterns
  const userSubs = await db.select().from(submissions).where(eq(submissions.userId, req.user.id)).orderBy(desc(submissions.submittedAt)).limit(20);
  // ... build summary of verdicts, topics, solve times
  const analysis = await callGroq(
    "Based on this competitive programmer's recent match history...",
    summaryText,
    300
  );
  res.json({ analysis });
});
```

#### 4.6 Share / Rematch
- **Share:** Generate a text summary of match results for clipboard
- **Rematch:** Create new room with same opponent invited (socket emit)

---

## Phase 5: Profile, Problems, Landing & Polish

### Status: 🔴 NOT STARTED

### 5.1 Profile Page Enhancement
**File:** `frontend/src/app/(protected)/profile/[username]/page.tsx`

Features:
- **Rank Tier Badge:** Same tier system as dashboard, shown prominently
- **ELO Timeline Chart:** Canvas line chart of full ELO history
  - X-axis: match number, Y-axis: ELO
  - Green dots for wins, red for losses
  - Hover tooltip with details
- **Activity Heatmap:** GitHub-style grid (last 90 days)
  - Each cell = one day, color intensity = number of battles
  - Use matchEvents or match timestamps to build data
- **Badge Showcase:** Display earned achievements with descriptions
  - Add more achievements:
    - "Speedrunner" — Solved in under 5 minutes
    - "Perfect Score" — All test cases first try
    - "Comeback King" — Won after opponent had more submissions
    - "Night Owl" — Won a match after midnight
    - "Unbreakable" — 5+ win streak
- **Rival System:** Show top 3 most-played opponents with W/L record
- **Favorite Language:** Pie chart of languages used

### 5.2 Problem Detail Page (NEW)
**File:** `frontend/src/app/(protected)/problems/[slug]/page.tsx`

Features:
- Full problem description with constraints and examples
- **Practice Editor:** Monaco editor for solving problems outside battles
  - Submit button that calls `POST /api/submissions/practice` (new endpoint)
  - Test results displayed inline
  - No ELO impact, just practice
- Company tags display
- Related problems section (same topic)
- "Start Battle with This Problem" button
- AI hint available

New backend endpoint:
```typescript
// POST /api/submissions/practice — submit code for practice (no match required)
router.post("/practice", requireAuth, async (req, res) => {
  const { problemId, code, language } = req.body;
  const [problem] = await db.select().from(problems).where(eq(problems.id, problemId)).limit(1);
  if (!problem) return res.status(404).json({ error: "Problem not found" });
  const result = await judgeCode(code, language, problem.testCases ?? []);
  // Don't save to submissions table — just return the result
  res.json({ ...result, practice: true });
});
```

### 5.3 Problems Listing Enhancement
**File:** `frontend/src/app/(protected)/problems/page.tsx`

Features:
- Solved/attempted status per problem (green check, yellow circle)
- "Random Problem" button
- Company tags filter
- Grid/list view toggle
- Better card design with hover animations

### 5.4 Landing Page Redesign
**File:** `frontend/src/app/page.tsx`

Complete redesign:
- Animated gradient background (CSS keyframes)
- Floating code snippets animation
- Feature cards with glassmorphism
- "How It Works" section: Create → Join → Battle → Win
- Stats counter (animated number roll-up)
- CTA buttons with hover glow

### 5.5 Global CSS Additions
**File:** `frontend/src/app/globals.css`

Add:
```css
/* Animations */
@keyframes float { ... }
@keyframes glow-pulse { ... }
@keyframes shimmer { ... }
@keyframes confetti { ... }
@keyframes number-roll { ... }

/* Utilities */
.glass { backdrop-filter: blur(12px); background: rgba(16,19,26,0.7); }
.glow-border { box-shadow: 0 0 15px rgba(124,58,237,0.3); }
.gradient-text { background: linear-gradient(...); -webkit-background-clip: text; }
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.animate-float { animation: float 3s ease-in-out infinite; }
```

### 5.6 App Shell Enhancements
**File:** `frontend/src/components/layout/app-shell.tsx`

Features:
- Mobile responsive hamburger menu
- Active match indicator (pulsing dot)
- Rank badge next to username
- Notification indicator

### 5.7 Room Pages Enhancement
**Files:**
- `frontend/src/app/(protected)/room/new/page.tsx`
- `frontend/src/app/(protected)/room/[code]/page.tsx`

Room creation:
- Visual difficulty selector (card-style, not dropdown)
- Topic picker with searchable chips
- Room preview card
- "Copy Room Code" button with animation

Room waiting:
- Animated waiting state with floating particles
- Room options display with icons
- ELO comparison chart between host and guest
- Countdown animation (circle SVG filling)

---

## File-by-File Change Reference

### Frontend Files

| File | Phase | Changes |
|------|-------|---------|
| `src/lib/socket.ts` | 1 | Auto-rejoin rooms on reconnect, room tracking |
| `src/lib/types.ts` | 1 | Add new type definitions for debrief, AI responses |
| `src/lib/api.ts` | 1 | No changes needed |
| `src/app/globals.css` | 5 | Animation utilities, glass, glow, scrollbar |
| `src/app/page.tsx` | 5 | Complete landing page redesign |
| `src/app/(protected)/dashboard/page.tsx` | 2 | Full redesign with charts, rank, streak |
| `src/app/(protected)/battle/[matchId]/page.tsx` | 1,3 | Timer fix, Monaco editor, shortcuts |
| `src/app/(protected)/matches/[matchId]/debrief/page.tsx` | 4 | Code review tab, enhanced AI, share |
| `src/app/(protected)/profile/[username]/page.tsx` | 1,5 | Stats fix, rank badge, ELO chart, heatmap |
| `src/app/(protected)/problems/page.tsx` | 5 | Enhanced listing, status indicators |
| `src/app/(protected)/problems/[slug]/page.tsx` | 5 | NEW: Problem detail + practice mode |
| `src/app/(protected)/leaderboard/page.tsx` | 5 | Minor: add wins/losses columns |
| `src/app/(protected)/room/new/page.tsx` | 5 | Visual redesign |
| `src/app/(protected)/room/[code]/page.tsx` | 5 | Waiting animation, countdown |
| `src/components/layout/app-shell.tsx` | 5 | Mobile menu, rank badge |
| `src/components/ui/button.tsx` | - | No changes |
| `src/components/ui/card.tsx` | - | No changes |

### Backend Files

| File | Phase | Changes |
|------|-------|---------|
| `src/routes/users.ts` | 1 | Add GET /:username/stats endpoint |
| `src/routes/ai.ts` | 4 | Add /review, /optimal, /weakness, /strategy endpoints |
| `src/routes/submissions.ts` | 5 | Add POST /practice endpoint |
| `src/routes/matches.ts` | 1 | Include room options in match GET response |
| `src/index.ts` | - | No changes (already complete) |

---

## New Backend AI Endpoints

### Existing Endpoints (Already Built)
- `POST /api/ai/hint` — Non-spoiling hint during battle
- `POST /api/ai/analyze` — Complexity analysis by submissionId
- `POST /api/ai/roast` — Funny code review
- `POST /api/ai/comment` — Live commentary from match events
- `POST /api/ai/autopsy` — Post-match coaching
- `POST /api/ai/complexity` — Standalone complexity check

### New Endpoints to Build

#### `POST /api/ai/review` (Phase 4)
**Purpose:** Detailed code review with grades  
**Request:** `{ code, language, problem_title, verdict }`  
**Response:** `{ review: { grade, quality, efficiency, bugs, strengths } }`

#### `POST /api/ai/optimal` (Phase 4)
**Purpose:** Show optimal solution approaches after match  
**Request:** `{ problem_title, problem_description, difficulty, topics }`  
**Response:** `{ approaches: [{ approach, explanation, time_complexity, space_complexity }] }`

#### `POST /api/ai/weakness` (Phase 4)
**Purpose:** Analyze user's weak topics from match history  
**Request:** `{ }` (uses auth user)  
**Response:** `{ analysis: string, weak_topics: string[], recommendations: string[] }`

#### `POST /api/ai/strategy` (Phase 4)
**Purpose:** Pre-battle strategy advice based on problem  
**Request:** `{ problem_title, problem_description, difficulty, topics, current_code }`  
**Response:** `{ strategy: string }`

---

## Creative Feature Ideas (Future)

These are NOT in the current phases but could be implemented later:

### Tournament Mode
- Bracket-style tournaments (8/16/32 players)
- Single/double elimination
- Tournament leaderboard
- Prize pool (ELO bonus)

### Team Battles
- 2v2 or 3v3 team matches
- Team ELO rating
- Team formation/management

### Spectator Mode
- Watch live matches
- Spectator chat
- Spectator count display
- "Featured Match" on dashboard

### Daily/Weekly Challenges
- Curated daily problem
- Weekly leaderboard
- Streak rewards

### Social Features
- Friend list
- Challenge a friend directly
- Chat/messaging
- Activity feed

### Replay System
- Full match replay with code playback
- Timeline scrubber
- Speed controls (1x, 2x, 4x)

### Achievements System (Extended)
More badges to implement:
- "Speedrunner" — Solved in under 5 minutes
- "Perfect Score" — All test cases first try
- "Comeback King" — Won after being behind
- "Night Owl" — Won after midnight
- "Unbreakable" — 5+ win streak
- "Polyglot" — Won with 3+ different languages
- "Giant Slayer" — Beat someone 200+ ELO above you
- "Mentor" — Win against someone 200+ ELO below (small delta)
- "Century" — 100 matches played
- "The Machine" — 10+ win streak

### Mobile Optimization
- Responsive layout for all pages
- Touch-friendly controls
- Mobile code editor optimization

### Analytics Dashboard
- Time-of-day performance chart
- Language preference trends
- Average solve time by difficulty
- Improvement rate graph

---

## Technical Notes

### Monaco Editor Setup
```bash
cd frontend
npm install @monaco-editor/react
```
Monaco is loaded from CDN by default via `@monaco-editor/react`. No need to install `monaco-editor` separately unless you want to self-host.

Usage pattern:
```tsx
'use client';
import Editor from '@monaco-editor/react';

// In component:
<Editor
  height="100%"
  language={monacoLanguageMap[language]}
  theme="vs-dark"
  value={code}
  onChange={(val) => handleCodeChange(val ?? '')}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    readOnly: !!matchEnded,
  }}
/>
```

### Canvas Charts (No Libraries)
For ELO sparkline and radar charts, draw directly on `<canvas>`:

```typescript
function drawSparkline(canvas: HTMLCanvasElement, data: number[], color: string) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  data.forEach((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  
  ctx.stroke();
}
```

### Rank Tier System
Used across dashboard, profile, and app shell:

```typescript
export function getRankTier(elo: number) {
  if (elo >= 2000) return { name: 'Legend', color: 'from-yellow-400 to-red-500', icon: '♛', textColor: 'text-yellow-300' };
  if (elo >= 1800) return { name: 'Master', color: 'from-red-400 to-pink-500', icon: '♚', textColor: 'text-red-300' };
  if (elo >= 1600) return { name: 'Diamond', color: 'from-cyan-300 to-blue-400', icon: '◆', textColor: 'text-cyan-300' };
  if (elo >= 1400) return { name: 'Platinum', color: 'from-teal-300 to-cyan-400', icon: '▲', textColor: 'text-teal-300' };
  if (elo >= 1200) return { name: 'Gold', color: 'from-yellow-300 to-amber-400', icon: '★', textColor: 'text-yellow-300' };
  if (elo >= 1000) return { name: 'Silver', color: 'from-gray-300 to-gray-400', icon: '●', textColor: 'text-gray-300' };
  return { name: 'Bronze', color: 'from-orange-400 to-amber-600', icon: '■', textColor: 'text-orange-300' };
}
```

### Socket.IO Room Pattern
All socket rooms use this pattern:
- **Room code rooms:** Joined with room's 6-char code (e.g., "ABC123")
- **Match rooms:** Joined with match UUID (e.g., "550e8400-...")
- Both host AND guest must join BOTH rooms for events to work
- On `match:started`, clients receive `match:join_room` to join the match UUID room

### Groq API Notes
- Model: `llama-3.3-70b-versatile`
- Max rate: Check Groq dashboard for rate limits
- JSON responses: Always use JSON mode prompt
- Fallback: Every AI call should have a fallback response
- Max tokens: Keep under 500 for speed

---

## Continuation Instructions

If this development session ends and you need to continue:

1. **Read this file** (`CODECLASH_ROADMAP.md`) to understand what's done and what's next
2. **Check Phase statuses** at the top of each phase section
3. **Follow the file-by-file reference** to know exactly what to change
4. **Each phase section has code snippets** — use them as starting points
5. **Test after each phase** — run `npm run build` in both frontend and backend
6. **Update the status emojis** (🔴→🟡→🟢) as you complete phases

### Quick Start Commands
```bash
# Backend
cd backend
npm run dev

# Frontend (separate terminal)
cd frontend
npm run dev

# Open browser
http://localhost:3000
```

---

**Last Updated:** April 17, 2026  
**Maintainer:** CodeClash Team
