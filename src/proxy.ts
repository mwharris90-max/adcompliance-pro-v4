import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password");

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  const isAppRoute = pathname.startsWith("/app");

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/app/dashboard", req.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && (isAppRoute || isAdminRoute)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password reset — intercept all /app routes except /app/change-password
  if (
    isLoggedIn &&
    user?.forcePasswordReset &&
    isAppRoute &&
    !pathname.startsWith("/app/change-password")
  ) {
    return NextResponse.redirect(new URL("/app/change-password", req.url));
  }

  // Admin-only route guard
  if (isLoggedIn && isAdminRoute && user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/403", req.url));
  }
});

export const config = {
  // api/upload is excluded so large file bodies bypass the middleware 10 MB limit
  // (the route handler calls auth() directly, so it's still protected)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|api/auth|api/upload).*)"],
};
