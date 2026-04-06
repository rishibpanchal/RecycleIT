import json
from typing import Any, Dict, List
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import os

load_dotenv()

class QuerySpec(BaseModel):
    intent: str
    parameters: dict

class QueryResult(BaseModel):
    data: Any
    metadata: dict

class QueryProcessor:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0, google_api_key=api_key)
        
        self.intent_prompt = PromptTemplate(
            input_variables=["query"],
            template="""You are an intent classifier for a recycling traceability system.
Classify the following natural language query into an intent and extract relevant parameters.
Common intents: 'date_filter', 'stage_filter', 'ranking', 'lineage_trace', 'general_question'.

Query: "{query}"

Output ONLY a valid JSON object matching this schema:
{{
    "intent": "intent_name",
    "parameters": {{"key1": "value1"}}
}}
"""
        )

    def _get_text(self, ai_msg) -> str:
        content = ai_msg.content
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            return " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return str(content)

    def parse_query(self, nl_query: str) -> QuerySpec:
        try:
            response = self.llm.invoke(self.intent_prompt.format(query=nl_query))
            # Extract JSON from response
            text = self._get_text(response)
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()
            elif text.startswith("```"):
                text = text.replace("```", "").strip()
            
            parsed = json.loads(text)
            return QuerySpec(intent=parsed.get("intent", "general_question"), parameters=parsed.get("parameters", {}))
        except Exception as e:
            return QuerySpec(intent="error", parameters={"error": str(e)})

    def execute_query(self, spec: QuerySpec) -> QueryResult:
        # In a full implementation, this would route to SQL, Graph, or NoSQL based on the intent
        # For this skeleton, we'll return mock data based on intent
        data = []
        if spec.intent == "date_filter":
            data = [{"date": "2026-03-20", "dispatches": 15}]
        elif spec.intent == "stage_filter":
            data = [{"stage": spec.parameters.get("stage", "washing"), "loss": "12%"}]
        elif spec.intent == "ranking":
            data = [{"batch_id": "BATCH-99", "yield": "94%"}]
        else:
            data = [{"result": "Sample execution result for " + spec.intent}]
            
        return QueryResult(data=data, metadata={"executed_intent": spec.intent})

    def format_response(self, result: QueryResult) -> str:
        prompt = f"""Format this query result into a natural, conversational response:
Intent: {result.metadata.get('executed_intent')}
Data: {json.dumps(result.data)}

Response should be a clear, human-readable sentence or two.
"""
        try:
            response = self.llm.invoke(prompt)
            return self._get_text(response).strip()
        except:
            return f"Result: {result.data}"

if __name__ == "__main__":
    qp = QueryProcessor()
    spec = qp.parse_query("What was the loss in washing stage?")
    print("Parsed Spec:", spec.dict())
    res = qp.execute_query(spec)
    print("Execution Result:", res.dict())
    fmt = qp.format_response(res)
    print("Formatted Response:", fmt)
