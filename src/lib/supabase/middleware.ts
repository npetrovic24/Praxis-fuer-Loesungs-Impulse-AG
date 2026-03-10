import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Password set page - always public (token comes via URL hash)
  if (pathname === "/set-password") {
    return supabaseResponse;
  }

  // Public routes that don't need auth
  if (pathname === "/login" || pathname === "/") {
    if (user) {
      // Logged-in user on login page: check role and redirect
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (profile && !profile.is_active) {
        // Deactivated user - sign them out
        await supabase.auth.signOut();
        return supabaseResponse;
      }

      if (profile?.role === "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      } else if (profile?.role === "dozent") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/members";
        return NextResponse.redirect(url);
      } else {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  // Protected routes: redirect to login if not authenticated
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check if user is active
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Admin/Dozent on member routes → redirect to admin equivalents
  if (profile?.role === "admin" || profile?.role === "dozent") {
    if (pathname.startsWith("/chat")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/chat";
      return NextResponse.redirect(url);
    }
    if (pathname === "/settings") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/settings";
      return NextResponse.redirect(url);
    }
  }

  // Dozent should never be in member/participant area - redirect to admin
  if (profile?.role === "dozent" && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/members";
    return NextResponse.redirect(url);
  }

  // Admin routes: access control by role
  if (pathname.startsWith("/admin")) {
    if (profile?.role === "admin") {
      // Admin can access everything
    } else if (profile?.role === "dozent") {
      // Dozent can access /admin/members, /admin/reflexionen, /admin/chat, /admin/settings, /admin/courses
      if (!pathname.startsWith("/admin/members") && !pathname.startsWith("/admin/reflexionen") && !pathname.startsWith("/admin/chat") && !pathname.startsWith("/admin/settings") && !pathname.startsWith("/admin/courses")) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/members";
        return NextResponse.redirect(url);
      }
    } else {
      // Participants cannot access admin area
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
