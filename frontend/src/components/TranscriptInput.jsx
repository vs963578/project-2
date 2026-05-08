import React, { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Upload, Loader2, Sparkles, FileText, Mic, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { apiAnalyze, apiUpload, apiTranscribeAudio, apiDiarize } from "../lib/api";

const SAMPLE_TRANSCRIPT = `Agent: Hi, what do you want?
Customer: My internet has been down for 3 days. I've called twice already and nobody has helped me.
Agent: Yeah, the network is down in many areas, can't do anything.
Customer: I work from home. I'm losing money. I need this fixed today.
Agent: I'll just put a ticket in. Someone will call you back maybe tomorrow.
Customer: Can I speak to your supervisor?
Agent: They're busy. Just wait for the callback.
Customer: This is unacceptable. I want to cancel my service.
Agent: Okay, bye.`;

export default function TranscriptInput({ onAnalyzed }) {
  const [transcript, setTranscript] = useState("");
  const [agentName, setAgentName] = useState("");
  const [callId, setCallId] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [labeling, setLabeling] = useState(false);
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const data = await apiUpload(fd);
      setTranscript(data.transcript || "");
      toast.success(`Loaded ${file.name}`);
    } catch (err) {
      toast.error("Failed to read file");
    } finally {
      e.target.value = "";
    }
  };

  const handleAudio = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Audio file exceeds 25 MB limit");
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setTranscribing(true);
    const t = toast.loading(`Transcribing ${file.name}...`);
    try {
      const data = await apiTranscribeAudio(fd);
      setTranscript(data.transcript || "");
      toast.success(`Transcribed ${file.name}`, { id: t });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Transcription failed";
      toast.error(typeof msg === "string" ? msg : "Transcription failed", { id: t });
    } finally {
      setTranscribing(false);
      e.target.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!transcript || transcript.trim().length < 10) {
      toast.error("Please provide a transcript (at least 10 characters).");
      return;
    }
    setLoading(true);
    try {
      const result = await apiAnalyze({
        transcript,
        agent_name: agentName || "Unknown Agent",
        call_id: callId || null,
      });
      toast.success("Analysis complete");
      onAnalyzed?.(result);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Analysis failed";
      toast.error(typeof msg === "string" ? msg : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLabel = async () => {
    if (!transcript || transcript.trim().length < 10) {
      toast.error("Add a transcript first.");
      return;
    }
    setLabeling(true);
    const t = toast.loading("Labeling speakers...");
    try {
      const data = await apiDiarize(transcript);
      setTranscript(data.transcript || transcript);
      toast.success("Speakers labeled", { id: t });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Labeling failed";
      toast.error(typeof msg === "string" ? msg : "Labeling failed", { id: t });
    } finally {
      setLabeling(false);
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm" data-testid="transcript-input-card">
      <CardHeader>
        <CardTitle className="text-xl font-display tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5" />
          New Call Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Agent Name
            </Label>
            <Input
              id="agent-name"
              data-testid="agent-name-input"
              placeholder="e.g. Maya Thompson"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="call-id" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Call ID (optional)
            </Label>
            <Input
              id="call-id"
              data-testid="call-id-input"
              placeholder="e.g. CALL-00123"
              value={callId}
              onChange={(e) => setCallId(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="transcript" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Transcript
            </Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 inline-flex items-center gap-1"
                onClick={handleAutoLabel}
                disabled={labeling || loading || transcribing}
                data-testid="auto-label-btn"
              >
                {labeling ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Labeling...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3 h-3" /> Auto-label speakers
                  </>
                )}
              </button>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => setTranscript(SAMPLE_TRANSCRIPT)}
                data-testid="load-sample-btn"
              >
                Load sample
              </button>
            </div>
          </div>
          <Textarea
            id="transcript"
            data-testid="transcript-textarea"
            placeholder="Paste customer-agent conversation here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[220px] font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.md,.log"
            onChange={handleFile}
            className="hidden"
            data-testid="file-input"
          />
          <input
            ref={audioRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
            onChange={handleAudio}
            className="hidden"
            data-testid="audio-input"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              data-testid="upload-btn"
              className="border-zinc-300"
              disabled={transcribing || loading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload .txt
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => audioRef.current?.click()}
              data-testid="upload-audio-btn"
              className="border-zinc-300"
              disabled={transcribing || loading}
            >
              {transcribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Upload audio
                </>
              )}
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || transcribing}
            data-testid="analyze-call-button"
            className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Call
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
