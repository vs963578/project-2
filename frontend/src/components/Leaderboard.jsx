import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Trophy, Crown } from "lucide-react";
import { apiLeaderboard } from "../lib/api";

const scoreColor = (s) =>
  s >= 80 ? "text-green-600" : s >= 60 ? "text-blue-600" : s >= 40 ? "text-amber-600" : "text-red-600";

export default function Leaderboard({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiLeaderboard()
      .then((d) => setRows(d.leaderboard || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <Card className="border-zinc-200 shadow-sm" data-testid="leaderboard-card">
      <CardHeader>
        <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Agent Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-zinc-500 py-8 text-center">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">No agents evaluated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="leaderboard-table">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-semibold text-zinc-500 border-b border-zinc-200">
                  <th className="text-left py-2 pr-2 w-10">#</th>
                  <th className="text-left py-2 pr-2">Agent</th>
                  <th className="text-right py-2 px-2">Calls</th>
                  <th className="text-right py-2 px-2">Avg QA</th>
                  <th className="text-right py-2 px-2">Escalation</th>
                  <th className="text-right py-2 pl-2">Negative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={r.agent_name} className="hover:bg-zinc-50 transition-colors" data-testid={`row-${r.agent_name}`}>
                    <td className="py-3 pr-2">
                      {i === 0 ? (
                        <Crown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <span className="text-zinc-400 font-semibold">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-3 pr-2 font-semibold text-zinc-950">{r.agent_name}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-zinc-700">{r.calls}</td>
                    <td className={`py-3 px-2 text-right tabular-nums font-bold ${scoreColor(r.avg_qa)}`}>
                      {r.avg_qa}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-zinc-700">{r.escalation_rate}%</td>
                    <td className="py-3 pl-2 text-right tabular-nums text-zinc-700">{r.negative_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
