# CodeClash Proceed Document

This document is the Single Source of Truth for the CodeClash application.

It defines:
- the current backend API contract
- the frontend architecture for the upcoming Next.js 15 App Router app
- the reusable global UI system
- the implementation scope for Auth, Dashboard, and Battle Arena
- the deployment plan

This document reflects the backend as it exists now in `/backend`. Where backend behavior is incomplete or inconsistent, that is explicitly called out so the frontend can handle it safely without inventing behavior.

## 1. Product Summary

CodeClash is a real-time competitive coding platform where two users enter a room, configure a duel, receive the same problem, submit solutions, and compare outcomes through live match events, ELO changes, and post-match analysis.

Frontend target:
- `frontend/` using Next.js 15
- App Router only
- Tailwind CSS
- dark, elegant, high-contrast design
- one primary accent color
- minimal dependencies

Backend target:
- `backend/` Node + Express
- PostgreSQL + Drizzle ORM
- Socket.IO for real-time events
- JWT authentication

## 2. Backend Data Model

These core entities exist in the backend schema and drive the frontend shape.

### `users`
- `id: uuid`
- `email: string`
- `username: string`
- `elo: number`
- `codeDna: { weak_topics?: string[]; patterns?: string[]; ai_summary?: string }`
- `metadata: { avatar_url?: string; college?: string; bio?: string }`
- `createdAt: timestamp`
- `updatedAt: timestamp`

### `rooms`
- `id: uuid`
- `roomCode: string`
- `hostId: uuid`
- `guestId: uuid | null`
- `status: "waiting" | "ready" | "active" | "done"`
- `options`
  - `dead_mans_switch?: { enabled: boolean; idle_seconds: number }`
  - `blind_rating?: { enabled: boolean }`
  - `wager?: { enabled: boolean; amount: number }`
  - `live_commentator?: boolean`
  - `spectators_allowed?: boolean`
  - `time_limit_minutes?: number`
  - `difficulty?: "easy" | "medium" | "hard"`
  - `topic?: string | null`
- `createdAt`
- `updatedAt`

### `problems`
- `id: uuid`
- `title: string`
- `slug: string`
- `difficulty: "easy" | "medium" | "hard"`
- `topics: string[]`
- `companyTags: string[]`
- `description: string`
- `examples: Array<{ input: string; output: string; explanation?: string }>`
- `constraints: string | null`
- `testCases: Array<{ input: string; expected_output: string; is_hidden: boolean }>`
- `starterCode: { javascript?: string; python?: string; cpp?: string; java?: string }`
- `editorial: string | null`
- `metadata: Record<string, unknown>`
- `createdAt`

### `matches`
- `id: uuid`
- `roomId: uuid`
- `problemId: uuid`
- `player1Id: uuid`
- `player2Id: uuid`
- `winnerId: uuid | null`
- `status: "active" | "finished" | "abandoned"`
- `startedAt`
- `endedAt`
- `metadata`
  - `spectator_count?: number`
  - `final_scores?: { p1: number; p2: number }`
- `createdAt`

### `submissions`
- `id: uuid`
- `matchId: uuid`
- `userId: uuid`
- `code: string`
- `language: string`
- `verdict: "accepted" | "wrong_answer" | "time_limit_exceeded" | "runtime_error" | "compilation_error" | "pending"`
- `runtimeMs: number | null`
- `memoryKb: number | null`
- `testCasesPassed: number`
- `testCasesTotal: number`
- `complexity: { time?: string; space?: string; ai_note?: string; explanation?: string }`
- `isFinal: boolean`
- `submittedAt`

### `match_events`
- append-only timeline for battle activity
- `eventType` may include:
  - `match_start`
  - `code_change`
  - `run_code`
  - `submission`
  - `test_passed`
  - `test_failed`
  - `wrong_answer`
  - `accepted`
  - `idle_warning`
  - `lines_deleted`
  - `surrender`
  - `match_end`
  - `ai_comment`
  - `spectator_joined`

### `elo_history`
- stores ELO transitions per match

### `topic_stats`
- stores topic performance summaries per user

## 3. Global API Rules

Base URL:
- backend origin, all REST routes under `/api/*`

Health route:
- `GET /health`

