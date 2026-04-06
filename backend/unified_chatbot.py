import os
import json
import networkx as nx
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# Import the existing modules we built and the original nlp_agent
from nlp_agent import QueryProcessor as DBQueryProcessor
from query_processor import QueryProcessor as SimpleQueryProcessor
from insight_generator import InsightGenerator

load_dotenv()

class TraceabilityChatbot:
    """
    The Single Unified Chatbot Interface (Smart Router)
    Provides a seamless .chat() method that routes requests behind the scenes.
    """
    def __init__(self, db_path="../traceability.db", json_path="../traceability_report.json"):
        # Initialize sub-systems
        self.db_agent = DBQueryProcessor(db_path=db_path, json_path=json_path) # Handles SQL and Kuzu Graph
        self.simple_qp = SimpleQueryProcessor() # Handles intent parsing & formatting
        self.insight_gen = InsightGenerator()   # Handles anomalies, hotspots, & summaries
        
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0, google_api_key=api_key)
        
        # Memory variables
        self.history = []
        self._last_route = None  # Track last routing decision for API exposure
        
        # Memory Prompt for rewriting queries
        self.memory_prompt = PromptTemplate(
            input_variables=["history", "query"],
            template="""Given the following conversation history and the latest user query, rephrase the latest user query to be a standalone question that can be understood without the context of the conversation. If the query is already standalone, return it as is. Do not answer the question, just reformulate it.

Chat History:
{history}

Latest Query: {query}
Standalone Query:"""
        )
        
        # High-level Router Prompt
        self.router_prompt = PromptTemplate(
            input_variables=["query"],
            template="""You are a master router for a Traceability Chatbot.
Classify the given natural language query into exactly ONE of the following routing categories:
1. 'ANALYZE_BATCH': User wants insights, hotspots, recommendations, or anomalies for a particular batch/process. (e.g. "Analyze batch 101", "Are there anomalies?", "Find hotspots")
2. 'SUMMARIZE_JOURNEY': User wants a descriptive narrative summary of a batch's path. (e.g. "Summarize the journey of INV-123")
3. 'DATABASE': User is asking for specific data queries, lineage trace, counts, filters, rankings. (e.g. "What is the yield?", "Trace downstream of X", "How many dispatches today?")

Query: "{query}"

Output ONLY the category name (e.g. DATABASE). No extra text.
"""
        )

    def _get_text(self, ai_msg) -> str:
        content = ai_msg.content
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            return " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return str(content)

    def _extract_batch_id(self, query: str) -> str:
        """Helper to quickly extract a batch ID from a query using the LLM."""
        prompt = f"Extract the Batch ID or Item ID from this query. Query: '{query}'. Return ONLY the ID (e.g. 'INV-123' or 'BATCH-99'), or 'UNKNOWN' if not found."
        response = self.llm.invoke(prompt)
        return self._get_text(response).strip()

    def chat(self, user_message: str) -> str:
        print(f"\n[Chatbot] Received: '{user_message}'")
        
        # 0. Handle Memory (Rewrite query if history exists)
        actual_query = user_message
        if self.history:
            history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in self.history])
            rewritten_response = self.llm.invoke(self.memory_prompt.format(history=history_text, query=user_message))
            actual_query = self._get_text(rewritten_response).strip()
            if actual_query != user_message:
                print(f"[Chatbot] Rewrote as: '{actual_query}'")
        
        # 1. Route the query using the actual context-aware query
        route_response = self.llm.invoke(self.router_prompt.format(query=actual_query))
        route = self._get_text(route_response).strip().upper()
        
        # Store route for API exposure
        self._last_route = route
        
        print(f"[Chatbot] Master Router decided path: {route}")
        
        # 2. Execute based on route
        final_answer = ""
        if "ANALYZE_BATCH" in route:
            batch_id = self._extract_batch_id(actual_query)
            if batch_id == "UNKNOWN": batch_id = "General Data"
            
            # Use insight generator
            insights = self.insight_gen.analyze_batch(batch_id)
            
            # Format nicely
            response = f"**Analysis for {batch_id}:**\n"
            for ins in insights:
                icon = "🔥" if ins.type == "hotspot" else "📊" if ins.type == "efficiency" else "💡"
                response += f"- {icon} **{ins.type.capitalize()}** ({ins.severity}): {ins.description}\n"
            final_answer = response
            
        elif "SUMMARIZE_JOURNEY" in route:
            batch_id = self._extract_batch_id(actual_query)
            if batch_id == "UNKNOWN": batch_id = "INV-101"
            
            # For demonstration, mock a path. (In real life, we'd query Kuzu for the path array first)
            mock_path = ["Vendor", "Segregation", "Washing", "Granulation", batch_id]
            summary = self.insight_gen.summarize_journey(mock_path)
            final_answer = f"**Journey Summary:**\n{summary}"
            
        else: # DEFAULT TO 'DATABASE'
            # Use the existing robust DB agent which auto-routes to SQL or Cypher
            final_answer = self.db_agent.ask(actual_query)
            
        # 3. Store in History
        self.history.append({"role": "User", "content": user_message})
        self.history.append({"role": "Bot", "content": final_answer})
        
        # Keep history from growing unbounded (last 6 messages = 3 turns)
        if len(self.history) > 6:
            self.history = self.history[-6:]
            
        return final_answer

if __name__ == "__main__":
    bot = TraceabilityChatbot()
    
    # Test cases to prove the single interface and memory
    print("--------------------------------------------------")
    print(bot.chat("What is the overall yield percent from scenario 1?"))
    print("--------------------------------------------------")
    print(bot.chat("Analyze batch INV-123 for any hotspots or efficiency problems."))
    print("--------------------------------------------------")
    print(bot.chat("Are there any other anomalies in that same batch?")) # Follow up using memory
    print("--------------------------------------------------")
