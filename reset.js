import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function resetUserPassword() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    "d0604137-2985-4274-9279-467f38ae9cb1", // ID user yang mau direset (dari Dashboard → Authentication → Users)
    {
      password: process.env.DEFAULT_NEW_PASSWORD, // isi password baru
      // kamu juga bisa tambahkan: email: 'emailbaru@example.com'
    }
  );

  console.log({ data, error });
}