Auth transport:
- protected REST routes require `Authorization: Bearer <token>`
- Socket.IO requires `auth.token`

Common auth errors:
- `401 { "error": "Missing or invalid Authorization header" }`
- `401 { "error": "Invalid or expired token" }`

Common route error:
- `404 { "error": "Route not found" }`

Content type:
- `application/json`

## 4. Full API Documentation

This section maps every discovered backend route in `/backend/src/routes`.

---

## 4.1 Health

### `GET /health`

Auth:
- public

Request:
- no params
- no query
- no body

Success `200`:
```json
{
  "status": "ok",
  "service": "codeclash-api",
  "timestamp": "2026-04-17T00:00:00.000Z"
}
```

---

## 4.2 Auth API

### `POST /api/auth/register`

Auth:
- public

Body:
```json
{
  "email": "user@example.com",
  "username": "lost_arc",
  "password": "supersecret123"
}
```

Validation:
- `email` must be a valid email
- `username` must be 3-50 chars and only letters, numbers, or `_`
- `password` min length is 8

Success `201`:
```json
{
  "user": {
    "id": "uuid",
    "username": "lost_arc",
    "elo": 1200
  },
  "token": "jwt-token"
}
```

Error cases:
```json
{ "error": "validation message" }
```
```json
{ "error": "Email is already registered" }
```
```json
{ "error": "Username is already taken" }
```
```json
{ "error": "Internal server error" }
```

### `POST /api/auth/login`

Auth:
- public

Body:
```json
{
  "email": "user@example.com",
  "password": "supersecret123"
}
```

Success `200`:
```json
{
  "user": {
    "id": "uuid",
    "username": "lost_arc",
    "elo": 1200
  },
  "token": "jwt-token"
}
```

Error cases:
```json
{ "error": "validation message" }
```
```json
{ "error": "Invalid email or password" }
```

### `GET /api/auth/me`

Auth:
- required

Request:
- no params
- no query
- no body

Success `200`:
```json
{
  "id": "uuid",
  "username": "lost_arc",
  "email": "user@example.com",
  "elo": 1200,
  "metadata": {
    "avatar_url": "https://example.com/avatar.png",
    "college": "UCE OU",
    "bio": "Competitive programmer"
  },
  "codeDna": {
    "weak_topics": ["graphs"],
    "patterns": ["brute_force_first"],
    "ai_summary": "Needs faster optimization recognition"
  },
  "createdAt": "2026-04-17T00:00:00.000Z"
}
```

Errors:
```json
{ "error": "User not found" }
```

---

## 4.3 Rooms API

### `POST /api/rooms`

Auth:
- required

Body:
```json
{
  "options": {
    "time_limit_minutes": 30,
    "difficulty": "medium",
    "topic": "graphs",
    "spectators_allowed": true,
    "live_commentator": true,
    "blind_rating": { "enabled": true },
    "dead_mans_switch": { "enabled": true, "idle_seconds": 45 }
  }
}
```

Success `201`:
```json
{
  "id": "uuid",
  "roomCode": "ABC123",
  "hostId": "uuid",
  "guestId": null,
  "status": "waiting",
  "options": {
    "time_limit_minutes": 30,
    "difficulty": "medium",
    "topic": "graphs",
    "spectators_allowed": true,
    "live_commentator": true,
    "blind_rating": { "enabled": true },
    "dead_mans_switch": { "enabled": true, "idle_seconds": 45 }
  },
  "createdAt": "2026-04-17T00:00:00.000Z",
  "updatedAt": "2026-04-17T00:00:00.000Z"
}
```

### `GET /api/rooms/:code`

Auth:
- required

Params:
- `code: string`

Success `200`:
```json
{
  "id": "uuid",
  "roomCode": "ABC123",
  "hostId": "uuid",
  "guestId": "uuid",
  "status": "ready",
  "options": {
    "time_limit_minutes": 30,
    "difficulty": "medium",
    "topic": "graphs",
    "spectators_allowed": true,
    "live_commentator": true,
    "blind_rating": { "enabled": true },
    "dead_mans_switch": { "enabled": true, "idle_seconds": 45 }
  },
  "createdAt": "2026-04-17T00:00:00.000Z",
  "updatedAt": "2026-04-17T00:00:00.000Z",
  "host": {
    "id": "uuid",
    "username": "hostUser",
    "elo": 1234
  },
  "guest": {
    "id": "uuid",
    "username": "guestUser",
    "elo": 1198
  }
}
```

