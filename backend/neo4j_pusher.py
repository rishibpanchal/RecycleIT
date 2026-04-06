"""
neo4j_pusher.py
===============
Pushes a NetworkX traceability graph into Neo4j (Aura / Desktop / Docker).
Now includes yield analytics tracking!

Usage:
    from neo4j_pusher import Neo4jPusher
    from grapher import build_traceability_graph, compute_yield_analytics

    G = build_traceability_graph("transforms.csv", "events.csv")
    yield_analytics = compute_yield_analytics(G)

    pusher = Neo4jPusher(
        uri      = "neo4j+s://<your-aura-id>.databases.neo4j.io",
        user     = "neo4j",
        password = "<your-aura-password>",
    )
    pusher.push_graph(G, scenario_id="Scenario 1", yield_analytics=yield_analytics)
    pusher.close()

Environment variable alternative (recommended):
    Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in your .env file
    and call Neo4jPusher.from_env() instead of the constructor.

Recent Changes:
    ✅ Fixed directory path (PROBLEM_STATEMENT_3)
    ✅ Added yield metrics tracking via ScenarioMetadata nodes
    ✅ Improved yield calculation (includes all productive terminals)
    ✅ Better error handling and logging for index creation
"""

import os
import json
import time
import logging
from typing import Optional

import networkx as nx
from neo4j import GraphDatabase, exceptions as neo4j_exc
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger("neo4j_pusher")

# ─────────────────────────────────────────────
#  BATCH SIZE — tune based on Aura free tier
#  Free tier: 200k nodes / 400k relationships
#  Keep batches at 500 to avoid timeout errors
# ─────────────────────────────────────────────
BATCH_SIZE = 500


