"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { SubmissionStatus } from "@/lib/types";

// ─── Auth helpers ───

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return { supabase, user };
}

async function requireDozentOrAdmin() {
  const { supabase, user } = await requireAuth();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "dozent"].includes(profile.role))
    throw new Error("Keine Berechtigung");
  return { supabase, user, role: profile.role as "admin" | "dozent" };
}

// ─── Assignments (Admin) ───

export async function getAssignmentForUnit(unitId: string) {
  const { supabase } = await requireAuth();
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function upsertAssignment(params: {
  unitId: string;
  title: string;
  description?: string;
}) {
  const { supabase } = await requireAuth();
  // Check if assignment exists for this unit
  const { data: existing } = await supabase
    .from("assignments")
    .select("id")
    .eq("unit_id", params.unitId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("assignments")
      .update({ title: params.title, description: params.description || null })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("assignments").insert({
      unit_id: params.unitId,
      title: params.title,
      description: params.description || null,
    });
    if (error) return { error: error.message };
  }
  return { success: true };
}

export async function deleteAssignment(unitId: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("unit_id", unitId);
  if (error) return { error: error.message };
  return { success: true };
}

// ─── Submissions (Participant) ───

export async function createSubmission(params: {
  assignmentId: string;
  content: string;
  fileUrl?: string;
}) {
  const { supabase, user } = await requireAuth();
  const { data: submission, error } = await supabase.from("submissions").insert({
    user_id: user.id,
    assignment_id: params.assignmentId,
    content: params.content,
    file_url: params.fileUrl || null,
  }).select("id").single();
  if (error) return { error: error.message };

  // Send notification to admins + dozents (awaited to prevent duplicate from retry)
  try {
    await notifyTeamAboutNewReflexion(user.id, params.assignmentId, submission.id);
  } catch (err) {
    console.error("Failed to send reflexion notifications:", err);
  }

  revalidatePath("/reflexionen");
  return { success: true };
}

// Simple dedup: track recently notified submission IDs (in-memory, per serverless instance)
const recentlyNotified = new Set<string>();

async function notifyTeamAboutNewReflexion(userId: string, assignmentId: string, submissionId: string) {
  // Prevent duplicate notifications for same submission
  if (recentlyNotified.has(submissionId)) {
    console.log(`⚠️ Skipping duplicate notification for submission ${submissionId}`);
    return;
  }
  recentlyNotified.add(submissionId);
  // Clean up after 60s to prevent memory leak
  setTimeout(() => recentlyNotified.delete(submissionId), 60_000);

  const { sendNewReflexionNotification } = await import("@/lib/email");
  const admin = createAdminClient();

  console.log(`📧 Sending reflexion notifications for submission ${submissionId}...`);

  // Get student name
  const { data: student } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  // Get assignment + course info
  const { data: assignment } = await admin
    .from("assignments")
    .select("title, unit:units(name, course:courses(name))")
    .eq("id", assignmentId)
    .single();

  const courseName = (assignment as any)?.unit?.course?.name || "Unbekannter Kurs";
  const assignmentTitle = assignment?.title || "Reflexion";

  // Get admins (always notified) + assigned dozent or all dozents if unassigned
  const { data: admins } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .eq("is_active", true);

  const { data: assignments } = await admin
    .from("dozent_assignments")
    .select("dozent_id, dozent:profiles!dozent_assignments_dozent_id_fkey(email)")
    .eq("participant_id", userId);

  let dozentEmails: string[];
  if (assignments && assignments.length > 0) {
    // Has assigned dozent → only notify them
    dozentEmails = assignments.map((a: any) => a.dozent?.email).filter(Boolean);
  } else {
    // Unassigned → notify ALL active dozents
    const { data: allDozents } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "dozent")
      .eq("is_active", true);
    dozentEmails = (allDozents || []).map(d => d.email);
  }

  const adminEmails = (admins || []).map(a => a.email);
  const emails = [...new Set([...adminEmails, ...dozentEmails])];

  if (emails.length === 0) {
    console.log("⚠️ No recipients found for notification");
    return;
  }
  console.log(`📧 Notifying ${emails.length} team members: ${emails.join(", ")}`);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://portal.loesungs-impulse.ch";

  // Send one email to all team members
  await sendNewReflexionNotification({
    recipientEmails: emails,
    studentName: student?.full_name || "Ein Teilnehmer",
    assignmentTitle,
    courseName,
    submissionUrl: `${baseUrl}/admin/reflexionen/${submissionId}`,
  });
}

