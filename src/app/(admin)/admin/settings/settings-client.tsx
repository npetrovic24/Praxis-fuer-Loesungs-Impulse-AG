"use client";

import { useState } from "react";
import { User, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

interface SettingsClientProps {
  fullName: string;
  email: string;
}

export function SettingsClient({ fullName, email }: SettingsClientProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }

    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error("Fehler beim Ändern des Passworts");
    } else {
      toast.success("Passwort erfolgreich geändert");
      setPassword("");
      setConfirmPassword("");
    }

    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-lg p-6 animate-fade-in">
      <h1 className="mb-6 text-2xl font-semibold">Einstellungen</h1>

      {/* Profile info (read-only) */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Profil</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">E-Mail</p>
              <p className="text-sm font-medium">{email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Passwort ändern</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Neues Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Mindestens 8 Zeichen
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Speichern..." : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
