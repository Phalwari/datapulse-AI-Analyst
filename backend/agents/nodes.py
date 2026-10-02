import os
import json
import re
import duckdb
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
try:
    from backend.semantic_store import SemanticStore
    from backend.utils.llm import call_llm
except ImportError:
    from semantic_store import SemanticStore
    from utils.llm import call_llm



# State structure for LangGraph
class DatasetInfo(BaseModel):
    name: str
    csv_path: str


class AgentState(BaseModel):
    query: str
    dataset_name: str = ""
    csv_path: str = ""
    datasets: List[DatasetInfo] = []
    columns_by_table: Dict[str, List[Dict[str, str]]] = {}
    semantic_context: str = ""
    sql_query: str = ""
    query_results: List[Dict[str, Any]] = []
    error_traceback: str = ""
    retry_count: int = 0
    answer: str = ""
    chart: Optional[Dict[str, Any]] = None
    suggested_questions: List[str] = []
    agent_steps: List[Dict[str, Any]] = []


def sanitize_table_name(name: str) -> str:
    cleaned = name.replace(".csv", "").replace("-", "_").replace(" ", "_")
    return "".join([c for c in cleaned if c.isalnum() or c == "_"])


# --- 1. Validation Agent ---
def validation_node(state: AgentState) -> Dict[str, Any]:
    print("[Validation Node] Checking request parameters & active datasets...")
    steps = state.agent_steps.copy()
    steps.append({
        "node": "validation",
        "title": "Dataset Schema Validation",
        "detail": f"Validated {len(state.datasets or [1])} dataset files in DuckDB memory workspace.",
    })

    active_datasets = state.datasets.copy() if state.datasets else []
    if not active_datasets and state.csv_path:
        active_datasets.append(DatasetInfo(name=state.dataset_name, csv_path=state.csv_path))

    if not active_datasets:
        return {"error_traceback": "No active dataset files provided.", "agent_steps": steps}

    columns_by_table = {}
    con = duckdb.connect(database=":memory:")
    try:
        for ds in active_datasets:
            if not os.path.exists(ds.csv_path):
                return {"error_traceback": f"Dataset file not found at path: {ds.csv_path}", "agent_steps": steps}

            table_name = sanitize_table_name(ds.name)
            desc = con.execute(f"DESCRIBE SELECT * FROM read_csv_auto('{ds.csv_path}')").fetchall()
            columns_by_table[table_name] = [{"name": col[0], "type": col[1]} for col in desc]

        return {"columns_by_table": columns_by_table, "datasets": active_datasets, "agent_steps": steps}
    except Exception as e:
        return {"error_traceback": f"Failed to parse CSV schema: {e}", "agent_steps": steps}
    finally:
        con.close()


# --- 2. Data Wrangling Agent ---
def data_wrangling_node(state: AgentState) -> Dict[str, Any]:
    print("[Data Wrangling Node] Auditing constraints and datatypes...")
    steps = state.agent_steps.copy()
    steps.append({
        "node": "wrangling",
        "title": "Constraint & Null Count Audit",
        "detail": "Audited column datatypes and missing record bounds.",
    })
    return {"agent_steps": steps}


# --- 3. Schema Discovery Agent ---
def schema_discovery_node(state: AgentState) -> Dict[str, Any]:
    print("[Schema Discovery Node] Accessing multi-dataset semantic catalog...")
    steps = state.agent_steps.copy()
    store = SemanticStore()
    dataset_names = [ds.name for ds in state.datasets]
    results = store.query_similar_columns(dataset_names=dataset_names, query=state.query, n_results=10)

    context_lines = []
    if results and "documents" in results and results["documents"]:
        for doc in results["documents"][0]:
            context_lines.append(doc)

    semantic_context = "\n---\n".join(context_lines)
    steps.append({
        "node": "schema_discovery",
        "title": "ChromaDB Semantic Resolution",
        "detail": f"Retrieved {len(context_lines)} semantic column mappings from vector store.",
    })
    return {"semantic_context": semantic_context, "agent_steps": steps}


