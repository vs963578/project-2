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
from datetime import timedelta
import httpx

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


class DiarizeRequest(BaseModel):
    transcript: str


class TalkRatio(BaseModel):
    agent_words: int = 0
    customer_words: int = 0
    agent_pct: float = 0.0
    customer_pct: float = 0.0


class Evaluation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str = "Unknown Agent"
    call_id: Optional[str] = None
    transcript: str
    diarized_transcript: Optional[str] = None
    talk_ratio: Optional[TalkRatio] = None
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


DIARIZE_SYSTEM_PROMPT = """You are a speaker diarization assistant for BPO call transcripts.

Your job: take a raw, unlabeled call transcript and rewrite it so every utterance is prefixed with either "Agent:" or "Customer:" on its own line.

Rules:
- Identify each turn of speech and label it correctly based on context (greetings, problem statements, resolution language, support actions, etc.).
- The agent typically: greets, asks verification questions, troubleshoots, offers solutions, follows compliance scripts.
- The customer typically: states a problem, expresses frustration, asks questions, requests cancellation, etc.
- Keep the original wording verbatim. Do NOT paraphrase, summarize, translate, or add new content.
- Merge consecutive lines from the same speaker into one labeled turn.
- If a line is already labeled (e.g. "Agent:" or "Customer:" or "Rep:" / "Caller:"), normalize to "Agent:" / "Customer:".
- Output ONLY the diarized transcript. No commentary, no markdown, no code fences."""


async def diarize_text(transcript: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=DIARIZE_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")
    msg = UserMessage(text=f"RAW TRANSCRIPT:\n\n{transcript}\n\nReturn the diarized transcript now.")
    raw = await chat.send_message(msg)
    out = raw if isinstance(raw, str) else str(raw)
    out = out.strip()
    if out.startswith("```"):
        out = re.sub(r"^```(?:\w+)?\s*", "", out)
        out = re.sub(r"\s*```$", "", out)
    return out.strip()


SPEAKER_LINE_RE = re.compile(r"^\s*(agent|customer|rep|representative|caller|client|cust)\s*[:\-]\s*(.*)$", re.IGNORECASE)


def is_diarized(text: str) -> bool:
    """Heuristic: at least 2 lines start with Agent:/Customer:."""
    if not text:
        return False
    matches = 0
    for line in text.splitlines():
        if SPEAKER_LINE_RE.match(line):
            matches += 1
            if matches >= 2:
                return True
    return False


def compute_talk_ratio(diarized: str) -> TalkRatio:
    agent_words = 0
    customer_words = 0
    if not diarized:
        return TalkRatio()
    for line in diarized.splitlines():
        m = SPEAKER_LINE_RE.match(line)
        if not m:
            continue
        speaker = m.group(1).lower()
        content = m.group(2).strip()
        wc = len(re.findall(r"\b\w+\b", content))
        if speaker in ("agent", "rep", "representative"):
            agent_words += wc
        else:
            customer_words += wc
    total = agent_words + customer_words
    if total == 0:
        return TalkRatio(agent_words=agent_words, customer_words=customer_words)
    return TalkRatio(
        agent_words=agent_words,
        customer_words=customer_words,
        agent_pct=round((agent_words / total) * 100, 1),
        customer_pct=round((customer_words / total) * 100, 1),
    )


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "BPO QA Analyzer API", "status": "ok"}


@api_router.post("/analyze", response_model=Evaluation)
async def analyze_call(req: AnalyzeRequest):
    if not req.transcript or len(req.transcript.strip()) < 10:
        raise HTTPException(status_code=400, detail="Transcript is too short to analyze.")

    # Auto-diarize if not already labeled
    diarized_text = req.transcript
    if not is_diarized(req.transcript):
        try:
            diarized_text = await diarize_text(req.transcript)
        except Exception:
            logger.exception("Pre-analyze diarization failed; using raw transcript")
            diarized_text = req.transcript

    talk_ratio = compute_talk_ratio(diarized_text)

    session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")

    user_msg = UserMessage(text=f"INPUT TRANSCRIPT:\n\n{diarized_text}\n\nReturn the JSON now.")

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
        diarized_transcript=diarized_text,
        talk_ratio=talk_ratio,
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


