# ClarityQA — BPO Quality Assurance & Coaching Platform

## Original Problem Statement
Build an AI system for BPO Quality Assurance, Agent Coaching, and Performance Analytics. Analyze customer-agent transcripts and produce: QA score (0-100), sub-scores (greeting, communication, resolution, compliance — 0-10 each), sentiment, compliance issues, missed steps, root cause + risk + business impact, 3 coaching tips, ideal response, motivation, manager insights, and escalation flag — returned as clean structured JSON.

## Stack & Architecture
- **Backend**: FastAPI + MongoDB (Motor) + emergentintegrations (LlmChat → OpenAI gpt-5.2) via EMERGENT_LLM_KEY
- **Frontend**: React 19 + Tailwind + shadcn/ui + framer-motion + recharts + lucide-react
- **Design**: Swiss / High-Contrast (light theme), Cabinet Grotesk headings, IBM Plex Sans body

## User Personas
1. **QA Auditor** — pastes/uploads transcript, reviews scoring + compliance gaps
2. **Trainer/Coach** — uses coaching tips, ideal response, motivation
3. **Operations Manager** — reviews analytics dashboard, escalations, trends

## What's Implemented (Feb 2026)
- POST `/api/analyze` — full LLM-driven QA evaluation (GPT-5.2). **Auto-diarizes** raw transcripts, computes **talk_ratio** (agent vs customer word share), persists in MongoDB.
- POST `/api/diarize` — labels speakers ("Agent:" / "Customer:") on any transcript via GPT-5.2
- POST `/api/upload-transcript` — .txt/.csv/.md upload to file picker
- POST `/api/transcribe-audio` — Audio (mp3/mp4/m4a/wav/webm/mpeg/mpga ≤25MB) → Whisper-1 → optional auto-diarization
- GET `/api/evaluations` & `/api/evaluations/{id}` — history & detail (with diarized_transcript + talk_ratio fields)
- DELETE `/api/evaluations/{id}` — delete
- GET `/api/analytics/summary` — total_calls, avg sub-scores, escalation_rate, sentiment & risk breakdowns, top compliance issues, QA-score trend
- GET `/api/analytics/leaderboard` — per-agent ranking (calls, avg_qa, escalation_rate, negative_rate)
- GET `/api/digest/preview?days=N` — manager digest payload (lowest calls, leaderboard, top issues, plain-text version)
- POST `/api/digest/send-slack?days=N` — sends formatted Slack blocks via webhook OR bot token
- GET `/api/digest/config` — non-secret indicator (slack & email configured flags)
- POST `/api/agents` / GET `/api/agents` / DELETE `/api/agents/{id}` — Agents collection (name + email)
- POST `/api/digest/preview-agent-email/{agent_id}?days=N` — HTML preview of an agent's coaching email
- POST `/api/digest/send-agent-emails?days=N` — sends per-agent personalized coaching emails via Resend
- Frontend: **AgentsPanel** on Analytics tab (add/delete agents, period selector, preview email dialog, "Email all agents" button)
- Resend integration in sandbox mode (`onboarding@resend.dev`) — unverified recipients surface in `failed[]`; verify a domain in Resend to deliver to any address
- "Load sample" auto-fills agent name + call ID
- Tested: iteration 4 — 100% backend (9/9 new email tests) + 100% frontend (add/preview/send/delete flows)

## Backlog
- **P1**: Multi-agent leaderboard, date-range filters on analytics, per-agent coaching trends
- **P1**: Authentication with Manager / Agent roles (Emergent Google Auth or JWT)
- **P2**: Audio file → STT (whisper) → analyze pipeline
- **P2**: PDF export of evaluation report; email coaching summary
- **P2**: Bulk CSV upload of transcripts
- **P2**: Custom QA rubric configuration per organization

## Next Tasks
- Gather user feedback on the live MVP
- Add per-agent scorecards & leaderboard
- Wire authentication if managers need private dashboards
