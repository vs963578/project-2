import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { MessageCircle, User, Headset } from "lucide-react";

const SPEAKER_RE = /^\s*(agent|customer|rep|representative|caller|client|cust)\s*[:\-]\s*(.*)$/i;

function parseLines(text) {
  if (!text) return [];
  const turns = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(SPEAKER_RE);
    if (m) {
      const speaker = ["agent", "rep", "representative"].includes(m[1].toLowerCase())
        ? "agent"
        : "customer";
      turns.push({ speaker, text: m[2].trim() });
    } else {
      // Append to last turn if any, else mark unknown
      if (turns.length > 0) {
        turns[turns.length - 1].text += " " + line;
      } else {
        turns.push({ speaker: "unknown", text: line });
      }
    }
  }
  return turns;
}

export default function TranscriptViewer({ transcript }) {
  const turns = parseLines(transcript);
  if (turns.length === 0) return null;

  return (
    <Card className="border-zinc-200 shadow-sm" data-testid="transcript-viewer">
      <CardHeader>
        <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Conversation Transcript
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {turns.map((t, i) => {
            const isAgent = t.speaker === "agent";
            const isCustomer = t.speaker === "customer";
            return (
              <div
                key={i}
                className={`flex gap-3 ${isCustomer ? "flex-row-reverse" : ""}`}
                data-testid={`turn-${i}-${t.speaker}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isAgent
                      ? "bg-blue-100 text-blue-700"
                      : isCustomer
                      ? "bg-zinc-100 text-zinc-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isAgent ? <Headset className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div
                  className={`max-w-[78%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                    isAgent
                      ? "bg-blue-50 text-blue-950 border border-blue-100"
                      : isCustomer
                      ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                      : "bg-amber-50 text-amber-900 border border-amber-100"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">
                    {t.speaker === "unknown" ? "Speaker" : t.speaker}
                  </div>
                  <div>{t.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
