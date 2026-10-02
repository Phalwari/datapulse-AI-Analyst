# DataPulse AI Analyst — Task Backlog & Tracking (TODO.md)

> **Active Development Tracking & Milestone Progress**  
> *Last Updated: 2026-10-02*

---

## 📌 Legend & Task States
- `[ ]` **Open**: Not yet started
- `[-]` **In Progress**: Actively being worked on
- `[x]` **Completed**: Tested, verified, and documented
- `[HIGH]`, `[MEDIUM]`, `[LOW]`: Priority indicators

---

## 🚀 Active Sprint: Stabilization & Core Upgrades

### Phase 1: Environment & Import Stabilization [HIGH]
- [x] Create centralized documentation directory in `docs/` (`implementation_plan.md`, `agent.md`, `todo.md`, `changelog.md`).
- [x] Add `sys.path` resolver / flexible imports in `backend/main.py`, `backend/agents/nodes.py`, and `backend/agents/orchestrator.py` to fix `ModuleNotFoundError: No module named 'backend'` when running inside `backend/` or Docker.
- [x] Verify local backend execution: `python -c "import main; print('Backend loaded successfully')"` in `backend/`.
- [-] Stage and commit the directory refactoring (`backend/`, `frontend/`, `docs/`) to git.
- [ ] Push to `origin/main` and verify GitHub Actions CI Pipeline and Hugging Face sync.

---

## 📋 Roadmap Phases (from `docs/implementation_plan.md`)

### Phase 2: Enhanced Data Wrangling & Profiling Node [HIGH]
- [ ] Replace stub in `backend/agents/nodes.py` (`data_wrangling_node`) with real DuckDB columnar profiling:
  - [ ] Calculate non-null counts, null percentages, and unique counts per column.
  - [ ] Compute numeric distributions: min, max, median, 25%/75% quartiles, standard deviation.
  - [ ] Identify top categorical frequency values.
- [ ] Populate `AgentState.data_profile` with summary statistics to ground SQL generation and prevent hallucinations.
- [ ] Add statistical anomaly warnings (IQR bounds $1.5 \times \text{IQR}$) in initial dataset screening.

### Phase 3: Wiring Python ML Sandbox to Agent Orchestrator [MEDIUM]
- [ ] Add conditional routing in `backend/agents/orchestrator.py` for statistical/ML queries:
  - [ ] Detect user intents: *"predict"*, *"forecast"*, *"regression"*, *"cluster"*, *"correlate"*.
  - [ ] Route to a dedicated `python_sandbox_node`.
- [ ] Implement ML Best Practices safeguards in sandbox code generation:
  - [ ] Chronological train/validation splits for time-series forecasting.
  - [ ] Featurization ordering: split before fitting scalers/encoders.
  - [ ] Silhouette score evaluation for clustering across $k \in [2, 6]$.
  - [ ] Regression residual analysis and $R^2$/RMSE metrics reporting.
- [ ] Expose statistical results cleanly to `synthesis_node` for executive narrative generation.

### Phase 4: Conversational Streaming & Live Thought Visualization [MEDIUM]
- [ ] Implement Server-Sent Events (SSE) via FastAPI `StreamingResponse` at `POST /api/chat/stream`.
- [ ] Emit step-by-step agent lifecycle events to `frontend/src/components/AgentChatConsole.tsx`:
  - [ ] `validation` step
  - [ ] `schema_discovery` ChromaDB vector search
  - [ ] `sql_execution` (with live retry attempts if self-correction triggers)
  - [ ] `visualization` chart recommendation
  - [ ] `synthesis` Markdown answer streaming
- [ ] Add interactive retry indicator and execution time metrics per node in UI.

### Phase 5: UI Polish & Export Enhancements [LOW]
- [ ] Humanize large numeric formats in Recharts tooltips and data tables (e.g. `$2.5M`, `14.2%`).
- [ ] Cardinality guarding in visualization agent: automatically reject pie charts when categories $> 7$, fallback to bar/treemap.
- [ ] Add single-click Excel / CSV download button directly on SQL query results in chat console.
- [ ] Improve PDF export layout in `frontend/src/utils/exportReport.ts`.

---

## 🏆 Completed Milestones
- [x] **M1: Backend Restructuring**: Moved backend scripts to `backend/`, added `backend/utils/llm.py` unified client, parameterized `DATA_SEARCH_PATHS`.
- [x] **M2: Frontend Restructuring**: Moved frontend into `frontend/`, removed obsolete Express `server.ts`, cleaned `package.json` and `vite.config.ts`.
- [x] **M3: Infrastructure & CI/CD**: Updated `Dockerfile`, `.github/workflows/ci.yml`, and `deploy.yml` for dual-package structure.
- [x] **M4: Documentation Hub**: Created `docs/` containing `agent.md`, `implementation_plan.md`, `todo.md`, and `changelog.md`.
