"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getDashboardData() {
  const admin = createAdminClient();

  const now = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentSubmissions },
    { data: allSubmissions },
    { data: recentChatMessages },
    { data: coursesWithSubmissions },
    { data: recentFeedback },
  ] = await Promise.all([
    // Latest 5 submissions with details
    admin
      .from("submissions")
      .select(`
        id, status, submitted_at, assigned_to,
        user:profiles!submissions_user_id_fkey(id, full_name),
        assignee:profiles!submissions_assigned_to_fkey(id, full_name),
        assignment:assignments(
          title,
          unit:units(
            name,
            course:courses(id, name)
          )
        )
      `)
      .order("submitted_at", { ascending: false })
      .limit(5),

    // All submissions for stats
    admin
      .from("submissions")
      .select("id, status, submitted_at, assigned_to"),

    // Chat messages this week
    admin
      .from("chat_messages")
      .select("id, course_id, created_at")
      .gte("created_at", weekAgo),

    // Courses with submission counts
    admin
      .from("courses")
      .select(`
        id, name,
        units(
          assignments(
            submissions(id, status)
          )
        )
      `)
      .eq("is_active", true),

    // Recent feedback (for avg response time)
    admin
      .from("feedback")
      .select(`
        id, created_at,
        submission:submissions(submitted_at)
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Calculate stats per course
  const courseStats = (coursesWithSubmissions || []).map((course: any) => {
    let pending = 0;
    let inReview = 0;
    let reviewed = 0;
    for (const unit of course.units || []) {
      for (const assignment of unit.assignments || []) {
        for (const sub of assignment.submissions || []) {
          if (sub.status === "pending") pending++;
          else if (sub.status === "in_review") inReview++;
          else if (sub.status === "reviewed") reviewed++;
        }
      }
    }
    return { id: course.id, name: course.name, pending, inReview, reviewed, total: pending + inReview + reviewed };
  }).filter((c: any) => c.total > 0)
    .sort((a: any, b: any) => b.pending - a.pending);

  // Calculate average response time (hours)
  let avgResponseHours: number | null = null;
  if (recentFeedback && recentFeedback.length > 0) {
    const responseTimes = recentFeedback
      .filter((fb: any) => fb.submission?.submitted_at)
      .map((fb: any) => {
        const submitted = new Date(fb.submission.submitted_at).getTime();
        const responded = new Date(fb.created_at).getTime();
        return (responded - submitted) / (1000 * 60 * 60); // hours
      });
    if (responseTimes.length > 0) {
      avgResponseHours = Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length);
    }
  }

  // Chat messages per course this week
  const chatActivity = new Map<string, number>();
  for (const msg of recentChatMessages || []) {
    chatActivity.set(msg.course_id, (chatActivity.get(msg.course_id) || 0) + 1);
  }

  // Submissions this week
  const submissionsThisWeek = (allSubmissions || []).filter(
    (s: any) => new Date(s.submitted_at) >= new Date(weekAgo)
  ).length;

  // Claimed but not yet reviewed
  const claimedCount = (allSubmissions || []).filter(
    (s: any) => s.status === "in_review" && s.assigned_to
  ).length;

  return {
    recentSubmissions: (recentSubmissions || []).map((s: any) => ({
      ...s,
      user: Array.isArray(s.user) ? s.user[0] : s.user,
      assignee: Array.isArray(s.assignee) ? s.assignee[0] : s.assignee,
    })),
    courseStats,
    avgResponseHours,
    chatMessagesThisWeek: recentChatMessages?.length || 0,
    chatActivity: Object.fromEntries(chatActivity),
    submissionsThisWeek,
    claimedCount,
  };
}
