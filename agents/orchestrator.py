from langgraph.graph import StateGraph, END
from typing import Dict, Any
from agents.nodes import (
    AgentState,
    validation_node,
    data_wrangling_node,
    schema_discovery_node,
    sql_execution_node,
    visualization_node,
    synthesis_node
)

def run_agent_orchestrator(query: str, dataset_name: str, csv_path: str) -> Dict[str, Any]:
    # Initialize the graph
    workflow = StateGraph(AgentState)

    # Add agent nodes
    workflow.add_node("validate", validation_node)
    workflow.add_node("wrangle", data_wrangling_node)
    workflow.add_node("discover_schema", schema_discovery_node)
    workflow.add_node("execute_sql", sql_execution_node)
    workflow.add_node("visualize", visualization_node)
    workflow.add_node("synthesize", synthesis_node)

    # Establish connections and conditional paths
    workflow.set_entry_point("validate")

    def post_validate_router(state: AgentState):
        if state.error_traceback:
            return "synthesize"
        return "wrangle"

    workflow.add_conditional_edges(
        "validate",
        post_validate_router,
        {
            "synthesize": "synthesize",
            "wrangle": "wrangle"
        }
    )

    workflow.add_edge("wrangle", "discover_schema")
    workflow.add_edge("discover_schema", "execute_sql")

    def sql_router(state: AgentState):
        if state.error_traceback and state.retry_count < 3:
            print(f"[Orchestrator Router] SQL failed. Retrying ({state.retry_count}/3)...")
            return "execute_sql"
        return "visualize"

    workflow.add_conditional_edges(
        "execute_sql",
        sql_router,
        {
            "execute_sql": "execute_sql",
            "visualize": "visualize"
        }
    )

    workflow.add_edge("visualize", "synthesize")
    workflow.add_edge("synthesize", END)

    # Compile the graph
    app = workflow.compile()

    # Create initial state
    initial_state = AgentState(
        query=query,
        dataset_name=dataset_name,
        csv_path=csv_path
    )

    # Execute graph synchronously
    result = app.invoke(initial_state)
    return result
