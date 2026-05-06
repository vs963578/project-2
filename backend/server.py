from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="BPO QA Analyzer API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class AnalyzeRequest(BaseModel):
    transcript: str
    agent_name: Optional[str] = "Unknown Agent"
    call_id: Optional[str] = None


class Evaluation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str = "Unknown Agent"
    call_id: Optional[str] = None
    transcript: str
    qa_score: int
    greeting_score: int
    communication_score: int
    resolution_score: int
    compliance_score: int
    sentiment: str
    compliance_issues: List[str] = []
    missed_steps: List[str] = []
    root_cause: str
    risk_level: str
    business_impact: str
    coaching_tips: List[str] = []
    ideal_response: str
    motivation: str
    insights: str
    escalation_required: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


SYSTEM_PROMPT = """You are an advanced AI system designed for BPO Quality Assurance, Agent Coaching, and Performance Analytics.

Your task is to analyze customer-agent conversation data and generate a complete QA evaluation, coaching feedback, and business insights.

You must perform ALL of the following:

1. QA EVALUATION
- QA Score (0-100)
- Greeting Score (0-10)
- Communication Score (0-10)
- Resolution Score (0-10)
- Compliance Score (0-10)
- Sentiment (positive / neutral / negative)
- Compliance Issues (list)
- Missed Steps (list)

2. ROOT CAUSE ANALYSIS
- Root Cause (main issue)
- Risk Level (low / medium / high)
- Business Impact (short explanation)

3. AI COACHING SYSTEM
- 3 personalized coaching tips
- 1 ideal response the agent should have used
- 1 motivational message

4. PERFORMANCE INSIGHTS (FOR MANAGER)
- Key issues observed in this call (combined into the "insights" field as concise business prose)
- Risk indicators (folded into insights)
- escalation_required (yes/no with reason inside insights)

OUTPUT RULES:
- Return ONLY valid JSON. No markdown, no commentary, no code fences.
- Be strict like a real QA auditor.
- Do not hallucinate.
- Use clear business language.
- Keep outputs concise but meaningful.

Return JSON in EXACTLY this schema:
{
  "qa_score": number,
  "greeting_score": number,
  "communication_score": number,
  "resolution_score": number,
  "compliance_score": number,
  "sentiment": "positive|neutral|negative",
  "compliance_issues": ["..."],
  "missed_steps": ["..."],
  "root_cause": "...",
  "risk_level": "low|medium|high",
  "business_impact": "...",
  "coaching_tips": ["...", "...", "..."],
  "ideal_response": "...",
  "motivation": "...",
  "insights": "...",
  "escalation_required": "yes|no"
}"""


def extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM output."""
    text = text.strip()
    # Strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract first {...} block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "BPO QA Analyzer API", "status": "ok"}


@api_router.post("/analyze", response_model=Evaluation)
async def analyze_call(req: AnalyzeRequest):
    if not req.transcript or len(req.transcript.strip()) < 10:
        raise HTTPException(status_code=400, detail="Transcript is too short to analyze.")

    session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")

    user_msg = UserMessage(text=f"INPUT TRANSCRIPT:\n\n{req.transcript}\n\nReturn the JSON now.")

    try:
        raw = await chat.send_message(user_msg)
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    try:
        data = extract_json(raw if isinstance(raw, str) else str(raw))
    except Exception:
        logger.error("Failed to parse JSON from LLM. Raw: %s", raw)
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON.")

    evaluation = Evaluation(
        agent_name=req.agent_name or "Unknown Agent",
        call_id=req.call_id,
        transcript=req.transcript,
        qa_score=int(data.get("qa_score", 0)),
        greeting_score=int(data.get("greeting_score", 0)),
        communication_score=int(data.get("communication_score", 0)),
        resolution_score=int(data.get("resolution_score", 0)),
        compliance_score=int(data.get("compliance_score", 0)),
        sentiment=str(data.get("sentiment", "neutral")).lower(),
        compliance_issues=list(data.get("compliance_issues", []) or []),
        missed_steps=list(data.get("missed_steps", []) or []),
        root_cause=str(data.get("root_cause", "")),
        risk_level=str(data.get("risk_level", "low")).lower(),
        business_impact=str(data.get("business_impact", "")),
        coaching_tips=list(data.get("coaching_tips", []) or []),
        ideal_response=str(data.get("ideal_response", "")),
        motivation=str(data.get("motivation", "")),
        insights=str(data.get("insights", "")),
        escalation_required=str(data.get("escalation_required", "no")).lower(),
    )

    doc = evaluation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.evaluations.insert_one(doc)

    return evaluation


@api_router.get("/evaluations", response_model=List[Evaluation])
async def list_evaluations(limit: int = 50):
    docs = await db.evaluations.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for d in docs:
        if isinstance(d.get('created_at'), str):
            d['created_at'] = datetime.fromisoformat(d['created_at'])
    return docs


@api_router.get("/evaluations/{eval_id}", response_model=Evaluation)
async def get_evaluation(eval_id: str):
    doc = await db.evaluations.find_one({"id": eval_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if isinstance(doc.get('created_at'), str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return doc


@api_router.delete("/evaluations/{eval_id}")
async def delete_evaluation(eval_id: str):
    result = await db.evaluations.delete_one({"id": eval_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return {"deleted": True}


@api_router.get("/analytics/summary")
async def analytics_summary():
    docs = await db.evaluations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    total = len(docs)
    if total == 0:
        return {
            "total_calls": 0,
            "avg_qa_score": 0,
            "avg_greeting": 0,
            "avg_communication": 0,
            "avg_resolution": 0,
            "avg_compliance": 0,
            "escalation_rate": 0,
            "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "risk_breakdown": {"low": 0, "medium": 0, "high": 0},
            "top_compliance_issues": [],
            "trend": [],
        }

    avg = lambda key: round(sum(d.get(key, 0) for d in docs) / total, 1)

    sentiment_breakdown = {"positive": 0, "neutral": 0, "negative": 0}
    risk_breakdown = {"low": 0, "medium": 0, "high": 0}
    issue_counter = {}
    escalations = 0

    for d in docs:
        s = (d.get("sentiment") or "neutral").lower()
        if s in sentiment_breakdown:
            sentiment_breakdown[s] += 1
        r = (d.get("risk_level") or "low").lower()
        if r in risk_breakdown:
            risk_breakdown[r] += 1
        if (d.get("escalation_required") or "no").lower() == "yes":
            escalations += 1
        for issue in (d.get("compliance_issues") or []):
            key = issue.strip()
            if key:
                issue_counter[key] = issue_counter.get(key, 0) + 1

    top_issues = sorted(issue_counter.items(), key=lambda x: x[1], reverse=True)[:5]

    # Trend: last 10 calls in chronological order
    trend = []
    for d in reversed(docs[:10]):
        created = d.get('created_at')
        if isinstance(created, datetime):
            created = created.isoformat()
        trend.append({
            "created_at": created,
            "qa_score": d.get("qa_score", 0),
            "agent_name": d.get("agent_name", ""),
        })

    return {
        "total_calls": total,
        "avg_qa_score": avg("qa_score"),
        "avg_greeting": avg("greeting_score"),
        "avg_communication": avg("communication_score"),
        "avg_resolution": avg("resolution_score"),
        "avg_compliance": avg("compliance_score"),
        "escalation_rate": round((escalations / total) * 100, 1),
        "sentiment_breakdown": sentiment_breakdown,
        "risk_breakdown": risk_breakdown,
        "top_compliance_issues": [{"issue": k, "count": v} for k, v in top_issues],
        "trend": trend,
    }


@api_router.post("/upload-transcript")
async def upload_transcript(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="ignore")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file as text.")
    return {"transcript": text, "filename": file.filename}


AUDIO_EXTENSIONS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB Whisper limit


@api_router.post("/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...)):
    filename = file.filename or "audio"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '.{ext}'. Allowed: {', '.join(sorted(AUDIO_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file.")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file exceeds 25 MB Whisper limit.")

    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    audio_buffer = io.BytesIO(content)
    audio_buffer.name = filename  # whisper SDK uses the filename for format detection

    try:
        response = await stt.transcribe(
            file=audio_buffer,
            model="whisper-1",
            response_format="json",
        )
    except Exception as e:
        logger.exception("Whisper transcription failed")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")

    text = getattr(response, "text", None) or (response.get("text") if isinstance(response, dict) else None)
    if not text:
        raise HTTPException(status_code=502, detail="Whisper returned empty transcript.")

    return {"transcript": text, "filename": filename}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
