"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/lib/types";

interface CoursesReadonlyClientProps {
  courses: Course[];
}

export function CoursesReadonlyClient({ courses }: CoursesReadonlyClientProps) {
  const activeCourses = courses.filter((c) => c.is_active);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Lehrgänge</h1>
        <p className="mt-1 text-muted-foreground">
          Alle verfügbaren Lehrgänge im Überblick.
        </p>
      </div>

      {activeCourses.length === 0 ? (
        <Card className="mx-auto max-w-md border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-medium text-foreground">
              Keine Lehrgänge vorhanden
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeCourses.map((course) => (
            <Link key={course.id} href={`/admin/courses/${course.id}`}>
              <Card className="group overflow-hidden border-t-4 border-t-primary transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                <div className="relative aspect-[16/9] bg-muted">
                  {course.thumbnail_url ? (
                    <Image
                      src={course.thumbnail_url}
                      alt={course.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent to-muted">
                      <BookOpen className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {course.name}
                  </h2>
                  {course.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  {course.category_tags && course.category_tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {course.category_tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
