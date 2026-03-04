import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, BookOpen, BarChart3, Layers, Clock, MessageCircle,
  PenLine, UserCheck, Timer, MessageSquare, ChevronRight, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReflexionStats } from "@/lib/actions/submissions";
import { getDashboardData } from "@/lib/actions/dashboard";

const statusConfig = {
  pending: { label: "Offen", color: "bg-yellow-100 text-yellow-700" },
  in_review: { label: "In Bearbeitung", color: "bg-blue-100 text-blue-700" },
  reviewed: { label: "Erledigt", color: "bg-green-100 text-green-700" },
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "dozent") {
      redirect("/admin/reflexionen");
    }
  }

  const admin = createAdminClient();

  const [reflexionStats, dashboardData, countsResult] = await Promise.all([
    getReflexionStats(),
    getDashboardData(),
    Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true).eq("role", "participant"),
      admin.from("courses").select("*", { count: "exact", head: true }).eq("is_active", true),
      admin.from("units").select("*", { count: "exact", head: true }),
      admin.from("access_grants").select("*", { count: "exact", head: true }).eq("is_granted", true),
    ]),
  ]);

  const [
    { count: membersCount },
    { count: activeMembersCount },
    { count: activeCoursesCount },
    { count: unitsCount },
    { count: activeGrantsCount },
  ] = countsResult;

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Top stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{membersCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">{activeMembersCount ?? 0} aktive Teilnehmer</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCoursesCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Lehrgänge aktiv</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                <PenLine className="h-4 w-4 text-yellow-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reflexionStats.pending}</p>
                <p className="text-xs text-muted-foreground">Offene Reflexionen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <UserCheck className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboardData.claimedCount}</p>
                <p className="text-xs text-muted-foreground">In Bearbeitung</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <Timer className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboardData.avgResponseHours !== null ? `${dashboardData.avgResponseHours}h` : "–"}
                </p>
                <p className="text-xs text-muted-foreground">⌀ Antwortzeit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert: pending reflexions */}
      {reflexionStats.pending > 0 && (
        <Link href="/admin/reflexionen">
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {reflexionStats.pending} Reflexion{reflexionStats.pending !== 1 ? "en" : ""} warten auf Feedback
                </p>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.submissionsThisWeek} neue diese Woche
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent reflexions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                Letzte Reflexionen
              </span>
              <Link href="/admin/reflexionen" className="text-xs text-primary hover:underline font-normal">
                Alle anzeigen →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dashboardData.recentSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground px-5 pb-5">Noch keine Reflexionen eingereicht.</p>
            ) : (
              <div className="divide-y divide-border">
                {dashboardData.recentSubmissions.map((s: any) => {
                  const config = statusConfig[s.status as keyof typeof statusConfig] || statusConfig.pending;
                  return (
                    <Link
                      key={s.id}
                      href={`/admin/reflexionen/${s.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">
                            {s.user?.full_name || "Unbekannt"}
                          </span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${config.color} border-0`}>
                            {config.label}
                          </Badge>
                          {s.assignee && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <UserCheck className="h-2.5 w-2.5" />
                              {s.assignee.full_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.assignment?.unit?.course?.name} — {s.assignment?.title}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(s.submitted_at).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reflexionen per course */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Reflexionen nach Lehrgang
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dashboardData.courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground px-5 pb-5">Noch keine Daten.</p>
            ) : (
              <div className="divide-y divide-border">
                {dashboardData.courseStats.map((course: any) => {
                  const total = course.pending + course.inReview + course.reviewed;
                  const reviewedPct = total > 0 ? Math.round((course.reviewed / total) * 100) : 0;
                  return (
                    <div key={course.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium truncate">{course.name}</span>
                        <span className="text-xs text-muted-foreground">{total} gesamt</span>
                      </div>
                      {/* Progress bar */}
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        {course.reviewed > 0 && (
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${(course.reviewed / total) * 100}%` }}
                          />
                        )}
                        {course.inReview > 0 && (
                          <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${(course.inReview / total) * 100}%` }}
                          />
                        )}
                        {course.pending > 0 && (
                          <div
                            className="bg-yellow-500 transition-all"
                            style={{ width: `${(course.pending / total) * 100}%` }}
                          />
                        )}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                          {course.pending} offen
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {course.inReview} in Arbeit
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          {course.reviewed} erledigt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Activity & Quick stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Diese Woche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Neue Reflexionen</span>
                <span className="text-sm font-semibold">{dashboardData.submissionsThisWeek}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Chat-Nachrichten</span>
                <span className="text-sm font-semibold">{dashboardData.chatMessagesThisWeek}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Erledigte Reflexionen</span>
                <span className="text-sm font-semibold">{reflexionStats.reviewed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat activity per course */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Chat-Aktivität (7 Tage)
              </span>
              <Link href="/admin/chat" className="text-xs text-primary hover:underline font-normal">
                Zum Chat →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.chatMessagesThisWeek === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Chat-Nachrichten diese Woche.</p>
            ) : (
              <div className="space-y-2">
                {dashboardData.courseStats
                  .filter((c: any) => dashboardData.chatActivity[c.id])
                  .map((course: any) => {
                    const count = dashboardData.chatActivity[course.id] || 0;
                    const maxCount = Math.max(...Object.values(dashboardData.chatActivity as Record<string, number>));
                    return (
                      <div key={course.id} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-40 truncate">{course.name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full transition-all"
                            style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                {/* Show courses with chat activity but no submissions */}
                {Object.entries(dashboardData.chatActivity as Record<string, number>)
                  .filter(([id]) => !dashboardData.courseStats.find((c: any) => c.id === id))
                  .map(([id, count]) => (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-40 truncate">Kurs</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: "50%" }} />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
