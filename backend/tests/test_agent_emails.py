"""Tests for new Auto-Coach Agent emails feature (iteration 4)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback: read from frontend env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL'):
                BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
                break


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def cleanup_agents(api):
    """Cleanup TEST_ prefixed agents after module."""
    created = []
    yield created
    # Teardown
    try:
        agents = api.get(f"{BASE_URL}/api/agents", timeout=15).json()
        for a in agents:
            if a.get("name", "").startswith("TEST_"):
                api.delete(f"{BASE_URL}/api/agents/{a['id']}", timeout=10)
    except Exception:
        pass


# ---- Digest config ----
class TestDigestConfig:
    def test_config_email_configured(self, api):
        r = api.get(f"{BASE_URL}/api/digest/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("email_configured") is True
        assert d.get("sender_email") == "onboarding@resend.dev"


# ---- Agent CRUD ----
class TestAgentCRUD:
    def test_create_list_delete_agent(self, api, cleanup_agents):
        unique = f"TEST_Agent_{uuid.uuid4().hex[:6]}"
        # CREATE
        r = api.post(f"{BASE_URL}/api/agents", json={"name": unique, "email": "test@example.com"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == unique
        assert data["email"] == "test@example.com"
        assert "id" in data
        assert "_id" not in data
        agent_id = data["id"]
        cleanup_agents.append(agent_id)

        # LIST verifies persistence + no _id leak
        r2 = api.get(f"{BASE_URL}/api/agents", timeout=15)
        assert r2.status_code == 200
        lst = r2.json()
        assert any(a["id"] == agent_id and a["name"] == unique for a in lst)
        for a in lst:
            assert "_id" not in a

        # DELETE
        r3 = api.delete(f"{BASE_URL}/api/agents/{agent_id}", timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("deleted") is True

        # DELETE missing -> 404
        r4 = api.delete(f"{BASE_URL}/api/agents/{agent_id}", timeout=15)
        assert r4.status_code == 404

    def test_duplicate_agent_name_409(self, api, cleanup_agents):
        unique = f"TEST_Dup_{uuid.uuid4().hex[:6]}"
        r1 = api.post(f"{BASE_URL}/api/agents", json={"name": unique, "email": "a@example.com"}, timeout=15)
        assert r1.status_code == 200
        cleanup_agents.append(r1.json()["id"])
        r2 = api.post(f"{BASE_URL}/api/agents", json={"name": unique, "email": "b@example.com"}, timeout=15)
        assert r2.status_code == 409


# ---- Preview agent email ----
class TestPreviewAgentEmail:
    def test_preview_agent_email_returns_summary_and_html(self, api, cleanup_agents):
        unique = f"TEST_Preview_{uuid.uuid4().hex[:6]}"
        r = api.post(f"{BASE_URL}/api/agents", json={"name": unique, "email": "preview@example.com"}, timeout=15)
        assert r.status_code == 200
        agent_id = r.json()["id"]
        cleanup_agents.append(agent_id)

        rp = api.post(f"{BASE_URL}/api/digest/preview-agent-email/{agent_id}", params={"days": 7}, timeout=20)
        assert rp.status_code == 200
        d = rp.json()
        assert "summary" in d and "html" in d
        s = d["summary"]
        assert s.get("agent_name") == unique
        assert "total_calls" in s
        assert isinstance(d["html"], str) and d["html"].strip().startswith("<div")

    def test_preview_unknown_agent_404(self, api):
        rp = api.post(f"{BASE_URL}/api/digest/preview-agent-email/does-not-exist", params={"days": 7}, timeout=15)
        assert rp.status_code == 404


# ---- Send agent emails ----
class TestSendAgentEmails:
    def test_send_agent_emails_no_agents_400(self, api):
        # First wipe all TEST_ agents and any other agents to ensure 400.
        # Safer: only check that endpoint returns 400 when zero agents exist.
        agents = api.get(f"{BASE_URL}/api/agents", timeout=15).json()
        if agents:
            pytest.skip(f"Cannot test 'no agents' branch; {len(agents)} agents already exist")
        r = api.post(f"{BASE_URL}/api/digest/send-agent-emails", params={"days": 7}, timeout=20)
        assert r.status_code == 400

    def test_send_agent_emails_returns_sent_failed_lists(self, api, cleanup_agents):
        unique = f"TEST_Send_{uuid.uuid4().hex[:6]}"
        r = api.post(f"{BASE_URL}/api/agents", json={"name": unique, "email": "sandbox-fail@example.com"}, timeout=15)
        assert r.status_code == 200
        cleanup_agents.append(r.json()["id"])

        rs = api.post(f"{BASE_URL}/api/digest/send-agent-emails", params={"days": 7}, timeout=60)
        # MUST NOT 500 even if Resend rejects unverified recipients
        assert rs.status_code == 200, f"expected 200, got {rs.status_code}: {rs.text}"
        d = rs.json()
        assert "sent" in d and "failed" in d and "total_agents" in d
        assert isinstance(d["sent"], list) and isinstance(d["failed"], list)
        assert d["total_agents"] >= 1
        # Our unverified email should be either in sent (if account permits) or failed
        all_emails = [x["email"] for x in d["sent"]] + [x["email"] for x in d["failed"]]
        assert "sandbox-fail@example.com" in all_emails


# ---- Pre-existing flows still work ----
class TestExistingFlows:
    def test_leaderboard(self, api):
        r = api.get(f"{BASE_URL}/api/analytics/leaderboard", timeout=15)
        assert r.status_code == 200
        assert "leaderboard" in r.json()

    def test_digest_preview(self, api):
        r = api.get(f"{BASE_URL}/api/digest/preview", params={"days": 7}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "total_calls" in d and "plain_text" in d

    def test_digest_send_slack_400_when_unconfigured(self, api):
        r = api.post(f"{BASE_URL}/api/digest/send-slack", params={"days": 7}, timeout=15)
        assert r.status_code == 400
