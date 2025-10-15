// lib/amazon_ses/index.ts

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

type Attachment = {
  filename: string;
  content: string;
  encoding: "base64";
};

type SendEmailOptions = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Attachment[];
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SES_FROM}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });

    console.log("✅ Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
}
