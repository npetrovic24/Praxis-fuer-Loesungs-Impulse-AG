"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { updateSubmission, deleteSubmission } from "@/lib/actions/submissions";

type Tab = "offen" | "feedback";

interface Submission {
  id: string;
  content: string;
  status: string;
  submitted_at: string;
  file_url: string | null;
  assignment?: {
    title: string;
    unit?: {
      id: string;
      name: string;
      course_id: string;
      course?: { id: string; name: string };
      module?: { name: string } | null;
    };
  };
  feedback?: Array<{
    id: string;
    content: string;
    created_at: string;
    reviewer?: { full_name: string };
  }>;
}

interface ReflexionenClientProps {
  submissions: Submission[];
}

export function ReflexionenClient({ submissions: initialSubmissions }: ReflexionenClientProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState<Tab>("offen");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const openSubmissions = submissions.filter(
    (s) => s.status === "pending" || s.status === "in_review"
  );
  const feedbackSubmissions = submissions.filter(
    (s) => s.status === "reviewed"
  );

  const current = tab === "offen" ? openSubmissions : feedbackSubmissions;

  function startEdit(e: React.MouseEvent, s: Submission) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(s.id);
    setEditContent(s.content);
  }

  async function handleSaveEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editingId || !editContent.trim()) return;
    setSaving(true);
    const result = await updateSubmission(editingId, editContent.trim());
    if (result.success) {
      setSubmissions((prev) =>
        prev.map((s) => s.id === editingId ? { ...s, content: editContent.trim() } : s)
      );
      setEditingId(null);
    } else {
      alert(result.error || "Fehler beim Speichern");
    }
    setSaving(false);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(null);
  }

  async function handleDelete(submissionId: string) {
    setDeleting(submissionId);
    const result = await deleteSubmission(submissionId);
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    } else {
      alert(result.error || "Fehler beim Löschen");
    }
    setDeleting(null);
  }

  function hasFeedback(s: Submission) {
    return (s.feedback?.length || 0) > 0;
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Meine Reflexionen
        </h1>
        <p className="mt-1 text-muted-foreground">
          Übersicht deiner eingereichten Reflexionen und Feedback.
        </p>
      </div>

      <div>
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === "offen" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("offen")}
            className={tab === "offen" ? "bg-[#0099A8] hover:bg-[#007A87]" : ""}
          >
            <Clock className="w-4 h-4 mr-2" />
            Offen ({openSubmissions.length})
          </Button>
          <Button
            variant={tab === "feedback" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("feedback")}
            className={tab === "feedback" ? "bg-[#0099A8] hover:bg-[#007A87]" : ""}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Feedback erhalten ({feedbackSubmissions.length})
          </Button>
        </div>

        {/* Submissions list */}
        {current.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-16 text-center bg-muted/20">
            <MessageCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {tab === "offen"
                ? "Keine offenen Reflexionen. Gut gemacht!"
                : "Noch kein Feedback erhalten."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {current.map((s) => {
              const courseId = s.assignment?.unit?.course_id || s.assignment?.unit?.course?.id;
              const unitId = s.assignment?.unit?.id;
              const isEditing = editingId === s.id;
              const canEdit = !hasFeedback(s);

              return (
                <Link
                  key={s.id}
                  href={courseId && unitId ? `/courses/${courseId}/units/${unitId}` : "#"}
                  onClick={(e) => { if (isEditing) e.preventDefault(); }}
                >
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0099A8]/10 mt-0.5">
                          {s.status === "reviewed" ? (
                            <Sparkles className="h-5 w-5 text-[#0099A8]" />
                          ) : (
                            <FileText className="h-5 w-5 text-[#0099A8]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {s.assignment?.title || "Reflexion"}
                            </span>
                            <Badge
                              variant={s.status === "reviewed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {s.status === "pending"
                                ? "Wird gelesen"
                                : s.status === "in_review"
                                  ? "In Bearbeitung"
                                  : "Feedback erhalten"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {s.assignment?.unit?.course?.name}
                            {s.assignment?.unit?.module?.name && ` · ${s.assignment.unit.module.name}`}
                            {` · ${s.assignment?.unit?.name}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.submitted_at).toLocaleDateString("de-CH", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>

                          {/* Inline Edit */}
                          {isEditing && (
                            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={5}
                                className="text-sm mb-2"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#0099A8] hover:bg-[#007A87]"
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                >
                                  <Save className="h-3.5 w-3.5 mr-1" />
                                  {saving ? "Speichern..." : "Speichern"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  Abbrechen
                                </Button>
                              </div>
                            </div>
                          )}

                          {s.status === "reviewed" && s.feedback?.[0] && !isEditing && (
                            <div className="mt-2 p-3 bg-[#0099A8]/5 rounded-lg">
                              <p className="text-xs text-muted-foreground font-medium mb-1">
                                Feedback von {s.feedback[0].reviewer?.full_name || "Team PLI®"}
                              </p>
                              <div
                                className="text-sm text-foreground line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: s.feedback[0].content }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && !isEditing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => startEdit(e, s)}
                              title="Bearbeiten"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          {!isEditing && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.preventDefault()}
                                  title="Löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reflexion löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deine Reflexion{hasFeedback(s) ? " und das dazugehörige Feedback werden" : " wird"} unwiderruflich gelöscht.
                                    Du kannst danach eine neue Reflexion für diesen Tag einreichen.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deleting === s.id}
                                  >
                                    {deleting === s.id ? "Wird gelöscht..." : "Löschen"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {!isEditing && (
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
