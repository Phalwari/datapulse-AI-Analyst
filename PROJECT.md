# Project: DataPulse AI Refactoring & Documentation

## Architecture
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS (SPA running on dev port 5173, proxying `/api` to FastAPI port 8000)
- **Backend**: FastAPI REST server + Uvicorn (running on port 8000)
- **Agent Orchestrator**: LangGraph StateGraph multi-agent engine (`AgentState`, DuckDB `:memory:`, ChromaDB vector store)
- **Shared LLM Utility**: Unified LLM client (`backend/utils/llm.py`) supporting Groq API and OpenRouter API

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Backend Migration & Init Packages | Move backend files to `backend/`, add `__init__.py` files | M1 | R1 |
| 2 | Shared LLM Helper | Unified `call_llm` in `backend/utils/llm.py` supporting Groq/OpenRouter | M1 | R1, R3 |
| 3 | Remove Hardcoded Paths | Replace `C:\Users\Umer\Downloads` in `main.py` with `DATA_SEARCH_PATHS` env var | M1 | R1, R3 |
| 4 | Frontend Migration & Config | Delete `server.ts`, move frontend files to `frontend/`, update Vite proxy to 8000 | M2 | R1, R3 |
| 5 | Package.json Cleanup | Rename `"react-example"` to `"datapulse-ai"`, remove Express/esbuild dependencies | M2 | R1, R3 |
| 6 | Infrastructure & CI/CD | Update `Dockerfile`, `.github/workflows/ci.yml`, `deploy.yml` | M3 | R1 |
| 7 | Environment & Git Config | Update `.gitignore` and `.env.example` with all env vars | M3 | R1, R3 |
| 8 | README Documentation | Update `README.md` setup instructions for `backend/` and `frontend/` | M3 | R1 |
| 9 | AGENTS.md Operating Manual | Create comprehensive 11-section `AGENTS.md` single source of truth | M4 | R2 |
| 10 | End-to-End Verification & Audit | Verify build, typecheck, imports, code quality, and forensic integrity | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Backend Restructuring & Core Fixes | `backend/` package, `backend/utils/llm.py`, remove hardcoded path in `main.py` | None | DONE |
| 2 | M2: Frontend Restructuring & Package Cleanup | `frontend/` directory, delete `server.ts`, update `package.json` & `vite.config.ts` | M1 | DONE |
| 3 | M3: Infrastructure & Configuration | `Dockerfile`, `.github/workflows/`, `.gitignore`, `.env.example`, `README.md` | M2 | DONE |
| 4 | M4: Documentation Hub & Operating Manual | `docs/` folder with `agent.md`, `implementation_plan.md`, `todo.md`, `changelog.md` | M1, M2, M3 | DONE |
| 5 | M5: Verification & Gate Pass | Full build verification, `tsc --noEmit`, backend import test, forensic audit | M1, M2, M3, M4 | IN PROGRESS |

## Interface Contracts
### Frontend ↔ Backend REST API
- Base URL: `/api` (proxied by Vite to `http://localhost:8000`)
- Endpoints:
  - `GET /api/health` -> `{"status": "ok", "time": "..."}`
  - `POST /api/analyze-metadata` -> Ingest dataset metadata, index schema in ChromaDB, return dataset summary
  - `POST /api/chat` -> Execute LangGraph agent orchestrator, return `{answer, suggestedQuestions, agentSteps, chart, chartData}`

### Backend LLM Utility API (`backend/utils/llm.py`)
- Function: `call_llm(prompt: str, system_instruction: str = "", json_mode: bool = False) -> str`
- Checks `OPENROUTER_API_KEY` (model `OPENROUTER_MODEL` default `openrouter/free`) or `GROQ_API_KEY` (model `GROQ_MODEL` default `llama-3.1-8b-instant`).

## Code Layout
```
datapulse-ai/
├── docs/                       # Centralized Documentation Directory
│   ├── agent.md                # AI agent & developer working guide
│   ├── implementation_plan.md  # Comprehensive architecture & implementation plan
│   ├── todo.md                 # Active task backlog & tracking
│   ├── changelog.md            # Version release history
│   └── README.md               # Documentation directory index
├── agent.md                    # Root pointer to docs/agent.md
├── AGENTS.md                   # Multi-agent operating manual
├── README.md                   # Project overview & setup instructions
├── Dockerfile                  # Multi-stage container build
├── .gitignore                  # Git exclusion rules
├── .env.example                # Template environment variables
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI pipeline
│       └── deploy.yml          # Hugging Face deployment
├── backend/
│   ├── __init__.py
│   ├── main.py                 # FastAPI server & REST endpoints
│   ├── semantic_store.py       # ChromaDB vector store interface
│   ├── requirements.txt        # Python dependencies
│   ├── utils/
│   │   ├── __init__.py
│   │   └── llm.py              # Shared Groq/OpenRouter LLM utility
│   └── agents/
│       ├── __init__.py
│       ├── nodes.py            # AgentState schema & node functions
│       ├── orchestrator.py     # LangGraph StateGraph definition
│       └── sandbox.py          # Python execution sandbox
└── frontend/
    ├── package.json            # React SPA dependencies & scripts
    ├── tsconfig.json           # TypeScript configuration
    ├── vite.config.ts          # Vite build & proxy config
    ├── index.html              # HTML entry point
    └── src/                    # React components, styles, utilities
```
