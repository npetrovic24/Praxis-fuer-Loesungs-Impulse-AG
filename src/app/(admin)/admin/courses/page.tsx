import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourses } from "@/lib/actions/courses";
import { CoursesClient } from "./courses-client";
import { CoursesReadonlyClient } from "./courses-readonly-client";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const courses = await getCourses();

  if (profile?.role === "dozent") {
    return <CoursesReadonlyClient courses={courses} />;
  }

  return <CoursesClient initialCourses={courses} />;
}
