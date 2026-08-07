import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const userId = "5deb72aa-28f6-4dc7-bd77-7846474f0ee5";
const email = "admin.ami@garudamart.com";

async function hardReset() {
  const { data: before, error: beforeError } =
    await supabase.auth.admin.getUserById(userId);
  if (beforeError) console.log("BEFORE ERROR:", beforeError);
  console.log("BEFORE:", before?.user?.last_sign_in_at);

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: "gmi2026",
    email_confirm: true,
    banned_until: null,
  });

  console.log("UPDATE:", { data, error });

  const { data: after } = await supabase.auth.admin.getUserById(userId);
  console.log("AFTER:", after?.user?.updated_at);

  const login = await supabase.auth.signInWithPassword({
    email,
    password: "gmi2026",
  });

  console.log("LOGIN:", login);
}

hardReset();
