import Link from "next/link";
import { redirect } from "next/navigation";
import {
  openFloorplannerBillingPortal,
  startFloorplannerCheckout,
} from "@/app/floorplanner/actions";
import {
  getFloorplannerSubscription,
  isFloorplannerSubscriptionActive,
} from "@/lib/floorplanner-billing";
import {
  getFloorplannerCustomerSession,
  getFloorplannerWorkspaceSession,
} from "@/lib/floorplanner-workspace-auth";
import { FLOORPLANNER_MONTHLY_PRICE_LABEL } from "@/lib/stripe";
import {
  isPurchasingEnabled,
  PURCHASING_PAUSED_MESSAGE,
} from "@/lib/purchasing";

export const dynamic = "force-dynamic";

export default async function FloorplannerBillingPage() {
  const customerSession = await getFloorplannerCustomerSession();
  if (!customerSession) {
    const staffSession = await getFloorplannerWorkspaceSession();
    if (staffSession?.role === "ADMIN") redirect("/admin/floorplanner");
    if (staffSession?.role === "MODERATOR") redirect("/moderator/floorplanner");
    redirect("/login?from=%2Ffloorplanner%2Fbilling");
  }

  const subscription = await getFloorplannerSubscription(customerSession.user.id);
  const paidAccess = isFloorplannerSubscriptionActive(subscription);
  const complimentary =
    !paidAccess &&
    customerSession.role === "ORGANIZER" &&
    Boolean(customerSession.organizer?.floorplanEnabled);
  const active = complimentary || paidAccess;
  const purchasingEnabled = isPurchasingEnabled();

  return (
    <div className="container-narrow py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Floor Planner Billing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {active ? "Your floor planner is active" : "Floor planner access"}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {purchasingEnabled
            ? `One active cloud project for ${FLOORPLANNER_MONTHLY_PRICE_LABEL} per month.`
            : PURCHASING_PAUSED_MESSAGE}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Detail
            label="Access"
            value={complimentary ? "Complimentary" : active ? "Active" : "Inactive"}
          />
          <Detail
            label="Billing status"
            value={complimentary ? "Admin granted" : subscription?.status ?? "Not subscribed"}
          />
          <Detail
            label="Renews / ends"
            value={
              complimentary
                ? "No billing date"
                : subscription?.currentPeriodEnd
                  ? subscription.currentPeriodEnd.toLocaleDateString()
                  : "—"
            }
          />
          <Detail
            label="Cancellation"
            value={subscription?.cancelAtPeriodEnd ? "Ends after current period" : "Not scheduled"}
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {active && (
            <Link
              href="/floorplanner/workspace"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Open workspace
            </Link>
          )}
          {subscription ? (
            <form action={openFloorplannerBillingPortal}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
              >
                Manage in Stripe
              </button>
            </form>
          ) : !complimentary && purchasingEnabled ? (
            <form action={startFloorplannerCheckout}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
              >
                Subscribe
              </button>
            </form>
          ) : !complimentary ? (
            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-500">
              New subscriptions paused
            </span>
          ) : null}
          <Link
            href={customerSession.role === "ORGANIZER" ? "/promoter" : "/account"}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
