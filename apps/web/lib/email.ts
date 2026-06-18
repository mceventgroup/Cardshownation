import { Resend } from "resend";
import type { UserRole } from "@csn/db";

const DEFAULT_FROM_ADDRESS = "Card Show Nation <onboarding@resend.dev>";
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
]);

function extractEmailAddress(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] ?? trimmed).trim().toLowerCase();
}

function getSenderConfigError() {
  const configuredFromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || process.env.RESEND_FROM_ADDRESS?.trim() || "";

  if (!configuredFromAddress) {
    return null;
  }

  const emailAddress = extractEmailAddress(configuredFromAddress);
  const atIndex = emailAddress.lastIndexOf("@");
  if (atIndex === -1) {
    return "Email sending is not configured: RESEND_FROM_EMAIL must be a valid sender address.";
  }

  const domain = emailAddress.slice(atIndex + 1);
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return "Email sending is not configured: RESEND_FROM_EMAIL must use a verified sending domain, not a personal inbox address.";
  }

  return null;
}

export function getEmailConfigStatus() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) {
    return {
      ready: false as const,
      error: "Email sending is not configured: set RESEND_API_KEY.",
    };
  }

  const senderError = getSenderConfigError();
  if (senderError) {
    return {
      ready: false as const,
      error: senderError,
    };
  }

  return {
    ready: true as const,
    error: null,
  };
}

function getResend() {
  const config = getEmailConfigStatus();
  if (!config.ready) {
    throw new Error(config.error);
  }
  return new Resend(process.env.RESEND_API_KEY!.trim());
}

export function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_ADDRESS?.trim() ||
    DEFAULT_FROM_ADDRESS
  );
}

async function sendEmail(input: Parameters<Resend["emails"]["send"]>[0]) {
  const resend = getResend();
  const result = await resend.emails.send(input);

  if (result.error) {
    throw new Error(`Email send failed for ${input.to}: ${result.error.message}`);
  }

  if (!result.data?.id) {
    throw new Error("Email send failed: provider did not return a message id.");
  }

  console.info("[email] sent", {
    id: result.data.id,
    to: input.to,
    from: input.from,
    subject: input.subject,
  });

  return result.data;
}

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

function getAccountAudienceLabel(role: UserRole) {
  switch (role) {
    case "MODERATOR":
      return "moderator";
    case "ORGANIZER":
      return "promoter";
    default:
      return "member";
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, role: UserRole) {
  const audienceLabel = getResetAudienceLabel(role);
  await sendEmail({
    from: getFromAddress(),
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

export async function sendAdminCreatedAccountEmail(to: string, setupUrl: string, role: UserRole) {
  const audienceLabel = getAccountAudienceLabel(role);

  await sendEmail({
    from: getFromAddress(),
    to,
    subject: "Your Card Show Nation account is ready",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Your account is ready
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          An admin created a Card Show Nation ${audienceLabel} account for this email address.
          Click the button below to set your password and finish activating your account.
          This link expires in 1 hour.
        </p>
        <a href="${setupUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Set password
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you were not expecting this account, you can ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPromoterPasswordResetEmail(to: string, resetUrl: string) {
  await sendPasswordResetEmail(to, resetUrl, "ORGANIZER");
}

export async function sendFanVerificationEmail(to: string, verifyUrl: string) {
  await sendEmail({
    from: getFromAddress(),
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

export async function sendFanEmailChangeVerificationEmail(
  to: string,
  previousEmail: string,
  verifyUrl: string
) {
  await sendEmail({
    from: getFromAddress(),
    to,
    subject: "Confirm your new Card Show Nation email",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Confirm your new email
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          We received a request to change your Card Show Nation member email from
          ${previousEmail} to this address. Verify this email to finish the update.
          This link expires in 24 hours.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#0284c7;color:#fff;font-size:14px;
                  font-weight:600;padding:12px 24px;border-radius:9999px;
                  text-decoration:none">
          Verify new email
        </a>
      </div>
    `,
  });
}

export async function sendFanEmailChangeNotice(to: string, newEmail: string) {
  await sendEmail({
    from: getFromAddress(),
    to,
    subject: "Your Card Show Nation email was changed",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
        <h1 style="font-size:22px;font-weight:600;color:#020617;margin-bottom:8px">
          Your email was updated
        </h1>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
          Your Card Show Nation member account email was changed to ${newEmail}.
          If you made this change, no further action is required.
        </p>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">
          If you did not make this change, reset your password immediately and contact support.
        </p>
      </div>
    `,
  });
}

export async function sendModeratorVerificationEmail(to: string, verifyUrl: string) {
  await sendEmail({
    from: getFromAddress(),
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
  await sendEmail({
    from: getFromAddress(),
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
