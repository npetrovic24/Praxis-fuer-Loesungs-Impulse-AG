"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContentBlock } from "@/lib/types";

interface UnitViewReadonlyProps {
  courseId: string;
  courseName: string;
  unitId: string;
  unitName: string;
  blocks: ContentBlock[];
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  const content = block.content as Record<string, unknown>;

  switch (block.type) {
    case "canva_embed":
      return (
        <div className="relative w-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
          <div className="aspect-[16/9] relative">
            <iframe
              src={content.url as string}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allowFullScreen
              title={content.title as string || "Canva-Präsentation"}
            />
          </div>
        </div>
      );

    case "video":
      return (
        <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-muted/30 to-muted/10 shadow-sm">
          <div className="aspect-[16/9] relative">
            <iframe
              src={content.url as string}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allowFullScreen
              allow="autoplay; fullscreen"
              title="Video"
            />
          </div>
        </div>
      );

    case "text":
      return (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: (content.html as string) || "" }}
        />
      );

    case "link":
      return (
        <a
          href={content.url as string}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 text-sm font-medium text-primary hover:bg-accent/50 transition-colors"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {(content.title as string) || (content.url as string)}
        </a>
      );

    default:
      return null;
  }
}

export function UnitViewReadonly({
  courseId,
  courseName,
  unitName,
  blocks,
}: UnitViewReadonlyProps) {
  const fileBlocks = blocks.filter((b) => b.type === "file");
  const contentBlocks = blocks.filter((b) => b.type !== "file");

  return (
    <div className="animate-fade-in px-6 py-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/admin/courses"
          className="hover:text-foreground transition-colors"
        >
          Lehrgänge
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/admin/courses/${courseId}`}
          className="hover:text-foreground transition-colors truncate max-w-[200px]"
        >
          {courseName}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {unitName}
        </span>
      </nav>

      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl text-foreground">
          {unitName}
        </h1>
      </div>

      {/* Content */}
      <div className="space-y-6 max-w-4xl">
        {contentBlocks.map((block) => (
          <ContentBlockRenderer key={block.id} block={block} />
        ))}

        {/* File downloads */}
        {fileBlocks.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {fileBlocks.map((block) => {
              const content = block.content as Record<string, unknown>;
              return (
                <Button
                  key={block.id}
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a
                    href={
                      (content.publicUrl as string) ||
                      (content.url as string) ||
                      (content.viewUrl as string)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="h-4 w-4" />
                    {(content.filename as string) || "Dokument"}
                    <Download className="h-3 w-3 text-muted-foreground" />
                  </a>
                </Button>
              );
            })}
          </div>
        )}

        {contentBlocks.length === 0 && fileBlocks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <p className="text-muted-foreground">
                Noch keine Inhalte für diese Lektion.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Back button */}
      <div className="mt-10">
        <Link href={`/admin/courses/${courseId}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Lehrgang
          </Button>
        </Link>
      </div>
    </div>
  );
}
