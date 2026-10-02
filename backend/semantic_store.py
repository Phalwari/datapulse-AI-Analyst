import os
import chromadb
from chromadb.utils import embedding_functions


class SemanticStore:
    """
    ChromaDB-backed semantic vector store for mapping dataset column metadata
    to natural language meanings. Prevents LLM hallucinations by grounding
    column resolution in actual schema embeddings.
    """

    def __init__(self, persist_directory: str = None):
        if persist_directory is None:
            persist_directory = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "chroma_db")
            )
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        self.collection = self.client.get_or_create_collection(
            name="schema_metadata",
            embedding_function=self.embedding_function,
        )

    def add_schema(
        self,
        dataset_name: str,
        column_name: str,
        column_type: str,
        description: str,
        sample_values: list,
    ):
        document = (
            f"Column Name: {column_name}\n"
            f"Data Type: {column_type}\n"
            f"Business Description: {description}\n"
            f"Sample Data: {', '.join(map(str, sample_values[:5]))}"
        )
        self.collection.add(
            documents=[document],
            metadatas=[{"dataset": dataset_name, "column": column_name, "type": column_type}],
            ids=[f"{dataset_name}_{column_name}"],
        )

    def query_similar_columns(
        self,
        dataset_name: str = None,
        query: str = "",
        n_results: int = 5,
        dataset_names: list = None,
    ):
        try:
            count = self.collection.count()
            if count == 0:
                return {"documents": [[]], "metadatas": [[]]}

            where_filter = None
            if dataset_names and len(dataset_names) > 0:
                if len(dataset_names) == 1:
                    where_filter = {"dataset": dataset_names[0]}
                else:
                    where_filter = {"dataset": {"$in": dataset_names}}
            elif dataset_name:
                where_filter = {"dataset": dataset_name}

            results = self.collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where=where_filter,
            )
            return results
        except Exception as e:
            print(f"Error querying ChromaDB: {e}")
            return {"documents": [[]], "metadatas": [[]]}

    def clear_dataset(self, dataset_name: str):
        try:
            self.collection.delete(where={"dataset": dataset_name})
        except Exception as e:
            print(f"Error clearing dataset in ChromaDB: {e}")
