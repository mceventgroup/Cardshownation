import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Cookie Policy", description: "How Card Show Nation uses essential and optional cookies and similar technologies." };

const sections = [
  { id: "about", label: "About cookies" }, { id: "essential", label: "Essential technologies" },
  { id: "optional", label: "Optional technologies" }, { id: "choices", label: "Manage your choices" },
  { id: "changes", label: "Changes and contact" },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" summary="This policy describes cookies and similar technologies used by Card Show Nation and explains how to control optional use." updated="September 1, 2026" currentPath="/cookies" sections={sections}>
      <LegalSection id="about" title="1. About cookies">
        <p>Cookies are small text files a website stores in your browser. Similar technologies, such as pixels and browser storage, can remember settings, secure sessions, measure visits, or support advertising. Some are necessary for requested features; others are optional.</p>
      </LegalSection>
      <LegalSection id="essential" title="2. Essential technologies">
        <p>Essential technologies operate without optional consent because they support core features you request or protect the service. They may include:</p>
        <LegalList>
          <li>Account, admin, moderator, promoter, and Floor Planner session cookies.</li>
          <li>Security, rate-limiting, email-verification, password-reset, and Google sign-in handoff data.</li>
          <li>Stripe checkout or billing-portal handoffs.</li>
          <li>The <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">csn_cookie_consent</code> cookie, which remembers your privacy choice for up to one year.</li>
          <li>Device-local Floor Planner layouts and preferences in local storage, plus uploaded background images stored in the browser&apos;s IndexedDB database.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="optional" title="3. Optional analytics and advertising">
        <p>If you select “Allow analytics,” the site may load Google Analytics, Google advertising tools or AdSense, and the Meta Pixel. These providers may receive identifiers, IP address, device and browser information, page visits, referral information, and interaction data according to their own policies.</p>
        <p>Optional tools help us understand traffic, improve the directory, measure promotion, and support advertising. They remain off when no choice has been made or when you select “Essential only.”</p>
      </LegalSection>
      <LegalSection id="choices" title="4. Manage your choices">
        <p>Use the <strong>Cookie settings</strong> button at the lower-left edge of any standard site page to reopen the consent panel. Choosing “Essential only” is presented alongside “Allow analytics” and does not prevent essential account or security functions.</p>
        <p>If your browser sends Global Privacy Control, optional analytics and advertising remain disabled and the settings panel confirms that the signal was honored. The signal applies to that browser or device.</p>
        <p>You may also block or delete cookies through your browser. Blocking essential cookies can prevent sign-in, billing, saved privacy choices, or other requested features. Browser privacy controls may not remove information already processed.</p>
        <p>For more information about personal information and privacy requests, see the <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Privacy Policy</Link>.</p>
      </LegalSection>
      <LegalSection id="changes" title="5. Changes and contact">
        <p>We may update this policy when technologies or providers change. Questions may be sent to <a href="mailto:privacy@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">privacy@cardshownation.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