### `POST /api/rooms/:code/join`

Auth:
- required

Params:
- `code: string`

Body:
- none

Success `200`:
- returns updated room row with `guestId` filled and `status` typically set to `ready`

Socket side effect:
- emits `room:guest_joined`

Payload:
```json
{
  "guest": {
    "id": "uuid",
    "username": "guestUser",
    "elo": 1200
  }
}
```

### `POST /api/rooms/:code/start`

Auth:
- required
- only host can start

Params:
- `code: string`

Body:
- none

Success `201`:
```json
{
  "match": {
    "id": "uuid",
    "roomId": "uuid",
    "problemId": "uuid",
    "player1Id": "uuid",
    "player2Id": "uuid",
    "winnerId": null,
    "status": "active",
    "startedAt": "2026-04-17T00:00:00.000Z",
    "endedAt": null,
    "metadata": {},
    "createdAt": "2026-04-17T00:00:00.000Z"
  },
  "problem": {
    "id": "uuid",
    "title": "Two Sum",
    "slug": "two-sum",
    "difficulty": "easy",
    "topics": ["arrays", "hashing"],
    "companyTags": [],
    "description": "Problem text",
    "examples": [],
    "constraints": "Constraint text",
    "testCases": [
      {
        "input": "nums=[2,7,11,15], target=9",
        "expected_output": "[0,1]",
        "is_hidden": false
      }
    ],
    "starterCode": {
      "javascript": "function solve() {}"
    },
    "editorial": "Editorial text",
    "metadata": {},
    "createdAt": "2026-04-17T00:00:00.000Z"
  }
}
```

Important behavior:
- this response happens before the live match truly starts
- server emits a 5-second countdown through sockets
- timer starts after countdown

Socket events after success:
```json
{ "seconds": 5 }
```
Event name: `room:countdown`

```json
{
  "match_id": "uuid",
  "problem": {
    "id": "uuid",
    "title": "Two Sum"
  },
  "time_limit_ms": 1800000
}
```
Event name: `match:started`

```json
{ "match_id": "uuid" }
```
Event name: `match:join_room`

### `PATCH /api/rooms/:code/options`

Auth:
- required
- host only

Params:
- `code: string`

Body:
```json
{
  "options": {
    "difficulty": "hard",
    "topic": "dp",
    "spectators_allowed": false
  }
}
```

Success `200`:
- returns updated room row

Socket side effect:
- emits `room:options_updated`

Payload:
```json
{
  "options": {
    "difficulty": "hard",
    "topic": "dp",
    "spectators_allowed": false
  }
}
```

### `DELETE /api/rooms/:code`

Auth:
- required
- host only

Params:
- `code: string`

Success `200`:
```json
{ "message": "Room closed" }
```

Socket side effect:
```json
{ "room_code": "ABC123" }
```
Event name: `room:closed`

---

## 4.4 Matches API

### `GET /api/matches/history`

Auth:
- required

Query:
- `limit?: number` default `20`
- `offset?: number` default `0`

Success `200`:
```json
{
  "matches": [
    {
      "id": "uuid",
      "roomId": "uuid",
      "problemId": "uuid",
      "player1Id": "uuid",
      "player2Id": "uuid",
      "winnerId": "uuid",
      "status": "finished",
      "startedAt": "2026-04-17T00:00:00.000Z",
      "endedAt": "2026-04-17T00:20:00.000Z",
      "metadata": {},
      "createdAt": "2026-04-17T00:00:00.000Z",
      "problem": {
        "title": "Two Sum",
        "slug": "two-sum",
        "difficulty": "easy"
      },
      "opponent": {
        "username": "otherUser",
        "elo": 1216
      },
      "eloDelta": 16,
      "result": "win"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

### `GET /api/matches/:id`

Auth:
- required

Params:
- `id: uuid`

Success `200`:
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "problemId": "uuid",
  "player1Id": "uuid",
  "player2Id": "uuid",
  "winnerId": null,
  "status": "active",
  "startedAt": "2026-04-17T00:00:00.000Z",
  "endedAt": null,
  "metadata": {},
  "createdAt": "2026-04-17T00:00:00.000Z",
  "problem": {
    "id": "uuid",
    "title": "Two Sum",
    "slug": "two-sum",
    "difficulty": "easy",
    "topics": ["arrays"],
    "companyTags": [],
    "description": "Problem text",
    "examples": [],
    "constraints": "Constraint text",
    "testCases": [
      {
        "input": "nums=[2,7,11,15], target=9",
        "expected_output": "[0,1]",
        "is_hidden": false
      }
    ],
    "starterCode": {
      "javascript": "function solve() {}"
    },
    "editorial": "Editorial text",
    "metadata": {},
    "createdAt": "2026-04-17T00:00:00.000Z"
  },
  "player1": {
    "id": "uuid",
    "username": "hostUser",
    "elo": 1200
  },
  "player2": {
    "id": "uuid",
    "username": "guestUser",
    "elo": 1210
  }
}
```

