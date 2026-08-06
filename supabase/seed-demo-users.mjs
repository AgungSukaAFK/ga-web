// Seed user demo untuk local dev (bukan production!).
// Bikin 1 requester + 1 approver per divisi + 2 admin global, semua dengan
// password "demo123" dan email @demo.com, lewat Supabase Auth Admin API
// (supaya trigger `handle_new_user` otomatis bikin baris profiles-nya),
// lalu di-update role/department/nama-nya.
//
// Jalankan setelah `supabase start` + schema sudah di-restore:
//   node supabase/seed-demo-users.mjs

import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
// Service role key default utk local dev Supabase - sama di semua project
// lokal (bukan secret production), lihat output `supabase status`.
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PASSWORD = "demo123";
const COMPANY = "GMI";
const LOKASI = "Head Office";

const DEPARTMENTS = [
  "Human Resources",
  "General Affair",
  "HRGA-HSE",
  "Marketing",
  "Produksi",
  "K3",
  "Finance",
  "IT",
  "Logistik",
  "Purchasing",
  "Warehouse",
  "Service",
  "General Manager",
  "Executive Manager",
  "Boards of Director",
  "Legal",
];

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function buildUserList() {
  const users = [];
  for (const dept of DEPARTMENTS) {
    const slug = slugify(dept);
    users.push({
      email: `requester.${slug}@demo.com`,
      role: "requester",
      department: dept,
      nama: `Requester ${dept} (Demo)`,
      nrp: `DEMO-REQ-${slug}`,
    });
    users.push({
      email: `approver.${slug}@demo.com`,
      role: "approver",
      department: dept,
      nama: `Approver ${dept} (Demo)`,
      nrp: `DEMO-APP-${slug}`,
    });
  }
  users.push({
    email: "admin1@demo.com",
    role: "admin",
    department: "IT",
    nama: "Admin Demo 1",
    nrp: "DEMO-ADMIN-1",
  });
  users.push({
    email: "admin2@demo.com",
    role: "admin",
    department: "General Affair",
    nama: "Admin Demo 2",
    nrp: "DEMO-ADMIN-2",
  });
  return users;
}

async function main() {
  const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = buildUserList();
  console.log(`Seeding ${users.length} demo users ke ${LOCAL_URL} ...`);

  let ok = 0;
  let failed = 0;

  for (const u of users) {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
      });

    if (createError || !created?.user) {
      console.error(`✗ ${u.email}: gagal createUser -`, createError?.message);
      failed++;
      continue;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: u.role,
        department: u.department,
        nama: u.nama,
        nrp: u.nrp,
        company: COMPANY,
        lokasi: LOKASI,
        is_active: true,
      })
      .eq("id", created.user.id);

    if (profileError) {
      console.error(`✗ ${u.email}: user dibuat tapi gagal update profile -`, profileError.message);
      failed++;
      continue;
    }

    console.log(`✓ ${u.email} (${u.role} / ${u.department})`);
    ok++;
  }

  console.log(`\nSelesai. Berhasil: ${ok}, gagal: ${failed}.`);
}

main().catch((err) => {
  console.error("Seed gagal total:", err);
  process.exit(1);
});
