import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { updateAdminPassword } from "@/lib/admins";
import { getRecentAuditLogs } from "@/lib/audit-log";
import { sendAdminCreatedAccountEmail, sendModeratorVerificationEmail } from "@/lib/email";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { createVerificationToken } from "@/lib/verification-token";
import {
  assignModeratorAccessByAdmin,
  createManagedAccountByAdmin,
  createModeratorAccountByAdmin,
  createTestAccountByAdmin,
  deleteUserAccountByAdmin,
  getPasswordResetPathForRole,
  getUserRoleStats,
  listManageableAccounts,
  listModeratorAccounts,
  revokeModeratorAccessByAdmin,
  sendPasswordResetByAdmin,
} from "@/lib/users";
import type { UserRole } from "@csn/db";

type SearchParams = {
  accountCreated?: string;
  created?: string;
  inviteFailed?: string;
  password?: string;
  moderatorAssigned?: string;
  moderatorRevoked?: string;
  resetSent?: string;
  testCreated?: string;
  userDeleted?: string;
  error?: string;
  errorMessage?: string;
};

type AdminUserFlash =
  | {
      kind: "test-account";
      role: UserRole;
      email: string;
      password: string;
      loginPath: string;
    }
  | {
      kind: "account-created";
      role: UserRole;
      email: string;
      setupPath: string;
      inviteFailed: boolean;
    };

const ADMIN_USERS_FLASH_COOKIE = "csn-admin-users-flash";

export const dynamic = "force-dynamic";

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return "";
  }

  return trimmed;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRedirectErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message.slice(0, 240);
    }
  }

  return fallback;
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function readAdminRole(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "FAN" || value === "ORGANIZER" || value === "MODERATOR" ? value : "";
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
}

async function setAdminUsersFlashCookie(value: AdminUserFlash) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_USERS_FLASH_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/users",
    maxAge: 5 * 60,
  });
}

async function readAdminUsersFlashCookie() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(ADMIN_USERS_FLASH_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AdminUserFlash;
  } catch {
    return null;
  }
}

async function createModerator(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const name = readRequiredString(formData, "name", 120);
  const email = readRequiredString(formData, "email", 320).toLowerCase();
  const password = readRequiredString(formData, "password", 200);
  const confirmPassword = readRequiredString(formData, "confirmPassword", 200);

  if (!name || !isValidEmail(email) || password.length < 8 || password !== confirmPassword) {
    redirect("/admin/users?error=moderator");
  }

  try {
    const user = await createModeratorAccountByAdmin({
      actorId: session.user.id,
      email,
      name,
      password,
    });
    const token = await createVerificationToken(user.id);
    const appUrl = getAppUrl();
    await sendModeratorVerificationEmail(email, `${appUrl}/moderator/verify?token=${token}`);
    redirect("/admin/users?created=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getRedirectErrorMessage(
      error,
      "Moderator creation failed. Check the name, email, and password fields.",
    );
    redirect(`/admin/users?error=moderator&errorMessage=${encodeURIComponent(message)}`);
  }
}

async function createManagedAccount(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const role = readAdminRole(formData, "role");
  const name = readRequiredString(formData, "name", 120);
  const email = readRequiredString(formData, "email", 320).toLowerCase();
  const organizerName = readOptionalString(formData, "organizerName", 120);

  if ((role !== "FAN" && role !== "ORGANIZER") || !name || !isValidEmail(email)) {
    redirect("/admin/users?error=account-create");
  }

  try {
    const user = await createManagedAccountByAdmin({
      actorId: session.user.id,
      role,
      email,
      name,
      organizerName,
    });
    const token = await createPasswordResetToken(user.id);
    const setupPath = `${getPasswordResetPathForRole(user.role)}?token=${token}`;

    try {
      await sendAdminCreatedAccountEmail(user.email, `${getAppUrl()}${setupPath}`, user.role);
      await setAdminUsersFlashCookie({
        kind: "account-created",
        role: user.role,
        email: user.email,
        setupPath,
        inviteFailed: false,
      });
      redirect("/admin/users?accountCreated=1");
    } catch (emailError) {
      await setAdminUsersFlashCookie({
        kind: "account-created",
        role: user.role,
        email: user.email,
        setupPath,
        inviteFailed: true,
      });
      const message = getRedirectErrorMessage(
        emailError,
        "Account was created, but the setup email could not be sent.",
      );
      redirect(
        `/admin/users?accountCreated=1&inviteFailed=1&errorMessage=${encodeURIComponent(message)}`,
      );
    }
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getRedirectErrorMessage(
      error,
      "Account creation failed. Check the name, email, and organizer fields.",
    );
    redirect(`/admin/users?error=account-create&errorMessage=${encodeURIComponent(message)}`);
  }
}

