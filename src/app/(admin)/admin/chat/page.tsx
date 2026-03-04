import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserCourses } from "@/lib/actions/chat";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const courses = await getUserCourses();

  return (
    <ChatClient
      courses={courses}
      currentUserId={user.id}
      currentUserName={profile?.full_name || "Benutzer"}
      currentUserRole={profile?.role || "participant"}
    />
  );
}
