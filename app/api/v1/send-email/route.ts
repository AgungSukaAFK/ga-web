// app/api/v1/send-email/route.ts

import { sendEmail } from "@/lib/amazon_ses";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { to, subject, html, from, attachments } = await request.json();

  const result = await sendEmail({ to, subject, html, from, attachments });

  return NextResponse.json(result);
}
