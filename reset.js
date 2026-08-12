import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.log("Usage: node reset.js <email> <newPassword>");
  process.exit(1);
}

async function findUserIdByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const found = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;

    if (data.users.length < perPage) return null;
    page++;
  }
}

async function hardReset() {
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.log("USER NOT FOUND:", email);
    return;
  }
  console.log("FOUND userId:", userId);

  const { data: before, error: beforeError } =
    await supabase.auth.admin.getUserById(userId);
  if (beforeError) console.log("BEFORE ERROR:", beforeError);
  console.log("BEFORE:", before?.user?.last_sign_in_at);

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
    banned_until: null,
  });

  console.log("UPDATE:", { data, error });

  const { data: after } = await supabase.auth.admin.getUserById(userId);
  console.log("AFTER:", after?.user?.updated_at);

  const login = await supabase.auth.signInWithPassword({
    email,
    password: newPassword,
  });

  console.log("LOGIN:", login);
}

hardReset();