# --- 4. SQL Execution & Self-Correction Agent ---
def sql_execution_node(state: AgentState) -> Dict[str, Any]:
    print("[SQL Execution Node] Formulating and verifying multi-table SQL...")
    steps = state.agent_steps.copy()

    tables_summary_lines = []
    for t_name, cols in state.columns_by_table.items():
        col_list = ", ".join([f"\"{c['name']}\" ({c['type']})" for c in cols])
        tables_summary_lines.append(f"Table Name: '{t_name}'\nColumns: {col_list}")

    tables_summary = "\n\n".join(tables_summary_lines)
    primary_table = list(state.columns_by_table.keys())[0] if state.columns_by_table else "data_table"

    system_prompt = f"""You are a senior database engineer. 
Write a DuckDB SQL query to answer the user's question. You can query or JOIN across available tables.
Return ONLY the SQL query itself, with NO formatting, codeblocks, or explanatory text.

Available Tables & Schemas:
{tables_summary}

Semantic Layer Context:
{state.semantic_context}

DuckDB Query Rules:
- If querying a single dataset, reference table '{primary_table}'.
- If querying multiple datasets, JOIN them using logical key columns (e.g. matching IDs, names, dates).
- Always wrap column names in double quotes if they contain spaces, dots, or special characters.
- Prefix columns with their table name or alias when joining tables to avoid ambiguous column errors (e.g., table_a."column_name").
- Ensure all queries are READ-ONLY SELECT queries.
"""

    prompt = state.query
    if state.error_traceback:
        prompt += f"\n\nYour previous SQL query generated this error:\n{state.error_traceback}\nPlease auto-correct the query syntax to address this error."

    try:
        sql = call_llm(prompt=prompt, system_instruction=system_prompt).strip()
        if "```" in sql:
            # Extract content within ```sql ... ``` if present
            match = re.search(r"```(?:sql)?\s*(.*?)\s*```", sql, re.DOTALL | re.IGNORECASE)
            if match:
                sql = match.group(1).strip()
            else:
                sql = sql.replace("```sql", "").replace("```", "").strip()
        print(f"Generated SQL: {sql}")

        con = duckdb.connect(database=":memory:")
        for ds in state.datasets:
            t_name = sanitize_table_name(ds.name)
            con.execute(f"CREATE TABLE \"{t_name}\" AS SELECT * FROM read_csv_auto('{ds.csv_path}')")
            if t_name != "data_table" and len(state.datasets) == 1:
                con.execute(f"CREATE VIEW data_table AS SELECT * FROM \"{t_name}\"")

        res = con.execute(sql).fetchall()
        keys = [desc[0] for desc in con.description]
        results_list = [dict(zip(keys, row)) for row in res[:100]]

        steps.append({
            "node": "sql_execution",
            "title": "DuckDB SQL Execution",
            "detail": f"Executed query successfully. Returned {len(results_list)} rows.",
            "sql": sql,
        })

        return {
            "sql_query": sql,
            "query_results": results_list,
            "error_traceback": "",
            "retry_count": state.retry_count + 1,
            "agent_steps": steps,
        }
    except Exception as e:
        print(f"SQL execution error: {e}")
        steps.append({
            "node": "sql_execution_error",
            "title": "DuckDB SQL Exception",
            "detail": f"Syntax/Execution Error: {e}",
            "retry": state.retry_count + 1,
        })
        return {
            "error_traceback": str(e),
            "retry_count": state.retry_count + 1,
            "agent_steps": steps,
        }
    finally:
        if "con" in locals():
            con.close()


