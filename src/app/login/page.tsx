"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Detect recovery tokens in URL hash and redirect to set-password page
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Recovery/invite link landed here instead of /set-password — redirect with hash intact
      window.location.href = "/set-password" + hash;
    }
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Ungültige Anmeldedaten");
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    // Check if user is active
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        toast.error("Account ist deaktiviert");
        setLoading(false);
        return;
      }

      // Use window.location.href for full page reload (important for middleware)
      if (profile?.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  const handleForgotPassword = () => {
    toast.info("Bitte kontaktiere den Administrator, um dein Passwort zurückzusetzen.");
  };

  const isDisabled = !email || !password || loading;

  return (
    <div className="flex min-h-screen animate-fade-in">
      {/* Left side – Teal branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0099A8] via-[#007A87] to-[#005F6B]">
        {/* Decorative geometric shapes */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 h-64 w-64 rounded-full border-2 border-white" />
          <div className="absolute bottom-32 right-16 h-48 w-48 rounded-full border-2 border-white" />
          <div className="absolute top-1/2 left-1/3 h-32 w-32 rotate-45 border-2 border-white" />
          <div className="absolute bottom-20 left-20 h-24 w-24 rounded-full bg-white/20" />
          <div className="absolute top-32 right-32 h-16 w-16 rounded-full bg-white/20" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20">
          <img src="/logo-white.svg" alt="PLI Logo" className="mb-8 h-16 w-auto" />
          <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
            Willkommen im<br />Lernportal
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/80">
            Dein Raum für Wachstum und Entwicklung. Entdecke deine Lehrgänge und
            lerne in deinem eigenen Tempo.
          </p>
          <div className="mt-12 border-l-2 border-white/30 pl-6">
            <p className="text-white/70 italic leading-relaxed">
              &laquo;Jede Reise beginnt mit dem ersten Schritt.&raquo;
            </p>
            <p className="mt-2 text-sm text-white/50">
              — Praxis für Lösungs-Impulse
            </p>
          </div>
        </div>
      </div>

      {/* Right side – Login form */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Mobile teal stripe */}
        <div className="h-2 bg-gradient-to-r from-[#0099A8] to-[#007A87] lg:hidden" />

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="mb-10 text-center">
              <img src="/logo-teal.svg" alt="PLI Logo" className="mx-auto mb-4 h-14 w-auto" />
              <h1 className="text-xl font-semibold text-foreground">
                Lösungs-Impulse
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Lernportal</p>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <h2 className="text-center text-lg font-semibold">Anmelden</h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@beispiel.ch"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isDisabled}
                  >
                    {loading ? "Anmelden..." : "Anmelden"}
                  </Button>
                </form>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Passwort vergessen?
                  </button>
                </div>
              </CardContent>
            </Card>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Praxis für Lösungs-Impulse AG
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
