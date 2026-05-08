import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { apiAnalytics, apiDigestConfig } from "../lib/api";
import { TrendingUp, AlertOctagon, BarChart3, Activity } from "lucide-react";
import Leaderboard from "./Leaderboard";
import DigestPanel from "./DigestPanel";
import AgentsPanel from "./AgentsPanel";

const StatCard = ({ label, value, suffix, icon: Icon, tone = "default" }) => {
  const toneClass =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
      ? "text-red-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-zinc-950";
  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
            {label}
          </span>
          {Icon && <Icon className="w-4 h-4 text-zinc-400" />}
        </div>
        <div className={`mt-3 text-4xl font-bold tracking-tight font-display tabular-nums ${toneClass}`}>
          {value}
          {suffix && <span className="text-xl ml-1 text-zinc-500">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
};

const PIE_COLORS = {
  positive: "#16a34a",
  neutral: "#71717a",
  negative: "#dc2626",
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#dc2626",
};

export default function AnalyticsDashboard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    apiAnalytics().then(setData).catch(() => setData(null));
    apiDigestConfig().then(setConfig).catch(() => setConfig(null));
  }, [refreshKey]);

  if (!data) {
    return <div className="text-sm text-zinc-500 py-8 text-center">Loading analytics...</div>;
  }

  const sentimentData = Object.entries(data.sentiment_breakdown).map(([k, v]) => ({
    name: k,
    value: v,
  }));
  const riskData = Object.entries(data.risk_breakdown).map(([k, v]) => ({
    name: k,
    value: v,
  }));

  const trend = (data.trend || []).map((t, i) => ({
    idx: i + 1,
    score: t.qa_score,
    agent: t.agent_name,
  }));

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Calls" value={data.total_calls} icon={BarChart3} />
        <StatCard label="Avg QA" value={data.avg_qa_score} suffix="/100" icon={TrendingUp} />
        <StatCard label="Greeting" value={data.avg_greeting} suffix="/10" icon={Activity} />
        <StatCard label="Communication" value={data.avg_communication} suffix="/10" icon={Activity} />
        <StatCard label="Resolution" value={data.avg_resolution} suffix="/10" icon={Activity} />
        <StatCard
          label="Escalation Rate"
          value={data.escalation_rate}
          suffix="%"
          icon={AlertOctagon}
          tone={data.escalation_rate > 20 ? "bad" : data.escalation_rate > 10 ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-display tracking-tight">QA Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="idx" stroke="#a1a1aa" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="#a1a1aa" fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#2563eb" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-display tracking-tight">Sentiment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.total_calls === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {sentimentData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#71717a"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-display tracking-tight">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.total_calls === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={riskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {riskData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#71717a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-display tracking-tight">Top Compliance Issues</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_compliance_issues.length === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center">
                No compliance issues recorded.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.top_compliance_issues.map((it, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-400 w-5">#{i + 1}</span>
                    <span className="text-sm text-zinc-700 flex-1">{it.issue}</span>
                    <span className="text-sm font-bold tabular-nums text-zinc-950 bg-zinc-100 px-2 py-0.5 rounded">
                      {it.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Leaderboard refreshKey={refreshKey} />

      <DigestPanel />

      <AgentsPanel
        emailConfigured={!!config?.email_configured}
        senderEmail={config?.sender_email}
      />
    </div>
  );
}