@api_router.get("/analytics/leaderboard")
async def analytics_leaderboard():
    docs = await db.evaluations.find({}, {"_id": 0}).to_list(2000)
    by_agent: dict = {}
    for d in docs:
        name = (d.get("agent_name") or "Unknown Agent").strip() or "Unknown Agent"
        bucket = by_agent.setdefault(name, {"agent_name": name, "calls": 0, "qa_total": 0, "escalations": 0, "neg": 0})
        bucket["calls"] += 1
        bucket["qa_total"] += int(d.get("qa_score", 0) or 0)
        if (d.get("escalation_required") or "no").lower() == "yes":
            bucket["escalations"] += 1
        if (d.get("sentiment") or "").lower() == "negative":
            bucket["neg"] += 1
    rows = []
    for b in by_agent.values():
        calls = b["calls"]
        rows.append({
            "agent_name": b["agent_name"],
            "calls": calls,
            "avg_qa": round(b["qa_total"] / calls, 1) if calls else 0,
            "escalation_rate": round((b["escalations"] / calls) * 100, 1) if calls else 0,
            "negative_rate": round((b["neg"] / calls) * 100, 1) if calls else 0,
        })
    rows.sort(key=lambda r: (r["avg_qa"], r["calls"]), reverse=True)
    return {"leaderboard": rows}


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


@api_router.post("/diarize")
async def diarize(req: DiarizeRequest):
    if not req.transcript or len(req.transcript.strip()) < 10:
        raise HTTPException(status_code=400, detail="Transcript is too short to diarize.")
    try:
        labeled = await diarize_text(req.transcript)
    except Exception as e:
        logger.exception("Diarization failed")
        raise HTTPException(status_code=502, detail=f"Diarization error: {str(e)}")
    return {"transcript": labeled}


