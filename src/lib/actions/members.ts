"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendWelcomeEmail, sendPasswordResetEmail } from "@/lib/email";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") throw new Error("Keine Berechtigung");
  return user;
}

async function requireAdminOrDozent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "dozent"))
    throw new Error("Keine Berechtigung");
  return { user, role: profile.role as "admin" | "dozent" };
}

export async function getMembers() {
  await requireAdminOrDozent();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getAllCourses() {
  await requireAdminOrDozent();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("courses")
    .select(`
      id, name,
      units(id, name, sort_order, module:modules(id, name))
    `)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  // Sort units by sort_order
  return (data || []).map((course: any) => ({
    ...course,
    units: (course.units || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));
}

export async function createMember(formData: {
  email: string;
  fullName: string;
  role?: "admin" | "dozent" | "participant";
  courseAssignments?: { courseId: string; unitIds?: string[]; expiresAt?: string | null }[];
}) {
  const { role: callerRole } = await requireAdminOrDozent();
  const admin = createAdminClient();
  // Dozent can only create participants
  const role = callerRole === "dozent" ? "participant" : (formData.role || "participant");

  // Create user with temporary random password (user will set their own via invite link)
  const tempPassword = crypto.randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: formData.fullName,
      role,
    },
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
    }
    return { error: error.message };
  }

  // Assign courses if provided
  let assignedCourses: { id: string; name: string }[] = [];
  if (formData.courseAssignments && formData.courseAssignments.length > 0 && data.user) {
    const supabase = createAdminClient();
    const grants: any[] = [];
    for (const ca of formData.courseAssignments) {
      if (ca.unitIds && ca.unitIds.length > 0) {
        // Unit-level access: one grant per unit
        for (const unitId of ca.unitIds) {
          grants.push({
            user_id: data.user.id,
            course_id: ca.courseId,
            module_id: null,
            unit_id: unitId,
            is_granted: true,
            expires_at: ca.expiresAt || null,
          });
        }
      } else {
        // Full course access
        grants.push({
          user_id: data.user.id,
          course_id: ca.courseId,
          module_id: null,
          unit_id: null,
          is_granted: true,
          expires_at: ca.expiresAt || null,
        });
      }
    }
    await supabase.from("access_grants").insert(grants);

    // Get course names for email
    const courseIds = formData.courseAssignments.map(ca => ca.courseId);
    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, name")
      .in("id", courseIds);
    
    assignedCourses = coursesData || [];
  }

  // Generate password-set link and send welcome email
  if (data.user) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: formData.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://portal.loesungs-impulse.ch"}/set-password`,
      },
    });

    const passwordSetLink = linkError ? undefined : linkData?.properties?.action_link;

    try {
      await sendWelcomeEmail({
        fullName: formData.fullName,
        email: formData.email,
        passwordSetLink,
        role,
        courses: assignedCourses,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }
  }

  revalidatePath("/admin/members");
  return { data: data.user };
}

