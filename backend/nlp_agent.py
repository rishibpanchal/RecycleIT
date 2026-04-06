import sqlite3
import json
import os
import kuzu
import pandas as pd
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# Load environment variables (e.g., GOOGLE_APPLICATION_CREDENTIALS)
load_dotenv()

class QueryProcessor:
    def __init__(self, db_path="../traceability.db", json_path="../traceability_report.json"):
        """
        Initialize the NLP Agent. Uses Vertex AI for inference and Kùzu for embedded, zero-setup Cypher execution.
        """
        self.db_path = db_path
        self.json_path = json_path
        self.kuzu_db_path = "./kuzu_db"
        # VertexAI expects a JSON service account file. If you use a raw API Key, you need GoogleGenerativeAI.
        # We auto-map GOOGLE_APPLICATION_CREDENTIALS as the key if that's what's in the .env file.
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0, google_api_key=api_key)
        
        # SQL-specific prompt enhanced with domain knowledge
        self.sql_prompt = PromptTemplate(
            input_variables=["schema", "question"],
            template="""You are an AI assistant that converts natural language to SQL queries.
Schema:
{schema}

Domain Rules for Aggregate Metrics (Yield, Output, Input, Anomalies):
1. For ANY questions asking about "overall yield", "total yield", "total input", "total output", or "total anomalies", ALWAYS query the `scenario_metrics` table directly.
2. Example: `SELECT overall_yield_percent FROM scenario_metrics WHERE scenario_id = 'Scenario 1';`
3. DO NOT attempt to manually calculate yield by summing the `graph_edges` or `graph_nodes` table.

Question: {question}

Return ONLY the valid SQL query for SQLite. Do not include markdown formatting or explanations."""
        )

        # Cypher Generator prompt tailored for our specific Kùzu schema
        self.cypher_generator_prompt = PromptTemplate(
            input_variables=["question"],
            template="""You are an AI assistant that writes Cypher queries for a Kùzu embedded graph database.
Our dynamic JSON graph has been loaded into Kùzu using a generic schema to avoid strict table mapping issues.

Schema Constraints:
1. All nodes belong to the table `Entity`.
   Properties: id (STRING), label (STRING), node_type (STRING), lifecycle_stage (INT64), phase (STRING).
2. All relationships belong to the table `Rel` (from Entity to Entity).
   Properties: mode (STRING), quantity (DOUBLE), status (STRING), is_anomaly (BOOL).

Example Query: "Find all downstream dependencies of Node X"
Cypher: MATCH (a:Entity {{id: 'X'}})-[r:Rel*1..5]->(b:Entity) RETURN b.id, b.node_type

Note: 
- ALWAYS use `Entity` for the node label (e.g., `(n:Entity)`). Filter by `node_type` property if needed (e.g., `WHERE n.node_type = 'BALED_LOT'`).
- ALWAYS use `Rel` for the relationship label (e.g., `-[r:Rel]->`). Filter by `mode` property if needed (e.g., `WHERE r.mode = 'TRANSFERRED'`).
- Kuzu supports standard OpenCypher.

Question: {question}

Return ONLY the valid Cypher query that logically extracts the answer. Do not include markdown formatting or explanations."""
        )

        self._init_kuzu()

    def _init_kuzu(self):
        """Initializes embedded Kùzu database and loads JSON if not already present."""
        print("[Kùzu] Initializing embedded graph engine...")
        self.db = kuzu.Database(self.kuzu_db_path)
        self.conn = kuzu.Connection(self.db)
        
        # Check if tables exist
        tables = self.conn.execute("CALL show_tables() RETURN *").get_as_df()
        if 'name' in tables.columns and 'Entity' in tables['name'].values:
            print("[Kùzu] Tables already exist. Ready to query.")
            return
            
        print("[Kùzu] Creating schema...")
        self.conn.execute("CREATE NODE TABLE Entity(id STRING, label STRING, node_type STRING, lifecycle_stage INT64, phase STRING, PRIMARY KEY (id))")
        self.conn.execute("CREATE REL TABLE Rel(FROM Entity TO Entity, mode STRING, quantity DOUBLE, status STRING, is_anomaly BOOL)")
        
        self._load_json_data()

    def _load_json_data(self):
        """Loads JSON data into Kùzu."""
        if not os.path.exists(self.json_path):
            print("[Kùzu] No JSON report found to load.")
            return

        with open(self.json_path, 'r') as f:
            graph_data = json.load(f)

        nodes = graph_data.get("node_summary", [])
        edges = graph_data.get("edge_summary", [])
        
        print("[Kùzu] Loading JSON data into embedded engine...")
        
        # Kuzu is highly optimized for bulk loading via CSV/Parquet, but we can parameterize inserts for small graphs
        for node in nodes:
            nid = node.get("id")
            label = str(node.get("label", nid))
            ntype = str(node.get("node_type", "Unknown"))
            stage = int(node.get("lifecycle_stage", 0))
            phase = str(node.get("phase", ""))
            
            # Using parameters
            query = "CREATE (n:Entity {id: $id, label: $label, node_type: $ntype, lifecycle_stage: $stage, phase: $phase})"
            self.conn.execute(query, parameters={"id": nid, "label": label, "ntype": ntype, "stage": stage, "phase": phase})
            
        for edge in edges:
            u = edge.get("from")
            v = edge.get("to")
            mode = str(edge.get("mode", "TRANSFERRED"))
            qty = float(edge.get("quantity", 0.0))
            status = str(edge.get("status", ""))
            anomaly = bool(edge.get("is_anomaly", False))
            
            query = """
            MATCH (a:Entity), (b:Entity) 
            WHERE a.id = $u AND b.id = $v 
            CREATE (a)-[r:Rel {mode: $mode, quantity: $qty, status: $status, is_anomaly: $anomaly}]->(b)
            """
            self.conn.execute(query, parameters={"u": u, "v": v, "mode": mode, "qty": qty, "status": status, "anomaly": anomaly})

        print(f"[Kùzu] Successfully loaded {len(nodes)} nodes and {len(edges)} edges natively.")

    def _get_db_schema(self):
        """Retrieve schema from the SQLite DB."""
        if not os.path.exists(self.db_path):
            return "No database found."
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
        schemas = cursor.fetchall()
        conn.close()
        return "\n".join([s[0] for s in schemas if s[0]])

    def _execute_sql(self, query: str):
        """Execute SQL query safely."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(query)
            results = cursor.fetchall()
            conn.close()
            return results
        except Exception as e:
            return str(e)

    def _execute_cypher(self, query: str):
        """Execute Cypher natively against embedded Kùzu DB."""
        try:
            result = self.conn.execute(query)
            # Fetch as pandas df and convert to dict for easy LLM readability
            if result.has_next():
                df = result.get_as_df()
                return df.to_dict(orient="records")
            return "No results found."
        except Exception as e:
            return f"Cypher Execution Error: {str(e)}"

    def _get_text(self, ai_msg) -> str:
        """Helper to extract clean text from Langchain AIMessage, handling multi-modal cases."""
        content = ai_msg.content
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            # Google AI sometimes returns a list of dictionaries [{'type': 'text', 'text': '...'}]
            return " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return str(content)

    def route_query(self, question: str) -> str:
        """Determines if the question requires SQL or Graph/Cypher."""
        routing_prompt = f"""You are a query router.
