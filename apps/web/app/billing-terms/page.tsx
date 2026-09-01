import type { Metadata } from "next";
import Link from "next/link";
import { FLOORPLANNER_MONTHLY_PRICE_LABEL } from "@/lib/stripe";
import { LegalContact, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Billing Terms", description: "Floor Planner subscription, renewal, cancellation, and refund terms." };

const sections = [
  { id: "plan", label: "Plan and authorization" }, { id: "renewal", label: "Automatic renewal" },
  { id: "cancellation", label: "Cancellation" }, { id: "refunds", label: "Refunds" },
  { id: "changes", label: "Price and service changes" }, { id: "contact", label: "Billing support" },
];

export default function BillingTermsPage() {
  return (
    <LegalPage title="Billing Terms" summary="These terms apply to paid Floor Planner subscriptions and supplement the Terms of Use." updated="September 1, 2026" currentPath="/billing-terms" sections={sections}>
      <LegalSection id="plan" title="1. Plan and payment authorization">
        <p>The current Floor Planner offer provides one active cloud project for {FLOORPLANNER_MONTHLY_PRICE_LABEL} per month, unless a different price or plan is clearly shown before checkout. Applicable taxes may be added.</p>
        <p>By subscribing, you authorize Stripe and MC Event Group LLC, doing business as Card Show Nation, to charge the payment method you provide for the initial period and each renewal. Stripe handles payment credentials under its own terms and privacy policy; Card Show Nation receives transaction and subscription status rather than your full card number.</p>
      </LegalSection>
      <LegalSection id="renewal" title="2. Automatic renewal">
        <p>Your subscription renews monthly until canceled. The billing page and Stripe portal show the current status and renewal or end date. Failed payments may result in restricted or suspended paid access.</p>
      </LegalSection>
      <LegalSection id="cancellation" title="3. Cancellation">
        <p>You may cancel through <Link href="/floorplanner/billing" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Floor Planner Billing</Link> and the Stripe billing portal. Cancellation normally takes effect at the end of the current paid period, and access continues until that date. Deleting an account may be unavailable until an active subscription is canceled and its paid period ends.</p>
      </LegalSection>
      <LegalSection id="refunds" title="4. Refunds">
        <p>All subscription charges are final and non-refundable once charged, except where a refund is required by law. We do not provide prorated refunds or credits for partial billing periods, unused time, cancellation, or failure to use the service. Cancel before your next renewal to avoid another charge.</p>
        <p>If you believe a charge is unauthorized, duplicated, or incorrect, contact support promptly with the account email and charge date. This no-refund policy does not limit any non-waivable consumer rights.</p>
      </LegalSection>
      <LegalSection id="changes" title="5. Price, plan, and service changes">
        <p>We may change pricing, plan features, or availability. A price change for an existing recurring subscription will receive advance notice when required and will apply no earlier than a future renewal. Complimentary access may be changed or withdrawn because it is not a paid subscription.</p>
      </LegalSection>
      <LegalSection id="contact" title="6. Billing support">
        <LegalContact><p className="font-semibold text-slate-950">MC Event Group LLC</p><address className="mt-1 not-italic">PO Box 655<br />Moundridge, KS 67107</address><p className="mt-2">Email <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a> with questions about a charge or cancellation. Do not send full card numbers or account passwords.</p></LegalContact>
      </LegalSection>
    </LegalPage>
  );
}
