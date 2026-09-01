import { redirect } from "next/navigation";
import { StateMultiSelect } from "@/components/account/signup-form-controls";
import { requireModeratorSession } from "@/lib/moderator-auth";
import { getModeratorAccountData } from "@/lib/moderators";
import { US_STATES } from "@/lib/states";
import {
  listFavoriteOrganizerOptions,
  updateFanFavoriteOrganizers,
  updateFanStateSubscriptions,
} from "@/lib/users";

export const dynamic = "force-dynamic";

async function saveFollows(formData: FormData) {
  "use server";

  const session = await requireModeratorSession("/moderator/account");
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

  redirect("/moderator/account?updated=1");
}

export default async function ModeratorAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const session = await requireModeratorSession("/moderator/account");
  const [account, sp] = await Promise.all([
    getModeratorAccountData(session.user.id),
    searchParams,
  ]);

  if (!account) {
    redirect("/moderator/login");
  }

  const selectedStateCodes = account.subscriptions.map((subscription) => subscription.stateCode);
  const favoriteOrganizers = await listFavoriteOrganizerOptions(selectedStateCodes);
  const selectedOrganizerIds = new Set(
    account.favoriteOrganizers.map((favorite) => favorite.organizerId),
  );

  return (
    <div className="container-wide py-4 sm:py-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 sm:text-sm sm:tracking-[0.2em]">
          Moderator account
        </p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950 sm:mt-3 sm:text-4xl">
          {account.name ?? "Account settings"}
        </h1>
        <p className="mt-2 break-all text-sm text-slate-500 sm:mt-3 sm:break-normal">
          {account.email}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          Choose the states and show hosts you want to follow. These preferences stay with your
          account while you use the moderator tools.
        </p>

        {sp.updated === "1" && (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Follow preferences saved.
          </p>
        )}

        <form action={saveFollows} className="mt-6 space-y-6 sm:mt-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
            <h2 className="text-lg font-semibold text-slate-950">States you follow</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Select one or more states for show alerts and regional preferences.
            </p>
            <StateMultiSelect
              states={US_STATES}
              defaultSelectedCodes={selectedStateCodes}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
            <h2 className="text-lg font-semibold text-slate-950">Favorite show hosts</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Choose promoters with upcoming shows in your followed states.
            </p>

            {favoriteOrganizers.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-500">
                Select and save states first, then return here to see matching promoters.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {favoriteOrganizers.map((organizer) => (
                  <label
                    key={organizer.id}
                    className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="organizerIds"
                      value={organizer.id}
                      defaultChecked={selectedOrganizerIds.has(organizer.id)}
                      className="mt-0.5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-slate-900">
                        {organizer.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {organizer.verified ? "Verified promoter" : "Promoter profile"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
          >
            Save follows
          </button>
        </form>
      </section>
    </div>
  );
}
