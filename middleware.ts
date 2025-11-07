import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  const authPaths = [
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
    "/auth/error",
    "/auth/sign-up-success",
    "/auth/confirm",
    "/auth/update-password",
  ];

  const pendingPath = "/pending-approval";

  const otherPublicPaths = ["/"];

  const dynamicPublicPatterns = [/^\/approval-po\/[0-9]+$/];

  const isAuthPath = authPaths.includes(pathname);
  const isPendingPath = pathname === pendingPath;
  const isOtherPublicPath = otherPublicPaths.includes(pathname);
  const isDynamicPublicPath = dynamicPublicPatterns.some((pattern) =>
    pattern.test(pathname)
  );

  if (!session) {
    if (isAuthPath || isOtherPublicPath || isDynamicPublicPath) {
      return response;
    }

    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (session) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nrp, company")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Middleware profile fetch error:", profileError);
    }

    if (!profile?.nrp || !profile?.company) {
      if (!isPendingPath) {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }
    } else {
      if (isAuthPath || isPendingPath) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .*(files with extensions, e.g. .png, .jpg, .svg)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[^.]+$).*)",
  ],
};
