import os
import json
import duckdb
import requests
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from semantic_store import SemanticStore

# Helper to call Groq API
def call_groq(prompt: str, system_instruction: str = "", json_mode: bool = False) -> str:
    key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    if not key:
        raise ValueError("GROQ_API_KEY environment variable is not set.")
        
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
        raise Exception(f"Groq API Error: {res.text}")
        
    return res.json()["choices"][0]["message"]["content"]

# State structure for LangGraph
class AgentState(BaseModel):
    query: str
    dataset_name: str
    csv_path: str
    columns: List[Dict[str, str]] = []
    semantic_context: str = ""
    sql_query: str = ""
    query_results: List[Dict[str, Any]] = []
    error_traceback: str = ""
    retry_count: int = 0
    answer: str = ""
    chart: Optional[Dict[str, Any]] = None
    suggested_questions: List[str] = []

# --- 1. Validation Agent ---
def validation_node(state: AgentState) -> Dict[str, Any]:
    print("[Validation Node] Checking request parameters...")
    if not os.path.exists(state.csv_path):
        return {"error_traceback": f"Dataset file not found at path: {state.csv_path}"}
    
    con = duckdb.connect(database=":memory:")
    try:
        desc = con.execute(f"DESCRIBE SELECT * FROM read_csv_auto('{state.csv_path}')").fetchall()
        columns = [{"name": col[0], "type": col[1]} for col in desc]
        return {"columns": columns}
    except Exception as e:
        return {"error_traceback": f"Failed to parse CSV schema: {e}"}
    finally:
        con.close()

# --- 2. Data Wrangling Agent ---
def data_wrangling_node(state: AgentState) -> Dict[str, Any]:
    print("[Data Wrangling Node] Auditing constraints and datatypes...")
    con = duckdb.connect(database=":memory:")
    try:
        null_counts = {}
        for col in state.columns:
            name = col["name"]
            c = con.execute(f"SELECT COUNT(*) FILTER (WHERE \"{name}\" IS NULL) FROM read_csv_auto('{state.csv_path}')").fetchone()[0]
            null_counts[name] = c
        print(f"Null counts audited: {null_counts}")
        return {}
    except Exception as e:
        print(f"Wrangling audit failed: {e}")
        return {}
    finally:
        con.close()

# --- 3. Schema Discovery Agent ---
def schema_discovery_node(state: AgentState) -> Dict[str, Any]:
    print("[Schema Discovery Node] Accessing semantic catalog...")
    store = SemanticStore()
    results = store.query_similar_columns(state.dataset_name, state.query, n_results=5)
    
    context_lines = []
    if results and "documents" in results and results["documents"]:
        for doc in results["documents"][0]:
            context_lines.append(doc)
            
    semantic_context = "\n---\n".join(context_lines)
    return {"semantic_context": semantic_context}

# --- 4. SQL Execution & Self-Correction Agent ---
def sql_execution_node(state: AgentState) -> Dict[str, Any]:
    print("[SQL Execution Node] Formulating and verifying SQL...")
    
    column_str = "\n".join([f"- {col['name']} ({col['type']})" for col in state.columns])
    
    system_prompt = f"""You are a senior database engineer. 
Write a DuckDB SQL query to answer the user's question on the database table 'data_table'.
Return ONLY the SQL query itself, with NO formatting, codeblocks, or explanatory text.

Table Schema columns:
{column_str}

Semantic Layer context:
{state.semantic_context}

DuckDB Query Rules:
- Reference the table as 'data_table'.
- Always wrap column names in double quotes if they contain spaces, dots, or special characters.
- Ensure all queries are READ-ONLY SELECT queries.
"""
    
    prompt = state.query
    if state.error_traceback:
        prompt += f"\n\nYour previous SQL query generated this error:\n{state.error_traceback}\nPlease auto-correct the query syntax to address this error."

    try:
        sql = call_groq(prompt=prompt, system_instruction=system_prompt).strip()
        # Clean any markdown block formatting
        sql = sql.replace("```sql", "").replace("```", "").strip()
        print(f"Generated SQL: {sql}")
        
        # Test execute in DuckDB
        con = duckdb.connect(database=":memory:")
        con.execute(f"CREATE TABLE data_table AS SELECT * FROM read_csv_auto('{state.csv_path}')")
        
        res = con.execute(sql).fetchall()
        keys = [desc[0] for desc in con.description]
        results_list = [dict(zip(keys, row)) for row in res[:100]]
        
        return {
            "sql_query": sql,
            "query_results": results_list,
            "error_traceback": "",
            "retry_count": state.retry_count + 1
        }
    except Exception as e:
        print(f"SQL execution error: {e}")
        return {
            "error_traceback": str(e),
            "retry_count": state.retry_count + 1
        }
    finally:
        if 'con' in locals():
            con.close()

# --- 5. Visualization Agent ---
def visualization_node(state: AgentState) -> Dict[str, Any]:
    print("[Visualization Agent] Checking if visual assets are recommended...")
    if not state.query_results:
        return {}
        
    column_keys = list(state.query_results[0].keys())
    
    system_prompt = """You are a visualization expert.
Determine if a visual chart is relevant for the user query and results keys.
You MUST respond with a JSON object conforming exactly to this schema:
{
  "type": "bar" | "line" | "area" | "scatter" | "pie" | "radar",
  "title": "Visual chart descriptive title",
  "xAxisKey": "column_name",
  "yAxisKeys": ["numeric_column_name"],
  "aggregation": "sum" | "mean" | "count" | "min" | "max",
  "description": "Explanation of what this chart demonstrates",
  "summary": "Main takeaway message of this visual"
}
If no chart is relevant, return an empty JSON object: {}"""

    prompt = f"""User Query: "{state.query}"
Resulting Keys: {column_keys}
Sample Data: {json.dumps(state.query_results[0], default=str)}"""

    try:
        response_text = call_groq(prompt=prompt, system_instruction=system_prompt, json_mode=True)
        chart_data = json.loads(response_text)
        if not chart_data or "type" not in chart_data:
            return {}
        chart_data["id"] = f"chart_{int(os.getpid())}"
        print(f"Recommended Chart: {chart_data}")
        return {"chart": chart_data}
    except Exception as e:
        print(f"No visual recommendation generated: {e}")
        return {}

# --- 6. Synthesis & Safety Node ---
def synthesis_node(state: AgentState) -> Dict[str, Any]:
    print("[Synthesis & Safety Node] Compiling findings and grounding facts...")
    
    system_prompt = """You are a principal business analyst.
Provide a JSON response containing a markdown answer and suggested questions based on the analytical findings.
Response JSON Schema:
{
  "answer": "The markdown formatted final answer explaining findings",
  "suggested_questions": ["question 1", "question 2"]
}"""

    prompt = f"""User Query: {state.query}
SQL Query Run: {state.sql_query}
Query Results Sample: {json.dumps(state.query_results[:10], default=str)}"""

    try:
        response_text = call_groq(prompt=prompt, system_instruction=system_prompt, json_mode=True)
        res = json.loads(response_text)
        
        # Normalize suggested questions key
        suggested = res.get("suggested_questions") or res.get("suggestedQuestions") or [
            "Can you explain this trend in more detail?",
            "What factors contribute most to this value?"
        ]
        
        return {
            "answer": res.get("answer", "Analysis complete."),
            "suggested_questions": suggested
        }
    except Exception as e:
        return {
            "answer": f"Analysis complete. Query results: {state.query_results[:5]}",
            "suggested_questions": ["Explain this dataset summary", "Show me the top values"]
        }
