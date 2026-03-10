"use client";

import { useState } from "react";
import Link from "next/link";
import type { Course, Module, Unit } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CourseDetailReadonlyClientProps {
  course: Course;
  modules: Module[];
  units: Unit[];
}

export function CourseDetailReadonlyClient({
  course,
  modules,
  units,
}: CourseDetailReadonlyClientProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map((m) => m.id))
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const getModuleUnits = (moduleId: string) =>
    units.filter((u) => u.module_id === moduleId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/courses"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Lehrgänge
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{course.name}</h1>
        {course.description && (
          <p className="mt-1 text-muted-foreground">{course.description}</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            {modules.length} {modules.length === 1 ? "Modul" : "Module"}
          </span>
          <span>·</span>
          <span>
            {units.length} {units.length === 1 ? "Lektion" : "Lektionen"}
          </span>
        </div>
      </div>

      {/* Modules & Units */}
      <div className="space-y-4">
        {modules
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((module) => {
            const moduleUnits = getModuleUnits(module.id);
            const isExpanded = expandedModules.has(module.id);

            return (
              <Card key={module.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer select-none hover:bg-accent/50 transition-colors"
                  onClick={() => toggleModule(module.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <h2 className="text-lg font-medium text-foreground">{module.name}</h2>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {moduleUnits.length} {moduleUnits.length === 1 ? "Lektion" : "Lektionen"}
                    </Badge>
                  </div>
                </CardHeader>
                {isExpanded && moduleUnits.length > 0 && (
                  <CardContent className="border-t pt-0 pb-2">
                    <ul className="divide-y">
                      {moduleUnits.map((unit) => (
                        <li key={unit.id}>
                          <Link
                            href={`/admin/courses/${course.id}/units/${unit.id}`}
                            className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-accent/50 transition-colors group"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                              <PlayCircle className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              {unit.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
