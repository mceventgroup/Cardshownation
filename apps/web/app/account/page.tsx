import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutUser } from "@/app/account/actions";
import { US_STATES } from "@/lib/states";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import {
  getUserSession,
  getUserSessionSecret,
  getUserSessionSecretStatus,
  MIN_USER_SESSION_SECRET_LENGTH,
  requireUserSession,
} from "@/lib/user-auth";
import { getFanAccountData, updateFanProfile, updateFanStateSubscriptions } from "@/lib/users";

export const dynamic = "force-dynamic";

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.slice(0, maxLength);
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

async function saveProfile(formData: FormData) {
  "use server";

  const session = await requireUserSession("/account");

  try {
    const result = await updateFanProfile({
      userId: session.user.id,
      name: readRequiredString(formData, "name", 120),
      email: readRequiredString(formData, "email", 320),
      phone: readOptionalString(formData, "phone", 40),
      city: readOptionalString(formData, "city", 80),
      state: readOptionalString(formData, "state", 2),
    });

    redirect(result.emailChanged ? "/account?profile=verify" : "/account?profile=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : "We couldn't update your profile right now.";
    redirect(`/account?error=${encodeURIComponent(message)}`);
  }
}

async function saveSubscriptions(formData: FormData) {
  "use server";

  const session = await requireUserSession("/account");
  const stateCodes = formData
    .getAll("stateCodes")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  await updateFanStateSubscriptions(session.user.id, stateCodes);
  redirect("/account?updated=1");
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; profile?: string; error?: string }>;
}) {
  const [session, secret, secretStatus, sp] = await Promise.all([
    getUserSession(),
    getUserSessionSecret(),
    getUserSessionSecretStatus(),
    searchParams,
  ]);

  if (!secret) {
    return (
      <div className="container-narrow py-10">
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">Member accounts unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Set a session secret to enable user accounts</h1>
          <p className="mt-4 text-base leading-7">
            {secretStatus.error === "too_short"
              ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
              : "Add `USER_SESSION_SECRET` to the web app environment, then reload this page."}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container-wide py-6 sm:py-10">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Member account
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Save the states you want email alerts for
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Create a simple fan account to follow upcoming shows by state. Email notifications are the first step, with SMS and push preferences reserved for later.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/account/signup"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Create account
            </Link>
            <Link
              href="/account/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const account = await getFanAccountData(session.user.id);
  if (!account) {
    redirect("/account/login");
  }

  const selectedStates = new Set(account.subscriptions.map((subscription) => subscription.stateCode));
  const successMessage =
    sp.profile === "verify"
      ? "Profile saved. Check your new email inbox for a verification link before your next login."
      : sp.profile === "1"
        ? "Profile updated."
        : sp.updated === "1"
          ? "State subscriptions updated."
          : null;

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                Member account
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {account.name ?? account.email}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Keep your profile current and manage the states you want to follow for future show alerts.
              </p>
            </div>

            <form action={logoutUser}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Log out
              </button>
            </form>
          </div>

          {successMessage && (
            <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {successMessage}
            </p>
          )}

          {sp.error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {sp.error}
            </p>
          )}

          <form action={saveProfile} className="mt-8 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Update the profile details tied to your member account.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account profile</p>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={account.name ?? ""}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    defaultValue={account.email}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={account.phone ?? ""}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    defaultValue={account.city ?? ""}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="state" className="mb-2 block text-sm font-medium text-slate-700">
                    Home state
                  </label>
                  <select
                    id="state"
                    name="state"
                    defaultValue={account.state ?? ""}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  >
                    <option value="">Select a state</option>
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Changing your email will send a fresh verification link to the new address.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Save profile
            </button>
          </form>

          <form action={saveSubscriptions} className="mt-8 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Email alerts</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Toggle the states you want to follow.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">SMS / push later</p>
              </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {US_STATES.map((state) => (
                  <label
                    key={state.code}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="stateCodes"
                      value={state.code}
                      defaultChecked={selectedStates.has(state.code)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{state.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Save subscriptions
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Account stats
            </p>
            <div className="mt-4 grid gap-4">
              <StatCard label="Tracked states" value={String(account.subscriptions.length)} />
              <StatCard label="Saved shows" value={String(account._count.savedShows)} />
              <StatCard label="Delivery" value="Email first" />
              <StatCard
                label="Email status"
                value={account.emailVerifiedAt ? "Verified" : "Needs verification"}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
