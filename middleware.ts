import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeNextPath } from "@/lib/safe-next-path";

// Hasil cek profil lengkap (nrp + company) di-cache di cookie supaya
// middleware tidak query `profiles` di SETIAP request. Nilainya user id,
// jadi ganti akun otomatis cek ulang.
const PROFILE_OK_COOKIE = "ga-profile-ok";
const PROFILE_OK_MAX_AGE = 60 * 10; // detik

function isPrefetchRequest(request: NextRequest) {
  const h = request.headers;
  return (
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch" ||
    (h.get("sec-purpose") ?? "").includes("prefetch")
  );
}

export async function middleware(request: NextRequest) {
  // Prefetch <Link> (mis. 25 baris tabel MR) dulu bikin 2 request Supabase
  // per link - puluhan dalam hitungan detik, bikin Log Ingestion jebol.
  // Aman di-skip: halaman dinamis tetap di-fetch ulang (lewat middleware)
  // saat benar-benar diklik, dan data tetap dilindungi RLS.
  if (isPrefetchRequest(request)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const authPaths = [
    "/auth/login",
    "/auth/sign-up",
    "/auth/error",
    "/auth/sign-up-success",
    "/auth/confirm",
  ];

  const pendingPath = "/pending-approval";

  const otherPublicPaths = ["/"];

  const dynamicPublicPatterns = [
    /^\/approval-po\/[0-9]+$/,
    // Scan QR di BAST cetak - konfirmasi penerimaan barang tanpa login
    // (kode global), lihat app/goods-receipt/[token]/page.tsx.
    /^\/goods-receipt\/[A-Za-z0-9-]+$/,
  ];

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

    // Bawa halaman tujuan (mis. hasil scan QR /approval-pc-*/[id]?step=1)
    // ke halaman login, supaya setelah login user kembali ke sana - bukan
    // terdampar di dashboard.
    const loginUrl = new URL("/auth/login", request.url);
    const next = getSafeNextPath(pathname + request.nextUrl.search);
    if (next && next !== "/") loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  // Jika user terautentikasi
  if (user) {
    let profileOk =
      request.cookies.get(PROFILE_OK_COOKIE)?.value === user.id;

    if (!profileOk) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("nrp, company")
        .eq("id", user.id) // Gunakan user.id
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Middleware profile fetch error:", profileError);
      }

      profileOk = !!profile?.nrp && !!profile?.company;
      if (profileOk) {
        response.cookies.set(PROFILE_OK_COOKIE, user.id, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: PROFILE_OK_MAX_AGE,
        });
      }
    }

    if (!profileOk) {
      if (!isPendingPath) {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }
    } else {
      if (isAuthPath || isPendingPath) {
        const next = getSafeNextPath(request.nextUrl.searchParams.get("next"));
        return NextResponse.redirect(new URL(next ?? "/", request.url));
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
