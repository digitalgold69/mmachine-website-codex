import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "mmachine_session";
const AUTH_SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const PUBLIC_DASHBOARD_PATHS = [
  "/dashboard/login",
  "/dashboard/forgot-password",
  "/dashboard/reset-password",
  "/dashboard/accept-invitation",
];

export const runtime = "experimental-edge";

function isPublicDashboardPath(pathname: string) {
  return PUBLIC_DASHBOARD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mmachine-pathname", `${pathname}${search}`);
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value || "";

  if (pathname.startsWith("/dashboard") && !isPublicDashboardPath(pathname)) {
    const hasSessionCookie = Boolean(sessionCookie);
    if (!hasSessionCookie) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/dashboard/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (sessionCookie) {
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
