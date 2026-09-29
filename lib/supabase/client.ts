import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

// Satu halaman bisa manggil auth.getUser() 5x dalam hitungan milidetik
// (layout, sidebar, avatar, notifikasi, halamannya sendiri) - tiap panggilan
// = 1 request ke /auth/v1/user = 1 baris log API Gateway (Log Ingestion).
// Hasilnya di-cache sebentar & panggilan bersamaan digabung jadi 1 request.
// Cache dibuang tiap ada perubahan sesi (login/logout/refresh token), jadi
// user yang ganti akun tidak kebagian data basi. Ini cuma untuk UI - akses
// data tetap dijaga RLS & middleware di server.
const GET_USER_TTL_MS = 30_000;
const dedupedClients = new WeakSet<BrowserClient>();

function dedupeGetUser(client: BrowserClient) {
  if (dedupedClients.has(client)) return;
  dedupedClients.add(client);

  const originalGetUser = client.auth.getUser.bind(client.auth);
  type GetUserResult = Awaited<ReturnType<typeof originalGetUser>>;
  let cached: { promise: Promise<GetUserResult>; at: number } | null = null;

  client.auth.onAuthStateChange(() => {
    cached = null;
  });

  client.auth.getUser = (jwt?: string) => {
    // Panggilan dengan JWT eksplisit tidak di-cache.
    if (jwt) return originalGetUser(jwt);

    if (cached && Date.now() - cached.at < GET_USER_TTL_MS) {
      return cached.promise;
    }

    const promise: Promise<GetUserResult> = originalGetUser().then(
      (result: GetUserResult) => {
        // Hasil gagal jangan disimpan, supaya panggilan berikutnya coba lagi.
        if (result.error || !result.data.user) {
          if (cached?.promise === promise) cached = null;
        }
        return result;
      },
    );
    cached = { promise, at: Date.now() };
    return promise;
  };
}

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
  );
  // createBrowserClient di browser selalu mengembalikan instance yang sama
  // (singleton), jadi patch ini cuma terpasang sekali.
  if (typeof window !== "undefined") dedupeGetUser(client);
  return client;
}
