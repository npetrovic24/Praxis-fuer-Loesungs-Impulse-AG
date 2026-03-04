"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BookOpen, MessageCircle, MessageSquare, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

const allNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/admin/reflexionen", label: "Reflexionen", icon: MessageCircle, adminOnly: false },
  { href: "/admin/members", label: "Benutzer", icon: Users, adminOnly: false },
  { href: "/admin/courses", label: "Lehrgänge", icon: BookOpen, adminOnly: true },
  { href: "/admin/chat", label: "Chat", icon: MessageSquare, adminOnly: false },
];

interface AdminSidebarMobileProps {
  role: UserRole;
  userName?: string;
}

export function AdminSidebarMobile({ role, userName }: AdminSidebarMobileProps) {
  const pathname = usePathname();
  const navItems = role === "dozent"
    ? allNavItems.filter((item) => !item.adminOnly)
    : allNavItems;

  const homeHref = role === "dozent" ? "/admin/members" : "/admin";
  const title = role === "dozent" ? "Verwaltung" : "Admin";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <Link href={homeHref} className="flex items-center gap-3">
          <img src="/logo-teal.svg" alt="PLI" className="h-9 w-auto" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        {userName && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <span className="text-sm font-medium text-foreground truncate">{userName}</span>
          </div>
        )}
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Einstellungen
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