class Neo4jPusher:
    """
    Handles all Neo4j operations for the traceability graph.

    Schema created in Neo4j:
    ─────────────────────────
    Nodes:
        (:InventoryLot {id, label, node_type, color_hint,
                        lifecycle_stage, lifecycle_label, phase,
                        warehouse_code, warehouse_label,
                        last_known_qty, is_root_source, is_terminal_sink,
                        anomaly_incoming_count, in_degree, out_degree,
                        transactions_json, scenario_id})

        (:ScenarioMetadata {scenario_id, overall_yield_percent,
                           overall_input_qty, overall_output_qty,
                           per_stage_count, loss_hotspots_count})

    Relationships:
        (:InventoryLot)-[:TRANSFORMS_TO {
                        transform_id, transaction_id,
                        mode, mode_label, phase,
                        lifecycle_stage, lifecycle_label,
                        quantity, loss_percent, loss_qty,
                        process_code, process_label,
                        status, transaction_date,
                        warehouse_code, warehouse_label,
                        is_anomaly, edge_weight, label, remarks,
                        scenario_id}]->(:InventoryLot)

    Indexes created automatically:
        - InventoryLot.id
        - InventoryLot.scenario_id
        - InventoryLot.node_type
        - InventoryLot.lifecycle_stage
        - InventoryLot.is_root_source
        - InventoryLot.is_terminal_sink
        - ScenarioMetadata.scenario_id
        - ScenarioMetadata.overall_yield_percent
        - TRANSFORMS_TO.is_anomaly
        - TRANSFORMS_TO.status
        - TRANSFORMS_TO.scenario_id

    Updates (Latest):
        - Added ScenarioMetadata nodes for yield tracking
        - Improved yield calculation (includes all productive terminals)
        - Full scenario metadata pushing
        - Better error handling and logging
    """

    def __init__(self, uri: str, user: str, password: str):
        log.info("Connecting to Neo4j at %s ...", uri)
        self._driver = GraphDatabase.driver(uri, auth=(user, password))
        # Verify connectivity immediately — fail fast
        self._driver.verify_connectivity()
        log.info("Connected.")

    @classmethod
    def from_env(cls) -> "Neo4jPusher":
        """
        Reads NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD from environment / .env file.
        Recommended for production use — keeps credentials out of source code.
        """
        uri      = os.environ.get("NEO4J_URI")
        user     = os.environ.get("NEO4J_USER", "neo4j")
        password = os.environ.get("NEO4J_PASSWORD")

        if not uri or not password:
            raise EnvironmentError(
                "NEO4J_URI and NEO4J_PASSWORD must be set. "
                "Add them to your .env file or environment variables."
            )
        return cls(uri=uri, user=user, password=password)

    def close(self):
        self._driver.close()
        log.info("Neo4j connection closed.")

    # ─────────────────────────────────────────
    #  PUBLIC: Main entry point
    # ─────────────────────────────────────────

    def push_graph(
        self,
        G: nx.DiGraph,
        scenario_id: str,
        clear_scenario_first: bool = True,
        yield_analytics: dict = None,
    ) -> None:
        """
        Full pipeline:
        1. (Optional) Clear existing data for this scenario
        2. Create indexes
        3. Push nodes in batches
        4. Push edges in batches
        5. (Optional) Push yield analytics as scenario metadata

        Args:
            G               : The NetworkX DiGraph from grapher.py
            scenario_id     : Tag for this scenario (e.g. "Scenario 1")
            clear_scenario_first : If True, deletes existing nodes/edges
                                   for this scenario before pushing.
            yield_analytics : Optional dict with overall_yield_percent, overall_input_qty,
                            overall_output_qty from compute_yield_analytics()
        """
        log.info("=" * 55)
        log.info(" Pushing graph for: %s", scenario_id)
        log.info(" Nodes: %d  |  Edges: %d", G.number_of_nodes(), G.number_of_edges())
        if yield_analytics:
            log.info(" Yield: %.2f%%  |  Input: %.2f kg  |  Output: %.2f kg",
                    yield_analytics.get("overall_yield_percent", 0),
                    yield_analytics.get("overall_input_qty", 0),
                    yield_analytics.get("overall_output_qty", 0))
        log.info("=" * 55)

        if clear_scenario_first:
            self._clear_scenario(scenario_id)

        self._create_indexes()
        self._push_nodes(G, scenario_id)
        self._push_edges(G, scenario_id)

        # Push yield analytics as scenario metadata
        if yield_analytics:
            self._push_yield_analytics(scenario_id, yield_analytics)

        log.info("[DONE] %s pushed successfully.", scenario_id)

    def clear_all(self) -> None:
        """
        ⚠ Deletes ALL nodes and relationships in the database.
        Use only during development / full resets.
        """
        log.warning("Clearing ENTIRE Neo4j database...")
        with self._driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        log.info("Database cleared.")

    # ─────────────────────────────────────────
    #  INTERNAL: Yield analytics storage
    # ─────────────────────────────────────────

    def _push_yield_analytics(self, scenario_id: str, analytics: dict) -> None:
        """
        Pushes yield analytics as a special ScenarioMetadata node.
        Allows querying yield data alongside graph data in Neo4j.
        """
        log.info("Pushing yield analytics for scenario...")
        metadata = {
            "scenario_id": scenario_id,
            "overall_yield_percent": float(analytics.get("overall_yield_percent", 0)),
            "overall_input_qty": float(analytics.get("overall_input_qty", 0)),
            "overall_output_qty": float(analytics.get("overall_output_qty", 0)),
            "per_stage_count": len(analytics.get("per_stage", [])),
            "loss_hotspots_count": len(analytics.get("loss_hotspots", [])),
        }

        with self._driver.session() as session:
            session.run(
                """
                MERGE (s:ScenarioMetadata {scenario_id: $sid})
                SET s += $data
                """,
                {"sid": scenario_id, "data": metadata}
            )

        log.info("  Yield: %.2f%% | Input: %.2f kg | Output: %.2f kg",
                metadata["overall_yield_percent"],
                metadata["overall_input_qty"],
                metadata["overall_output_qty"])

    # ─────────────────────────────────────────
    #  INTERNAL: Indexes
    # ─────────────────────────────────────────

    def _create_indexes(self) -> None:
        """
        Creates indexes for fast lookups.
        Uses CREATE INDEX IF NOT EXISTS — safe to call multiple times.
        """
        indexes = [
            # Node indexes — most common lookup patterns
            "CREATE INDEX inv_id IF NOT EXISTS FOR (n:InventoryLot) ON (n.id)",
            "CREATE INDEX inv_scenario IF NOT EXISTS FOR (n:InventoryLot) ON (n.scenario_id)",
            "CREATE INDEX inv_node_type IF NOT EXISTS FOR (n:InventoryLot) ON (n.node_type)",
            "CREATE INDEX inv_lifecycle IF NOT EXISTS FOR (n:InventoryLot) ON (n.lifecycle_stage)",
            "CREATE INDEX inv_warehouse IF NOT EXISTS FOR (n:InventoryLot) ON (n.warehouse_code)",
            "CREATE INDEX inv_is_root IF NOT EXISTS FOR (n:InventoryLot) ON (n.is_root_source)",
            "CREATE INDEX inv_is_sink IF NOT EXISTS FOR (n:InventoryLot) ON (n.is_terminal_sink)",

            # Scenario metadata indexes
            "CREATE INDEX meta_scenario IF NOT EXISTS FOR (m:ScenarioMetadata) ON (m.scenario_id)",
            "CREATE INDEX meta_yield IF NOT EXISTS FOR (m:ScenarioMetadata) ON (m.overall_yield_percent)",

            # Relationship indexes — anomaly and status queries
            "CREATE INDEX rel_anomaly IF NOT EXISTS FOR ()-[r:TRANSFORMS_TO]-() ON (r.is_anomaly)",
            "CREATE INDEX rel_status IF NOT EXISTS FOR ()-[r:TRANSFORMS_TO]-() ON (r.status)",
            "CREATE INDEX rel_scenario IF NOT EXISTS FOR ()-[r:TRANSFORMS_TO]-() ON (r.scenario_id)",
        ]
        with self._driver.session() as session:
            for idx_query in indexes:
                try:
                    session.run(idx_query)
                except Exception as e:
                    # Index might already exist in some Neo4j versions
                    log.warning("Index creation note: %s", e)
        log.info("Indexes created / verified.")

    # ─────────────────────────────────────────
    #  INTERNAL: Node push
    # ─────────────────────────────────────────

    def _push_nodes(self, G: nx.DiGraph, scenario_id: str) -> None:
        """
        Pushes all nodes using MERGE (upsert by id + scenario_id).
        Batched to avoid memory issues on large graphs.
        """
        log.info("Pushing nodes...")

        all_nodes = []
        for node_id, data in G.nodes(data=True):
            # transactions is a list of dicts — serialize to JSON string for Neo4j
            txns = data.get("transactions", [])
            node_props = {
                "id":                    node_id,
                "label":                 data.get("label", node_id),
                "node_type":             data.get("node_type", "UNKNOWN"),
                "color_hint":            data.get("color_hint", "#ffffff"),
                "lifecycle_stage":       int(data.get("lifecycle_stage", 0)),
                "lifecycle_label":       str(data.get("lifecycle_label", "Unknown")),
                "phase":                 str(data.get("phase", "UNKNOWN")),
                "warehouse_code":        str(data.get("warehouse_code", "UNKNOWN")),
                "warehouse_label":       str(data.get("warehouse_label", "Unknown")),
                "last_known_qty":        float(data.get("last_known_qty", 0.0)),
                "is_root_source":        bool(data.get("is_root_source", False)),
                "is_terminal_sink":      bool(data.get("is_terminal_sink", False)),
                "anomaly_incoming_count": int(data.get("anomaly_incoming_count", 0)),
                "in_degree":             int(data.get("in_degree", 0)),
                "out_degree":            int(data.get("out_degree", 0)),
                # Serialized transaction history for this lot
                "transactions_json":     json.dumps(txns, default=str),
                "scenario_id":           scenario_id,
            }
            all_nodes.append(node_props)

        total = len(all_nodes)
        pushed = 0

        for batch in _batched(all_nodes, BATCH_SIZE):
            self._run_with_retry(
                """
                UNWIND $rows AS row
                MERGE (n:InventoryLot {id: row.id, scenario_id: row.scenario_id})
                SET n += row
                """,
                {"rows": batch},
            )
            pushed += len(batch)
            log.info("  Nodes: %d / %d", pushed, total)

        log.info("Nodes pushed: %d", total)

    # ─────────────────────────────────────────
    #  INTERNAL: Edge push
    # ─────────────────────────────────────────

    def _push_edges(self, G: nx.DiGraph, scenario_id: str) -> None:
        """
        Pushes all edges as TRANSFORMS_TO relationships.
        Uses MERGE on transform_id + scenario_id to avoid duplicates.
        """
        log.info("Pushing edges...")

        all_edges = []
        for u, v, data in G.edges(data=True):
            edge_props = {
                "source":           u,
                "target":           v,
                "transform_id":     str(data.get("transform_id", "UNKNOWN")),
                "transaction_id":   str(data.get("transaction_id", "UNKNOWN")),
                "mode":             str(data.get("mode", "UNKNOWN")),
                "mode_label":       str(data.get("mode_label", "")),
                "phase":            str(data.get("phase", "UNKNOWN")),
                "lifecycle_stage":  int(data.get("lifecycle_stage", 0)),
                "lifecycle_label":  str(data.get("lifecycle_label", "")),
                "quantity":         float(data.get("quantity", 0.0)),
                "loss_percent":     float(data.get("loss_percent", 0.0)),
                "loss_qty":         float(data.get("loss_qty", 0.0)),
                "process_code":     str(data.get("process_code", "")),
                "process_label":    str(data.get("process_label", "")),
                "status":           str(data.get("status", "UNKNOWN")),
                "transaction_date": str(data.get("transaction_date", "")),
                "warehouse_code":   str(data.get("warehouse_code", "UNKNOWN")),
                "warehouse_label":  str(data.get("warehouse_label", "")),
                "remarks":          str(data.get("remarks", "")),
                "is_anomaly":       bool(data.get("is_anomaly", False)),
                "edge_weight":      float(data.get("edge_weight", 0.0)),
                "label":            str(data.get("label", "")),
                "scenario_id":      scenario_id,
            }
            all_edges.append(edge_props)

        total = len(all_edges)
        pushed = 0

        for batch in _batched(all_edges, BATCH_SIZE):
            self._run_with_retry(
                """
                UNWIND $rows AS row
                MATCH (src:InventoryLot {id: row.source, scenario_id: row.scenario_id})
                MATCH (dst:InventoryLot {id: row.target, scenario_id: row.scenario_id})
                MERGE (src)-[r:TRANSFORMS_TO {
                    transform_id: row.transform_id,
                    scenario_id:  row.scenario_id
                }]->(dst)
                SET r += row
                """,
                {"rows": batch},
            )
            pushed += len(batch)
            log.info("  Edges: %d / %d", pushed, total)

        log.info("Edges pushed: %d", total)

    # ─────────────────────────────────────────
    #  INTERNAL: Scenario cleanup
    # ─────────────────────────────────────────

    def _clear_scenario(self, scenario_id: str) -> None:
        """
        Deletes all nodes and relationships for a specific scenario.
        Safe — only affects the given scenario_id tag.
        """
        log.info("Clearing existing data for scenario: %s", scenario_id)
        with self._driver.session() as session:
            session.run(
                """
                MATCH (n:InventoryLot {scenario_id: $sid})
                DETACH DELETE n
                """,
                {"sid": scenario_id},
            )
        log.info("Cleared.")

    # ─────────────────────────────────────────
    #  INTERNAL: Retry wrapper
    # ─────────────────────────────────────────

    def _run_with_retry(
        self,
        query: str,
        params: dict,
        max_retries: int = 3,
        backoff_seconds: float = 2.0,
    ) -> None:
        """
        Runs a Cypher query with exponential backoff retry.
        Handles transient Aura connection errors gracefully.
        """
        for attempt in range(1, max_retries + 1):
            try:
                with self._driver.session() as session:
                    session.run(query, params)
                return
            except (
                neo4j_exc.ServiceUnavailable,
                neo4j_exc.SessionExpired,
                neo4j_exc.TransientError,
            ) as e:
                if attempt == max_retries:
                    log.error("Query failed after %d retries: %s", max_retries, e)
                    raise
                wait = backoff_seconds * attempt
                log.warning("Transient error (attempt %d/%d). Retrying in %.1fs...", attempt, max_retries, wait)
                time.sleep(wait)


