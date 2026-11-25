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
│   └── run-backend.js                   # Cross-platform launcher for backend/.venv uvicorn
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
├── backend/                             # FastAPI + web3.py + hashlib + SQLite
│   ├── .env.example                     # Backend environment variable template
│   ├── main.py                          # Minimal FastAPI app + StaticFiles mount for /uploads
│   ├── database.py                      # Local SQLite (sqlite:///./app.db) + SQLModel get_db()
│   ├── models.py                        # Shared off-chain DB schemas (User, Job, Contract, Milestone, Escrow, Dispute)
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
│       │   └── service.py               # web3.py RPC wrapper for Escrow & SIMIDR contracts
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
| **1. Smart Contracts (On-Chain)** | `blockchain/contracts/SIMIDR.sol`<br>`blockchain/contracts/Escrow.sol`<br>`blockchain/scripts/deploy.js` | `SmartContractProvider` (On-Chain Layer) | `SIM-IDR` ERC-20 token, `Escrow.sol` multi-milestone vault (`ReentrancyGuard`, 5-day auto-release, handover, `RELEASE`/`REFUND`/`SPLIT` arbiter verdict, immutable closure), and deployment script. | `@Member-1` |
| **2. Smart Contract RPC Service** | `backend/services/smart_contract/service.py` | `SmartContractProvider` (`EscrowPaymentContract`) | `web3.py` bridge connecting FastAPI to Hardhat node (`get_contract`, `execute_arbiter_verdict_onchain`, `close_contract_onchain`). | `@Member-2` |
| **3. Platform Orchestrator** | `backend/services/orchestrator/router.py` | `PlatformOrchestrator` & `MilestoneStatusNotification` | Core REST API routes (`/api/v1/contracts`, `/milestones/*`, file upload + `hashlib` SHA-256 hashing to `/uploads`) and cross-service workflow orchestration. | `@Member-3` |
| **4. AI Matching Service** | `backend/services/ai_matching/service.py` | `AIMatchingProvider` (`MatchingServiceContract`) | Anonymized candidate recommendation & skill scoring engine (`/api/v1/matching/recommend`). | `@Member-4` |
| **5. Dispute Handler Service** | `backend/services/dispute_handler/service.py` | `DisputeResolutionContract` | Dispute filing, evidence upload hashing, escrow freeze triggers, and executing arbiter rulings (`/api/v1/disputes`, `/verdict`). | `@Member-5` |
| **6. Frontend Participant Views** | `frontend/src/pages/ClientView.jsx`<br>`frontend/src/pages/FreelancerView.jsx`<br>`frontend/src/pages/ArbiterView.jsx` | `ClientParticipant`<br>`FreelancerParticipant`<br>`ArbiterParticipant` | Role dashboards for job posting, anonymized AI match selection, escrow funding, deliverable submission, and arbiter dispute resolution. | `@Member-6` |

---

## Local Setup & Quick-Start Guide

### 1. One-Time Setup (Run from the Project Root)

#### A. Install Node Dependencies (Root, Blockchain, Frontend)
```powershell
npm install
npm --prefix blockchain install
npm --prefix frontend install
```

#### B. Initialize Python Virtual Environment & Backend Packages
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

#### C. Create Local Environment Files (`.env`)
```powershell
# Windows PowerShell:
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
# macOS / Linux:
# cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env
```

#### D. Compile Smart Contracts (Generates ABIs for Backend)
```powershell
cd blockchain
npx hardhat compile
cd ..
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
| **Backend** | FastAPI + SQLModel + `web3.py` | `http://localhost:8000` (Swagger: `/docs`) |
| **Frontend** | Vite + React + Tailwind CSS | `http://localhost:5173` |

#### Step 2 — Deploy Smart Contracts Locally
Open a **second terminal** at the project root and run:
```powershell
npm run deploy
```

#### Step 3 — Verify `backend/.env`
Ensure `backend/.env` contains the addresses printed by `npm run deploy` and Hardhat's local test keys (no quotes, no spaces around `=`):
```ini
DATABASE_URL=sqlite:///./app.db
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=llama-3.3-70b-versatile
RPC_URL=http://127.0.0.1:8545
SIMIDR_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ESCROW_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
PLATFORM_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ARBITER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
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

### Quick Reminders
- **Restarted `npm run dev`?** The local Hardhat node resets to block 0 on restart — just re-run `npm run deploy` in a second terminal (contract addresses stay identical on a fresh node).
- **Prefer separate terminals?** Run `npm run blockchain`, `npm run backend`, and `npm run frontend` individually from the project root.
