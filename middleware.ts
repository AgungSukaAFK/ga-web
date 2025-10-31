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

  // Halaman publik yang selalu bisa diakses
  const publicPaths = [
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
    "/auth/error",
    "/auth/sign-up-success",
    "/auth/confirm",
    "/auth/update-password",
    "/pending-approval",
  ];

  // Jika user BELUM login
  if (!session) {
    // Jika mencoba akses halaman selain halaman publik, redirect ke login, diperbolehkan jika akses root url (landing page)
    if (!publicPaths.includes(pathname) && pathname !== "/") {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    // Jika sudah di halaman publik, biarkan
    return response;
  }

  // Jika user SUDAH login
  if (session) {
    // Ambil profile-nya
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nrp, company") // Cek kolom nrp dan company
      .eq("id", session.user.id)
      .maybeSingle(); // Gunakan maybeSingle untuk handle jika profile belum ada

    // Handle jika ada error saat fetch profile (selain user belum ada profile)
    if (profileError && profileError.code !== "PGRST116") {
      console.error("Middleware profile fetch error:", profileError);
      // Mungkin redirect ke halaman error atau logout?
      // Untuk sementara, biarkan lanjut tapi log error
    }

    // Kondisi 1: User login tapi BELUM punya NRP/Company (belum diaktifkan)
    if (!profile?.nrp || !profile?.company) {
      // Jika TIDAK sedang di halaman pending, redirect ke sana
      if (pathname !== "/pending-approval") {
        console.log("User lacks NRP/Company, redirecting to /pending-approval");
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }
    }
    // Kondisi 2: User SUDAH punya NRP/Company (sudah aktif)
    else {
      // Jika mencoba akses halaman login, signup, atau pending, redirect ke dashboard
      if (publicPaths.includes(pathname)) {
        console.log(
          "Activated user accessing public auth page, redirecting to /"
        );
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  // Jika semua kondisi lolos, lanjutkan request
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