### `GET /api/matches/:id/events`

Auth:
- required

Params:
- `id: uuid`

Success `200`:
```json
[
  {
    "id": "uuid",
    "matchId": "uuid",
    "userId": "uuid",
    "eventType": "submission",
    "payload": {},
    "createdAt": "2026-04-17T00:10:00.000Z"
  }
]
```

### `GET /api/matches/:id/debrief`

Auth:
- required

Params:
- `id: uuid`

Success `200`:
```json
{
  "match": {
    "id": "uuid",
    "status": "finished",
    "startedAt": "2026-04-17T00:00:00.000Z",
    "endedAt": "2026-04-17T00:20:00.000Z",
    "winner_id": "uuid"
  },
  "problem": {
    "id": "uuid",
    "title": "Two Sum",
    "difficulty": "easy",
    "topics": ["arrays"],
    "editorial": "Editorial text"
  },
  "player1": {
    "id": "uuid",
    "username": "hostUser",
    "elo": 1216,
    "final_submission": null,
    "solve_time_ms": 120000,
    "score": 87,
    "elo_delta": 16,
    "old_elo": 1200,
    "new_elo": 1216,
    "submission_count": 3
  },
  "player2": {
    "id": "uuid",
    "username": "guestUser",
    "elo": 1184,
    "final_submission": null,
    "solve_time_ms": 240000,
    "score": 55,
    "elo_delta": -16,
    "old_elo": 1200,
    "new_elo": 1184,
    "submission_count": 4
  },
  "events_timeline": []
}
```

### `POST /api/matches/:id/surrender`

Auth:
- required
- user must be a player in the match

Params:
- `id: uuid`

Body:
- none

Success `200`:
```json
{
  "message": "Surrendered",
  "winnerId": "uuid",
  "eloDelta": {
    "winnerDelta": 16,
    "loserDelta": -16
  }
}
```

Socket side effect:
```json
{
  "winner_id": "uuid",
  "reason": "surrender",
  "elo_deltas": {
    "winnerUuid": 16,
    "loserUuid": -16
  }
}
```
Event name: `match:ended`

---

## 4.5 Submissions API

### `POST /api/submissions`

Auth:
- required

Body:
```json
{
  "matchId": "uuid",
  "code": "function solve() {}",
  "language": "javascript"
}
```

Allowed languages:
- `javascript`
- `python`
- `cpp`
- `java`

Success `201`:
```json
{
  "id": "uuid",
  "matchId": "uuid",
  "userId": "uuid",
  "code": "function solve() {}",
  "language": "javascript",
  "verdict": "accepted",
  "runtimeMs": 123,
  "memoryKb": null,
  "testCasesPassed": 10,
  "testCasesTotal": 10,
  "complexity": {},
  "isFinal": true,
  "submittedAt": "2026-04-17T00:00:00.000Z"
}
```

Important current backend behavior:
- JavaScript is actually executed
- other languages are mocked with placeholder/random judging
- accepted submissions do not yet end the match automatically
- live submission socket broadcasts are defined in helper functions but not currently wired from this route

---

## 4.6 Problems API

### `GET /api/problems`

Auth:
- public

Query:
- `difficulty?: "easy" | "medium" | "hard"`
- `topic?: string`
- `limit?: number` default `20`
- `offset?: number` default `0`

