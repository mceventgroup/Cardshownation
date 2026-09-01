import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteMyAccount, logoutUser, unsubscribeAllEmail } from "@/app/account/actions";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import { US_STATES } from "@/lib/states";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import {
  getUserSession,
  getUserSessionSecret,
  getUserSessionSecretStatus,
  MIN_USER_SESSION_SECRET_LENGTH,
  requireUserSession,
  startUserSession,
} from "@/lib/user-auth";
import {
  changeFanPassword,
  getFanAccountData,
  listFavoriteOrganizerOptions,
  updateFanFavoriteOrganizers,
  updateFanProfile,
  updateFanStateSubscriptions,
} from "@/lib/users";
import { endUserSession } from "@/lib/user-auth";
import { enablePromoterAccess } from "@/lib/promoters";
import { startPromoterSession } from "@/lib/promoter-auth";
import { StateMultiSelect } from "@/components/account/signup-form-controls";

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

    if (result.emailChanged) {
      await endUserSession();
      redirect("/account/login?verify=1");
    }

    redirect("/account?profile=1");
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
  const organizerIds = formData
    .getAll("organizerIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  await Promise.all([
    updateFanStateSubscriptions(session.user.id, stateCodes),
    updateFanFavoriteOrganizers(session.user.id, organizerIds),
  ]);
  redirect("/account?updated=1");
}

async function savePassword(formData: FormData) {
  "use server";

  const session = await requireUserSession("/account");
  const currentPassword = readPasswordInput(formData, "currentPassword");
  const nextPassword = readPasswordInput(formData, "nextPassword");
  const confirmPassword = readPasswordInput(formData, "confirmPassword");

  if (
    !currentPassword ||
    !nextPassword ||
    nextPassword.length < MIN_PASSWORD_LENGTH ||
    nextPassword !== confirmPassword
  ) {
    redirect("/account?error=password");
  }

  try {
    await changeFanPassword({
      userId: session.user.id,
      currentPassword,
      nextPassword,
    });
    await startUserSession(session.user.id);
    redirect("/account?password=1");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/account?error=password");
  }
}

