import React from "react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Quote,
  Target,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { ScoreGauge } from "./ScoreGauge";

const sentimentStyles = {
  positive: "bg-green-100 text-green-800 hover:bg-green-100",
  neutral: "bg-zinc-100 text-zinc-800 hover:bg-zinc-100",
  negative: "bg-red-100 text-red-800 hover:bg-red-100",
};

const riskStyles = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const SubScore = ({ label, value }) => (
  <div className="space-y-2" data-testid={`subscore-${label.toLowerCase()}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-zinc-950">{value}/10</span>
    </div>
    <Progress value={value * 10} className="h-2" />
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-zinc-950">
    <Icon className="w-4 h-4" />
    <span className="text-xs uppercase tracking-wider font-semibold">{children}</span>
  </div>
);

const ListBlock = ({ items, emptyText, testId, tone = "default" }) => {
  const dotColor =
    tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-blue-600";
  if (!items || items.length === 0) {
    return <p className="text-sm text-zinc-500 italic">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2" data-testid={testId}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 leading-relaxed">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
};

export default function EvaluationView({ evaluation }) {
  if (!evaluation) return null;

  const stagger = (i) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.05, duration: 0.3 },
  });

  return (
    <div className="space-y-6" data-testid="evaluation-view">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QA Score Card */}
        <motion.div {...stagger(0)} className="lg:col-span-1">
          <Card className="h-full border-zinc-200 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-6">
              <ScoreGauge score={evaluation.qa_score} />
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge
                  className={sentimentStyles[evaluation.sentiment] || sentimentStyles.neutral}
                  data-testid="sentiment-badge"
                >
                  Sentiment: {evaluation.sentiment}
                </Badge>
                <Badge
                  className={riskStyles[evaluation.risk_level] || riskStyles.low}
                  data-testid="risk-badge"
                >
                  Risk: {evaluation.risk_level}
                </Badge>
                {evaluation.escalation_required === "yes" && (
                  <Badge className="bg-red-600 text-white hover:bg-red-700" data-testid="escalation-badge">
                    Escalation Required
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sub-scores Card */}
        <motion.div {...stagger(1)} className="lg:col-span-2">
          <Card className="h-full border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5" />
                Score Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <SubScore label="Greeting" value={evaluation.greeting_score} />
              <SubScore label="Communication" value={evaluation.communication_score} />
              <SubScore label="Resolution" value={evaluation.resolution_score} />
              <SubScore label="Compliance" value={evaluation.compliance_score} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance & Missed Steps */}
        <motion.div {...stagger(2)}>
          <Card className="h-full border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Compliance & Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <SectionTitle icon={AlertTriangle}>Compliance Issues</SectionTitle>
                <div className="mt-3">
                  <ListBlock
                    items={evaluation.compliance_issues}
                    emptyText="No compliance issues detected."
                    testId="compliance-issues-list"
                    tone="danger"
                  />
                </div>
              </div>
              <Separator />
              <div>
                <SectionTitle icon={CheckCircle2}>Missed Steps</SectionTitle>
                <div className="mt-3">
                  <ListBlock
                    items={evaluation.missed_steps}
                    emptyText="All process steps were followed."
                    testId="missed-steps-list"
                    tone="warning"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Root Cause */}
        <motion.div {...stagger(3)}>
          <Card className="h-full border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Root Cause Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <SectionTitle icon={AlertTriangle}>Root Cause</SectionTitle>
                <p className="mt-2 text-sm text-zinc-700 leading-relaxed" data-testid="root-cause-text">
                  {evaluation.root_cause || "Not specified."}
                </p>
              </div>
              <Separator />
              <div>
                <SectionTitle icon={TrendingUp}>Business Impact</SectionTitle>
                <p className="mt-2 text-sm text-zinc-700 leading-relaxed" data-testid="business-impact-text">
                  {evaluation.business_impact || "Not specified."}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Coaching */}
        <motion.div {...stagger(4)}>
          <Card className="h-full border-zinc-200 shadow-sm bg-gradient-to-br from-white to-blue-50/50">
            <CardHeader>
              <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                AI Coaching
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <SectionTitle icon={Target}>Personalized Tips</SectionTitle>
                <ol className="mt-3 space-y-2.5" data-testid="coaching-tips-list">
                  {(evaluation.coaching_tips || []).map((tip, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-700 leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <Separator />
              <div>
                <SectionTitle icon={MessageSquare}>Ideal Response</SectionTitle>
                <blockquote
                  className="mt-3 border-l-2 border-blue-600 pl-4 text-sm italic text-zinc-700 leading-relaxed"
                  data-testid="ideal-response-text"
                >
                  "{evaluation.ideal_response}"
                </blockquote>
              </div>
              <Separator />
              <div>
                <SectionTitle icon={Quote}>Motivation</SectionTitle>
                <p className="mt-2 text-sm text-zinc-700 italic leading-relaxed" data-testid="motivation-text">
                  {evaluation.motivation}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Manager Insights */}
        <motion.div {...stagger(5)}>
          <Card className="h-full border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-display tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Manager Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-zinc-700 leading-relaxed" data-testid="insights-text">
                {evaluation.insights}
              </p>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  Escalation Required
                </span>
                <Badge
                  className={
                    evaluation.escalation_required === "yes"
                      ? "bg-red-600 text-white"
                      : "bg-green-100 text-green-800"
                  }
                  data-testid="escalation-status"
                >
                  {evaluation.escalation_required.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
