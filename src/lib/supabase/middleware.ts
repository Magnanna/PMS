import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

/**
 * Refreshes the Supabase auth session on every request. Required by the SSR
 * cookie-based auth pattern — without this, sessions silently expire.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isPublicRoute =
    isAuthRoute ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/pay/") || // US-H3 public pay links
    request.nextUrl.pathname.startsWith("/r/") || // public receipt view (US-D1)
    request.nextUrl.pathname.startsWith("/tenant/claim/") || // tenant portal invite (US-A4)
    request.nextUrl.pathname.startsWith("/api/");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
