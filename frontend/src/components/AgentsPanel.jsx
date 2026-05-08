import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Mail, UserPlus, Trash2, Eye, Send, Loader2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  apiListAgents,
  apiCreateAgent,
  apiDeleteAgent,
  apiSendAgentEmails,
  apiPreviewAgentEmail,
} from "../lib/api";

export default function AgentsPanel({ emailConfigured, senderEmail }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewName, setPreviewName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setAgents(await apiListAgents());
    } catch {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e?.preventDefault?.();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setAdding(true);
    try {
      await apiCreateAgent({ name: name.trim(), email: email.trim() });
      toast.success(`Added ${name.trim()}`);
      setName("");
      setEmail("");
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to add agent";
      toast.error(typeof msg === "string" ? msg : "Failed to add agent");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      toast.success("Agent removed");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handlePreview = async (agent) => {
    setPreviewName(agent.name);
    setPreviewHtml("Loading...");
    setPreviewOpen(true);
    try {
      const d = await apiPreviewAgentEmail(agent.id, days);
      setPreviewHtml(d.html);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Preview failed";
      setPreviewHtml(`<p style="padding:24px;font-family:sans-serif;color:#dc2626">${msg}</p>`);
    }
  };

  const handleSendAll = async () => {
    if (!emailConfigured) {
      toast.error("Email not configured. Add RESEND_API_KEY to backend/.env.");
      return;
    }
    if (agents.length === 0) {
      toast.error("Add at least one agent first.");
      return;
    }
    setSending(true);
    const t = toast.loading(`Sending coaching emails to ${agents.length} agents...`);
    try {
      const res = await apiSendAgentEmails(days);
      const okCount = res.sent?.length || 0;
      const failCount = res.failed?.length || 0;
      if (failCount > 0) {
        toast.warning(`Sent ${okCount}, failed ${failCount}. Check console.`, { id: t });
        console.warn("Email failures:", res.failed);
      } else {
        toast.success(`Sent coaching emails to ${okCount} agents`, { id: t });
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Send failed";
      toast.error(typeof msg === "string" ? msg : "Send failed", { id: t });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm" data-testid="agents-panel">
      <CardHeader>
        <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
          <UsersRound className="w-5 h-5" />
          Agents & Auto-Coach Emails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-zinc-600 leading-relaxed">
          Add your agents below. Click <strong>Email all agents</strong> to send each agent a
          personalized weakness summary based on their last {days} days of evaluations.
        </p>

        <form className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3" onSubmit={handleAdd}>
          <div>
            <Label htmlFor="agent-add-name" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Name
            </Label>
            <Input
              id="agent-add-name"
              data-testid="agent-add-name-input"
              placeholder="Sarah Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="agent-add-email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Email
            </Label>
            <Input
              id="agent-add-email"
              data-testid="agent-add-email-input"
              type="email"
              placeholder="sarah@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button
            type="submit"
            disabled={adding}
            data-testid="agent-add-btn"
            className="bg-zinc-950 text-white hover:bg-zinc-800 self-end"
          >
            {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Add agent
          </Button>
        </form>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading agents...</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No agents yet. Add your first agent above.</p>
        ) : (
          <div className="border border-zinc-200 rounded-md overflow-hidden">
            <table className="w-full text-sm" data-testid="agents-table">
              <thead className="bg-zinc-50">
                <tr className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  <th className="text-left py-2 px-4">Name</th>
                  <th className="text-left py-2 px-4">Email</th>
                  <th className="text-right py-2 px-4 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {agents.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50" data-testid={`agent-row-${a.id}`}>
                    <td className="py-2.5 px-4 font-semibold text-zinc-950">{a.name}</td>
                    <td className="py-2.5 px-4 text-zinc-700">{a.email}</td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(a)}
                        className="h-8 w-8 text-zinc-500 hover:text-blue-600"
                        aria-label="Preview email"
                        data-testid={`agent-preview-${a.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(a.id)}
                        className="h-8 w-8 text-zinc-500 hover:text-red-600"
                        aria-label="Delete agent"
                        data-testid={`agent-delete-${a.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-zinc-200">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Period</span>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                data-testid={`agent-period-${d}`}
                className={`text-xs font-semibold rounded-full px-3 py-1 border transition-all duration-200 ${
                  days === d
                    ? "bg-zinc-950 text-white border-zinc-950"
                    : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {emailConfigured ? (
              <span className="text-xs text-zinc-500">
                from <code className="bg-zinc-100 px-1.5 py-0.5 rounded">{senderEmail}</code>
              </span>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                Set RESEND_API_KEY to enable
              </span>
            )}
            <Button
              type="button"
              onClick={handleSendAll}
              disabled={sending || !emailConfigured || agents.length === 0}
              data-testid="email-all-agents-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Email all agents
            </Button>
          </div>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-200 pt-3">
          <Mail className="w-3 h-3 inline mr-1" />
          Note: Resend's sandbox sender (<code className="bg-zinc-100 px-1 rounded">onboarding@resend.dev</code>) only delivers to email addresses
          verified on your Resend account. To send to any agent address, verify a domain at{" "}
          <a href="https://resend.com/domains" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">resend.com/domains</a>{" "}
          and update <code className="bg-zinc-100 px-1 rounded">SENDER_EMAIL</code> in <code className="bg-zinc-100 px-1 rounded">backend/.env</code>.
        </p>
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              Email preview — {previewName}
            </DialogTitle>
            <DialogDescription>
              This is exactly what {previewName} will receive in their inbox.
            </DialogDescription>
          </DialogHeader>
          <div
            className="border border-zinc-200 rounded-md bg-white"
            data-testid="agent-email-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="border-zinc-300">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
