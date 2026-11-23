# Gigly — Freelancer Matching & Smart Contract Escrow Platform

Barebones 3-folder modular scaffold (`/blockchain`, `/backend`, `/frontend`) for **Gigly**, designed so a 6-person engineering team can develop in parallel without Git merge conflicts.

---

## Project Structure

```text
project-root/
├── README.md
├── .gitignore
├── package.json                         # Root one-command dev runner (concurrently)
├── scripts/
│   └── run-backend.js                   # Cross-platform launcher for backend/.venv uvicorn
├── blockchain/                          # Hardhat + Solidity (^0.8.20) + OpenZeppelin
│   ├── hardhat.config.js                # Minimal Hardhat local network config
│   ├── package.json                     # hardhat, @nomicfoundation/hardhat-toolbox, @openzeppelin/contracts
│   ├── contracts/
│   │   ├── SIMIDR.sol                   # [BLANK] ERC-20 simulated token (SIM-IDR)
│   │   └── Escrow.sol                   # [BLANK] Milestone escrow + ReentrancyGuard + Arbiter verdict
│   └── scripts/
│       └── deploy.js                    # [BLANK] Local Hardhat deployment script
├── backend/                             # FastAPI + web3.py + hashlib + SQLite
│   ├── .env.example                     # Backend environment variable template
│   ├── main.py                          # Minimal FastAPI app + StaticFiles mount for /uploads
│   ├── database.py                      # Local SQLite (sqlite:///./app.db) + SQLModel get_db()
│   ├── models.py                        # Shared off-chain DB skeletons (User, Job, Contract, Milestone, Escrow, Dispute)
│   ├── requirements.txt                 # fastapi, uvicorn, sqlmodel, web3, python-multipart, python-dotenv
│   ├── uploads/                         # Local off-chain storage for deliverables & dispute evidence
│   │   └── .gitkeep
│   └── services/
│       ├── orchestrator/                # PlatformOrchestrator & MilestoneStatusNotification
│       │   ├── __init__.py
│       │   └── router.py                # [BLANK] Main API routes (/api/v1/contracts, /milestones/*, etc.)
│       ├── ai_matching/                 # AIMatchingProvider (MatchingServiceContract)
│       │   ├── __init__.py
│       │   └── service.py               # [BLANK] Anonymized matching (/api/v1/matching/recommend)
│       ├── smart_contract/              # SmartContractProvider (EscrowPaymentContract)
│       │   ├── __init__.py
│       │   └── service.py               # [BLANK] web3.py RPC wrapper (/api/v1/escrow/lock, reassign, close)
│       └── dispute_handler/             # DisputeResolutionContract
│           ├── __init__.py
│           └── service.py               # [BLANK] Dispute & arbiter verdict (/api/v1/disputes, /verdict)
└── frontend/                            # Vite + React + Tailwind CSS
    ├── .env.example                     # Frontend environment variable template
    └── src/
        └── pages/
            ├── ClientView.jsx           # [BLANK] ClientParticipant dashboard
            ├── FreelancerView.jsx       # [BLANK] FreelancerParticipant dashboard
            └── ArbiterView.jsx          # [BLANK] ArbiterParticipant dashboard
```

---

## 6-Person Team Task Division

Each module is isolated into dedicated files so team members can build independently without merge conflicts.

| Module | File Path(s) | SoaML Component / Role | Responsibilities | Assignee |
| :--- | :--- | :--- | :--- | :--- |
| **1. Smart Contracts (On-Chain)** | `blockchain/contracts/SIMIDR.sol`<br>`blockchain/contracts/Escrow.sol`<br>`blockchain/scripts/deploy.js` | `SmartContractProvider` (On-Chain Layer) | Implement `SIM-IDR` ERC-20 token, `Escrow.sol` milestone vault with OpenZeppelin `ReentrancyGuard` & arbiter verdict split, and local Hardhat deployment script. | `@Member-1` |
| **2. Smart Contract RPC Service** | `backend/services/smart_contract/service.py` | `SmartContractProvider` (`EscrowPaymentContract`) | `web3.py` bridge connecting FastAPI to Hardhat node (`/api/v1/escrow/lock`, milestone release, reassign, close, and SHA-256 hash anchoring). | `@Member-2` |
| **3. Platform Orchestrator** | `backend/services/orchestrator/router.py` | `PlatformOrchestrator` & `MilestoneStatusNotification` | Core REST API routes (`/api/v1/contracts`, `/milestones/*`, file upload + `hashlib` SHA-256 hashing to `/uploads`) and cross-service workflow orchestration. | `@Member-3` |
| **4. AI Matching Service** | `backend/services/ai_matching/service.py` | `AIMatchingProvider` (`MatchingServiceContract`) | Anonymized candidate recommendation & skill scoring engine (`/api/v1/matching/recommend`). | `@Member-4` |
| **5. Dispute Handler Service** | `backend/services/dispute_handler/service.py` | `DisputeResolutionContract` | Dispute filing, evidence upload hashing, escrow freeze triggers, and executing arbiter rulings (`/api/v1/disputes`, `/verdict`). | `@Member-5` |
| **6. Frontend Participant Views** | `frontend/src/pages/ClientView.jsx`<br>`frontend/src/pages/FreelancerView.jsx`<br>`frontend/src/pages/ArbiterView.jsx` | `ClientParticipant`<br>`FreelancerParticipant`<br>`ArbiterParticipant` | Role dashboards for job posting, anonymized AI match selection, escrow funding, deliverable submission, and arbiter dispute resolution. | `@Member-6` |

---

## One-Time Setup

### 1. Environment Variables
Copy `.env.example` to `.env` in both `/backend` and `/frontend`:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
*(On Windows PowerShell: `Copy-Item backend/.env.example backend/.env; Copy-Item frontend/.env.example frontend/.env`)*

### 2. Install Node Dependencies (Root, Blockchain, Frontend)
```bash
npm install
npm --prefix blockchain install
npm --prefix frontend install
```

### 3. Setup Python Virtual Environment (`backend/.venv`)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

---

## Daily Dev Workflow

### 1. Start All Services (Blockchain + Backend + Frontend)
From the project root, run a single command to launch the local Hardhat node (`BLOCKCHAIN`), FastAPI server (`BACKEND`), and Vite React app (`FRONTEND`) simultaneously:
```bash
npm run dev
```

### 2. Deploy Smart Contracts Locally
Once the `BLOCKCHAIN` Hardhat node is running on `http://127.0.0.1:8545`, open a **second terminal** at the project root and run:
```bash
npm run deploy
```
Copy the deployed `SIMIDR` and `Escrow` contract addresses into `backend/.env`.
