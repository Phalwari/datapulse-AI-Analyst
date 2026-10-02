from langgraph.graph import StateGraph, END
from typing import Dict, Any
try:
    from backend.agents.nodes import (
        AgentState,
        validation_node,
        data_wrangling_node,
        schema_discovery_node,
        sql_execution_node,
        visualization_node,
        synthesis_node,
    )
except ImportError:
    from agents.nodes import (
        AgentState,
        validation_node,
        data_wrangling_node,
        schema_discovery_node,
        sql_execution_node,
        visualization_node,
        synthesis_node,
    )



def run_agent_orchestrator(
    query: str, dataset_name: str = "", csv_path: str = "", datasets: list = None
) -> Dict[str, Any]:
    """
    Build and execute the LangGraph agent state graph for a single user query.

    Node execution order:
        validate → wrangle → discover_schema → execute_sql (with retry loop) → visualize → synthesize
    """
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
            "wrangle": "wrangle",
        },
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
            "visualize": "visualize",
        },
    )

    workflow.add_edge("visualize", "synthesize")
    workflow.add_edge("synthesize", END)

    # Compile the graph
    app = workflow.compile()

    formatted_datasets = datasets or []
    if not formatted_datasets and csv_path:
        formatted_datasets = [{"name": dataset_name, "csv_path": csv_path}]

    # Create initial state
    initial_state = AgentState(
        query=query,
        dataset_name=dataset_name,
        csv_path=csv_path,
        datasets=formatted_datasets,
    )

    # Execute graph synchronously
    result = app.invoke(initial_state)
    return result
