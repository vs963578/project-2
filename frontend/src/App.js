import React, { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Headphones, History, BarChart3 } from "lucide-react";
import TranscriptInput from "./components/TranscriptInput";
import EvaluationView from "./components/EvaluationView";
import HistoryList from "./components/HistoryList";
import AnalyticsDashboard from "./components/AnalyticsDashboard";

function Dashboard() {
  const [evaluation, setEvaluation] = useState(null);
  const [tab, setTab] = useState("analyzer");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAnalyzed = (result) => {
    setEvaluation(result);
    setRefreshKey((k) => k + 1);
  };

  const handleSelectHistory = (item) => {
    setEvaluation(item);
    setTab("analyzer");
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-zinc-950 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-zinc-950">
                ClarityQA
              </h1>
              <p className="text-xs text-zinc-500 -mt-0.5">BPO Quality & Coaching</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
              Powered by
            </span>
            <span className="text-xs font-bold text-zinc-950">GPT-5.2</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
            Quality Assurance Console
          </h2>
          <p className="text-zinc-600 mt-1 max-w-2xl">
            Analyze conversations, surface compliance gaps, and coach agents with
            evidence-based insights.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-white border border-zinc-200" data-testid="tabs-list">
            <TabsTrigger value="analyzer" data-testid="tab-analyzer">
              <Headphones className="w-4 h-4 mr-2" />
              Analyzer
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyzer" className="mt-6 space-y-6">
            <TranscriptInput onAnalyzed={handleAnalyzed} />
            {evaluation && <EvaluationView evaluation={evaluation} />}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <HistoryList onSelect={handleSelectHistory} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboard refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-zinc-500 flex items-center justify-between">
          <span>ClarityQA &middot; AI-powered call quality intelligence</span>
          <span>v1.0</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
