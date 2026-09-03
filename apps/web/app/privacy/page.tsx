import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Card Show Nation collects, uses, shares, and protects personal information.",
};

const sections = [
  { id: "scope", label: "Scope" }, { id: "information", label: "Information we collect" },
  { id: "use", label: "How we use information" }, { id: "public", label: "Public information" },
  { id: "sharing", label: "How information is shared" }, { id: "cookies", label: "Cookies and advertising" },
  { id: "retention", label: "Retention and security" }, { id: "choices", label: "Your choices and rights" },
  { id: "state-rights", label: "U.S. state privacy disclosures" }, { id: "children", label: "Children's privacy" },
  { id: "changes", label: "Changes and contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" summary="This policy explains what information Card Show Nation handles, why we use it, and the choices available to you." updated="September 3, 2026" currentPath="/privacy" sections={sections}>
      <LegalSection id="scope" title="1. Scope">
        <p>Card Show Nation is operated by MC Event Group LLC, a Kansas limited liability company. This policy applies to cardshownation.com, Card Show Nation accounts, show submissions, promoter tools, the Floor Planner, and related communications. It does not control the practices of independent event organizers, venues, payment providers, or websites that we link to.</p>
      </LegalSection>
      <LegalSection id="information" title="2. Information we collect">
        <p>Depending on how you use the service, we may collect:</p>
        <LegalList>
          <li><strong>Account information:</strong> name, email address, password credential, phone number, city, state, verification status, account role, and sign-in records.</li>
          <li><strong>Show and promoter information:</strong> organizer details, event dates, venue information, admission details, links, uploaded flyers, and information included in submissions or CSV imports.</li>
          <li><strong>Preferences:</strong> home or preferred state, followed states, favorite organizers, saved shows, alert choices, and cookie consent.</li>
          <li><strong>Floor Planner content:</strong> layouts, tables, vendor rosters, assignments, notes, and related project data you choose to save. Vendor rosters may contain information about other people; upload it only when you are authorized to do so.</li>
          <li><strong>Billing information:</strong> subscription status, transaction and subscription identifiers, price, renewal date, and cancellation status. A payment processor handles payment credentials; Card Show Nation does not store full payment-card numbers.</li>
          <li><strong>Technical information:</strong> IP address, browser and device information, request logs, security events, and usage data. If you request nearby results, your device briefly provides location in the browser and Card Show Nation receives only coordinates rounded to two decimal places.</li>
          <li><strong>Communications:</strong> messages and requests sent to our support or privacy addresses.</li>
        </LegalList>
        <p>We receive information directly from you, automatically from your browser, from service providers, from public event sources, and from promoters or other people who submit show information.</p>
      </LegalSection>
      <LegalSection id="use" title="3. How we use information">
        <LegalList>
          <li>Provide, maintain, personalize, and secure the directory, accounts, alerts, promoter tools, and Floor Planner.</li>
          <li>Review, publish, correct, and manage show listings and prevent duplicates or abuse.</li>
          <li>Process subscriptions, maintain billing records, and provide customer support.</li>
          <li>Send verification, password-reset, service, alert, and other requested communications.</li>
          <li>Measure and improve the service when you allow optional analytics or advertising cookies.</li>
          <li>Comply with law, enforce our terms, resolve disputes, and protect Card Show Nation, users, and the public.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="public" title="4. Public information">
        <p>Published show details, venue information, organizer names, event links, and flyers are public. Account emails and submitter emails are private by default. We publish a promoter email only when a separate public-contact email is entered and publication is expressly authorized.</p>
        <p>Do not include private personal information in public listing fields, flyers, or links. Search engines and other services may copy public information after it is published.</p>
      </LegalSection>
      <LegalSection id="sharing" title="5. How information is shared">
        <p>We disclose information as needed to categories of service providers that support website hosting and data storage; email delivery; payment processing; account sign-in; optional analytics and advertising; and AI-assisted extraction when you ask us to read an uploaded flyer. Each provider receives information reasonably necessary for its assigned function and handles it under applicable contracts and privacy terms.</p>
        <p>Nearby search begins only when you select the location control and your browser grants permission. Exact device coordinates are rounded to two decimal places before leaving the browser, kept temporarily in the current tab for no more than 15 minutes, and sent in the body of a no-store request solely to calculate nearby shows. They are not placed in the page address, saved to an account or cookie, or intentionally sent to analytics or advertising providers.</p>
        <p>We may disclose information when reasonably necessary to comply with law, protect rights or safety, investigate abuse, or complete a merger, financing, acquisition, or transfer of business assets. We do not sell account contact information for money. Some optional advertising or measurement activity may be treated as “sharing,” “targeted advertising,” or a “sale” under certain privacy laws; it remains disabled unless you choose optional cookies.</p>
      </LegalSection>
      <LegalSection id="cookies" title="6. Cookies, analytics, and advertising">
        <p>Essential cookies support sign-in, security, billing handoffs, and saved privacy choices. If you select “Allow optional cookies,” analytics and advertising services may also run. See the <Link href="/cookies" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Cookie Policy</Link> for details and how to change your choice.</p>
        <p>When your browser sends a recognized Global Privacy Control signal, Card Show Nation disables optional analytics and advertising for that browser even if an earlier cookie choice allowed them.</p>
      </LegalSection>
      <LegalSection id="retention" title="7. Retention and security">
        <p>We retain account and saved cloud-project data while an account or service relationship remains active; public show, venue, and organizer records while useful for the directory, moderation, historical accuracy, or business records; billing and transaction records as required for accounting, tax, fraud, and dispute purposes; email-suppression records as needed to honor opt-outs; and security or rate-limit records for a period appropriate to preventing abuse. Verification and reset records expire or are removed after use. Data may remain temporarily in backups until those backups expire through normal rotation.</p>
        <p>Card Show Nation does not save nearby-search coordinates to accounts or other persistent service records. The rounded location held in the browser expires after 15 minutes and is also removed when nearby search is cleared or the tab session ends. A preferred state contains only a two-letter state code and remains in the account until changed or the account is deleted, or in the browser cookie for no more than six months.</p>
        <p>We use administrative, technical, and organizational safeguards designed to protect information. No online service can guarantee absolute security, so use a unique password and contact us if you suspect unauthorized access.</p>
      </LegalSection>
      <LegalSection id="choices" title="8. Your choices and privacy rights">
        <LegalList>
          <li>Update account information, alert preferences, saved shows, and followed organizers from your dashboard.</li>
          <li>Unsubscribe using an email link or your account settings.</li>
          <li>Choose essential-only cookies or reopen Cookie settings to change your choice.</li>
          <li>Delete your account from account settings after any active paid subscription has ended. Account credentials, preferences, saved shows, follows, and account-linked cloud layouts are deleted. Public event, venue, or organizer records may remain for directory and recordkeeping purposes and may be detached from the deleted login.</li>
          <li>Floor Planner layouts and uploaded images saved only in your browser are not connected to your Card Show Nation account and are not removed by account deletion. Delete them in the Floor Planner layout manager or clear this site&apos;s browser data.</li>
          <li>Depending on where you live, request access, correction, deletion, or a copy of personal information, or object to certain processing.</li>
        </LegalList>
        <p>To make a privacy request, email <a href="mailto:privacy@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">privacy@cardshownation.com</a>. We may need to verify your identity and may retain a record of the request. Authorized agents should identify the person they represent and provide proof of authority.</p>
      </LegalSection>
      <LegalSection id="state-rights" title="9. U.S. state privacy disclosures">
        <p>Depending on applicable law and where you live, the categories handled in the preceding 12 months may include identifiers and contact information; customer and account records; commercial and subscription information; internet or device activity; device location briefly processed when you request nearby results; submitted content; and preferences or inferences based on activity.</p>
        <p>Sources include you, your browser or device, promoters and submitters, public event sources, and the service-provider categories described above. We use and disclose these categories for the operational, security, support, communication, billing, analytics, advertising, and legal purposes described in this policy.</p>
        <p>Where applicable, you may have rights to know, access, correct, delete, or obtain a portable copy of information; opt out of targeted advertising, sale, or sharing; and appeal a denied request. We will not discriminate against you for exercising an applicable privacy right. A recognized Global Privacy Control signal is treated as a browser-level request to disable optional analytics and advertising.</p>
      </LegalSection>
      <LegalSection id="children" title="10. Children's privacy">
        <p>Card Show Nation is a general-audience service and is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child provided personal information, contact us so we can investigate and delete it when appropriate.</p>
      </LegalSection>
      <LegalSection id="changes" title="11. Changes and contact">
        <p>We may update this policy as the service or law changes. We will update the date above and provide additional notice when a change is material.</p>
        <LegalContact><p className="font-semibold text-slate-950">MC Event Group LLC</p><address className="mt-1 not-italic">PO Box 655<br />Moundridge, KS 67107</address><p className="mt-2">Privacy requests: <a href="mailto:privacy@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">privacy@cardshownation.com</a><br />General support: <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a></p></LegalContact>
      </LegalSection>
    </LegalPage>
  );
}
