import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Trash2, ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";
import { apiList, apiDelete } from "../lib/api";

const sentimentTone = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-zinc-100 text-zinc-800",
  negative: "bg-red-100 text-red-800",
};

const scoreColor = (s) =>
  s >= 80 ? "text-green-600" : s >= 60 ? "text-blue-600" : s >= 40 ? "text-amber-600" : "text-red-600";

export default function HistoryList({ onSelect, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiList();
      setItems(data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await apiDelete(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Evaluation deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <Card className="border-zinc-200 shadow-sm" data-testid="history-list">
      <CardHeader>
        <CardTitle className="text-xl font-display tracking-tight">Evaluation History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-zinc-500 py-8 text-center">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Inbox className="w-10 h-10 mb-3" />
            <p className="text-sm">No evaluations yet. Run your first analysis.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {items.map((item) => (
              <li
                key={item.id}
                className="py-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-50 -mx-6 px-6 transition-colors duration-150"
                onClick={() => onSelect?.(item)}
                data-testid={`history-item-${item.id}`}
              >
                <div className={`text-2xl font-bold tabular-nums font-display ${scoreColor(item.qa_score)} w-14 text-center`}>
                  {item.qa_score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-950 text-sm">{item.agent_name}</span>
                    {item.call_id && (
                      <span className="text-xs text-zinc-500 font-mono">{item.call_id}</span>
                    )}
                    <Badge className={sentimentTone[item.sentiment] || sentimentTone.neutral}>
                      {item.sentiment}
                    </Badge>
                    {item.escalation_required === "yes" && (
                      <Badge className="bg-red-600 text-white">Escalation</Badge>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(item.id, e)}
                  className="text-zinc-400 hover:text-red-600"
                  data-testid={`delete-${item.id}`}
                  aria-label="Delete evaluation"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
