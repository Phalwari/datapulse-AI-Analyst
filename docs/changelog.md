# Changelog — DataPulse AI Analyst

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- Resolved `ModuleNotFoundError: No module named 'backend'` by adding dynamic `sys.path` injection and fallback imports across `backend/main.py`, `backend/agents/nodes.py`, and `backend/agents/orchestrator.py`.
- Added dual static assets directory lookup in `backend/main.py` to support both local development and Docker runner paths.

### Planned
- Real DuckDB data profiling and null-distribution auditing in `data_wrangling_node`.
- Connection of `SubprocessSandbox` to the LangGraph orchestrator for statistical and ML inquiries.
- Server-Sent Events (SSE) streaming endpoint `/api/chat/stream` for real-time thought visualization in React.

---

## [2.5.0] - 2026-10-02

### Added
- Created centralized documentation hub inside `docs/`:
  - [`docs/agent.md`](agent.md): Working protocol, development rules of engagement, and quality gates for AI agents.
  - [`docs/implementation_plan.md`](implementation_plan.md): Architectural blueprint incorporating `ml-best-practices` and `building-data-apps`.
  - [`docs/todo.md`](todo.md): Active backlog, priorities, and milestone progress tracker.
  - [`docs/changelog.md`](changelog.md): Standardized version changelog.
- Added root pointers (`agent.md`, `TODO.md`, `CHANGELOG.md`) referencing `docs/` for quick agent discovery.

---

## [2.0.0] - 2026-08-08

### Changed
- **Architectural Restructuring**: Split the root monolithic repository into separate, decoupled packages:
  - `backend/`: FastAPI application, LangGraph multi-agent orchestration, DuckDB SQL engine, ChromaDB vector store.
  - `frontend/`: React 19 + TypeScript + Vite SPA, Tailwind CSS, Recharts charting studio.
- Updated `Dockerfile` to multi-stage build targeting `frontend/` (Node 20 builder) and `backend/` (Python 3.11 runner).
- Updated `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` with separate `working-directory` paths.
- Replaced hardcoded download paths in `backend/main.py` with `DATA_SEARCH_PATHS` environment variable.
- Created `backend/utils/llm.py` providing unified support for both Groq API and OpenRouter API.

### Removed
- Removed legacy root `server.ts` Express server in favor of direct FastAPI backend API.
- Cleaned unused root dependencies from `package.json`.

---

## [1.1.0] - 2026-07-08

### Fixed
- Fixed visualization agent key hallucination in `agents/nodes.py` where non-existent metric keys were proposed.
- Resolved route `chartData` mismatch between DuckDB query results and Recharts visual coordinates.
- Added post-validation guard discarding recommended charts if suggested keys are absent from result set.

### Added
- Hugging Face metadata frontmatter to `README.md`.
- Automated sync workflow to Hugging Face Spaces repository `phalwari/datapulse`.

---

## [1.0.0] - 2026-07-07

### Added
- Initial release of DataPulse AI Analyst.
- LangGraph state machine orchestrator coordinating validation, schema discovery, SQL execution, and synthesis.
- DuckDB in-memory SQL execution with 3-attempt self-correcting query retry loop.
- ChromaDB vector store for semantic column and schema retrieval.
- Interactive Recharts visual dashboard with support for bar, line, area, scatter, pie, and radar charts.
- Automated dataset metadata screening and business question generation.
