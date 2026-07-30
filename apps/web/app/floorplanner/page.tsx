import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  openFloorplannerBillingPortal,
  startFloorplannerCheckout,
} from "@/app/floorplanner/actions";
import {
  getFloorplannerSubscription,
  isFloorplannerSubscriptionActive,
  syncFloorplannerCheckoutSession,
} from "@/lib/floorplanner-billing";
import {
  getFloorplannerCustomerSession,
  getFloorplannerWorkspaceSession,
} from "@/lib/floorplanner-workspace-auth";
import {
  FLOORPLANNER_MONTHLY_PRICE_LABEL,
  getStripeConfigStatus,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Floor Planner",
  description:
    "Build one professional card-show floor plan with cloud saves, vendor assignments, and exports.",
};

export default async function FloorplannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    billing?: string;
    checkout?: string;
    session_id?: string;
  }>;
}) {
  const sp = await searchParams;
  const workspaceSession = await getFloorplannerWorkspaceSession();

  if (workspaceSession?.role === "ADMIN") {
    redirect("/admin/floorplanner");
  }
  if (workspaceSession?.role === "MODERATOR") {
    redirect("/moderator/floorplanner");
  }
  if (workspaceSession) {
    redirect("/floorplanner/workspace");
  }

  const customerSession = await getFloorplannerCustomerSession();

  if (
    customerSession &&
    sp.checkout === "success" &&
    typeof sp.session_id === "string" &&
    sp.session_id
  ) {
    let checkoutActivated = false;
    try {
      const subscription = await syncFloorplannerCheckoutSession(
        sp.session_id,
        customerSession.user.id,
      );
      checkoutActivated = isFloorplannerSubscriptionActive(subscription);
    } catch (error) {
      console.error("[floorplanner checkout] immediate sync failed", error);
    }
    if (checkoutActivated) {
      redirect("/floorplanner/workspace");
    }
  }

  const subscription = customerSession
    ? await getFloorplannerSubscription(customerSession.user.id)
    : null;
  const stripeReady = getStripeConfigStatus().ready;
  const needsBillingRepair =
    subscription &&
    !["canceled", "incomplete_expired"].includes(subscription.status);

  return (
    <div className="bg-slate-950 text-white">
      <section className="container-wide py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Card Show Nation Floor Planner
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Plan your show once. Keep every table and vendor organized.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Build one active floor plan with cloud saving, table numbering, vendor
              assignments, printable layouts, and show-day check-in tools.
            </p>

            {sp.checkout === "cancelled" && (
              <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Checkout was cancelled. Nothing was charged.
              </p>
            )}
            {sp.checkout === "success" && (
              <p className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                Payment was received. Stripe is finishing your subscription setup; refresh
                this page in a moment if the workspace does not open automatically.
              </p>
            )}
            {sp.billing === "unavailable" && (
              <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                Billing is temporarily unavailable. Please try again shortly.
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {customerSession ? (
                needsBillingRepair ? (
                  <form action={openFloorplannerBillingPortal}>
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 sm:w-auto"
                    >
                      Fix billing in Stripe
                    </button>
                  </form>
                ) : (
                  <form action={startFloorplannerCheckout}>
                    <button
                      type="submit"
                      disabled={!stripeReady}
                      className="inline-flex w-full items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {stripeReady ? "Start my floor plan" : "Purchases temporarily unavailable"}
                    </button>
                  </form>
                )
              ) : (
                <>
                  <Link
                    href="/login?from=%2Ffloorplanner"
                    className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
                  >
                    Log in to subscribe
                  </Link>
                  <Link
                    href="/account/signup"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-900"
                  >
                    Create an account
                  </Link>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Members and promoters can subscribe. Promoter trust status does not affect the
              price or planner access.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-700 bg-white p-7 text-slate-950 shadow-2xl shadow-cyan-950/30 sm:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              One-show plan
            </p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight">
                {FLOORPLANNER_MONTHLY_PRICE_LABEL}
              </span>
              <span className="pb-1 text-base text-slate-500">/ month</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              One active cloud floor plan. Edit it as often as you need while your
              subscription is active.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-slate-700">
              {[
                "One active cloud project",
                "Unlimited edits and browser backups",
                "Vendor and table assignments",
                "PNG, CSV, and printable exports",
                "Show-day check-in mode",
                "Cancel from the Stripe billing portal",
              ].map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              Your browser copy remains on your device. Cloud access requires an active
              subscription.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
