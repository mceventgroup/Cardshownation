import { Resend } from "resend";
import type { UserRole } from "@csn/db";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return new Resend(apiKey);
}

const FROM_ADDRESS = "Card Show Nation <noreply@cardshownation.com>";

function getResetAudienceLabel(role: UserRole) {
  switch (role) {
    case "MODERATOR":
      return "moderator";
    case "ORGANIZER":
      return "promoter";
    default:
      return "account";
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, role: UserRole) {
  const resend = getResend();
  const audienceLabel = getResetAudienceLabel(role);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset your Card Show Nation password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Reset your password
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          Click the button below to reset your Card Show Nation ${audienceLabel} password.
          This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Reset password
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you didn't request this, you can ignore this email.
          Your password won't change.
        </p>
      </div>
    `,
  });
}

export async function sendPromoterPasswordResetEmail(to: string, resetUrl: string) {
  await sendPasswordResetEmail(to, resetUrl, "ORGANIZER");
}

export async function sendFanVerificationEmail(to: string, verifyUrl: string) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Verify your Card Show Nation account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Verify your email
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          Click the button below to verify your email and activate your
          Card Show Nation member account. This link expires in 24 hours.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Verify email
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you didn't create this account, you can ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendModeratorVerificationEmail(to: string, verifyUrl: string) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Verify your Card Show Nation moderator account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Verify your email
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          Click the button below to verify your email and activate your
          Card Show Nation moderator account. This link expires in 24 hours.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Verify email
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you weren't expecting moderator access, you can ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPromoterVerificationEmail(
  to: string,
  verifyUrl: string
) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Verify your Card Show Nation promoter account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Verify your email
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          Click the button below to verify your email and activate your
          Card Show Nation promoter account. This link expires in 24 hours.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Verify email
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you didn't create this account, you can ignore this email.
        </p>
      </div>
    `,
  });
}