async function createTestAccount(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const role = readAdminRole(formData, "role");
  const name = readOptionalString(formData, "name", 120);
  const organizerName = readOptionalString(formData, "organizerName", 120);

  if (role !== "FAN" && role !== "ORGANIZER" && role !== "MODERATOR") {
    redirect("/admin/users?error=test-account");
  }

  try {
    const result = await createTestAccountByAdmin({
      actorId: session.user.id,
      role,
      name,
      organizerName,
    });
    await setAdminUsersFlashCookie({
      kind: "test-account",
      role: result.user.role,
      email: result.user.email,
      password: result.password,
      loginPath: result.loginPath,
    });
    redirect("/admin/users?testCreated=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getRedirectErrorMessage(
      error,
      "Test account creation failed. Check the role and organizer name fields.",
    );
    redirect(`/admin/users?error=test-account&errorMessage=${encodeURIComponent(message)}`);
  }
}

async function changeMyPassword(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const currentPassword = readRequiredString(formData, "currentPassword", 200);
  const nextPassword = readRequiredString(formData, "nextPassword", 200);
  const confirmPassword = readRequiredString(formData, "confirmPassword", 200);

  if (nextPassword.length < 12 || nextPassword !== confirmPassword) {
    redirect("/admin/users?error=password");
  }

  try {
    await updateAdminPassword({
      userId: session.user.id,
      currentPassword,
      nextPassword,
    });
    redirect("/admin/users?password=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/admin/users?error=password");
  }
}