async function becomePromoter(formData: FormData) {
  "use server";

  const session = await requireUserSession("/account");
  try {
    await enablePromoterAccess({
      userId: session.user.id,
      organizerName: readRequiredString(formData, "organizerName", 160),
      websiteUrl: readOptionalString(formData, "websiteUrl", 2048),
      facebookUrl: readOptionalString(formData, "facebookUrl", 2048),
      instagramUrl: readOptionalString(formData, "instagramUrl", 2048),
    });
    await Promise.all([startUserSession(session.user.id), startPromoterSession(session.user.id)]);
    redirect("/promoter");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/account?error=promoter");
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; profile?: string; password?: string; unsubscribed?: string; error?: string }>;
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
  const selectedStateCodes = account.subscriptions.map((subscription) => subscription.stateCode);
  const favoriteOrganizers = await listFavoriteOrganizerOptions(selectedStateCodes);
  const selectedOrganizerIds = new Set(
    account.favoriteOrganizers.map((favoriteOrganizer) => favoriteOrganizer.organizerId)
  );
  const successMessage =
    sp.profile === "verify"
      ? "Profile saved. Check your new email inbox for a verification link before your next login."
      : sp.profile === "1"
        ? "Profile updated."
        : sp.password === "1"
          ? "Password updated."
        : sp.unsubscribed === "1"
          ? "You are unsubscribed from all state alert email."
        : sp.updated === "1"
          ? "State subscriptions updated."
          : null;
  const errorMessage =
    sp.error === "delete"
      ? "Account deletion failed. Enter your current password and type DELETE exactly."
      : sp.error === "billing"
        ? "Cancel your floor-planner subscription and wait for it to end before deleting your account."
      : sp.error === "promoter"
        ? "We couldn't add promoter tools. Enter your organizer or business name and try again."
      : sp.error === "password"
      ? `Password update failed. Check your current password and make sure the new one is at least ${MIN_PASSWORD_LENGTH} characters.`
      : sp.error ?? null;

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                Collector dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {account.name ?? account.email}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Find your next card show, keep favorites close, and help other collectors discover events near you.
              </p>
            </div>

            <form action={logoutUser}>
              <button
                type="submit"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Log out
              </button>
            </form>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              href="/card-shows"
              className="inline-flex min-h-24 flex-col justify-between rounded-3xl bg-slate-950 p-5 text-white transition-colors hover:bg-slate-800"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Discover</span>
              <span className="mt-4 text-lg font-semibold">Browse card shows</span>
            </Link>
            <Link
              href="/submit-show"
              className="inline-flex min-h-24 flex-col justify-between rounded-3xl bg-brand-600 p-5 text-white transition-colors hover:bg-brand-700"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">Help the community</span>
              <span className="mt-4 text-lg font-semibold">Submit a show</span>
            </Link>
            <a
              href="#collector-preferences"
              className="inline-flex min-h-24 flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-950 transition-colors hover:bg-slate-100"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Personalize</span>
              <span className="mt-4 text-lg font-semibold">Manage alerts</span>
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tracked states" value={String(account.subscriptions.length)} />
            <StatCard label="Favorite organizers" value={String(account.favoriteOrganizers.length)} />
            <StatCard label="Saved shows" value={String(account._count.savedShows)} />
            <StatCard label="Email" value={account.emailVerifiedAt ? "Verified" : "Verify"} />
          </div>

          {successMessage && (
            <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <div id="collector-preferences" className="mt-10 scroll-mt-28">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Account settings</p>
            <p className="mt-2 text-sm text-slate-600">Open only the section you want to change.</p>
          </div>

          <details className="group mt-5 rounded-3xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-950 marker:content-none">
              <span>Profile information</span>
              <span className="text-brand-700 group-open:hidden">Edit</span>
              <span className="hidden text-brand-700 group-open:inline">Close</span>
            </summary>
          <form action={saveProfile} className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
              className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
            >
              Save profile
            </button>
          </form>
          </details>

          <details className="group mt-4 rounded-3xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-950 marker:content-none">
              <span>Show alerts and favorite organizers</span>
              <span className="text-brand-700 group-open:hidden">Manage</span>
              <span className="hidden text-brand-700 group-open:inline">Close</span>
            </summary>
          <form action={saveSubscriptions} className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Email alerts</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Toggle the states and promoters you want to follow.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">SMS / push later</p>
              </div>

              <StateMultiSelect
                states={US_STATES}
                defaultSelectedCodes={selectedStateCodes}
              />

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Favorite show hosts</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose promoters with upcoming shows in your followed states.
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Promoters</p>
                </div>

                {favoriteOrganizers.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Promoter favorites will appear here once more upcoming shows are linked to hosts.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {favoriteOrganizers.map((organizer) => (
                      <label
                        key={organizer.id}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="organizerIds"
                          value={organizer.id}
                          defaultChecked={selectedOrganizerIds.has(organizer.id)}
                          className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>
                          <span className="block font-medium text-slate-900">{organizer.name}</span>
                          <span className="block text-xs text-slate-500">
                            {organizer.verified ? "Verified promoter" : "Promoter profile"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
            >
              Save subscriptions
            </button>
          </form>
          </details>

          <details className="group mt-4 rounded-3xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-950 marker:content-none">
              <span>Password and security</span>
              <span className="text-brand-700 group-open:hidden">Update</span>
              <span className="hidden text-brand-700 group-open:inline">Close</span>
            </summary>
          <form action={savePassword} className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Password</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Change your password and automatically invalidate older sessions on other devices.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Security</p>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-slate-700">
                    Current password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="nextPassword" className="mb-2 block text-sm font-medium text-slate-700">
                    New password
                  </label>
                  <input
                    id="nextPassword"
                    name="nextPassword"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
            >
              Update password
            </button>
          </form>
          </details>
        </section>

        <aside className="space-y-6">
          {account.role === "ORGANIZER" ? (
            <section className="rounded-[2rem] border border-brand-200 bg-brand-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Promoter tools</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">Your promoter profile is connected</h2>
              <Link href="/promoter" className="mt-5 inline-flex rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Open promoter dashboard</Link>
            </section>
          ) : (
            <section className="rounded-[2rem] border border-brand-200 bg-brand-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Organize card shows?</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">Add promoter tools to this account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Keep all your collector features and use the same login.</p>
              <form action={becomePromoter} className="mt-5 space-y-3">
                <div>
                  <label htmlFor="promoter-organizer-name" className="mb-1.5 block text-sm font-medium text-slate-700">Organizer or business name</label>
                  <input id="promoter-organizer-name" name="organizerName" required autoComplete="organization" className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm" />
                </div>
                <div>
                  <label htmlFor="promoter-website" className="mb-1.5 block text-sm font-medium text-slate-700">Website <span className="font-normal text-slate-500">(optional)</span></label>
                  <input id="promoter-website" name="websiteUrl" type="url" autoComplete="url" className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm" />
                </div>
                <button type="submit" className="inline-flex rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Become a promoter</button>
              </form>
            </section>
          )}

          <section className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-800">
              Floor Planner
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              Build your show layout
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              One active cloud floor plan for $19.99 per month, available to members and
              promoters.
            </p>
            <Link
              href="/floorplanner"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              View floor planner
            </Link>
          </section>
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-slate-950">Email choices</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Stop all state alert email. You can re-enable states later.</p>
            <form action={unsubscribeAllEmail} className="mt-4">
              <button className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Unsubscribe from alerts</button>
            </form>
          </section>
          <details className="group rounded-[2rem] border border-red-200 bg-red-50 p-6">
            <summary className="cursor-pointer list-none font-semibold text-red-900 marker:content-none">Delete account</summary>
            <p id="delete-account-help" className="mt-3 text-sm leading-6 text-red-800">This permanently deletes your login profile, preferences, saved shows, and account-linked cloud layouts. Public show or organizer records may remain without the login attached. Type DELETE{account.passwordHash ? " and enter your password" : " and account email"} to confirm.</p>
            <form action={deleteMyAccount} className="mt-4 space-y-3">
              <div>
                <label htmlFor="delete-confirmation" className="mb-1.5 block text-sm font-medium text-red-900">Confirmation</label>
                <input id="delete-confirmation" name="deleteConfirmation" required aria-describedby="delete-account-help" placeholder="Type DELETE" className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-950" />
              </div>
              {account.passwordHash ? (
                <div>
                  <label htmlFor="delete-password" className="mb-1.5 block text-sm font-medium text-red-900">Current password</label>
                  <input id="delete-password" name="deletePassword" type="password" required autoComplete="current-password" className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-950" />
                </div>
              ) : (
                <div>
                  <label htmlFor="delete-email" className="mb-1.5 block text-sm font-medium text-red-900">Account email</label>
                  <input id="delete-email" name="deleteEmail" type="email" required autoComplete="email" className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-950" />
                  <input type="hidden" name="deletePassword" value="" />
                </div>
              )}
              {account.passwordHash ? <input type="hidden" name="deleteEmail" value="" /> : null}
              <button className="w-full rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white sm:w-auto">Permanently delete account</button>
            </form>
          </details>
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