# ─────────────────────────────────────────────
#  UTILITY: Batch generator
# ─────────────────────────────────────────────

def _batched(items: list, size: int):
    """Yield successive chunks of `size` from `items`."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


# ─────────────────────────────────────────────
#  ENTRYPOINT: Run standalone
#  python neo4j_pusher.py
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import glob
    import sys
    from grapher import build_traceability_graph, compute_yield_analytics

    BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
    PROBLEM_DIR  = os.path.join(BASE_DIR, "PROBLEM_STATEMENT_3")

    scenario_dirs = sorted(glob.glob(os.path.join(PROBLEM_DIR, "Scenario *")))
    if not scenario_dirs:
        log.error("No scenario directories found in %s", PROBLEM_DIR)
        print(f"Available directories:")
        import os as os_module
        for item in os_module.listdir(BASE_DIR):
            print(f"  - {item}")
        sys.exit(1)

    # Connect using .env credentials
    pusher = Neo4jPusher.from_env()

    for scenario_dir in scenario_dirs:
        scenario_name   = os.path.basename(scenario_dir)
        transforms_path = os.path.join(scenario_dir, "inventory_transforms.csv")
        events_path     = os.path.join(scenario_dir, "transaction_events.csv")

        try:
            log.info(f"\nProcessing {scenario_name}...")
            G = build_traceability_graph(transforms_path, events_path)

            # Compute yield analytics for this scenario
            yield_analytics = compute_yield_analytics(G)

            # Push graph with yield metrics
            pusher.push_graph(
                G,
                scenario_id=scenario_name,
                clear_scenario_first=True,
                yield_analytics=yield_analytics
            )
        except FileNotFoundError as e:
            log.error("Missing files for %s: %s", scenario_name, e)
        except Exception as e:
            import traceback
            log.error("Failed for %s: %s", scenario_name, e)
            traceback.print_exc()

    pusher.close()
    log.info("All scenarios pushed to Neo4j.")