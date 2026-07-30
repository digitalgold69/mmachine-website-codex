import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "mmachine_session";
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

  if (pathname.startsWith("/dashboard") && !isPublicDashboardPath(pathname)) {
    const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
    if (!hasSessionCookie) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/dashboard/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
