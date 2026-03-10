import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetail } from "@/lib/actions/modules-units";
import { CourseDetailClient } from "./course-detail-client";
import { CourseDetailReadonlyClient } from "./course-detail-readonly-client";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id } = await params;

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

  try {
    const { course, modules, units } = await getCourseDetail(id);

    if (profile?.role === "dozent") {
      return (
        <CourseDetailReadonlyClient
          course={course}
          modules={modules}
          units={units}
        />
      );
    }

    return (
      <CourseDetailClient
        course={course}
        modules={modules}
        units={units}
      />
    );
  } catch {
    notFound();
  }
}
