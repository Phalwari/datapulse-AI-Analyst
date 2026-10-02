import os
import sys
import json
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Ensure parent directory and backend directory are in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
for _p in (_parent_dir, _current_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from backend.semantic_store import SemanticStore
    from backend.agents.orchestrator import run_agent_orchestrator
    from backend.utils.llm import call_llm
    from backend.utils.profiler import profile_dataset_file
except ImportError:
    from semantic_store import SemanticStore
    from agents.orchestrator import run_agent_orchestrator
    from utils.llm import call_llm
    from utils.profiler import profile_dataset_file

load_dotenv()

app = FastAPI(title="DataPulse AI Backend")

# Enable CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage directory — relative to project root
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data_files"))
os.makedirs(DATA_DIR, exist_ok=True)


class DatasetSummary(BaseModel):
    name: str

class ColumnDetail(BaseModel):
    name: str
    type: str

class AnalyzeMetadataRequest(BaseModel):
    datasetSummary: DatasetSummary
    columns: List[ColumnDetail]
    sampleRows: List[Dict[str, Any]]
    rowCount: int

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    columns: List[ColumnDetail]
    sampleRows: List[Dict[str, Any]]
    rowCount: int
    datasetName: str
    activeDatasets: Optional[List[Dict[str, Any]]] = None


def get_full_dataset_path(csv_name: str) -> str:
    """
    Resolve a dataset filename to its full path.
    Searches configurable directories via DATA_SEARCH_PATHS env var,
    then falls back to the project's data_files/ directory.
    """
    # 1. Check configurable search paths from environment
    search_paths_env = os.getenv("DATA_SEARCH_PATHS", "")
    if search_paths_env:
        for search_dir in search_paths_env.split(os.pathsep):
            candidate = os.path.join(search_dir.strip(), csv_name)
            if os.path.exists(candidate):
                return candidate

    # 2. Check project root (parent of backend/)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    root_path = os.path.join(project_root, csv_name)
    if os.path.exists(root_path):
        return root_path

    # 3. Fall back to data_files directory
    return os.path.join(DATA_DIR, csv_name)


@app.get("/api/health")
def health_check():
    import datetime
    return {"status": "ok", "time": datetime.datetime.utcnow().isoformat()}


@app.post("/api/analyze-metadata")
async def analyze_metadata(req: AnalyzeMetadataRequest):
    try:
        csv_name = req.datasetSummary.name
        csv_path = get_full_dataset_path(csv_name)

        # Build pandas df and save it to file if full path doesn't exist
        default_data_path = os.path.join(DATA_DIR, csv_name)
        if csv_path == default_data_path and not os.path.exists(csv_path):
            df = pd.DataFrame(req.sampleRows)
            df.to_csv(csv_path, index=False)

        # Store columns inside ChromaDB semantic layer
        store = SemanticStore()
        store.clear_dataset(csv_name)

        for col in req.columns:
            samples = [row.get(col.name, "") for row in req.sampleRows[:5]]
            store.add_schema(
                dataset_name=csv_name,
                column_name=col.name,
                column_type=col.type,
                description=f"Automated schema mapping for column {col.name}",
                sample_values=samples,
            )

        # Profile tabular dataset using DuckDB
        profile_summary = ""
        anomalies = []
        if os.path.exists(csv_path):
            try:
                prof = profile_dataset_file(csv_path, table_name="dataset_table", max_columns=35)
                profile_summary = prof.get("summary_text", "")
                anomalies = prof.get("anomalies", [])
            except Exception as prof_err:
                print(f"[Analyze Metadata] Profiling warning: {prof_err}")

        # Call LLM to perform initial screening analysis
        system_prompt = """You are a principal business intelligence analyst.
Analyze the dataset structure and statistical profile to generate executive screening info.
Highlight any data quality issues, missingness, or statistical anomalies detected.
You MUST respond with a JSON object conforming exactly to this schema:
{
  "summary": "overview summarizing what this dataset represents and data quality check",
  "businessQuestions": ["3-5 key business-facing questions"],
  "insights": [
     {
       "title": "Insight title",
       "description": "finding detail",
       "type": "positive" | "negative" | "neutral" | "trend" | "anomaly"
     }
  ],
  "charts": [
     {
       "id": "slug",
       "type": "bar" | "line" | "area" | "scatter" | "pie" | "radar",
       "title": "title",
       "xAxisKey": "column_name",
       "yAxisKeys": ["column_name"],
       "description": "why useful",
       "summary": "main takeaway"
     }
  ]
}"""

        profile_sec = f"\nStatistical Profile & Anomaly Flags:\n{profile_summary}\n" if profile_summary else ""
        prompt = f"""Dataset Name: {csv_name}
Total Row Count: {req.rowCount}
Columns Specifications: {json.dumps([col.dict() for col in req.columns])}
{profile_sec}Sample Rows: {json.dumps(req.sampleRows[:5])}"""

        try:
            response_text = call_llm(prompt=prompt, system_instruction=system_prompt, json_mode=True)
            res_data = json.loads(response_text)
        except Exception as err:
            print(f"[Metadata Analysis Fallback] LLM Rate limit / Error: {err}")
            num_cols = [c.name for c in req.columns if c.type == "numeric"]
            x_col = req.columns[0].name if req.columns else "index"
            y_col = num_cols[0] if num_cols else (req.columns[1].name if len(req.columns) > 1 else x_col)

            fallback_insights = [
                {
                    "title": "Dataset Successfully Ingested",
                    "description": f"Registered {req.rowCount} data rows and {len(req.columns)} table schema columns.",
                    "type": "positive",
                }
            ]
            for a in anomalies[:2]:
                fallback_insights.append({
                    "title": "Statistical Anomaly Detected",
                    "description": a,
                    "type": "anomaly",
                })

            summary_text = f"Dataset `{csv_name}` loaded with {req.rowCount} records across {len(req.columns)} attributes."
            if profile_summary:
                summary_text += f"\n\n{profile_summary}"

            res_data = {
                "summary": summary_text,
                "businessQuestions": [
                    f"What is the distribution of {y_col} across {x_col}?",
                    f"Are there any outliers in {y_col}?",
                    "How do metrics correlate across datasets?",
                ],
                "insights": fallback_insights,
                "charts": [
                    {
                        "id": "chart_default_1",
                        "type": "bar",
                        "title": f"{y_col} Distribution",
                        "xAxisKey": x_col,
                        "yAxisKeys": [y_col],
                        "description": f"Overview of {y_col} metric values.",
                        "summary": "Initial visual preview generated from table schema.",
                    }
                ],
            }

        # Inject concrete anomaly alerts if not already included by LLM
        existing_insight_desc = " ".join([i.get("description", "") for i in res_data.get("insights", [])])
        for alert in anomalies[:2]:
            if alert[:30] not in existing_insight_desc:
                res_data.setdefault("insights", []).append({
                    "title": "Statistical Anomaly Alert",
                    "description": alert,
                    "type": "anomaly",
                })

        # Normalize common casing mismatches to prevent frontend crashes
        if "business_questions" in res_data:
            res_data["businessQuestions"] = res_data.pop("business_questions")

        # Ensure all required React fields are present
        res_data.setdefault("summary", "Dataset loaded successfully.")
        res_data.setdefault(
            "businessQuestions",
            [
                "Explain the column relationships in this dataset.",
                "Are there any outliers in the continuous columns?",
                "What are the top three business takeaways?",
            ],
        )
        res_data.setdefault("insights", [])
        res_data.setdefault("charts", [])

        return res_data

    except Exception as e:
        print(f"Error in metadata analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat_interaction(req: ChatRequest):
    try:
        last_message = req.messages[-1].text
        csv_name = req.datasetName
        csv_path = get_full_dataset_path(csv_name)

        default_data_path = os.path.join(DATA_DIR, csv_name)
        if csv_path == default_data_path and not os.path.exists(csv_path):
            df = pd.DataFrame(req.sampleRows)
            df.to_csv(csv_path, index=False)

        datasets_list = []
        if req.activeDatasets:
            for ds in req.activeDatasets:
                d_name = ds.get("name")
                d_path = get_full_dataset_path(d_name)
                datasets_list.append({"name": d_name, "csv_path": d_path})

        if not datasets_list:
            datasets_list = [{"name": csv_name, "csv_path": csv_path}]

        result = run_agent_orchestrator(
            query=last_message,
            dataset_name=csv_name,
            csv_path=csv_path,
            datasets=datasets_list,
        )

        response_body = {
            "answer": result.get("answer", "Analysis completed successfully."),
            "suggestedQuestions": result.get("suggested_questions", []),
            "agentSteps": result.get("agent_steps", []),
        }
        if result.get("chart"):
            response_body["chart"] = result["chart"]
            response_body["chartData"] = result.get("query_results", [])

        return response_body

    except Exception as e:
        print(f"Error in chat agent execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Serve built frontend static files in production
from fastapi.staticfiles import StaticFiles

dist_candidates = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "dist")),
]
for dist_path in dist_candidates:
    if os.path.exists(dist_path):
        app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
        break
