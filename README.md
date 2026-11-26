# Gigly — Freelancer Matching & Smart Contract Escrow Platform

Modular 3-folder prototype (`/blockchain`, `/backend`, `/frontend`) for **Gigly**, designed so a 6-person engineering team can develop in parallel without Git merge conflicts.

---

## Project Structure

```text
project-root/
├── README.md
├── .gitignore
├── package.json                         # Root one-command dev runner (concurrently)
├── scripts/
│   └── run-backend.js                   # Launches the Python/FastAPI backend via Uvicorn
├── blockchain/                          # Hardhat + Solidity (^0.8.20) + OpenZeppelin
│   ├── hardhat.config.js                # Hardhat local network config (chainId 31337)
│   ├── package.json                     # hardhat, @nomicfoundation/hardhat-toolbox, @openzeppelin/contracts
│   ├── contracts/
│   │   ├── SIMIDR.sol                   # ERC-20 simulated token (SIM-IDR) + testing faucet
│   │   └── Escrow.sol                   # Multi-milestone escrow + 5-day auto-release + handover + 3-way arbiter verdict
│   ├── scripts/
│   │   └── deploy.js                    # Local Hardhat deployment script
│   └── test/
│       └── Escrow.test.js               # Hardhat/Chai unit & integration test suite
├── backend/                             # FastAPI + SQLModel + PostgreSQL + Alembic + web3.py
│   ├── .env.example                     # Backend environment variable template
│   ├── main.py                          # FastAPI app: routers, /uploads mount, auto-release background task
│   ├── database.py                      # PostgreSQL engine, get_db(), init_db() = run Alembic migrations
│   ├── models.py                        # Shared tables, including Contract, Dispute, and DisputeEvidence metadata
│   ├── alembic.ini                      # Alembic config (see "Database Migrations")
│   ├── migrations/versions/             # Alembic revisions, applied automatically on startup
│   ├── requirements.txt
│   ├── tests/test_migrations.py         # PostgreSQL migrations and models vs migrations in sync
│   ├── uploads/                         # Local off-chain storage for deliverables & dispute evidence
│   └── services/
│       ├── auth/router.py               # Login & bearer tokens (/api/v1/auth)
│       ├── invitations/router.py        # Client invites, freelancer accepts (/api/v1/invitations)
│       ├── ai_matching/                 # AIMatchingProvider: anonymized matching (/api/v1/matching), freelancer profile (/api/v1/freelancer)
│       │   ├── docs/                    # Matching design & context
│       │   └── script/seed_db.py        # Seeds clients & freelancers into PostgreSQL
│       ├── smart_contract/service.py    # SmartContractProvider: web3.py bridge, custodial dev wallets, faucet
│       ├── orchestrator/                # PlatformOrchestrator (/api/v1/contracts, /escrow, /milestones, /projects, /files, /wallet)
│       │   ├── router.py
│       │   ├── workflow.py              # Shared milestone state transitions & activity log
│       │   └── auto_release.py          # Releases milestones after the 5-day review timeout
│       └── dispute_handler/             # DisputeResolutionContract (/api/v1/disputes, /evidence, /verdict)
│           ├── service.py
│           └── seed_arbiter.py          # Creates the arbiter account
└── frontend/                            # Vite + React + TypeScript + Tailwind CSS
    ├── .env.example                     # API base URL + VITE_*_API / VITE_USE_MOCK toggles
    └── src/
        ├── services/                    # API clients (auth, matching, projectWork, ...) and mock store
        └── pages/
            ├── Login.tsx
            ├── ClientView.tsx, client/  # ClientParticipant: projects, matching, contracts, disputes
            ├── FreelancerView.tsx, FreelancerProjects.tsx, FreelancerProfile.tsx, ReceivedInvitations.tsx
            └── ArbiterView.tsx          # ArbiterParticipant dashboard
```

---

## 6-Person Team Task Division

