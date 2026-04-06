import json
import networkx as nx
from typing import List, Dict, Any
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import os

load_dotenv()

class Insight(BaseModel):
    type: str  # hotspot, efficiency, recommendation
    description: str
    severity: str

class Anomaly(BaseModel):
    node_id: str
    issue: str
    confidence: float

class InsightGenerator:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0, google_api_key=api_key)
        
    def _get_text(self, ai_msg) -> str:
        content = ai_msg.content
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            return " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return str(content)

    def analyze_batch(self, batch_id: str) -> List[Insight]:
        # In a real scenario, this would compute metrics from DB/Graph
        # We mock typical insights
        insights = [
            Insight(type="hotspot", description="Washing stage shows 15% loss - 3x higher than benchmark", severity="high"),
            Insight(type="efficiency", description="Overall yield 72% - below target of 80%", severity="medium"),
            Insight(type="recommendation", description=f"Consider reviewing {batch_id} process - high rejection rate", severity="high")
        ]
        return insights

    def detect_anomalies(self, graph: nx.DiGraph) -> List[Anomaly]:
        # Perform graph analysis to find structural anomalies
        anomalies = []
        for node in graph.nodes():
            # Example heuristic: if output > input, anomaly
            in_degree = graph.in_degree(node, weight="quantity")
            out_degree = graph.out_degree(node, weight="quantity")
            if in_degree > 0 and out_degree > in_degree:
                anomalies.append(Anomaly(
                    node_id=node,
                    issue=f"Output {out_degree} > Input {in_degree} - possible data error",
                    confidence=0.9
                ))
        return anomalies

    def summarize_journey(self, path: List[str], journey_data: Dict[str, Any] = None) -> str:
        prompt = f"""You are an expert report generator for a recycling traceability dashboard.
Generate a narrative text report summarizing a batch journey.
Path sequence: {path}
Context data (can be none): {journey_data}

Provide an output similar to this format:
Batch [ID] Journey Summary:
Started with [amount] kg from [Vendor] on [Date].
After [stage], [amount] kg passed to [next stage] (loss %).
...
Overall yield: [yield]%.
Status: [Dispatched/Pending]

Keep it clear, professional and structured with spacing.
"""
        response = self.llm.invoke(prompt)
        return self._get_text(response).strip()

if __name__ == "__main__":
    ig = InsightGenerator()
    
    # 1. Analyze Batch
    insights = ig.analyze_batch("INV-101")
    print("Batch Insights:")
    for ins in insights:
        print("-", ins.description)
        
    print("\n------------------------------\n")
    
    # 2. Detect Anomalies
    g = nx.DiGraph()
    g.add_edge("A", "INV-123", quantity=100)
    g.add_edge("INV-123", "B", quantity=110) # 110 > 100
    anomalies = ig.detect_anomalies(g)
    print("Anomalies Detected:")
    for an in anomalies:
        print("-", an.issue)
        
    print("\n------------------------------\n")
        
    # 3. Summarize Journey
    summary = ig.summarize_journey(["Vendor A", "Segregation", "Washing", "Granulation", "INV-101 (Dispatched)"])
    print("Journey Summary:")
    print(summary)
