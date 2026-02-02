import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("supabase url", "secret key");

const userId = "userid";
const email = "email";

async function hardReset() {
  const { data: before } = await supabase.auth.admin.getUserById(userId);
  console.log("BEFORE:", before.user.last_sign_in_at);

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: "gmi2026",
    email_confirm: true,
    banned_until: null,
  });

  console.log("UPDATE:", { data, error });

  const { data: after } = await supabase.auth.admin.getUserById(userId);
  console.log("AFTER:", after.user.updated_at);

  const login = await supabase.auth.signInWithPassword({
    email,
    password: "gmi2026",
  });

  console.log("LOGIN:", login);
}

hardReset();