Success `200`:
```json
{
  "problems": [
    {
      "id": "uuid",
      "title": "Two Sum",
      "slug": "two-sum",
      "difficulty": "easy",
      "topics": ["arrays", "hashing"],
      "companyTags": ["google"]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/problems/random`

Auth:
- public

Query:
- `difficulty?: "easy" | "medium" | "hard"`
- `topic?: string`

Success `200`:
- returns full problem object with hidden test cases removed

### `GET /api/problems/:slug`

Auth:
- public

Params:
- `slug: string`

Success `200`:
- returns full problem object with hidden test cases removed

---

## 4.7 Users API

### `GET /api/users/me/stats`

Auth:
- required

Success `200`:
```json
{
  "id": "uuid",
  "username": "lost_arc",
  "elo": 1200,
  "codeDna": {},
  "metadata": {},
  "createdAt": "2026-04-17T00:00:00.000Z",
  "wins": 10,
  "losses": 5,
  "totalMatches": 15,
  "topicStats": [],
  "eloHistory": []
}
```

### `PATCH /api/users/me`

Auth:
- required

Body:
```json
{
  "bio": "I like graphs and greedy problems",
  "college": "UCE OU",
  "avatar_url": "https://example.com/avatar.png"
}
```

Success `200`:
```json
{
  "id": "uuid",
  "username": "lost_arc",
  "elo": 1200,
  "metadata": {
    "bio": "I like graphs and greedy problems",
    "college": "UCE OU",
    "avatar_url": "https://example.com/avatar.png"
  }
}
```

### `GET /api/users/:username`

Auth:
- public

Params:
- `username: string`

Success `200`:
```json
{
  "id": "uuid",
  "username": "lost_arc",
  "elo": 1200,
  "metadata": {},
  "codeDna": {},
  "createdAt": "2026-04-17T00:00:00.000Z",
  "topicStats": []
}
```

---

## 4.8 Leaderboard API

### `GET /api/leaderboard`

Auth:
- public

Query:
- `limit?: number` default `50`
- `offset?: number` default `0`

Success `200`:
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "id": "uuid",
      "username": "topPlayer",
      "elo": 1600,
      "metadata": {},
      "createdAt": "2026-04-17T00:00:00.000Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

---

## 4.9 AI API

All AI routes:
- require auth
- may return `500 { "error": "AI unavailable" }`

### `POST /api/ai/hint`

Body:
```json
{
  "problemSlug": "two-sum",
  "currentCode": "function solve() {}",
  "language": "javascript"
}
```

Success `200`:
```json
{ "hint": "Consider using a hash map." }
```

### `POST /api/ai/analyze`

Body:
```json
{ "submissionId": "uuid" }
```

Success `200`:
```json
{
  "complexity": {
    "time": "O(n)",
    "space": "O(n)",
    "ai_note": "Good use of hash map",
    "explanation": "Single pass through array"
  }
}
```

### `POST /api/ai/roast`

Body:
```json
{
  "submissionId": "uuid",
  "code": "function solve() {}",
  "language": "javascript",
  "verdict": "wrong_answer",
  "problem_title": "Two Sum"
}
```

Success `200`:
```json
{ "roast": "Your nested loops are brave but expensive." }
```

### `POST /api/ai/comment`

Body:
```json
{ "matchId": "uuid" }
```

Success `200`:
```json
{ "comment": "Blue player is pushing aggressive submissions." }
```

### `POST /api/ai/autopsy`

Body:
```json
{ "matchId": "uuid" }
```

Success `200`:
```json
{ "autopsy": "The winner recognized the optimal pattern earlier." }
```

### `POST /api/ai/complexity`

Body:
```json
{
  "code": "function solve() {}",
  "language": "javascript"
}
```

Success `200`:
```json
{
  "time": "O(n)",
  "space": "O(n)",
  "explanation": "Uses one hash map lookup per iteration"
}
```

## 5. Socket Contract

Socket auth:
- token is sent as `auth.token`

### Client to Server Events

#### `room:join`
```json
{ "room_code": "ABC123" }
```

#### `room:leave`
```json
{ "room_code": "ABC123" }
```

#### `code:update`
```json
{
  "match_id": "uuid",
  "code_length": 240,
  "cursor_line": 18
}
```

