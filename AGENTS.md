# AGENTS.md — DataPulse AI Analyst Operating Manual

> **Single Source of Truth for AI Coding Agents and Human Developers**  
> *Last Updated: 2026-08-08 | Version: 2.5*

---

## 1. Project Overview

**DataPulse AI Analyst** is an enterprise-grade multi-agent conversational data analytics platform. It enables non-technical business users and data analysts to upload, query, visualize, and extract business intelligence from structured datasets (CSV, TSV, Excel) using natural language.

### Core Capabilities
- **Automated Dataset Screening & Ingestion**: Analyzes schema, column datatypes, distributions, and generates automatic anomaly reports and KPI recommendations.
- **Multi-Agent Conversational Copilot**: Driven by a stateful LangGraph orchestrator that validates requests, audits datatypes, queries a ChromaDB vector store for semantic context, executes DuckDB SQL queries, generates chart recommendations, and synthesizes rich Markdown answers.
- **Self-Correcting SQL Engine**: Automatically intercepts SQL errors (e.g., column syntax, table aliases, type mismatches) and retries up to 3 times with full error feedback to the LLM.
- **Multi-Dataset Querying & Joining**: Seamlessly queries single datasets or executes complex JOIN queries across multiple active datasets loaded into DuckDB `:memory:`.
- **Interactive Data Visualization & Dashboards**: Built-in visual studio using Recharts supporting bar, line, area, scatter, pie, and radar charts, with pinned items saved to local storage.

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (React SPA)                              │
│  React 19 + TypeScript + Tailwind CSS v4 + Recharts (Vite Dev Server Port 5173)   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                         REST API Requests (/api/*)
                         Proxied by Vite to Port 8000
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                                BACKEND (FastAPI)                                 │
│                   FastAPI Server (Uvicorn Runtime Port 8000)                     │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌────────────────────┐  │
│  │ GET  /api/health        │  │ POST /api/analyze-... │  │ POST /api/chat     │  │
│  └─────────────────────────┘  └───────────┬───────────┘  └─────────┬──────────┘  │
└───────────────────────────────────────────┼────────────────────────┼─────────────┘
                                            │                        │
                                            │                        │
  ┌─────────────────────────────────────────▼─────────┐   ┌──────────▼──────────┐
  │         CHROMADB SEMANTIC VECTOR STORE            │   │ LANGGRAPH AGENT     │
  │     Collection: `schema_metadata`                 │   │ ORCHESTRATOR        │
  │     Embedding: `all-MiniLM-L6-v2`                 │   │ (StateGraph)        │
  └───────────────────────────────────────────────────┘   └──────────┬──────────┘
                                                                     │
  ┌──────────────────────────────────────────────────────────────────▼──────────┐
  │                       LANGGRAPH MULTI-AGENT PIPELINE                        │
  │                                                                             │
  │   ┌──────────────┐      ┌───────────────┐      ┌────────────────────────┐   │
  │   │  Validation  ├─────►│ Data Wrangling├─────►│    Schema Discovery    │   │
  │   │     Node     │      │     Node      │      │ (ChromaDB Query) Node  │   │
  │   └──────┬───────┘      └───────────────┘      └───────────┬────────────┘   │
  │          │ (Error)                                         │                │
  │          ▼                                                 ▼                │
  │     ┌──────────┐        ┌──────────────────────────────────┐                │
  │     │Synthesize│        │       SQL Execution Node         │◄───────┐       │
  │     │   Node   │        │     (DuckDB :memory: Engine)     │        │       │
  │     └────▲─────┘        └────────────────┬─────────────────┘        │       │
  │          │                               │                          │       │
  │          │                               ├─── [Error & Retry < 3] ──┘       │
  │          │                               │ (Success or Retry >= 3)          │
  │          │                               ▼                                  │
  │          │                      ┌─────────────────┐                         │
  │          │                      │  Visualization  │                         │
  │          │                      │      Node       │                         │
  │          │                      └────────┬────────┘                         │
  │          │                               │                                  │
  │          └───────────────────────────────┘                                  │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend Stack
| Component | Technology | Version | Rationale |
|---|---|---|---|
| **Runtime** | Python | 3.11+ | Enterprise stability, robust ecosystem for data science and AI agents |
| **API Framework** | FastAPI | >=0.100.0 | High-performance asynchronous REST API framework with automatic Pydantic validation |
| **Agent Orchestrator** | LangGraph | >=0.0.10 | Cyclic state-graph multi-agent orchestration engine with built-in retry and routing support |
| **Analytical DB** | DuckDB | >=0.9.0 | In-memory columnar SQL database engine capable of high-speed CSV parsing and analytical queries |
| **Vector Database** | ChromaDB | >=0.4.0 | Lightweight persistent vector database for semantic schema indexing and column retrieval |
| **Embeddings** | sentence-transformers | `all-MiniLM-L6-v2` | Fast 384-dimensional local embeddings for schema similarity matching |
| **Data Manipulation** | Pandas | >=2.0.0 | Tabular data manipulation and CSV IO serialization |
| **LLM Provider API** | Requests | >=2.31.0 | Light HTTP client for communicating with Groq / OpenRouter OpenAI-compatible endpoints |

### Frontend Stack
| Component | Technology | Version | Rationale |
|---|---|---|---|
| **UI Library** | React | ^19.0.1 | Modern declarative UI component library |
| **Build Tool** | Vite | ^6.2.3 | Next-generation fast frontend bundler and development proxy server |
| **Language** | TypeScript | ~5.8.2 | Strict static typing for bug prevention and clean contracts |
| **Styling** | Tailwind CSS | ^4.1.14 | Utility-first CSS framework for rapid responsive UI development |
| **Charting Library** | Recharts | ^3.8.1 | Composability-focused React charting framework |
| **Icons** | Lucide React | ^0.546.0 | Clean, modern SVG icon set |
| **Document Export** | html2canvas / jsPDF / XLSX | ^1.4 / ^4.2 / ^0.18 | Client-side export of charts and data to PDF, Excel, and PNG |

---

## 4. Directory Map

```
datapulse-ai/
├── AGENTS.md                   # Single source of truth for AI agents (Operating Manual)
├── README.md                   # Project overview, quickstart & setup guide
├── PROJECT.md                  # Teamwork project tracking and architecture specification
├── Dockerfile                  # Multi-stage container definition (Node 20 frontend build + Python 3.11 backend runtime)
├── .gitignore                  # Git exclusion rules (__pycache__, chroma_db, node_modules, dist, .env*)
├── .env.example                # Template for environment variables (GROQ, OPENROUTER, DATA_SEARCH_PATHS)
├── .github/
│   └── workflows/
│       ├── ci.yml              # GitHub Actions CI workflow (Frontend build/lint + Backend Python setup)
│       └── deploy.yml          # Hugging Face Spaces deployment workflow
├── backend/
│   ├── __init__.py             # Python package marker
│   ├── main.py                 # FastAPI application server, endpoints (/api/health, /api/analyze-metadata, /api/chat)
│   ├── semantic_store.py       # SemanticStore class managing ChromaDB persistent schema vector store
│   ├── requirements.txt        # Python dependency manifest
│   ├── utils/
│   │   ├── __init__.py         # Utils package marker
│   │   └── llm.py              # Shared call_llm helper supporting Groq and OpenRouter APIs
│   └── agents/
│       ├── __init__.py         # Agents package marker
│       ├── nodes.py            # AgentState schema and 6 agent node functions (validation, wrangling, discovery, sql, viz, synthesis)
│       ├── orchestrator.py     # StateGraph definition and run_agent_orchestrator workflow runner
│       └── sandbox.py          # SubprocessSandbox python code execution isolate
└── frontend/
    ├── package.json            # Frontend npm package configuration, dependencies, and scripts
    ├── package-lock.json       # Npm dependency lockfile
    ├── tsconfig.json           # TypeScript configuration with strict mode and path alias (@ -> .)
    ├── vite.config.ts          # Vite build config with React plugin, Tailwind CSS plugin, and /api proxy to port 8000
    ├── index.html              # HTML5 entry point for Vite React SPA
    └── src/
        ├── main.tsx            # React application entry point mounting App root
        ├── App.tsx             # Main React SPA shell with sidebar navigation, tab routing, and global state
        ├── index.css           # Global Tailwind CSS imports and custom utility styles
        ├── types.ts            # Core TypeScript interfaces (Dataset, ColumnMetadata, VisualRecommendation, AgentState steps)
        ├── sampleData.ts       # Preset datasets for demonstration and quick screening
        ├── utils/
        │   └── exportReport.ts # PDF, Excel, and PNG export utility functions
        └── components/
            ├── AgentChatConsole.tsx     # Conversational copilot chat console displaying message logs & agent execution steps
            ├── AgentThoughtVisualizer.tsx # Step-by-step expandable UI accordion showing active agent reasoning steps
            ├── CustomChartBuilder.tsx   # Interactive visual chart studio allowing custom axis selection & chart rendering
            ├── CustomDashboard.tsx      # Dashboard view rendering user-pinned charts and statistical cards
            ├── DatasetSelector.tsx      # Initial landing screen dataset picker and CSV upload container
            ├── InsightPanel.tsx         # Automatic dataset screening dashboard displaying insights and recommended KPIs
            ├── InteractiveChart.tsx     # Dynamic Recharts wrapper supporting bar, line, area, scatter, pie, radar charts
            ├── TablePreview.tsx         # Paginated spreadsheet raw data grid viewer
            └── AdvancedStats.tsx        # Statistical analysis tab computing correlations, distribution metrics, and anomalies
```

---

## 5. LangGraph Agent System

The LangGraph multi-agent engine is located in `backend/agents/`. It orchestrates agent execution state via a typed Pydantic state model (`AgentState`).

### `AgentState` Schema (`backend/agents/nodes.py`)
```python
class DatasetInfo(BaseModel):
    name: str
    csv_path: str

class AgentState(BaseModel):
    query: str                                          # User input query
    dataset_name: str = ""                              # Primary dataset name
    csv_path: str = ""                                  # Primary CSV file path
    datasets: List[DatasetInfo] = []                    # All active datasets loaded in workspace
    columns_by_table: Dict[str, List[Dict[str, str]]] = {} # Dict mapping sanitized table names to column lists
    semantic_context: str = ""                          # Semantic column descriptions from ChromaDB
    sql_query: str = ""                                 # LLM-generated DuckDB SQL query string
    query_results: List[Dict[str, Any]] = []            # Result set rows from DuckDB execution
    error_traceback: str = ""                           # Traceback error string if SQL execution fails
    retry_count: int = 0                                # Number of SQL self-correction retries attempted (max 3)
    answer: str = ""                                    # Final Markdown answer string synthesized by LLM
    chart: Optional[Dict[str, Any]] = None              # Recommended chart configuration dict (Recharts schema)
    suggested_questions: List[str] = []                 # 2-3 follow-up business questions generated for the user
    agent_steps: List[Dict[str, Any]] = []              # Execution log steps rendered in the frontend UI
```

### Node Execution Order & Routing
```
[ENTRY: validate] ──► (post_validate_router)
                             │
            ┌────────────────┴──────────────┐
            ▼ (Valid)                       ▼ (Invalid / File missing)
       [wrangle]                       [synthesize] ──► [END]
            │
            ▼
   [discover_schema]
            │
            ▼
     [execute_sql] ◄──┐
            │         │ (sql_router: error_traceback AND retry_count < 3)
            ▼         │
      (sql_router) ───┘
            │
            ▼ (Success OR retry_count >= 3)
       [visualize]
            │
            ▼
       [synthesize] ──► [END]
```

1. **`validate` (`validation_node`)**: Verifies CSV files exist on disk, creates DuckDB `:memory:` instance, executes `DESCRIBE SELECT * FROM read_csv_auto(...)` for each dataset, populating `columns_by_table`.
2. **`wrangle` (`data_wrangling_node`)**: Audits column datatypes, null count constraints, and missing record boundaries.
3. **`discover_schema` (`schema_discovery_node`)**: Queries ChromaDB vector store (`SemanticStore`) to retrieve semantic documentation for relevant columns based on user `query`.
4. **`execute_sql` (`sql_execution_node`)**:
   - Generates DuckDB SQL using `call_llm`.
   - Executes SQL against `:memory:` DuckDB instance populated with all active tables.
   - If SQL execution fails, captures exception string in `error_traceback` and increments `retry_count`.
5. **`visualize` (`visualization_node`)**: Evaluates `query_results` and generates a Recharts visual recommendation object (`type`, `title`, `xAxisKey`, `yAxisKeys`, `description`, `summary`). Validates keys against returned column keys.
6. **`synthesize` (`synthesis_node`)**: Synthesizes rich Markdown analysis answer and generates suggested follow-up business questions.

### Self-Correction Loop Mechanism
When `sql_execution_node` encounters a syntax error, DuckDB query failure, or column reference error:
1. The error string is caught and saved to `state.error_traceback`.
2. `retry_count` is incremented by 1.
3. `sql_router` checks if `error_traceback` is non-empty AND `retry_count < 3`.
4. If true, `sql_router` returns `"execute_sql"`, looping back into `sql_execution_node`.
5. The LLM prompt includes the failed query and the exact traceback: `"Your previous SQL query generated this error: {error_traceback}. Please auto-correct..."`
6. If retries reach 3 or SQL succeeds, execution proceeds to `visualize`.

### Step-by-Step: How to Add a New Agent Node
To add a new processing node (e.g., `anomaly_detection_node`):
1. **Define Node Function in `backend/agents/nodes.py`**:
   ```python
   def anomaly_detection_node(state: AgentState) -> Dict[str, Any]:
       steps = state.agent_steps.copy()
       steps.append({
           "node": "anomaly_detection",
           "title": "Statistical Anomaly Audit",
           "detail": "Audited numeric columns for >3-sigma outliers."
       })
       # Perform calculations or LLM calls...
       return {"agent_steps": steps}
   ```
2. **Import and Register in `backend/agents/orchestrator.py`**:
   ```python
   from backend.agents.nodes import anomaly_detection_node
   
   # Inside run_agent_orchestrator:
   workflow.add_node("detect_anomalies", anomaly_detection_node)
   ```
3. **Connect Node to Graph**:
   ```python
   # Place node between wrangle and discover_schema:
   workflow.add_edge("wrangle", "detect_anomalies")
   workflow.add_edge("detect_anomalies", "discover_schema")
   ```
4. **Update `AgentState`** if new state variables are needed.

---

## 6. Coding Conventions

### Python Conventions (Backend)
- **Code Style**: Follow PEP 8 style guide.
- **Type Annotations**: All function signatures must include type annotations (`def get_path(name: str) -> str:`).
- **State Validation**: Use Pydantic `BaseModel` classes for request/response payloads and internal state (`AgentState`).
- **LLM Invocations**: ALWAYS use the central `call_llm` function imported from `backend.utils.llm`. NEVER import `requests` or `openai` to make direct LLM calls in nodes or endpoints.

### TypeScript / React Conventions (Frontend)
- **Functional Components**: All React components must be written as functional components with TypeScript props interface annotations (`React.FC<Props>` or direct destructured typing).
- **Strict Typing**: TypeScript `strict` mode is enabled in `tsconfig.json`. Avoid using `any` unless parsing raw CSV row records.
- **Styling**: Use Tailwind CSS utility classes. Avoid inline style blocks unless dynamic calculation is required.
- **Icons**: Use `lucide-react` icons.

### API & Endpoint Contract
- **Base Route**: All API endpoints MUST be prefixed with `/api/`.
- **Content-Type**: Requests and responses MUST use `application/json`.
- **Health Check Endpoint**: `GET /api/health` -> returns `{"status": "ok", "time": "<ISO timestamp>"}`.
- **Error Handling**: Endpoints must return HTTP 500 with detailed `JSON` error payloads on unhandled exceptions and maintain internal fallback mechanisms (e.g., fallback JSON in `/api/analyze-metadata` if LLM rate limits occur).

---

## 7. Environment & Secrets

All configuration settings are managed via environment variables loaded via `python-dotenv`.

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | Optional* | None | API Key for Groq cloud LLM provider |
| `GROQ_MODEL` | Optional | `llama-3.1-8b-instant` | Groq model identifier |
| `OPENROUTER_API_KEY` | Optional* | None | API Key for OpenRouter provider |
| `OPENROUTER_MODEL` | Optional | `openrouter/free` | OpenRouter model identifier |
| `DATA_SEARCH_PATHS` | Optional | `""` | Comma-separated directory paths to search for CSV dataset files |
| `PORT` | Optional | `8000` | Backend server port |

*\*Note: At least ONE of `GROQ_API_KEY` or `OPENROUTER_API_KEY` must be set for LLM features to operate.*

### Rules for Environment Variables
1. **NEVER Hardcode API Keys**: Never commit API keys or bearer tokens into code repositories.
2. **NEVER Hardcode Local File Paths**: Use `DATA_SEARCH_PATHS` or relative workspace resolution. Never insert user-specific absolute paths like `C:\Users\...`.
3. **Template Environment File**: Keep `.env.example` updated whenever adding new environment variables.

---

## 8. Development Workflow

### Quickstart Setup

1. **Clone & Setup Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env and supply GROQ_API_KEY or OPENROUTER_API_KEY
   ```

2. **Start Backend Server**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --reload --port 8000
   ```
   *Backend running at `http://localhost:8000` (API docs at `http://localhost:8000/docs`).*

3. **Start Frontend Dev Server**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Frontend running at `http://localhost:5173`.*

### How Vite Proxy Works
`frontend/vite.config.ts` configures a proxy targeting `http://localhost:8000`:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```
All frontend calls to `/api/...` in development automatically route to the FastAPI backend server on port 8000 without CORS issues.

### Verification & Testing Commands
- **Frontend Type Check**:
  ```bash
  cd frontend && npm run lint
  ```
- **Frontend Production Build Test**:
  ```bash
  cd frontend && npm run build
  ```
- **Backend Import Verification**:
  ```bash
  python -c "import backend.main; import backend.agents.orchestrator; print('All imports successful!')"
  ```

---

## 9. Contribution Rules

### Branching & PR Workflow
- **Branch Naming**: Use feature branches named `feature/<short-description>`, `fix/<short-description>`, or `m<number>-<task-name>`.
- **PR Verification Checklist**:
  1. `cd frontend && npm run build` completes with 0 errors.
  2. `cd frontend && npm run lint` passes without TypeScript errors.
  3. Backend server starts cleanly without missing dependency or relative import errors.
  4. No secret keys or hardcoded paths are committed.

### Database Migrations & Schema Changes
- **DuckDB Schema**: DuckDB tables are constructed in-memory (`:memory:`) per user request cycle using `read_csv_auto`. No persistent schema migrations are required for DuckDB tables.
- **ChromaDB Vector Store**: Schema embeddings are stored in `chroma_db/`. If altering the vector metadata structure in `backend/semantic_store.py`, clear existing collections using `store.clear_dataset(...)` or purge the `chroma_db/` directory to allow re-indexing.

---

## 10. Common Pitfalls & Gotchas

1. **DuckDB Column Quoting**:
   - DuckDB fails on unquoted column names containing spaces, hyphens, or uppercase letters (e.g., `SELECT Customer Name FROM table`).
   - **Fix**: Always wrap column names in double quotes (`SELECT "Customer Name" FROM "table"`).
2. **ChromaDB Embedding Model Dependency**:
   - `SemanticStore` initializes `SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")`. On first run, it downloads model weights (~90MB). Ensure internet connection is available or pre-download weights in container builds.
3. **CORS Configuration**:
   - FastAPI backend has CORS middleware configured (`allow_origins=["*"]`). If adding new headers or authorization schemes, update `CORSMiddleware` in `backend/main.py`.
4. **Table Name Sanitization**:
   - CSV filenames like `Sales & Marketing 2025.csv` are sanitized into valid SQL identifiers (`Sales_Marketing_2025`) using `sanitize_table_name()` in `backend/agents/nodes.py`. Always use the sanitized table name in DuckDB queries.
5. **Recharts Key Validation**:
   - The LLM visualization node may occasionally recommend `yAxisKeys` that do not exist in the DuckDB SQL result set. `visualization_node` validates recommended keys against `query_results[0].keys()` and discards mismatched chart configs to avoid frontend React rendering exceptions.

---

## 11. Do NOT Rules

- ❌ **Do NOT execute destructive SQL**: NEVER run `DROP TABLE`, `DROP DATABASE`, `DELETE FROM`, `TRUNCATE`, or `ALTER TABLE` queries against user datasets. All DuckDB execution must remain READ-ONLY `SELECT` statements.
- ❌ **Do NOT commit credentials or `.env` files**: Never commit `.env`, `.env.local`, API keys, or private key credentials to git repository.
- ❌ **Do NOT modify sandbox timeouts without team review**: Do not change `SubprocessSandbox(timeout_seconds=15)` without reviewing security and CPU resource bounds.
- ❌ **Do NOT introduce hardcoded user paths**: Never hardcode personal paths like `C:\Users\...` or `/Users/...`. Always use environment variable `DATA_SEARCH_PATHS` or relative directory paths.
- ❌ **Do NOT re-introduce Node.js Express server (`server.ts`)**: FastAPI (`backend/main.py`) is the single canonical backend. Do not re-add `server.ts` or Express middleware dependencies to `package.json`.
- ❌ **Do NOT duplicate LLM helper logic**: Always use `call_llm` from `backend.utils.llm`. Do not write duplicate HTTP request logic for Groq or OpenRouter in new nodes or routes.
- ❌ **Do NOT place source code inside `.agents/`**: The `.agents/` directory is reserved exclusively for agent task metadata, handoffs, plans, and briefings.
