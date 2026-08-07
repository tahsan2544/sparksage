// Combined sign-in / sign-up page (email + password).
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your account — SparkSage" },
      {
        name: "description",
        content:
          "Sign in to SparkSage, or create a free account, to chat with your documents and generate summaries, quizzes and flashcards.",
      },
      { property: "og:title", content: "Sign in to SparkSage" },
      {
        property: "og:description",
        content: "Access your AI study companion: document chat, summaries, quizzes, flashcards and your study plan.",
      },
      { property: "og:url", content: "https://sparksage.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://sparksage.lovable.app/auth" }],
  }),

  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // If already signed in, skip the page.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  /** Managed Google OAuth — opens the provider and returns to the app origin. */
  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 font-semibold justify-center mb-6">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-lg">SparkSage</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to keep studying your documents."
                : "Start turning your documents into summaries, quizzes, and flashcards."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading}
              onClick={onGoogle}
            >
              <GoogleMark />
              <span className="ml-2">{googleLoading ? "Connecting…" : "Continue with Google"}</span>
            </Button>

            <p className="text-sm text-muted-foreground mt-4 text-center">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create an account" : "Sign in instead"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/** Google "G" mark, inlined so the button needs no network request. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.7 7l7.3 5.7c4.3-3.9 7.1-9.8 7.1-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