#### `code_change` (legacy)
```json
{
  "roomCode": "ABC123",
  "code": "function solve() {}",
  "language": "javascript",
  "userId": "uuid"
}
```

#### `idle:heartbeat`
```json
{ "match_id": "uuid" }
```

#### `match:surrender`
```json
{ "match_id": "uuid" }
```

#### `spectator:join`
```json
{ "match_id": "uuid" }
```

### Server to Client Events

#### `room:guest_joined`
```json
{
  "guest": {
    "id": "uuid",
    "username": "guestUser",
    "elo": 1200
  }
}
```

#### `room:countdown`
```json
{ "seconds": 5 }
```

#### `match:started`
```json
{
  "match_id": "uuid",
  "problem": {},
  "time_limit_ms": 1800000
}
```

#### `match:join_room`
```json
{ "match_id": "uuid" }
```

#### `room:options_updated`
```json
{ "options": {} }
```

#### `room:closed`
```json
{ "room_code": "ABC123" }
```

#### `match:timer_tick`
```json
{ "remaining_ms": 1799000 }
```

#### `match:idle_warning`
```json
{
  "user_id": "uuid",
  "seconds_idle": 45,
  "seconds_until_delete": 10
}
```

#### `match:lines_deleted`
```json
{
  "user_id": "uuid",
  "lines_deleted": 5
}
```

#### `match:opponent_typing`
```json
{
  "is_typing": true,
  "user_id": "uuid"
}
```

#### `opponent_code_change`
```json
{
  "code": "function solve() {}",
  "language": "javascript",
  "userId": "uuid"
}
```

#### `match:opponent_surrendered`
```json
{ "user_id": "uuid" }
```

#### `match:spectator_joined`
```json
{ "username": "viewer42" }
```

#### `match:submission_result`
```json
{
  "user_id": "uuid",
  "verdict": "accepted",
  "test_cases_passed": 10,
  "test_cases_total": 10,
  "runtime_ms": 123
}
```

#### `match:opponent_accepted`
```json
{ "user_id": "uuid" }
```

#### `match:ended`
```json
{
  "winner_id": "uuid",
  "reason": "surrender",
  "elo_deltas": {
    "user-a": 16,
    "user-b": -16
  }
}
```

#### `match:ai_comment`
```json
{
  "comment": "This contest is turning tactical.",
  "timestamp": 1713370000000
}
```

## 6. Known Backend Gaps And Frontend Safeguards

The frontend must intentionally account for the following current realities.

### 6.1 Submission flow is incomplete
- `POST /api/submissions` stores and judges submissions
- it does not currently:
  - finish the match on accepted
  - emit live submission result events
  - emit opponent accepted events
  - update ELO on accepted solve

Frontend rule:
- treat submit result as local truth for verdict UI
- do not assume accepted verdict ends the battle unless backend later confirms through REST/socket

### 6.2 Match start is delayed
- `POST /api/rooms/:code/start` returns immediately
- real play begins after socket countdown and `match:started`

Frontend rule:
- after start request succeeds, transition into countdown state
- only unlock the editor fully on `match:started`

### 6.3 Match room joining is ambiguous
- backend emits `match:join_room`
- there is no dedicated listener for it
- current practical approach is to join match room by emitting `room:join` with `room_code = match_id`

Frontend rule:
- upon `match:join_room`, emit `room:join` again using the provided `match_id`

### 6.4 Spectator enforcement is weak
- socket spectator join does not verify `spectators_allowed`

Frontend rule:
- gate spectator UI from the client using room options
- do not expose spectator entry when disabled

### 6.5 Dead Man's Switch is presentation-only
- warnings and line-deletion events are emitted
- backend does not actually persist code deletion

Frontend rule:
- show warning banners and visual punishment states
- do not mutate editor code automatically until backend behavior is formalized

### 6.6 Multi-language judging is not production-ready
- JavaScript has real execution path
- Python, C++, Java are placeholders/randomized

Frontend rule:
- clearly label non-JS support as beta if exposed
- default battle editor language to `javascript`

### 6.7 Editorial visibility must be controlled by frontend
- some problem fetches include `editorial`

Frontend rule:
- never show editorial during active battle
- reveal editorial only in post-match/debrief contexts

