import os
import json
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from semantic_store import SemanticStore
from agents.orchestrator import run_agent_orchestrator
from dotenv import load_dotenv

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

# Ensure data storage directories exist
os.makedirs("../data_files", exist_ok=True)

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

# Helper to call Groq API
def call_groq(prompt: str, system_instruction: str = "", json_mode: bool = False) -> str:
    key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    if not key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY environment variable is not set.")
        
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Groq API Error: {res.text}")
        
    return res.json()["choices"][0]["message"]["content"]

@app.get("/api/health")
def health_check():
    import datetime
    return {"status": "ok", "time": datetime.datetime.utcnow().isoformat()}

def get_full_dataset_path(csv_name: str) -> str:
    # 1. Check parent workspace directory
    parent_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", csv_name))
    if os.path.exists(parent_path):
        return parent_path
    
    # 2. Check Windows Downloads directory
    downloads_path = os.path.join("C:\\Users\\Umer\\Downloads", csv_name)
    if os.path.exists(downloads_path):
        return downloads_path
        
    # 3. Fall back to sample data path
    return f"../data_files/{csv_name}"

@app.post("/api/analyze-metadata")
async def analyze_metadata(req: AnalyzeMetadataRequest):
    try:
        csv_name = req.datasetSummary.name
        csv_path = get_full_dataset_path(csv_name)
        
        # Build pandas df and save it to file if full path doesn't exist
        if csv_path == f"../data_files/{csv_name}":
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
                sample_values=samples
            )

        # Call Groq to perform initial screening analysis
        system_prompt = """You are a principal business intelligence analyst.
Analyze the dataset structure and generate screening info.
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

        prompt = f"""Dataset Name: {csv_name}
Total Row Count: {req.rowCount}
Columns Specifications: {json.dumps([col.dict() for col in req.columns])}
Sample Rows: {json.dumps(req.sampleRows[:5])}"""

        response_text = call_groq(prompt=prompt, system_instruction=system_prompt, json_mode=True)
        res_data = json.loads(response_text)
        
        # Normalize common casing mismatches to prevent frontend crashes
        if "business_questions" in res_data:
            res_data["businessQuestions"] = res_data.pop("business_questions")
        
        # Ensure all required React fields are present
        res_data.setdefault("summary", "Dataset loaded successfully.")
        res_data.setdefault("businessQuestions", [
            "Explain the column relationships in this dataset.",
            "Are there any outliers in the continuous columns?",
            "What are the top three business takeaways?"
        ])
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

        if csv_path == f"../data_files/{csv_name}" and not os.path.exists(csv_path):
            df = pd.DataFrame(req.sampleRows)
            df.to_csv(csv_path, index=False)

        result = run_agent_orchestrator(
            query=last_message,
            dataset_name=csv_name,
            csv_path=csv_path
        )

        response_body = {
            "answer": result.get("answer", "Analysis completed successfully."),
            "suggestedQuestions": result.get("suggested_questions", []),
        }
        if result.get("chart"):
            response_body["chart"] = result["chart"]
            response_body["chartData"] = result.get("query_results", [])

        return response_body

    except Exception as e:
        print(f"Error in chat agent execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.staticfiles import StaticFiles
if os.path.exists("./dist"):
    app.mount("/", StaticFiles(directory="./dist", html=True), name="static")