@api_router.post("/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...), diarize: bool = True):
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

    diarized = False
    if diarize and len(text.strip()) >= 10:
        try:
            text = await diarize_text(text)
            diarized = True
        except Exception:
            logger.exception("Post-Whisper diarization failed; returning raw transcript")

    return {"transcript": text, "filename": filename, "diarized": diarized}


# ---------- Weekly Digest ----------

def _score_color_emoji(s: int) -> str:
    if s >= 80:
        return ":large_green_circle:"
    if s >= 60:
        return ":large_blue_circle:"
    if s >= 40:
        return ":large_orange_circle:"
    return ":red_circle:"


async def _fetch_recent_evaluations(days: int = 7) -> List[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    docs = await db.evaluations.find({}, {"_id": 0}).to_list(2000)
    out = []
    for d in docs:
        c = d.get("created_at")
        if isinstance(c, str):
            try:
                c_dt = datetime.fromisoformat(c.replace("Z", "+00:00"))
            except Exception:
                continue
        elif isinstance(c, datetime):
            c_dt = c if c.tzinfo else c.replace(tzinfo=timezone.utc)
        else:
            continue
        if c_dt >= cutoff:
            out.append(d)
    out.sort(key=lambda d: d.get("created_at"), reverse=True)
    return out


def _build_digest(docs: List[dict], days: int) -> dict:
    total = len(docs)
    if total == 0:
        return {
            "total_calls": 0,
            "avg_qa": 0,
            "escalations": 0,
            "lowest_calls": [],
            "agent_rankings": [],
            "top_compliance_issues": [],
            "period_days": days,
        }

    avg_qa = round(sum(int(d.get("qa_score", 0) or 0) for d in docs) / total, 1)
    escalations = sum(1 for d in docs if (d.get("escalation_required") or "no").lower() == "yes")

    lowest = sorted(docs, key=lambda d: int(d.get("qa_score", 0) or 0))[:3]
    lowest_calls = [
        {
            "agent_name": d.get("agent_name") or "Unknown Agent",
            "call_id": d.get("call_id") or "—",
            "qa_score": int(d.get("qa_score", 0) or 0),
            "root_cause": (d.get("root_cause") or "")[:160],
            "risk_level": (d.get("risk_level") or "low").lower(),
        }
        for d in lowest
    ]

    by_agent: dict = {}
    for d in docs:
        name = (d.get("agent_name") or "Unknown Agent").strip() or "Unknown Agent"
        b = by_agent.setdefault(name, {"name": name, "calls": 0, "qa_total": 0, "esc": 0})
        b["calls"] += 1
        b["qa_total"] += int(d.get("qa_score", 0) or 0)
        if (d.get("escalation_required") or "no").lower() == "yes":
            b["esc"] += 1
    rankings = []
    for b in by_agent.values():
        rankings.append({
            "name": b["name"],
            "calls": b["calls"],
            "avg_qa": round(b["qa_total"] / b["calls"], 1) if b["calls"] else 0,
            "escalation_rate": round((b["esc"] / b["calls"]) * 100, 1) if b["calls"] else 0,
        })
    rankings.sort(key=lambda r: (r["avg_qa"], r["calls"]), reverse=True)

    issue_counter: dict = {}
    for d in docs:
        for issue in (d.get("compliance_issues") or []):
            k = issue.strip()
            if k:
                issue_counter[k] = issue_counter.get(k, 0) + 1
    top_issues = sorted(issue_counter.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_calls": total,
        "avg_qa": avg_qa,
        "escalations": escalations,
        "escalation_rate": round((escalations / total) * 100, 1),
        "lowest_calls": lowest_calls,
        "agent_rankings": rankings,
        "top_compliance_issues": [{"issue": k, "count": v} for k, v in top_issues],
        "period_days": days,
    }


def _digest_to_slack_blocks(d: dict) -> dict:
    period = f"Last {d['period_days']} days"
    if d["total_calls"] == 0:
        return {
            "text": f"*ClarityQA Weekly Digest* — no calls evaluated in the {period.lower()}.",
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": "ClarityQA Weekly Digest"}},
                {"type": "section", "text": {"type": "mrkdwn", "text": f"_No calls evaluated in {period.lower()}._"}},
            ],
        }

    summary_md = (
        f"*Total calls:* {d['total_calls']}    "
        f"*Avg QA:* {d['avg_qa']}/100    "
        f"*Escalations:* {d['escalations']} ({d.get('escalation_rate', 0)}%)"
    )

    lowest_md = "\n".join(
        f"{_score_color_emoji(c['qa_score'])} *{c['agent_name']}* — `{c['call_id']}` — *{c['qa_score']}/100*  _({c['risk_level']} risk)_\n> {c['root_cause']}"
        for c in d["lowest_calls"]
    ) or "_None_"

    rankings_md = "\n".join(
        f"{i+1}. *{r['name']}* — {r['avg_qa']}/100 ({r['calls']} calls, {r['escalation_rate']}% escalation)"
        for i, r in enumerate(d["agent_rankings"][:5])
    ) or "_None_"

    issues_md = "\n".join(
        f"• {it['issue']} (×{it['count']})" for it in d["top_compliance_issues"]
    ) or "_No recurring issues_"

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": ":bar_chart: ClarityQA Weekly Digest"}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": period}]},
        {"type": "section", "text": {"type": "mrkdwn", "text": summary_md}},
        {"type": "divider"},
        {"type": "section", "text": {"type": "mrkdwn", "text": "*:warning: Lowest-scoring calls (coach these first)*\n" + lowest_md}},
        {"type": "divider"},
        {"type": "section", "text": {"type": "mrkdwn", "text": "*:trophy: Agent leaderboard*\n" + rankings_md}},
        {"type": "divider"},
        {"type": "section", "text": {"type": "mrkdwn", "text": "*:no_entry: Top compliance issues*\n" + issues_md}},
    ]
    return {
        "text": f"ClarityQA Weekly Digest — {d['total_calls']} calls, avg {d['avg_qa']}/100",
        "blocks": blocks,
    }