Each module is isolated into dedicated files so team members can build independently without merge conflicts.

| Module | File Path(s) | SoaML Component / Role | Responsibilities | Assignee |
| :--- | :--- | :--- | :--- | :--- |
| **1. AI Matching** | `backend/services/ai_matching/` | `AIMatchingProvider` (`MatchingServiceContract`) | CV indexing, anonymized candidate recommendation & scoring, freelancer profile, seed data. | Krisna (`@yaisnaa`) |
| **2. Smart Contracts** | `blockchain/`<br>`backend/services/smart_contract/service.py` | `SmartContractProvider` (`EscrowPaymentContract`) | `SIM-IDR` token, `Escrow.sol` (milestones, 5-day auto-release, handover, arbiter verdict), deployment, `web3.py` bridge. | Fikri (`@fikrifalah`) |
| **3. Dispute Handling & Orchestrator** | `backend/services/dispute_handler/`<br>`backend/services/orchestrator/`<br>`backend/migrations/` | `DisputeResolutionContract`<br>`PlatformOrchestrator` & `MilestoneStatusNotification` | Disputes, evidence hashing, on-chain freeze & verdict; contracts, escrow lock, milestone submit/approve, files, wallet, auto-release; DB migrations. | Daniel (`@danarrigo`) |
| **4. Freelancer Interface** | `frontend/src/pages/Freelancer*.tsx`, `ReceivedInvitations.tsx` | `FreelancerParticipant` | Invitations, profile, project workspace & deliverable submission. | Dani (`@LaurensiusDani`) |
| **5. Client Interface** | `frontend/src/pages/ClientView.tsx`, `frontend/src/pages/client/` | `ClientParticipant` | Job posting, AI match selection, contract builder, escrow funding, approvals. | Kenny (`@kaem-nyoba`) |
| **6. Arbiter Interface** | `frontend/src/pages/ArbiterView.tsx` | `ArbiterParticipant` | Dispute review & verdict. | Jeko |

---

## Local Setup & Quick-Start Guide

### 1. One-Time Setup (Run from the Project Root)

#### A. Install Node Dependencies (Root, Blockchain, Frontend)
```powershell
npm install
npm --prefix blockchain install
npm --prefix frontend install
```

#### B. Create the PostgreSQL Database
Install PostgreSQL, then create the local development role and database (or configure `DATABASE_URL` for an existing database):
```powershell
psql -U postgres -c "CREATE USER gigly WITH PASSWORD 'gigly';"
psql -U postgres -c "CREATE DATABASE gigly OWNER gigly;"
psql -U postgres -c "CREATE DATABASE gigly_test OWNER gigly;"
```
The connection string in `backend/.env.example` uses these local development credentials. Replace them for your own PostgreSQL setup.

#### C. Initialize Python Virtual Environment & Backend Packages
```powershell
cd backend
python -m venv .venv
# Windows PowerShell (if script execution is blocked, run first):
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

#### D. Create Local Environment Files (`.env`)
```powershell
# Windows PowerShell:
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
# macOS / Linux:
# cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env
```

#### E. Compile Smart Contracts (Generates ABIs for Backend)
```powershell
cd blockchain
npx hardhat compile
cd ..
```

#### F. Seed Demo Data (Optional, Once)
The PostgreSQL schema is created and migrated automatically when the backend starts. To fill it with demo accounts:
```powershell
backend/.venv/Scripts/python backend/services/ai_matching/script/seed_db.py   # clients & freelancers (needs LLM_API_KEY)
cd backend
.venv/Scripts/python -m services.dispute_handler.seed_arbiter                  # arbiter@example.com / 1234
cd ..
# macOS / Linux: use .venv/bin/python instead of .venv/Scripts/python
```

---

### 2. Daily Dev Workflow

#### Step 1 — Start All 3 Services in One Terminal
From the project root:
```powershell
npm run dev
```

| Service | Stack | Local URL |
| :--- | :--- | :--- |
| **Blockchain** | Hardhat Local Node (Chain ID `31337`) | `http://127.0.0.1:8545` |
| **Backend** | FastAPI + SQLModel + Alembic + `web3.py` | `http://localhost:8000` (Swagger: `/docs`) |
| **Frontend** | Vite + React + Tailwind CSS | `http://localhost:5173` |