### 6.8 Some endpoints lack ownership checks
- certain match and AI routes may return data without strict membership validation

Frontend rule:
- only navigate users to resources they legitimately own or can access by product flow
- do not expose internal IDs casually

### 6.9 Startup log mismatch
- server logs mention a `GET /api/submissions/match/:matchId`
- actual route is not implemented

Frontend rule:
- do not build against that route

## 7. Frontend Architecture Flow

The frontend will be a Next.js 15 App Router application in `/frontend`.

### 7.1 Primary principles
- App Router for all pages and layouts
- server components by default
- client components only where interactivity is required
- backend remains source of truth for data
- auth token stored client-side for API and socket usage
- route protection performed in both middleware and layout-level checks
- shared API types and fetch helpers live in a dedicated `lib/` layer

### 7.2 Proposed frontend folders

```txt
frontend/
  src/
    app/
      (marketing)/
      (auth)/
      (protected)/
    components/
      ui/
      auth/
      dashboard/
      battle/
      room/
      profile/
      layout/
    lib/
      api/
      auth/
      sockets/
      utils/
      constants/
      types/
    hooks/
    store/
    styles/
```

### 7.3 Auth flow

1. User visits `/login` or `/register`
2. Submit credentials to backend auth routes
3. Receive `{ user, token }`
4. Persist token client-side
5. Hydrate user state by calling `GET /api/auth/me`
6. Use token for all protected REST requests
7. Use same token when creating the socket connection
8. On `401`, clear session and redirect to `/login`

### 7.4 Protected route flow

Protected route groups:
- dashboard
- room creation/join
- battle arena
- match history
- profile editing

Protection strategy:
- `middleware.ts` checks presence of auth token cookie
- protected layout validates session and redirects if missing
- client fetch wrapper handles `401` and signs user out gracefully

### 7.5 State architecture

Server state:
- handled through fetch helpers and route-based loading
- no heavy global state library required

Client state:
- auth session
- socket connection state
- live battle state
- room countdown state
- code editor state
- transient notifications

Recommended approach:
- React context for auth and socket
- lightweight local state for battle interactions
- avoid Redux/Zustand unless scale later demands it

### 7.6 Real-time battle flow

1. User creates or joins room
2. Room page opens socket and joins room code
3. Guest join updates host UI via socket
4. Host starts match
5. Client receives `room:countdown`
6. Client receives `match:started`
7. Client joins match room
8. Battle page shows timer, problem, code editor, submit actions
9. Editor emits typing and heartbeat events
10. Submit action uses REST `POST /api/submissions`
11. Battle completion is currently determined by:
   - surrender event, or
   - timer ending event, or
   - future backend accepted-submission completion

### 7.7 Rendering strategy

Use server components for:
- leaderboard page
- public profiles
- initial dashboard shell data where practical

Use client components for:
- auth forms
- room controls
- battle arena
- socket-driven countdowns
- editor
- live status bars

## 8. Global Components

These reusable UI atoms and primitives should exist before feature work expands too far.

### Core atoms
- `Button`
- `IconButton`
- `Input`
- `PasswordInput`
- `Textarea`
- `Select`
- `Toggle`
- `Checkbox`
- `Badge`
- `Pill`
- `Avatar`
- `Divider`
- `Spinner`
- `Skeleton`
- `Tooltip`

### Feedback and surface primitives
- `Card`
- `Panel`
- `GlassPanel`
- `Modal`
- `Drawer`
- `Toast`
- `InlineMessage`
- `EmptyState`
- `ErrorState`
- `SectionHeader`

### Navigation and layout
- `AppShell`
- `TopNav`
- `Sidebar`
- `PageHeader`
- `CommandBar`
- `ProtectedLayout`

### Domain-specific reusable components
- `AuthForm`
- `StatCard`
- `EloBadge`
- `ProfileMiniCard`
- `RoomCodeCard`
- `RoomOptionsForm`
- `CountdownOverlay`
- `BattleTimer`
- `BattleStatusPill`
- `CodeEditorShell`
- `ProblemPanel`
- `SubmissionResultCard`
- `MatchEventFeed`
- `LeaderboardTable`
- `MatchHistoryList`

## 9. UI Design Language

### 9.1 Theme
- background: black / charcoal
- surfaces: layered dark grays
- text: near-white with muted gray secondary text
- accent: electric violet or royal blue