export async function getMySubmissions() {
  const { supabase, user } = await requireAuth();
  const { data, error } = await supabase
    .from("submissions")
    .select(`
      *,
      assignment:assignments(
        *,
        unit:units(
          *,
          course:courses(*),
          module:modules(*)
        )
      ),
      feedback(
        *,
        reviewer:profiles!feedback_reviewer_id_fkey(id, full_name)
      )
    `)
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMySubmissionForAssignment(assignmentId: string) {
  const { supabase, user } = await requireAuth();
  const { data } = await supabase
    .from("submissions")
    .select(`
      *,
      feedback(
        *,
        reviewer:profiles!feedback_reviewer_id_fkey(id, full_name)
      )
    `)
    .eq("user_id", user.id)
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ─── Submissions (Dozent/Admin) ───

export async function getAllSubmissions(statusFilter?: SubmissionStatus) {
  const { user, role } = await requireDozentOrAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("submissions")
    .select(`
      *,
      user:profiles!submissions_user_id_fkey(id, full_name, email),
      assignee:profiles!submissions_assigned_to_fkey(id, full_name),
      assignment:assignments(
        *,
        unit:units(
          *,
          course:courses(*),
          module:modules(*)
        )
      ),
      feedback(
        *,
        reviewer:profiles!feedback_reviewer_id_fkey(id, full_name)
      )
    `)
    .order("submitted_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  // Dozent: filter to assigned + unassigned participants
  if (role === "dozent") {
    const { getMyAssignedParticipantIds } = await import("./members");
    const assignedIds = await getMyAssignedParticipantIds(user.id);
    
    // Get all assigned participant IDs (across all dozents)
    const { data: allAssignments } = await admin
      .from("dozent_assignments")
      .select("participant_id");
    const allAssignedIds = new Set((allAssignments || []).map((a: any) => a.participant_id));
    
    return (data || []).filter((s: any) => 
      assignedIds.includes(s.user_id) || !allAssignedIds.has(s.user_id)
    );
  }
  
  return data || [];
}

export async function getSubmissionById(submissionId: string) {
  await requireDozentOrAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("submissions")
    .select(`
      *,
      user:profiles!submissions_user_id_fkey(id, full_name, email),
      assignment:assignments(
        *,
        unit:units(
          *,
          course:courses(*),
          module:modules(*)
        )
      ),
      feedback(
        *,
        reviewer:profiles!feedback_reviewer_id_fkey(id, full_name)
      )
    `)
    .eq("id", submissionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus,
  assignedTo?: string
) {
  const { supabase, user } = await requireDozentOrAdmin();

  const updateData: Record<string, unknown> = { status };
  if (assignedTo !== undefined) {
    updateData.assigned_to = assignedTo;
  } else if (status === "in_review") {
    updateData.assigned_to = user.id;
  }

  const { error } = await supabase
    .from("submissions")
    .update(updateData)
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/admin/reflexionen");
  return { success: true };
}

// ─── Feedback (Dozent/Admin) ───

export async function createFeedback(params: {
  submissionId: string;
  content: string;
  isAiGenerated?: boolean;
}) {
  const { supabase, user } = await requireDozentOrAdmin();

  const { error: feedbackError } = await supabase.from("feedback").insert({
    submission_id: params.submissionId,
    reviewer_id: user.id,
    content: params.content,
    is_ai_generated: params.isAiGenerated || false,
  });

  if (feedbackError) return { error: feedbackError.message };

  // Auto-update submission status to reviewed
  const { error: statusError } = await supabase
    .from("submissions")
    .update({ status: "reviewed" })
    .eq("id", params.submissionId);

  if (statusError) return { error: statusError.message };

  // Notify participant about feedback (fire & forget)
  notifyParticipantAboutFeedback(params.submissionId, user.id).catch((err) => {
    console.error("Failed to send feedback notification:", err);
  });

  revalidatePath("/admin/reflexionen");
  return { success: true };
}

async function notifyParticipantAboutFeedback(submissionId: string, reviewerId: string) {
  const { sendFeedbackReceivedNotification } = await import("@/lib/email");
  const admin = createAdminClient();

  // Get submission with user + assignment info
  const { data: submission } = await admin
    .from("submissions")
    .select(`
      user_id,
      assignment:assignments(
        title,
        unit:units(id, course_id, course:courses(name))
      )
    `)
    .eq("id", submissionId)
    .single();

  if (!submission) return;

  // Get participant info
  const { data: participant } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", submission.user_id)
    .single();

  if (!participant) return;

  // Get reviewer name
  const { data: reviewer } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", reviewerId)
    .single();

  const assignment = submission.assignment as any;
  const courseName = assignment?.unit?.course?.name || "Kurs";
  const courseId = assignment?.unit?.course_id;
  const unitId = assignment?.unit?.id;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://portal.loesungs-impulse.ch";
  const courseUrl = courseId && unitId
    ? `${baseUrl}/courses/${courseId}/units/${unitId}`
    : `${baseUrl}/reflexionen`;

  await sendFeedbackReceivedNotification({
    recipientEmail: participant.email,
    recipientName: participant.full_name?.split(" ")[0] || "Teilnehmer",
    reviewerName: reviewer?.full_name || "Team PLI®",
    assignmentTitle: assignment?.title || "Reflexion",
    courseName,
    courseUrl,
  });
}

// ─── KI Feedback Generation ───

export async function generateAiFeedback(submissionId: string) {
  await requireDozentOrAdmin();
  const admin = createAdminClient();

  // Load submission with full context
  const { data: submission, error } = await admin
    .from("submissions")
    .select(`
      id, content,
      user:profiles!submissions_user_id_fkey(full_name),
      assignment:assignments(
        title, description,
        unit:units(
          name,
          course:courses(name),
          module:modules(name)
        )
      )
    `)
    .eq("id", submissionId)
    .single();

  if (error || !submission) throw new Error("Submission nicht gefunden");

  const studentName = (submission.user as any)?.full_name?.split(" ")[0] || "liebe/r Teilnehmer/in";
  const courseName = (submission.assignment as any)?.unit?.course?.name || "Coaching-Ausbildung";
  const moduleName = (submission.assignment as any)?.unit?.module?.name || "";
  const unitName = (submission.assignment as any)?.unit?.name || "";
  const assignmentTitle = (submission.assignment as any)?.title || "";
  const assignmentDescription = (submission.assignment as any)?.description || "";

  const submissionLength = submission.content.length;
  const wordCountGuidance = submissionLength > 1500
    ? "Deine Antwort sollte 300-400 Wörter umfassen."
    : submissionLength > 800
      ? "Deine Antwort sollte 200-300 Wörter umfassen."
      : "Deine Antwort sollte 150-200 Wörter umfassen.";

  const systemPrompt = `Du bist eine erfahrene Coaching-Ausbilderin bei der "Praxis für Lösungs-Impulse" (PLI®) in der Schweiz.
Du gibst warmherziges, wertschätzendes UND konstruktiv-kritisches Feedback auf Reflexionen und Aufgabeneinreichungen von Studierenden.

WICHTIG - Dein Feedback-Stil:
- Persönlich und wertschätzend, niemals herablassend oder belehrend
- Schweizer Hochdeutsch (z.B. "Grüsse" statt "Grüße", "ss" statt "ß")
- Empathisch und ermutigend als Grundton
- SEHR KONKRET auf die spezifischen Inhalte der Einreichung eingehend
- Du zitierst oder paraphrasierst einzelne Aussagen des Teilnehmers

KONSTRUKTIVE KRITIK:
- Nach der Wertschätzung gibst du 1-2 konkrete Denkanstösse oder Vertiefungsmöglichkeiten
- Formuliere als "Einladung zum Weiterdenken", nicht als Kritik
- Stelle maximal 1-2 Reflexionsfragen, die zum Weiterdenken anregen

LÄNGE UND TIEFE:
${wordCountGuidance}
- Gehe auf mindestens 2-3 konkrete Punkte aus der Einreichung ein

Struktur (verwende Absätze mit Leerzeilen):
1. Persönliche Anrede mit Vornamen
2. Wertschätzung mit konkretem Bezug
3. Eingehen auf 2-3 spezifische Aspekte der Reflexion
4. Konstruktive Denkanstösse mit 1-2 Reflexionsfragen
5. Ermutigung und herzliche Grüsse`;

  const userPrompt = `Schreibe Feedback für folgende Aufgabeneinreichung:

**Lehrgang:** ${courseName}
**Modul:** ${moduleName}
**Tag:** ${unitName}
**Aufgabe:** ${assignmentTitle}
**Aufgabenstellung:** ${assignmentDescription}

**Reflexion von ${studentName}:**
${submission.content}`;

  // Call Anthropic API (Claude Sonnet 4.6)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`KI-Fehler: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const feedbackText = data.content?.[0]?.text || "";

  return { feedback: feedbackText, studentName };
}

// ─── Stats ───

export async function getReflexionStats() {
  const { supabase } = await requireDozentOrAdmin();

  const [pendingRes, inReviewRes, reviewedRes, totalStudentsRes] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "participant"),
  ]);

  return {
    pending: pendingRes.count || 0,
    inReview: inReviewRes.count || 0,
    reviewed: reviewedRes.count || 0,
    totalStudents: totalStudentsRes.count || 0,
  };
}

// ─── Claiming (Dozent/Admin) ───

export async function claimSubmission(submissionId: string) {
  const { user } = await requireDozentOrAdmin();
  const admin = createAdminClient();

  // Check if already claimed by someone else
  const { data: submission } = await admin
    .from("submissions")
    .select("assigned_to, status")
    .eq("id", submissionId)
    .single();

  if (submission?.assigned_to && submission.assigned_to !== user.id) {
    return { error: "Diese Reflexion wird bereits von jemand anderem bearbeitet." };
  }

  const { error } = await admin
    .from("submissions")
    .update({ assigned_to: user.id, status: "in_review" })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/admin/reflexionen");
  return { success: true };
}

export async function unclaimSubmission(submissionId: string) {
  const { user } = await requireDozentOrAdmin();
  const admin = createAdminClient();

  // Only allow unclaiming your own claims (or admin can unclaim anyone)
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: submission } = await admin
    .from("submissions")
    .select("assigned_to")
    .eq("id", submissionId)
    .single();

  if (profile?.role !== "admin" && submission?.assigned_to !== user.id) {
    return { error: "Du kannst nur deine eigenen Zuweisungen aufheben." };
  }

  const { error } = await admin
    .from("submissions")
    .update({ assigned_to: null, status: "pending" })
    .eq("id", submissionId);

  if (error) return { error: error.message };
  revalidatePath("/admin/reflexionen");
  return { success: true };
}