Decide whether the following question should be answered using a SQL database OR a Graph database.
SQL is good for: aggregations, filtering specific fields, bulk records, counts.
Graph is good for: lineage, trace paths, upstream/downstream flow, material transformation sequence, bottlenecks.

Question: "{question}"
Return ONLY 'SQL' or 'GRAPH'.
"""
        ai_msg = self.llm.invoke(routing_prompt)
        response = self._get_text(ai_msg).strip().upper()
        if "SQL" in response:
            return "SQL"
        return "GRAPH"

    def ask(self, question: str):
        """Main method to ask a question."""
        route = self.route_query(question)
        print(f"\n[Agent] Routing query to: {route}")

        if route == "SQL":
            schema = self._get_db_schema()
            sql_response = self.llm.invoke(self.sql_prompt.format(schema=schema, question=question))
            sql_query = self._get_text(sql_response).strip()
            
            if sql_query.startswith("```sql"):
                sql_query = sql_query.replace("```sql", "").replace("```", "").strip()
            elif sql_query.startswith("```"):
                sql_query = sql_query.replace("```", "").strip()
                
            print(f"[Agent] Generated SQL: {sql_query}")
            result = self._execute_sql(sql_query)
            
            summary_prompt = f"User asked: {question}\nSQL Query: {sql_query}\nResult: {result}\nProvide a short natural language answer:"
            return self._get_text(self.llm.invoke(summary_prompt))
            
        else:
            cypher_response = self.llm.invoke(self.cypher_generator_prompt.format(question=question))
            cypher_query = self._get_text(cypher_response).strip()
            
            if cypher_query.startswith("```cypher"):
                cypher_query = cypher_query.replace("```cypher", "").replace("```", "").strip()
            elif cypher_query.startswith("```"):
                cypher_query = cypher_query.replace("```", "").strip()
                
            print(f"[Agent] Generated Cypher: {cypher_query}")
            
            # Execute natively on embedded Kùzu
            cypher_results = self._execute_cypher(cypher_query)
            
            summary_prompt = f"User asked: {question}\nCypher Query Executed: {cypher_query}\nResult from Kùzu Graph Engine: {cypher_results}\nProvide a short natural language answer interpreting the JSON results. Be concise."
            return self._get_text(self.llm.invoke(summary_prompt))

if __name__ == "__main__":
    agent = QueryProcessor(db_path="../traceability.db", json_path="../traceability_report.json")
    
    # Test queries
    q1 = "How many distinct transaction types are there in the transactions table?"
    print(f"Q: {q1}")
    print(f"A: {agent.ask(q1)}\n")
    
    q2 = "Find all downstream dependencies of INV-101."
    print(f"Q: {q2}")
    print(f"A: {agent.ask(q2)}\n")