def _digest_to_plain_text(d: dict) -> str:
    period = f"Last {d['period_days']} days"
    if d["total_calls"] == 0:
        return f"ClarityQA Weekly Digest — no calls evaluated in {period.lower()}."

    lines = [
        "CLARITYQA WEEKLY DIGEST",
        period,
        "",
        f"Total calls: {d['total_calls']}    Avg QA: {d['avg_qa']}/100    Escalations: {d['escalations']} ({d.get('escalation_rate', 0)}%)",
        "",
        "LOWEST-SCORING CALLS:",
    ]
    for c in d["lowest_calls"]:
        lines.append(f"  • {c['agent_name']} ({c['call_id']}) — {c['qa_score']}/100 [{c['risk_level']} risk]")
        if c["root_cause"]:
            lines.append(f"    Root cause: {c['root_cause']}")
    lines += ["", "AGENT LEADERBOARD:"]
    for i, r in enumerate(d["agent_rankings"][:5]):
        lines.append(f"  {i+1}. {r['name']} — {r['avg_qa']}/100 ({r['calls']} calls, {r['escalation_rate']}% escalation)")
    lines += ["", "TOP COMPLIANCE ISSUES:"]
    for it in d["top_compliance_issues"]:
        lines.append(f"  • {it['issue']} (x{it['count']})")
    return "\n".join(lines)


class DigestPreviewQuery(BaseModel):
    days: int = 7


@api_router.get("/digest/preview")
async def digest_preview(days: int = 7):
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")
    docs = await _fetch_recent_evaluations(days)
    digest = _build_digest(docs, days)
    digest["plain_text"] = _digest_to_plain_text(digest)
    return digest


@api_router.post("/digest/send-slack")
async def digest_send_slack(days: int = 7):
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    bot_token = os.environ.get("SLACK_BOT_TOKEN", "").strip()
    channel_id = os.environ.get("SLACK_CHANNEL_ID", "").strip()

    if not webhook_url and not (bot_token and channel_id):
        raise HTTPException(
            status_code=400,
            detail="Slack not configured. Set SLACK_WEBHOOK_URL in backend/.env, OR set SLACK_BOT_TOKEN (xoxb-...) + SLACK_CHANNEL_ID.",
        )

    docs = await _fetch_recent_evaluations(days)
    digest = _build_digest(docs, days)
    payload = _digest_to_slack_blocks(digest)

    async with httpx.AsyncClient(timeout=15.0) as http:
        if webhook_url:
            r = await http.post(webhook_url, json=payload)
            if r.status_code >= 300:
                raise HTTPException(status_code=502, detail=f"Slack webhook failed: {r.status_code} {r.text[:200]}")
            return {"sent": True, "channel": "webhook", "total_calls": digest["total_calls"]}

        # Bot token path
        body = {"channel": channel_id, **payload}
        r = await http.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {bot_token}", "Content-Type": "application/json; charset=utf-8"},
            json=body,
        )
        try:
            data = r.json()
        except Exception:
            raise HTTPException(status_code=502, detail=f"Slack API error: {r.status_code} {r.text[:200]}")
        if not data.get("ok"):
            raise HTTPException(status_code=502, detail=f"Slack API error: {data.get('error', 'unknown')}")
        return {"sent": True, "channel": channel_id, "total_calls": digest["total_calls"]}


@api_router.get("/digest/config")
async def digest_config():
    """Return whether Slack is configured (without exposing the secrets)."""
    has_webhook = bool(os.environ.get("SLACK_WEBHOOK_URL", "").strip())
    bot = os.environ.get("SLACK_BOT_TOKEN", "").strip()
    channel = os.environ.get("SLACK_CHANNEL_ID", "").strip()
    return {
        "slack_webhook_configured": has_webhook,
        "slack_bot_configured": bool(bot and channel),
        "channel_id": channel if (bot and channel) else None,
    }


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