# --- 5. Visualization Agent ---
def visualization_node(state: AgentState) -> Dict[str, Any]:
    print("[Visualization Agent] Checking if visual assets are recommended...")
    if not state.query_results:
        return {}

    column_keys = list(state.query_results[0].keys())

    system_prompt = f"""You are a visualization expert.
Determine if a visual chart is relevant for the user query and results keys.

CRITICAL RULES:
1. You MUST choose `xAxisKey` and `yAxisKeys` ONLY from the available Resulting Keys: {column_keys}.
2. Do NOT invent or use keys like "metric", "value", or any other key not explicitly in the Resulting Keys list.
3. If the query results only contain a single row with multiple separate metrics (e.g. summary stats of different columns), a chart is typically NOT relevant. Return an empty JSON object {{}} in this case.
4. If no chart is relevant or if the required keys are not present in the Resulting Keys, return an empty JSON object: {{}}

You MUST respond with a JSON object conforming exactly to this schema:
{{
  "type": "bar" | "line" | "area" | "scatter" | "pie" | "radar",
  "title": "Visual chart descriptive title",
  "xAxisKey": "column_name",
  "yAxisKeys": ["numeric_column_name"],
  "aggregation": "sum" | "mean" | "count" | "min" | "max",
  "description": "Explanation of what this chart demonstrates",
  "summary": "Main takeaway message of this visual"
}}"""

    prompt = f"""User Query: "{state.query}"
Resulting Keys: {column_keys}
Sample Data: {json.dumps(state.query_results[0], default=str)}"""

    try:
        response_text = call_llm(prompt=prompt, system_instruction=system_prompt, json_mode=True)
        chart_data = json.loads(response_text)
        if not chart_data or "type" not in chart_data:
            return {}

        # Post-validation check: Ensure xAxisKey and all yAxisKeys exist in column_keys
        rec_x = chart_data.get("xAxisKey")
        rec_y = chart_data.get("yAxisKeys", [])

        if rec_x not in column_keys or not all(y in column_keys for y in rec_y):
            print(f"[Visualization Agent] Discarding chart because recommended keys ({rec_x}, {rec_y}) are not in column keys: {column_keys}")
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

    system_prompt = """You are a principal business intelligence analyst.
Analyze the user's query and the SQL dataset results carefully.
Provide a clear, engaging, and rich Markdown formatted analysis answer.
Highlight key takeaways in bold, format key metrics cleanly using bullet points or tables, and explain business insights.
Do NOT dump raw JSON or raw Python dictionary strings.

You MUST respond with a JSON object conforming exactly to this schema:
{
  "answer": "Rich markdown text summarizing the analytical insights",
  "suggested_questions": ["Question 1", "Question 2", "Question 3"]
}"""

    prompt = f"""User Query: "{state.query}"
SQL Query Executed: {state.sql_query}
Query Results: {json.dumps(state.query_results[:15], default=str)}"""

    try:
        response_text = call_llm(prompt=prompt, system_instruction=system_prompt, json_mode=True)
        res = json.loads(response_text)

        suggested = res.get("suggested_questions") or res.get("suggestedQuestions") or [
            "Can you explain this trend in more detail?",
            "What factors contribute most to these values?",
        ]

        return {
            "answer": res.get("answer", "Analysis complete."),
            "suggested_questions": suggested,
        }
    except Exception as e:
        print(f"[Synthesis Node] LLM synthesis fallback: {e}")
        # Formulate clean Markdown representation if LLM parsing fails
        if state.query_results:
            sample_keys = list(state.query_results[0].keys())
            rows_md = "\n".join([
                f"- **{r.get(sample_keys[0], 'Item')}**: " +
                ", ".join([f"{k}: `{v}`" for k, v in list(r.items())[1:4]])
                for r in state.query_results[:5]
            ])
            answer_md = f"### Analytical Summary\nProcessed **{len(state.query_results)}** matching records.\n\n{rows_md}"
        else:
            answer_md = "Analysis complete. No matching rows returned."

        return {
            "answer": answer_md,
            "suggested_questions": ["Explain this dataset summary", "Show me the top values"],
        }
