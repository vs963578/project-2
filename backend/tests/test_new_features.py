"""Tests for new features: diarize, leaderboard, analyze auto-diarize+talk_ratio, transcribe-audio."""
import os
import io
import struct
import math
import wave
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://contact-audit.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RAW_TRANSCRIPT = (
    "hi thanks for calling. how can I help you today? "
    "yes my internet has been down for three hours and I cannot work from home. "
    "I understand the frustration. let me check your line status. "
    "okay please hurry I have a meeting in fifteen minutes. "
    "I see an outage in your area we are dispatching a crew now. "
    "alright thank you for the update."
)

DIARIZED_TRANSCRIPT = (
    "Agent: Thank you for calling, may I have your account number?\n"
    "Customer: Yes, it is 12345. My internet has been down for three hours.\n"
    "Agent: I am sorry for the trouble, let me run a quick check on the line.\n"
    "Customer: Please hurry, I have an important meeting soon.\n"
    "Agent: I see an outage in your area, a technician has been dispatched.\n"
    "Customer: Okay, thanks for confirming.\n"
)


# ---------- /api/diarize ----------
def test_diarize_short_returns_400():
    r = requests.post(f"{API}/diarize", json={"transcript": "hi"}, timeout=15)
    assert r.status_code == 400


def test_diarize_empty_returns_400():
    r = requests.post(f"{API}/diarize", json={"transcript": "   "}, timeout=15)
    assert r.status_code == 400


def test_diarize_labels_speakers():
    r = requests.post(f"{API}/diarize", json={"transcript": RAW_TRANSCRIPT}, timeout=120)
    assert r.status_code == 200, f"diarize failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert "transcript" in body
    out = body["transcript"]
    # Has at least 2 speaker-labeled lines
    lines = [l for l in out.splitlines() if l.strip()]
    labeled = [l for l in lines if l.lower().startswith(("agent:", "customer:"))]
    assert len(labeled) >= 2, f"Expected >=2 labeled lines, got: {out}"


# ---------- /api/analyze auto-diarize + talk_ratio ----------
CREATED = []


def test_analyze_raw_transcript_auto_diarizes_and_returns_talk_ratio():
    payload = {"transcript": RAW_TRANSCRIPT, "agent_name": "TEST_AutoDiarize"}
    r = requests.post(f"{API}/analyze", json=payload, timeout=180)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert "diarized_transcript" in data and data["diarized_transcript"]
    # diarized_transcript should differ from raw (or at least contain Agent:/Customer:)
    dt = data["diarized_transcript"]
    assert ("agent:" in dt.lower()) or ("customer:" in dt.lower())
    assert "talk_ratio" in data and data["talk_ratio"] is not None
    tr = data["talk_ratio"]
    for k in ("agent_words", "customer_words", "agent_pct", "customer_pct"):
        assert k in tr
    assert tr["agent_words"] + tr["customer_words"] > 0
    # Pct sums approx 100 (or 0 if no words)
    if tr["agent_words"] + tr["customer_words"] > 0:
        assert abs((tr["agent_pct"] + tr["customer_pct"]) - 100) < 1.0
    # Original transcript preserved
    assert data["transcript"] == RAW_TRANSCRIPT
    CREATED.append(data["id"])


def test_analyze_already_diarized_preserves_and_computes_ratio():
    payload = {"transcript": DIARIZED_TRANSCRIPT, "agent_name": "TEST_AlreadyDiarized"}
    r = requests.post(f"{API}/analyze", json=payload, timeout=180)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    # diarized_transcript should equal the original (no re-diarize)
    assert data["diarized_transcript"] == DIARIZED_TRANSCRIPT
    tr = data["talk_ratio"]
    assert tr["agent_words"] > 0
    assert tr["customer_words"] > 0
    assert tr["agent_pct"] > 0
    assert tr["customer_pct"] > 0
    CREATED.append(data["id"])


# ---------- /api/evaluations now includes new fields ----------
def test_list_evaluations_includes_new_fields():
    if not CREATED:
        pytest.skip("Need created eval")
    r = requests.get(f"{API}/evaluations", timeout=20)
    assert r.status_code == 200
    items = r.json()
    found = next((it for it in items if it["id"] in CREATED), None)
    assert found is not None
    assert "diarized_transcript" in found
    assert "talk_ratio" in found
    assert found["talk_ratio"] is not None


# ---------- /api/analytics/leaderboard ----------
def test_leaderboard_structure_and_sort():
    r = requests.get(f"{API}/analytics/leaderboard", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "leaderboard" in body
    rows = body["leaderboard"]
    assert isinstance(rows, list)
    if len(rows) == 0:
        pytest.skip("No data")
    for row in rows:
        for k in ("agent_name", "calls", "avg_qa", "escalation_rate", "negative_rate"):
            assert k in row, f"missing {k} in {row}"
    # Sorted desc by avg_qa
    for i in range(len(rows) - 1):
        assert rows[i]["avg_qa"] >= rows[i + 1]["avg_qa"]


# ---------- /api/transcribe-audio (small wav) ----------
def _make_silent_wav_bytes(duration_sec=1, framerate=16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(framerate)
        # Write silent samples
        n = duration_sec * framerate
        w.writeframes(b"\x00\x00" * n)
    return buf.getvalue()


def test_transcribe_audio_unsupported_extension_400():
    files = {"file": ("note.txt", b"abc", "text/plain")}
    r = requests.post(f"{API}/transcribe-audio", files=files, timeout=20)
    assert r.status_code == 400


def test_transcribe_audio_empty_file_400():
    files = {"file": ("empty.wav", b"", "audio/wav")}
    r = requests.post(f"{API}/transcribe-audio", files=files, timeout=20)
    assert r.status_code == 400


def test_transcribe_audio_small_wav_returns_200_or_502():
    """Whisper may accept silent wav (empty text) or raise 502. Either is acceptable as long as
    endpoint is reachable and validates input correctly."""
    wav_bytes = _make_silent_wav_bytes(duration_sec=1)
    files = {"file": ("silence.wav", wav_bytes, "audio/wav")}
    # diarize=False to avoid extra LLM cost on empty transcript
    r = requests.post(f"{API}/transcribe-audio?diarize=false", files=files, timeout=120)
    assert r.status_code in (200, 502), f"{r.status_code}: {r.text[:300]}"
    if r.status_code == 200:
        body = r.json()
        assert "transcript" in body
        assert body.get("filename") == "silence.wav"


# ---------- Cleanup ----------
def test_cleanup_created():
    for eid in CREATED:
        requests.delete(f"{API}/evaluations/{eid}", timeout=15)
