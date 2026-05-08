import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Mail, Send, Sparkles, Slack as SlackIcon, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiDigestConfig, apiDigestPreview, apiDigestSendSlack } from "../lib/api";

const RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

export default function DigestPanel() {
  const [days, setDays] = useState(7);
  const [config, setConfig] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiDigestConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const slackReady = config?.slack_webhook_configured || config?.slack_bot_configured;

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const d = await apiDigestPreview(days);
      setPreviewText(d.plain_text || "No data");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Preview failed";
      setPreviewText(typeof msg === "string" ? msg : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendSlack = async () => {
    if (!slackReady) {
      toast.error("Slack not configured. Add SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN to backend/.env.");
      return;
    }
    setSending(true);
    try {
      const d = await apiDigestSendSlack(days);
      toast.success(`Digest sent to Slack (${d.total_calls} calls in last ${days} days)`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Send failed";
      toast.error(typeof msg === "string" ? msg : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40" data-testid="digest-panel">
      <CardHeader>
        <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          Auto-Coach Digest
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-600 leading-relaxed">
          Send a manager digest summarizing the lowest-scoring calls, agent leaderboard, and top
          compliance issues over a chosen period.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 mr-1">
            Period
          </span>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              data-testid={`period-${opt.value}`}
              className={`text-xs font-semibold rounded-full px-3 py-1 border transition-all duration-200 ${
                days === opt.value
                  ? "bg-zinc-950 text-white border-zinc-950"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={
              config?.slack_webhook_configured || config?.slack_bot_configured
                ? "bg-green-100 text-green-800"
                : "bg-zinc-100 text-zinc-700"
            }
            data-testid="slack-status-badge"
          >
            <SlackIcon className="w-3 h-3 mr-1" />
            Slack {slackReady ? "ready" : "not configured"}
          </Badge>
          <Badge className="bg-zinc-100 text-zinc-700" data-testid="email-status-badge">
            <Mail className="w-3 h-3 mr-1" />
            Email coming soon
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading}
            data-testid="digest-preview-btn"
            className="border-zinc-300"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Preview digest
          </Button>
          <Button
            type="button"
            onClick={handleSendSlack}
            disabled={sending || !slackReady}
            data-testid="digest-send-slack-btn"
            className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send to Slack
          </Button>
        </div>

        {!slackReady && (
          <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-200 pt-3 mt-2">
            <span className="font-semibold text-zinc-700">Setup:</span> add{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">SLACK_WEBHOOK_URL</code>{" "}
            (recommended) or{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">SLACK_BOT_TOKEN</code> +{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">SLACK_CHANNEL_ID</code> to{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">backend/.env</code>, then
            restart backend.
          </p>
        )}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              Digest Preview — last {days} days
            </DialogTitle>
            <DialogDescription>
              This is exactly what will be sent to Slack (formatted with blocks/emoji on Slack side).
            </DialogDescription>
          </DialogHeader>
          <pre
            className="bg-zinc-50 border border-zinc-200 rounded-md p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto"
            data-testid="digest-preview-text"
          >
            {previewLoading ? "Loading..." : previewText}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="border-zinc-300">
              Close
            </Button>
            <Button
              onClick={handleSendSlack}
              disabled={sending || !slackReady}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="digest-send-from-preview-btn"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to Slack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
