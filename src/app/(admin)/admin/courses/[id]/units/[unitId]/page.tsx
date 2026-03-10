import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContentBlocks, getUnitWithCourse } from "@/lib/actions/content-blocks";
import { getAssignmentForUnit } from "@/lib/actions/submissions";
import { ContentEditorClient } from "./content-editor-client";
import { AssignmentEditor } from "./assignment-editor";
import { UnitViewReadonly } from "./unit-view-readonly";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; unitId: string }>;
}

export default async function ContentEditorPage({ params }: PageProps) {
  const { id: courseId, unitId } = await params;

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
    const [unit, blocks, assignment] = await Promise.all([
      getUnitWithCourse(unitId),
      getContentBlocks(unitId),
      getAssignmentForUnit(unitId),
    ]);

    const courseName =
      (unit as Record<string, unknown>).courses &&
      typeof (unit as Record<string, unknown>).courses === "object"
        ? ((unit as Record<string, unknown>).courses as { name: string }).name
        : "Lehrgang";

    if (profile?.role === "dozent") {
      return (
        <UnitViewReadonly
          courseId={courseId}
          courseName={courseName}
          unitId={unitId}
          unitName={unit.name}
          blocks={blocks}
        />
      );
    }

    return (
      <div>
        <ContentEditorClient
          courseId={courseId}
          courseName={courseName}
          unitId={unitId}
          unitName={unit.name}
          initialBlocks={blocks}
        />
        <div className="px-6 pb-8 max-w-4xl">
          <AssignmentEditor unitId={unitId} initialAssignment={assignment} />
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
