import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // --- DEBUG SEMENTARA - HAPUS SETELAH MASALAH REDIRECT KETEMU ---
  console.log("[middleware debug env]", {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY_len: process.env.SUPABASE_ANON_KEY?.length,
    SUPABASE_ANON_KEY_tail: process.env.SUPABASE_ANON_KEY?.slice(-12),
  });
  // ----------------------------------------------------------------

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // PENTING: setAll dipanggil SEKALI per request dengan SEMUA cookie
        // sesi (access + refresh token, kadang di-chunk jadi beberapa
        // cookie) - response cuma di-reassign SEKALI di sini, baru semua
        // cookie di-apply ke response yang baru itu. Pola lama (set/remove
        // per-cookie yang masing-masing reassign `response` sendiri-sendiri)
        // bikin cookie yang di-set di panggilan sebelumnya ketiban/hilang -
        // ini yang bikin sesi putus/nyangkut di /auth/login pas ada token
        // refresh (soalnya refresh nulis lebih dari 1 cookie sekaligus).
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    }
  );

  // UPDATE: Menggunakan getUser() alih-alih getSession() untuk keamanan
  // getUser() memvalidasi token ke server auth Supabase
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  // --- DEBUG SEMENTARA - HAPUS SETELAH MASALAH REDIRECT KETEMU ---
  const rawAuthCookie = request.cookies.get("sb-127-auth-token")?.value;
  console.log("[middleware debug cookie]", {
    exists: !!rawAuthCookie,
    length: rawAuthCookie?.length,
    startsWithBase64Prefix: rawAuthCookie?.startsWith("base64-"),
    first30: rawAuthCookie?.slice(0, 30),
  });
  console.log("[middleware debug]", {
    pathname: request.nextUrl.pathname,
    cookieNames: request.cookies.getAll().map((c) => c.name),
    hasUser: !!user,
    getUserError: getUserError?.message,
  });
  // ----------------------------------------------------------------

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

  // Cek keberadaan user, bukan session
  if (!user) {
    if (isAuthPath || isOtherPublicPath || isDynamicPublicPath) {
      return response;
    }

    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Jika user terautentikasi
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nrp, company")
      .eq("id", user.id) // Gunakan user.id
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
