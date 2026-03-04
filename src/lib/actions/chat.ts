"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getChatMessages(courseId: string, limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_messages")
    .select(`
      id,
      course_id,
      user_id,
      content,
      created_at,
      user:profiles!chat_messages_user_id_profiles_fkey(id, full_name, role)
    `)
    .eq("course_id", courseId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []).map((msg: any) => ({
    ...msg,
    user: Array.isArray(msg.user) ? msg.user[0] || null : msg.user,
  }));
}

export async function sendChatMessage(courseId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "Nachricht darf nicht leer sein." };
  if (trimmed.length > 2000) return { error: "Nachricht zu lang (max. 2000 Zeichen)." };

  // Verify user has access to this course
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "dozent") {
    const { data: grant } = await admin
      .from("access_grants")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("is_granted", true)
      .limit(1)
      .single();

    if (!grant) return { error: "Kein Zugriff auf diesen Kurs." };
  }

  const { error } = await admin
    .from("chat_messages")
    .insert({ course_id: courseId, user_id: user.id, content: trimmed });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getUserCourses() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin" || profile?.role === "dozent") {
    const { data } = await admin
      .from("courses")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    return data || [];
  }

  const { data } = await admin
    .from("access_grants")
    .select("course:courses(id, name)")
    .eq("user_id", user.id)
    .eq("is_granted", true)
    .not("course_id", "is", null);

  return (data || [])
    .map((ag: any) => ag.course)
    .filter(Boolean);
}

// ─── Chat Read Status ───

export async function markChatAsRead(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  
  await admin.from("chat_read_status").upsert({
    user_id: user.id,
    course_id: courseId,
    last_read_at: new Date().toISOString(),
  }, { onConflict: "user_id,course_id" });
}

export async function getUnreadChatCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const admin = createAdminClient();

  // Get all read statuses for this user
  const { data: readStatuses } = await admin
    .from("chat_read_status")
    .select("course_id, last_read_at")
    .eq("user_id", user.id);

  const readMap: Record<string, string> = {};
  for (const rs of readStatuses || []) {
    readMap[rs.course_id] = rs.last_read_at;
  }

  // Get message counts per course, excluding own messages
  const { data: messages } = await admin
    .from("chat_messages")
    .select("course_id, created_at")
    .neq("user_id", user.id);

  const counts: Record<string, number> = {};
  for (const msg of messages || []) {
    const lastRead = readMap[msg.course_id];
    if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
      counts[msg.course_id] = (counts[msg.course_id] || 0) + 1;
    }
  }

  return counts;
}

export async function getTotalUnreadCount(): Promise<number> {
  const counts = await getUnreadChatCounts();
  return Object.values(counts).reduce((a, b) => a + b, 0);
}
