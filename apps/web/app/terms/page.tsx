import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Rules for using Card Show Nation, submitting listings, and using promoter and Floor Planner tools.",
};

const sections = [
  { id: "agreement", label: "Agreement to these terms" }, { id: "accounts", label: "Eligibility and accounts" },
  { id: "listings", label: "Listings and user content" }, { id: "acceptable-use", label: "Acceptable use" },
  { id: "events", label: "Events and third parties" }, { id: "floorplanner", label: "Floor Planner" },
  { id: "billing", label: "Subscriptions and billing" }, { id: "intellectual-property", label: "Intellectual property" },
  { id: "disclaimers", label: "Disclaimers and liability" }, { id: "termination", label: "Termination and changes" },
  { id: "governing-law", label: "Governing law and disputes" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" summary="These terms govern access to Card Show Nation's directory, accounts, promoter tools, submissions, and Floor Planner." updated="September 1, 2026" currentPath="/terms" sections={sections}>
      <LegalSection id="agreement" title="1. Agreement to these terms">
        <p>Card Show Nation is operated by MC Event Group LLC, a Kansas limited liability company. By accessing or using Card Show Nation, you agree to these Terms of Use and our <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Privacy Policy</Link>. If you do not agree, do not use the service. If you use the service for a business or organization, you represent that you can accept these terms for it.</p>
      </LegalSection>
      <LegalSection id="accounts" title="2. Eligibility and accounts">
        <p>You must be at least 13 years old to create an account. If you are under the age of legal majority where you live, use the service only with permission from a parent or legal guardian.</p>
        <LegalList>
          <li>Provide accurate, current information and keep it updated.</li>
          <li>Keep credentials confidential and promptly report suspected unauthorized access.</li>
          <li>Do not create accounts for deceptive, abusive, or unlawful purposes.</li>
          <li>You are responsible for activity performed through your account unless prohibited by law.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="listings" title="3. Listings and user content">
        <p>You remain responsible for listings, flyers, floor plans, vendor information, links, and other material you submit. You represent that the information is accurate to the best of your knowledge and that you have the rights and permissions needed to submit and publish it.</p>
        <p>You retain ownership of your content. You grant Card Show Nation a worldwide, non-exclusive, royalty-free license to host, store, reproduce, format, display, and distribute it as needed to operate, promote, secure, and improve the service. This license ends when the content is deleted from active systems, except for public event, venue, or organizer records retained for directory or recordkeeping purposes, information copied by others, legal records, and temporary backups.</p>
        <p>We may edit listing formatting, correct apparent errors, merge duplicates, request verification, decline publication, or remove content. Submission does not guarantee publication or ranking.</p>
      </LegalSection>
      <LegalSection id="acceptable-use" title="4. Acceptable use">
        <p>Do not:</p>
        <LegalList>
          <li>Break the law, infringe rights, impersonate others, misrepresent an event, or submit deceptive content.</li>
          <li>Upload malware, harmful code, unlawful material, or sensitive personal information without authorization.</li>
          <li>Probe, bypass, disable, or interfere with authentication, rate limits, security, availability, or access controls.</li>
          <li>Scrape or automate access in a manner that burdens the service, circumvents controls, or violates applicable law.</li>
          <li>Use data from the service to spam, harass, discriminate, or build unauthorized profiles of people.</li>
          <li>Resell or commercially exploit the service except through a written agreement with Card Show Nation.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="events" title="5. Events, promoters, and third parties">
        <p>Card Show Nation is a directory and planning service, not the organizer, venue, ticket seller, insurer, or guarantor of listed events unless expressly stated. Promoters control event dates, admission, vendor arrangements, rules, accessibility, refunds, and cancellations.</p>
        <p>Verify important details directly with the promoter before traveling, paying, or entering an agreement. Transactions with promoters, vendors, venues, and linked services are between you and those parties. Third-party terms and privacy policies may apply.</p>
      </LegalSection>
      <LegalSection id="floorplanner" title="6. Floor Planner">
        <p>The Floor Planner is a planning aid, not architectural, engineering, fire-code, occupancy, accessibility, or legal advice. Organizers remain responsible for measurements, aisle widths, exits, capacity, emergency access, accessibility, venue requirements, and approval by qualified professionals or authorities.</p>
        <p>Keep independent backups of important layouts and exports. Features, compatibility, storage limits, and availability may change.</p>
      </LegalSection>
      <LegalSection id="billing" title="7. Subscriptions and billing">
        <p>Paid Floor Planner access renews automatically at the displayed interval until canceled. Prices, taxes, trial or complimentary access, and plan details are shown before purchase. Stripe processes payments and provides the billing portal.</p>
        <p>See the <Link href="/billing-terms" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Billing Terms</Link> for renewal, cancellation, refund, and plan-change details.</p>
      </LegalSection>
      <LegalSection id="intellectual-property" title="8. Intellectual property and reports">
        <p>The service, branding, software, design, and original content provided by Card Show Nation are owned by Card Show Nation or its licensors and protected by applicable laws. These terms do not transfer ownership to you.</p>
        <p>If you believe content infringes your copyright or other rights, email <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a> with the work or right involved, the content location, your contact information, and a good-faith explanation of the issue.</p>
      </LegalSection>
      <LegalSection id="disclaimers" title="9. Disclaimers and limitation of liability">
        <p>To the fullest extent permitted by law, the service is provided “as is” and “as available.” We do not guarantee uninterrupted operation, error-free data, event accuracy, availability of any feature, or results from using the service.</p>
        <p>To the fullest extent permitted by law, Card Show Nation and its owners, personnel, and providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages; lost profits, data, goodwill, or opportunities; event cancellations; or transactions between users and third parties. Our aggregate liability arising from the service will not exceed the greater of $100 or the amount you paid Card Show Nation during the 12 months before the event giving rise to the claim.</p>
        <p>Some jurisdictions do not allow certain exclusions or limitations, so portions of this section may not apply to you. Nothing in these terms limits rights or liability that cannot legally be limited.</p>
      </LegalSection>
      <LegalSection id="termination" title="10. Suspension, termination, and changes">
        <p>You may stop using the service at any time. We may restrict or terminate access, remove content, or preserve evidence when we reasonably believe these terms were violated, security or users are at risk, fees are unpaid, or the service is being discontinued.</p>
        <p>We may update these terms as the service or law changes. The updated date will appear above. Material changes may receive additional notice. Continued use after the effective date means you accept the revised terms.</p>
      </LegalSection>
      <LegalSection id="governing-law" title="11. Governing law and disputes">
        <p>These terms are governed by the laws of the State of Kansas, without regard to conflict-of-law principles. Before filing a legal claim, you and MC Event Group LLC agree to make a reasonable good-faith effort to resolve the dispute informally by contacting the other party. Any unresolved dispute may be brought in a state or federal court with jurisdiction under applicable law. These terms do not require arbitration.</p>
      </LegalSection>
      <LegalSection id="contact" title="12. Contact">
        <LegalContact><p className="font-semibold text-slate-950">MC Event Group LLC</p><address className="mt-1 not-italic">PO Box 655<br />Moundridge, KS 67107</address><p className="mt-2">Email <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a>.</p></LegalContact>
      </LegalSection>
    </LegalPage>
  );
}