Recommended default accent:
- `#7C3AED` or nearby violet tone

### 9.2 Aesthetic goals
- professional
- sleek
- elegant
- spacious
- crisp typography
- subtle gradients only where useful
- restrained motion

### 9.3 Interaction style
- smooth hover transitions
- soft glow on primary actions
- sharp focus states
- strong readability
- minimal clutter

### 9.4 Tailwind conventions
- centralize tokens in Tailwind theme
- keep shadows and gradients minimal
- avoid heavy class duplication by extracting reusable components

## 10. Implementation Plan For Frontend

This is the exact feature scope the frontend implementation will follow after this document is approved.

### 10.1 Setup
- initialize Next.js 15 app in `/frontend`
- configure Tailwind CSS
- add TypeScript path aliases
- define theme tokens
- create foundational layout and utility files

### 10.2 Auth feature
- routes:
  - `/login`
  - `/register`
- capabilities:
  - register
  - login
  - fetch current user
  - persist session
  - logout
  - protected route redirect

### 10.3 Dashboard feature
- route:
  - `/dashboard`
- includes:
  - user greeting
  - ELO summary
  - wins/losses/total matches
  - recent match history
  - quick actions
  - leaderboard preview
  - profile summary

### 10.4 Battle Arena feature
- routes:
  - `/room/new`
  - `/room/[code]`
  - `/battle/[matchId]`
- includes:
  - create room
  - join room
  - room lobby
  - live countdown
  - problem display
  - code editor shell
  - submit solution
  - timer
  - surrender
  - socket status
  - live event banners

### 10.5 Initial pages outside core scope but expected soon after
- `/`
- `/leaderboard`
- `/u/[username]`
- `/matches`
- `/matches/[id]/debrief`

## 11. Frontend Contract Rules

The frontend implementation must follow these rules exactly.

1. Never assume a backend route exists unless defined in Section 4.
2. Never expose editorials during active matches.
3. Default battle language to JavaScript.
4. Treat socket events as enhancements, but keep REST requests as the core mutation path.
5. Treat accepted submission as a verdict result, not guaranteed match completion.
6. Use the room and match IDs exactly as returned by backend.
7. Join the socket room for room code first, then match room after match start.
8. Keep auth and API wrappers centralized so backend changes only affect one layer.
9. If backend inconsistencies are discovered during frontend build, update this document first.

## 12. Deployment Plan

### Frontend
- platform: Vercel
- framework: Next.js 15
- environment variables:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SOCKET_URL`

### Backend
- platform: Railway
- runtime: Node.js
- environment variables expected:
  - `PORT`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `CLIENT_URL`
  - any AI provider secrets used by `/api/ai/*`

### Cross-origin setup
- backend `CLIENT_URL` must match deployed frontend URL
- frontend public env vars must target Railway backend URL

## 13. Immediate Next Step

The next implementation phase should:
- initialize `/frontend`
- build the shared design system
- implement auth flows first
- then dashboard
- then room lobby and battle arena

All of that implementation must stay synchronized with this document. If backend routes evolve, this file must be updated before frontend logic diverges.

## 14. Current Frontend Scaffold Status (Implemented)

The following is now implemented in `frontend/` with Next.js App Router + Tailwind and minimal dependencies.

### 14.1 Setup and dependencies
- Next.js latest (App Router, TypeScript)
- Tailwind CSS v4
- `socket.io-client` for realtime features
- no heavy UI component libraries

### 14.2 Implemented frontend routes
- `/` landing
- `/login`
- `/register`
- `/dashboard`
- `/room/new`
- `/room/[code]`
- `/battle/[matchId]`

### 14.3 Implemented architecture
- Auth provider for login/register/me hydration
- token persistence in localStorage + cookie for middleware route protection
- centralized fetch helper for backend REST calls
- centralized socket helper for JWT socket connection
- protected app shell layout for logged-in routes

### 14.4 Implemented reusable UI primitives
- `Button`
- `Input`
- `Card`

### 14.5 Battle implementation note
- submit flow currently mirrors backend behavior:
  - submission verdict is shown from `POST /api/submissions`
  - frontend does not force end-match on accepted verdict
  - waits for authoritative backend/socket end events
