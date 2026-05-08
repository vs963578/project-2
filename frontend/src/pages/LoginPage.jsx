import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Headphones, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function LoginPage() {
  const { status, login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") {
    const next = location.state?.from || "/";
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        toast.success("Welcome back");
      } else {
        await register(email.trim(), password, name.trim() || undefined);
        toast.success("Account created");
      }
    } catch (err) {
      const msg = formatApiError(err?.response?.data?.detail) || err.message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail("manager@clarityqa.dev");
    setPassword("manager123");
    setMode("login");
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col" data-testid="login-page">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-md bg-zinc-950 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-zinc-950">
                ClarityQA
              </h1>
              <p className="text-xs text-zinc-500 -mt-0.5">BPO Quality & Coaching</p>
            </div>
          </div>

          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-display tracking-tight" data-testid="auth-title">
                {mode === "login" ? "Sign in" : "Create account"}
              </CardTitle>
              <p className="text-sm text-zinc-600 mt-1">
                {mode === "login"
                  ? "Access your BPO quality console."
                  : "Create an agent account to start analyzing calls."}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                      Name
                    </Label>
                    <Input
                      id="name"
                      data-testid="auth-name-input"
                      placeholder="Sarah Khan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                    Email
                  </Label>
                  <Input
                    id="email"
                    data-testid="auth-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                    Password
                  </Label>
                  <Input
                    id="password"
                    data-testid="auth-password-input"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  data-testid="auth-submit-btn"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : mode === "login" ? (
                    <LogIn className="w-4 h-4 mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-between text-sm">
                {mode === "login" ? (
                  <button
                    type="button"
                    className="text-zinc-600 hover:text-zinc-950 font-medium"
                    onClick={() => setMode("register")}
                    data-testid="switch-to-register"
                  >
                    Don't have an account? <span className="text-blue-600">Create one</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-zinc-600 hover:text-zinc-950 font-medium"
                    onClick={() => setMode("login")}
                    data-testid="switch-to-login"
                  >
                    Have an account? <span className="text-blue-600">Sign in</span>
                  </button>
                )}
              </div>

              {mode === "login" && (
                <div className="mt-6 border-t border-zinc-200 pt-4">
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="text-xs text-zinc-500 hover:text-zinc-700 font-medium"
                    data-testid="fill-demo-btn"
                  >
                    Use demo manager credentials →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-zinc-400 text-center mt-6">
            ClarityQA v1.0 &middot; AI-powered call quality intelligence
          </p>
        </div>
      </div>
    </div>
  );
}
