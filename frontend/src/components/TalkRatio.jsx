import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Mic2 } from "lucide-react";

export default function TalkRatio({ ratio }) {
  if (!ratio || (ratio.agent_words === 0 && ratio.customer_words === 0)) return null;

  const agentPct = ratio.agent_pct ?? 0;
  const customerPct = ratio.customer_pct ?? 0;

  // Healthy BPO benchmark: agent talks 50–65%
  let benchmark = "On-target";
  let benchmarkColor = "text-green-700 bg-green-100";
  if (agentPct > 75) {
    benchmark = "Agent-dominant";
    benchmarkColor = "text-amber-700 bg-amber-100";
  } else if (agentPct < 35) {
    benchmark = "Agent under-engaged";
    benchmarkColor = "text-amber-700 bg-amber-100";
  }

  return (
    <Card className="border-zinc-200 shadow-sm h-full" data-testid="talk-ratio-card">
      <CardHeader>
        <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
          <Mic2 className="w-5 h-5" />
          Talk Ratio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Agent vs Customer
            </div>
            <div className="text-3xl font-bold font-display tabular-nums text-zinc-950 mt-1">
              {agentPct}<span className="text-zinc-400">%</span>
              <span className="text-zinc-300 mx-2">/</span>
              {customerPct}<span className="text-zinc-400">%</span>
            </div>
          </div>
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${benchmarkColor}`}>
            {benchmark}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-100" data-testid="talk-ratio-bar">
          <div
            className="bg-blue-600 h-full transition-all duration-700"
            style={{ width: `${agentPct}%` }}
            title={`Agent ${agentPct}%`}
          />
          <div
            className="bg-zinc-400 h-full transition-all duration-700"
            style={{ width: `${customerPct}%` }}
            title={`Customer ${customerPct}%`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
            <span className="text-zinc-600">Agent</span>
            <span className="font-bold tabular-nums text-zinc-950 ml-auto">
              {ratio.agent_words} words
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400" />
            <span className="text-zinc-600">Customer</span>
            <span className="font-bold tabular-nums text-zinc-950 ml-auto">
              {ratio.customer_words} words
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