export async function updateMember(
  memberId: string,
  formData: { fullName: string; email: string; role?: "admin" | "dozent" | "participant" }
) {
  const { role: callerRole } = await requireAdminOrDozent();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Dozent can only edit participants
  if (callerRole === "dozent") {
    const { data: target } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", memberId)
      .single();
    if (!target || target.role !== "participant") {
      return { error: "Keine Berechtigung, diesen Benutzer zu bearbeiten." };
    }
  }

  // Update profile
  const profileUpdate: Record<string, string> = {
    full_name: formData.fullName,
    email: formData.email,
  };
  // Dozent cannot change roles
  if (formData.role && callerRole === "admin") {
    profileUpdate.role = formData.role;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", memberId);

  if (profileError) return { error: profileError.message };

  // Update auth email if changed
  const { error: authError } = await admin.auth.admin.updateUserById(memberId, {
    email: formData.email,
  });

  if (authError) return { error: authError.message };

  revalidatePath("/admin/members");
  return { success: true };
}

export async function toggleMemberStatus(memberId: string, isActive: boolean) {
  const { user: currentUser, role: callerRole } = await requireAdminOrDozent();

  if (memberId === currentUser.id) {
    return { error: "Sie können sich nicht selbst deaktivieren." };
  }

  const supabase = await createClient();

  // Dozent can only toggle participants
  if (callerRole === "dozent") {
    const { data: target } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", memberId)
      .single();
    if (!target || target.role !== "participant") {
      return { error: "Keine Berechtigung, diesen Benutzer zu ändern." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", memberId);

  if (error) return { error: error.message };

  revalidatePath("/admin/members");
  return { success: true };
}

export async function resetMemberPassword(memberId: string, newPassword: string) {
  const { role: callerRole } = await requireAdminOrDozent();

  // Get user profile for email
  const supabase = await createClient();
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", memberId)
    .single();

  if (!userProfile) {
    return { error: "Benutzer nicht gefunden." };
  }

  // Dozent can only reset passwords for participants
  if (callerRole === "dozent") {
    if (userProfile.role !== "participant") {
      return { error: "Keine Berechtigung, dieses Passwort zurückzusetzen." };
    }
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(memberId, {
    password: newPassword,
  });

  if (error) return { error: error.message };

  // Send password reset email (fire & forget)
  sendPasswordResetEmail({
    fullName: userProfile.full_name,
    email: userProfile.email,
    newPassword,
  }).catch(error => {
    console.error("Failed to send password reset email:", error);
    // Don't throw - email failures shouldn't block password reset
  });

  return { success: true };
}

export async function deleteMember(memberId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Delete access grants first
  await supabase.from("access_grants").delete().eq("user_id", memberId);

  // Delete profile
  await supabase.from("profiles").delete().eq("id", memberId);

  // Delete from Supabase Auth
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) return { error: error.message };

  revalidatePath("/admin/members");
  return { success: true };
}

export async function getParticipants() {
  const { user, role } = await requireAdminOrDozent();
  const admin = createAdminClient();
  
  // Dozent: show assigned participants + unassigned participants
  if (role === "dozent") {
    const myAssignedIds = await getMyAssignedParticipantIds(user.id);
    
    // Get ALL assigned participant IDs (across all dozents)
    const { data: allAssignments } = await admin
      .from("dozent_assignments")
      .select("participant_id");
    const allAssignedIds = new Set((allAssignments || []).map(a => a.participant_id));
    
    // Get all participants
    const { data: allParticipants, error } = await admin
      .from("profiles")
      .select("*")
      .eq("role", "participant")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    
    // Filter: my assigned + unassigned
    return (allParticipants || []).filter(p => 
      myAssignedIds.includes(p.id) || !allAssignedIds.has(p.id)
    );
  }
  
  // Admin: show all
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "participant")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getTeamMembers() {
  await requireAdminOrDozent();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .in("role", ["admin", "dozent"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// ─── Dozent Assignments ───

export async function getDozents() {
  await requireAdminOrDozent();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["dozent"])
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getParticipantDozentAssignments(courseId?: string) {
  await requireAdminOrDozent();
  const admin = createAdminClient();
  let query = admin.from("dozent_assignments").select("id, dozent_id, participant_id, course_id");
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function assignDozent(participantId: string, dozentId: string, courseId?: string) {
  const { role } = await requireAdminOrDozent();
  if (role !== "admin") throw new Error("Nur Admins können Dozenten zuweisen.");
  const admin = createAdminClient();
  
  // Remove existing assignment for this participant+course first
  let deleteQuery = admin.from("dozent_assignments")
    .delete()
    .eq("participant_id", participantId);
  if (courseId) {
    deleteQuery = deleteQuery.eq("course_id", courseId);
  } else {
    deleteQuery = deleteQuery.is("course_id", null);
  }
  await deleteQuery;

  // Insert new if dozentId is not empty
  if (dozentId) {
    const { error } = await admin.from("dozent_assignments").insert({
      dozent_id: dozentId,
      participant_id: participantId,
      course_id: courseId || null,
    });
    if (error) throw new Error(error.message);
  }
  
  return { success: true };
}

export async function getMyAssignedParticipantIds(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dozent_assignments")
    .select("participant_id")
    .eq("dozent_id", userId);
  if (error) return [];
  return [...new Set((data || []).map(d => d.participant_id))];
}
