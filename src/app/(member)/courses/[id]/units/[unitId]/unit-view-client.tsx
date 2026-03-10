"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContentBlock, Course, Unit, Assignment, Feedback } from "@/lib/types";
import { CanvaEmbed } from "./canva-embed";
import { ReflexionForm } from "@/components/reflexion-form";

interface UnitViewClientProps {
  course: Course;
  unit: Unit;
  blocks: ContentBlock[];
  prevUnit: Unit | null;
  nextUnit: Unit | null;
  courseId: string;
  assignment?: Assignment | null;
  existingSubmission?: {
    id: string;
    content: string;
    status: string;
    submitted_at: string;
    feedback?: Feedback[];
  } | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  const content = block.content as Record<string, unknown>;

  switch (block.type) {
    case "canva_embed":
      return <CanvaEmbed blockId={block.id} title={content.title as string} />;

    case "text":
      return (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{
            __html: (content.html as string) || "",
          }}
        />
      );

    case "file":
      return (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">
                {(content.filename as string) ||
                  (content.fileName as string) ||
                  "Skript / Dokument"}
              </p>
              {typeof content.fileSize === "number" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatFileSize(content.fileSize)}
                </p>
              )}
            </div>
            <Button asChild size="sm">
              <a
                href={(content.publicUrl as string) || (content.url as string)}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Herunterladen
              </a>
            </Button>
          </CardContent>
        </Card>
      );

    case "link":
      return (
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <a
              href={content.url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-primary hover:underline"
            >
              <ExternalLink className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">
                {(content.title as string) || (content.url as string)}
              </span>
            </a>
          </CardContent>
        </Card>
      );

    default:
      return (
        <Card className="border-destructive/20">
          <CardContent className="flex items-center gap-3 p-4 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">
              Unbekannter Inhaltstyp: {block.type}
            </span>
          </CardContent>
        </Card>
      );
  }
}

export function UnitViewClient({
  course,
  unit,
  blocks,
  prevUnit,
  nextUnit,
  courseId,
  assignment,
  existingSubmission,
}: UnitViewClientProps) {
  // Scroll to top when unit changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [unit.id]);

  return (
    <div className="relative animate-fade-in">
      <div className="p-6 lg:p-8 max-w-7xl pb-24">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/courses/${courseId}`}
            className="hover:text-foreground transition-colors truncate max-w-[200px]"
          >
            {course.name}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {unit.name}
          </span>
        </nav>

        {/* Unit title */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl text-foreground">
            {unit.name}
          </h1>
          <div className="mt-2 h-1 w-12 rounded-full bg-primary/60" />
        </div>

        {/* Content + Reflexion layout */}
        {(() => {
          const fileBlocks = blocks.filter((b) => b.type === "file");
          const contentBlocks = blocks.filter((b) => b.type !== "file");

          const fileDownloads = fileBlocks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {fileBlocks.map((block) => {
                const c = block.content as Record<string, unknown>;
                return (
                  <a
                    key={block.id}
                    href={(c.publicUrl as string) || (c.url as string)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {(c.filename as string) || (c.fileName as string) || "Dokument"}
                  </a>
                );
              })}
            </div>
          );

          return assignment ? (
            <div className="flex flex-col 2xl:flex-row gap-8">
              {/* Left column: content + downloads */}
              <div className="flex-1 min-w-0">
                {contentBlocks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 p-16 text-center bg-muted/20">
                    <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">
                      Dieser Tag hat noch keine Inhalte.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {contentBlocks.map((block) => (
                      <ContentBlockRenderer key={block.id} block={block} />
                    ))}
                  </div>
                )}
                {fileDownloads}
              </div>
              {/* Right column: reflexion (sticky) */}
              <div className="2xl:w-[440px] 2xl:shrink-0 2xl:sticky 2xl:top-6 2xl:self-start">
                <ReflexionForm
                  assignment={assignment}
                  existingSubmission={existingSubmission}
                />
              </div>
            </div>
          ) : (
            <>
              {contentBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 p-16 text-center bg-muted/20">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">
                    Dieser Tag hat noch keine Inhalte.
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {contentBlocks.map((block) => (
                    <ContentBlockRenderer key={block.id} block={block} />
                  ))}
                </div>
              )}
              {fileDownloads}
            </>
          );
        })()}
      </div>

      {/* Sticky Prev/Next navigation bar */}
      {(prevUnit || nextUnit) && (
        <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-border bg-white/95 backdrop-blur-sm px-6 py-3 lg:px-8">
          <div className="flex items-center justify-between gap-4 max-w-5xl">
            {prevUnit ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/courses/${courseId}/units/${prevUnit.id}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline truncate max-w-[180px]">
                    {prevUnit.name}
                  </span>
                  <span className="sm:hidden">Zurück</span>
                </Link>
              </Button>
            ) : (
              <div />
            )}
            {nextUnit ? (
              <Button asChild size="sm">
                <Link href={`/courses/${courseId}/units/${nextUnit.id}`}>
                  <span className="hidden sm:inline truncate max-w-[180px]">
                    {nextUnit.name}
                  </span>
                  <span className="sm:hidden">Weiter</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
