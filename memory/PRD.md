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
- Frontend: 3 tabs (Analyzer, History, Analytics) — score gauge, sub-score progress bars, **TalkRatio bar chart**, **color-coded TranscriptViewer chat bubbles**, coaching panel with **Copy plan** button, manager insights, recharts visualizations
- Frontend: "Auto-label speakers" button, "Upload .txt", "Upload audio" buttons in Analyzer
- Frontend: **Agent Leaderboard** in Analytics tab with crown for top performer
- Tested: 20/20 backend pytest, 8/8 frontend e2e flows

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
