"""BPO QA Analyzer backend tests"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contact-audit.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SAMPLE_TRANSCRIPT = """Agent: Yeah what do you want.
Customer: Hi, my internet has been down for 3 hours, I can't work.
Agent: That's not my problem, just restart the router. Why are you bothering me with this?
Customer: I already did, it doesn't help. Can you check the line?
Agent: Look, I told you to restart it. If it doesn't work, that's on you.
Customer: This is unacceptable, I want to speak to a manager.
Agent: Fine, whatever. Goodbye.
"""

CREATED_IDS = []


# ---------- Health ----------
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Analyze: validation ----------
def test_analyze_short_transcript_returns_400():
    r = requests.post(f"{API}/analyze", json={"transcript": "hi"}, timeout=20)
    assert r.status_code == 400


def test_analyze_empty_transcript_returns_400():
    r = requests.post(f"{API}/analyze", json={"transcript": "   "}, timeout=20)
    assert r.status_code == 400


# ---------- Analyze: full flow with LLM ----------
def test_analyze_full_schema_and_persistence():
    payload = {"transcript": SAMPLE_TRANSCRIPT, "agent_name": "TEST_Agent_Rude"}
    r = requests.post(f"{API}/analyze", json=payload, timeout=120)
    assert r.status_code == 200, f"analyze failed: {r.status_code} {r.text[:300]}"
    data = r.json()

    required_fields = [
        "id", "agent_name", "created_at", "qa_score",
        "greeting_score", "communication_score", "resolution_score", "compliance_score",
        "sentiment", "compliance_issues", "missed_steps", "root_cause",
        "risk_level", "business_impact", "coaching_tips", "ideal_response",
        "motivation", "insights", "escalation_required",
    ]
    for f in required_fields:
        assert f in data, f"Missing field: {f}"

    assert isinstance(data["qa_score"], int) and 0 <= data["qa_score"] <= 100
    for k in ("greeting_score", "communication_score", "resolution_score", "compliance_score"):
        assert isinstance(data[k], int) and 0 <= data[k] <= 10
    assert data["sentiment"] in ("positive", "neutral", "negative")
    assert data["risk_level"] in ("low", "medium", "high")
    assert data["escalation_required"] in ("yes", "no")
    assert isinstance(data["coaching_tips"], list)
    assert isinstance(data["compliance_issues"], list)
    assert data["agent_name"] == "TEST_Agent_Rude"

    CREATED_IDS.append(data["id"])

    # GET to verify persistence
    g = requests.get(f"{API}/evaluations/{data['id']}", timeout=15)
    assert g.status_code == 200
    assert g.json()["id"] == data["id"]


# ---------- List ----------
def test_list_evaluations_no_objectid_and_sorted():
    # ensure at least one exists
    if not CREATED_IDS:
        pytest.skip("No evaluation created yet")
    r = requests.get(f"{API}/evaluations", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    for it in items:
        assert "_id" not in it
        assert "id" in it
    # Sorted desc by created_at
    if len(items) >= 2:
        assert items[0]["created_at"] >= items[1]["created_at"]


# ---------- Get missing ----------
def test_get_evaluation_404():
    r = requests.get(f"{API}/evaluations/nonexistent-id-xyz-123", timeout=15)
    assert r.status_code == 404


# ---------- Analytics ----------
def test_analytics_summary():
    r = requests.get(f"{API}/analytics/summary", timeout=20)
    assert r.status_code == 200
    d = r.json()
    for f in ["total_calls", "avg_qa_score", "escalation_rate",
              "sentiment_breakdown", "risk_breakdown", "top_compliance_issues", "trend"]:
        assert f in d
    assert set(d["sentiment_breakdown"].keys()) == {"positive", "neutral", "negative"}
    assert set(d["risk_breakdown"].keys()) == {"low", "medium", "high"}
    assert isinstance(d["trend"], list)


# ---------- Upload transcript ----------
def test_upload_transcript_txt():
    files = {"file": ("sample.txt", io.BytesIO(b"Agent: Hello\nCustomer: Hi"), "text/plain")}
    r = requests.post(f"{API}/upload-transcript", files=files, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "transcript" in body
    assert "Agent: Hello" in body["transcript"]
    assert body.get("filename") == "sample.txt"


# ---------- Delete ----------
def test_delete_evaluation_and_404_on_missing():
    if not CREATED_IDS:
        pytest.skip("Need created evaluation")
    eval_id = CREATED_IDS[0]
    r = requests.delete(f"{API}/evaluations/{eval_id}", timeout=15)
    assert r.status_code == 200
    assert r.json().get("deleted") is True

    # second delete -> 404
    r2 = requests.delete(f"{API}/evaluations/{eval_id}", timeout=15)
    assert r2.status_code == 404