async function assignModerator(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const userId = readRequiredString(formData, "userId", 120);

  if (!userId) {
    redirect("/admin/users?error=moderator-assign");
  }

  try {
    const user = await assignModeratorAccessByAdmin({
      actorId: session.user.id,
      userId,
    });
    if (user && !user.emailVerifiedAt) {
      const token = await createVerificationToken(user.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
      await sendModeratorVerificationEmail(user.email, `${appUrl}/moderator/verify?token=${token}`);
    }
    redirect("/admin/users?moderatorAssigned=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getRedirectErrorMessage(
      error,
      "Moderator assignment failed. Only member accounts can be promoted here.",
    );
    redirect(
      `/admin/users?error=moderator-assign&errorMessage=${encodeURIComponent(message)}`,
    );
  }
}

async function revokeModerator(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const moderatorUserId = readRequiredString(formData, "moderatorUserId", 120);

  if (!moderatorUserId) {
    redirect("/admin/users?error=moderator-revoke");
  }

  try {
    await revokeModeratorAccessByAdmin({
      actorId: session.user.id,
      moderatorUserId,
    });
    redirect("/admin/users?moderatorRevoked=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/admin/users?error=moderator-revoke");
  }
}

async function sendResetLink(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const userId = readRequiredString(formData, "userId", 120);

  if (!userId) {
    redirect("/admin/users?error=reset-send");
  }

  try {
    await sendPasswordResetByAdmin({
      actorId: session.user.id,
      userId,
    });
    redirect("/admin/users?resetSent=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = getRedirectErrorMessage(
      error,
      "Password reset email could not be sent.",
    );
    redirect(`/admin/users?error=reset-send&errorMessage=${encodeURIComponent(message)}`);
  }
}

async function deleteUser(formData: FormData) {
  "use server";

  const session = await requireAdminSession("/admin/users");
  const userId = readRequiredString(formData, "userId", 120);

  if (!userId || userId === session.user.id) {
    redirect("/admin/users?error=user-delete");
  }

  try {
    await deleteUserAccountByAdmin({
      actorId: session.user.id,
      userId,
    });
    redirect("/admin/users?userDeleted=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/admin/users?error=user-delete");
  }
}

function getMessage(sp: SearchParams) {
  if (sp.accountCreated === "1") {
    return sp.inviteFailed === "1"
      ? sp.errorMessage ?? "Account created. Send the setup link manually from the details below."
      : "Account created and setup email sent.";
  }

  if (sp.created === "1") {
    return "Moderator account created.";
  }

  if (sp.password === "1") {
    return "Admin password updated.";
  }

  if (sp.moderatorAssigned === "1") {
    return "Moderator access assigned.";
  }

  if (sp.moderatorRevoked === "1") {
    return "Moderator access revoked.";
  }

  if (sp.resetSent === "1") {
    return "Password reset email sent.";
  }

  if (sp.testCreated === "1") {
    return "Test account created.";
  }

  if (sp.userDeleted === "1") {
    return "User account deleted.";
  }

  if (sp.error === "moderator") {
    return sp.errorMessage ?? "Moderator creation failed. Check the name, email, and password fields.";
  }

  if (sp.error === "account-create") {
    return sp.errorMessage ?? "Account creation failed. Check the name, email, and organizer fields.";
  }

  if (sp.error === "password") {
    return "Password update failed. Check your current password and confirmation.";
  }

  if (sp.error === "moderator-assign") {
    return sp.errorMessage ?? "Moderator assignment failed. Only member accounts can be promoted here.";
  }

  if (sp.error === "moderator-revoke") {
    return "Moderator revoke failed.";
  }

  if (sp.error === "reset-send") {
    return sp.errorMessage ?? "Password reset email could not be sent.";
  }

  if (sp.error === "test-account") {
    return sp.errorMessage ?? "Test account creation failed.";
  }

  if (sp.error === "user-delete") {
    return "User deletion failed.";
  }

  return null;
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function isTestAccountEmail(email: string) {
  return (
    email.endsWith("@cardshownation.test") ||
    email.startsWith("portal-test-") ||
    email.startsWith("member-test-") ||
    email.startsWith("moderator-test-")
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, moderators, manageableAccounts, stats, auditLogs, sp, flash] = await Promise.all([
    requireAdminSession("/admin/users"),
    listModeratorAccounts(),
    listManageableAccounts(),
    getUserRoleStats(),
    getRecentAuditLogs(12),
    searchParams,
    readAdminUsersFlashCookie(),
  ]);

  const message = getMessage(sp);

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Manage account access, send password reset links, promote moderators, and review
          recent sensitive actions.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      {flash?.kind === "account-created" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-semibold">
            {flash.inviteFailed ? "Account created, but email delivery failed." : "Account ready."}
          </p>
          <p className="mt-2">
            {flash.email} can finish setup here:{" "}
            <a
              href={`${getAppUrl()}${flash.setupPath}`}
              className="font-semibold underline decoration-amber-400 underline-offset-2"
            >
              {getAppUrl()}
              {flash.setupPath}
            </a>
          </p>
        </div>
      )}

      {flash?.kind === "test-account" && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          <p className="font-semibold">Test account credentials</p>
          <p className="mt-2">
            {flash.role.toLowerCase()} login: <span className="font-mono">{flash.email}</span>
          </p>
          <p className="mt-1">
            Temporary password: <span className="font-mono">{flash.password}</span>
          </p>
          <p className="mt-1">
            Login page:{" "}
            <a
              href={`${getAppUrl()}${flash.loginPath}`}
              className="font-semibold underline decoration-sky-400 underline-offset-2"
            >
              {getAppUrl()}
              {flash.loginPath}
            </a>
          </p>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-5">
        <StatCard label="Fans" value={String(stats.fans)} />
        <StatCard label="Moderators" value={String(stats.moderators)} />
        <StatCard label="Promoters" value={String(stats.promoters)} />
        <StatCard label="Admins" value={String(stats.admins)} />
        <StatCard label="State subscriptions" value={String(stats.subscriptions)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Create member or promoter</h2>
          <p className="mt-2 text-sm text-slate-500">
            Create the account, email them a setup link, and let them choose their own password.
          </p>

          <form action={createManagedAccount} className="mt-5 space-y-4">
            <select
              name="role"
              defaultValue="FAN"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="FAN">Member account</option>
              <option value="ORGANIZER">Promoter account</option>
            </select>
            <input
              name="name"
              type="text"
              placeholder="Contact name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              name="email"
              type="email"
              placeholder="person@example.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              name="organizerName"
              type="text"
              placeholder="Organizer name (promoter accounts only)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Create and send setup email
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Create moderator</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use this when you need a dedicated moderator login. Existing member accounts can be
            promoted from the account list below.
          </p>

          <form action={createModerator} className="mt-5 space-y-4">
            <input
              name="name"
              type="text"
              placeholder="Moderator name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              name="email"
              type="email"
              placeholder="moderator@example.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                name="password"
                type="password"
                placeholder="Temporary password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Create moderator
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Create internal test account</h2>
          <p className="mt-2 text-sm text-slate-500">
            Generate a ready-to-use test login for QA. These accounts are auto-verified and do
            not send any outbound email.
          </p>

          <form action={createTestAccount} className="mt-5 space-y-4">
            <select
              name="role"
              defaultValue="FAN"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="FAN">Member test account</option>
              <option value="ORGANIZER">Promoter test account</option>
              <option value="MODERATOR">Moderator test account</option>
            </select>
            <input
              name="name"
              type="text"
              placeholder="Display name (optional)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              name="organizerName"
              type="text"
              placeholder="Organizer name (promoter tests only)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100"
            >
              Create test account
            </button>
          </form>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Rotate admin password</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your current admin account is {session.user.email}. Use at least 12 characters for
            the replacement password.
          </p>

          <form action={changeMyPassword} className="mt-5 space-y-4">
            <input
              name="currentPassword"
              type="password"
              placeholder="Current password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                name="nextPassword"
                type="password"
                placeholder="New password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Update password
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Moderators</h2>
          </div>
          {moderators.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No moderator accounts yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {moderators.map((moderator) => (
                <div key={moderator.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {moderator.name ?? moderator.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {moderator.email} · {moderator._count.moderatedSubmissions} reviewed
                    submissions
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={sendResetLink}>
                      <input type="hidden" name="userId" value={moderator.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                      >
                        Send reset email
                      </button>
                    </form>
                    <form action={revokeModerator}>
                      <input type="hidden" name="moderatorUserId" value={moderator.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        Revoke moderator
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent audit log</h2>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No audit entries yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">{entry.action}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.actor?.name ?? entry.actor?.email ?? "System"} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.targetId && (
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.targetType}: {entry.targetId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">All non-admin accounts</h2>
        </div>

        {manageableAccounts.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No accounts found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {manageableAccounts.map((account) => {
              const canPromote = account.role === "FAN";
              const isModerator = account.role === "MODERATOR";
              const isOrganizer = account.role === "ORGANIZER";

              return (
                <div key={account.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {account.name ?? account.email}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          {formatRole(account.role)}
                        </span>
                        {isTestAccountEmail(account.email) && (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                            Test account
                          </span>
                        )}
                        {account.organizer?.verified && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            Verified promoter
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{account.email}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Created {new Date(account.createdAt).toLocaleDateString()} ·{" "}
                        {account._count.subscriptions} subscriptions · {account._count.savedShows} saved
                        shows
                        {isModerator
                          ? ` · ${account._count.moderatedSubmissions} reviewed submissions`
                          : ""}
                        {isOrganizer && account.organizer
                          ? ` · Organizer: ${account.organizer.name}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form action={sendResetLink}>
                        <input type="hidden" name="userId" value={account.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                        >
                          Send reset email
                        </button>
                      </form>

                      {canPromote && (
                        <form action={assignModerator}>
                          <input type="hidden" name="userId" value={account.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                          >
                            Make moderator
                          </button>
                        </form>
                      )}

                      <form action={deleteUser}>
                        <input type="hidden" name="userId" value={account.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          Delete account
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
