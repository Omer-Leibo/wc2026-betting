# ⚽ WC2026 Betting

A full-stack web application for managing a FIFA World Cup 2026 prediction/betting game among friends.

## Features

- 🔐 User authentication (register/login) with JWT
- 🎯 Match score predictions for every World Cup game
- 🏆 Special bets: Champion, Top Scorer, Top Assists
- 📊 Real-time leaderboard with live standings
- 🧮 Full scoring engine with bonus system
- 🛡️ Admin panel to manage users and enter results

## Scoring System

### Match Bets
| Stage | Correct Winner | Exact Score |
|-------|---------------|-------------|
| Group Stage | 1 pt | 3 pts |
| Round of 16 / Quarter Finals | 2 pts | 4 pts |
| Semi Finals / Final | 3 pts | 5 pts |

### Special Bets
- Champion: **5 pts**
- Top Scorer: **4 pts**
- Top Assists: **3 pts**

### Bonus System
- Unique exact score (only participant to get it): **+1 pt**
- Group stage accuracy (per round, 24 games):
  - 18–20 correct: **+2 pts**
  - 21–22 correct: **+3 pts**
  - 23–24 correct: **+4 pts**
- Group stage exact scores (per round):
  - 12+ exact: **+3 pts**
  - 18+ exact: **+4 pts**
  - 24 exact: **+5 pts**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (Docker) |
| ORM | Prisma |
| Auth | JWT + bcrypt |

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Installation

```bash
# Clone the repo
git clone https://github.com/Omer-Leibo/wc2026-betting.git
cd wc2026-betting

# Start the database
docker-compose up -d

# Install server dependencies & run migrations
cd server
npm install
npx prisma migrate dev
npx prisma db seed

# Install client dependencies
cd ../client
npm install

# Start both (from root)
cd ..
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` in the `server/` directory:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wc2026"
JWT_SECRET="your-secret-key"
PORT=3001
```

## Project Structure

```
wc2026-betting/
├── client/          # React frontend
├── server/          # Express backend + Prisma
├── docker-compose.yml
└── README.md
```

## Git Workflow

- `main` — production-ready
- `develop` — integration branch
- `feature/*` — feature branches, merged via Pull Request

---

Built by [Omer Leibo](https://github.com/Omer-Leibo)
