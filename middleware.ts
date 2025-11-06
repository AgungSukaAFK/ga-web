// src/middleware.ts

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

  // --- REVISI LOGIKA ---

  // 1. Daftar halaman otentikasi (user yg sudah login tidak boleh akses ini)
  const authPaths = [
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
    "/auth/error",
    "/auth/sign-up-success",
    "/auth/confirm",
    "/auth/update-password",
  ];

  // 2. Daftar halaman "Tunggu" (hanya boleh diakses user login yg belum aktif)
  const pendingPath = "/pending-approval";

  // 3. Daftar halaman publik (bisa diakses siapa saja, kapan saja)
  const otherPublicPaths = [
    "/", // Landing page
  ];

  // 4. Pola Regex untuk rute publik dinamis
  const dynamicPublicPatterns = [
    /^\/approval-po\/[0-9]+$/, // Cocok: /approval-po/123, /approval-po/88
    // Tidak Cocok: /approval-po/, /approval-po/validate
  ];

  // Cek apakah path saat ini adalah path publik
  const isAuthPath = authPaths.includes(pathname);
  const isPendingPath = pathname === pendingPath;
  const isOtherPublicPath = otherPublicPaths.includes(pathname);
  const isDynamicPublicPath = dynamicPublicPatterns.some((pattern) =>
    pattern.test(pathname)
  );

  // ===================================
  // LOGIKA UNTUK USER BELUM LOGIN
  // ===================================
  if (!session) {
    // User belum login HANYA boleh akses:
    // - Halaman Auth (isAuthPath)
    // - Halaman Publik Lain (isOtherPublicPath)
    // - Halaman PO Dinamis (isDynamicPublicPath)
    if (isAuthPath || isOtherPublicPath || isDynamicPublicPath) {
      return response; // Biarkan
    }

    // Jika akses halaman lain (misal /dashboard), redirect ke login
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // ===================================
  // LOGIKA UNTUK USER SUDAH LOGIN
  // ===================================
  if (session) {
    // Ambil profile-nya
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nrp, company")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Middleware profile fetch error:", profileError);
    }

    // Kondisi 1: User login tapi BELUM punya NRP/Company (belum diaktifkan)
    if (!profile?.nrp || !profile?.company) {
      // Jika user belum aktif, HANYA boleh akses halaman pending
      if (!isPendingPath) {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }
    }
    // Kondisi 2: User SUDAH punya NRP/Company (sudah aktif)
    else {
      // Jika user sudah aktif, dia TIDAK BOLEH akses halaman auth atau halaman pending
      if (isAuthPath || isPendingPath) {
        return NextResponse.redirect(new URL("/", request.url)); // Redirect ke dashboard
      }
    }
  }

  // Jika semua kondisi lolos (user aktif akses halaman terproteksi,
  // atau user (non)aktif akses halaman publik dinamis), biarkan request.
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