#### Step 2 — Deploy Smart Contracts Locally
Open a **second terminal** at the project root and run:
```powershell
npm run deploy
```

#### Step 3 — Verify `backend/.env`
Ensure `backend/.env` contains the addresses printed by `npm run deploy` and Hardhat's local test keys (no quotes, no spaces around `=`):
```ini
DATABASE_URL=postgresql+psycopg://gigly:gigly@localhost:5432/gigly
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=llama-3.3-70b-versatile
RPC_URL=http://127.0.0.1:8545
SIMIDR_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ESCROW_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
PLATFORM_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ARBITER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
AUTO_RELEASE_INTERVAL_SECONDS=60
```

---

### 3. Quick Verification Checks
- **Run Smart Contract Tests:**
  ```powershell
  cd blockchain
  npx hardhat test
  ```
- **Check Backend API:** Open `http://localhost:8000/health` (returns `{"status":"ok"}`) or `http://localhost:8000/docs`.
- **Check Frontend:** Open `http://localhost:5173`.

---

### Database & Migrations (PostgreSQL + Alembic)
The backend uses PostgreSQL through `DATABASE_URL` (see `backend/.env.example`). On every startup, `database.init_db()` runs `alembic upgrade head` against that database. After pulling a schema revision, restart the backend (for example with `npm run dev`) and Alembic applies any unapplied revisions; it records the current revision in `alembic_version`, so already-applied migrations are not repeated.

The schema stores application data off-chain, including user and freelancer profiles, jobs, contracts, milestones, disputes, and dispute-evidence metadata. Evidence files are stored off-chain under `backend/uploads/`; PostgreSQL stores their filename, uploader, size, SHA-256 digest, and upload time. The escrow smart contract stores only the data needed to execute settlement, including the agreed contract hash and on-chain payment state. An arbiter reviews the off-chain case evidence and issues a `RELEASE`, `REFUND`, or `SPLIT` verdict through the dispute API.

Migration `0002_contract_escrow_dispute.py` already creates the contract, dispute, and dispute-evidence tables for a fresh database. Runtime services, tests, and AI evaluation use PostgreSQL. Tests require a separate `TEST_DATABASE_URL`; each test creates and removes a unique temporary schema so the configured test database's public schema is untouched. Set it in `backend/.env`, or in PowerShell before running tests:
```powershell
$env:TEST_DATABASE_URL="postgresql+psycopg://gigly:gigly@localhost:5432/gigly_test"
cd backend
.venv/Scripts/python -m pytest
```
Changing `DATABASE_URL` to another PostgreSQL database does not transfer rows; export/import data separately if it must be retained. Existing local database files are not automatically migrated or deleted.

When you change a table (`backend/models.py` or a module's `SQLModel` table), create a migration and commit it together with the model change:
```powershell
cd backend
alembic revision --autogenerate -m "short description"   # writes backend/migrations/versions/<rev>_<slug>.py
```
Review the generated file before committing it; autogenerate can need manual edits. Restart the backend to apply the revision, or run `alembic upgrade head` manually. `alembic current` shows the database version. Run `python -m pytest tests/test_migrations.py` with `TEST_DATABASE_URL` set to verify that a fresh schema and the SQLModel definitions remain in sync.

---

### Quick Reminders
- **Restarted `npm run dev`?** The local Hardhat node resets to block 0 on restart — just re-run `npm run deploy` in a second terminal (contract addresses stay identical on a fresh node).
- **Prefer separate terminals?** Run `npm run blockchain`, `npm run backend`, and `npm run frontend` individually from the project root.
