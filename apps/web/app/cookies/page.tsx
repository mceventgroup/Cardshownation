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
    <LegalPage title="Cookie Policy" summary="This policy describes cookies and similar technologies used by Card Show Nation and explains how to control optional use." updated="September 3, 2026" currentPath="/cookies" sections={sections}>
      <LegalSection id="about" title="1. About cookies">
        <p>Cookies are small text files a website stores in your browser. Similar technologies, such as pixels and browser storage, can remember settings, secure sessions, measure visits, or support advertising. Some are necessary for requested features; others are optional.</p>
      </LegalSection>
      <LegalSection id="essential" title="2. Essential technologies">
        <p>Essential technologies operate without optional consent because they support core features you request or protect the service. They may include:</p>
        <LegalList>
          <li>Member sessions last up to 30 days; promoter and moderator sessions up to 14 days; and admin and Floor Planner administrative sessions up to 12 hours.</li>
          <li>Security, rate-limiting, email-verification, password-reset, and third-party sign-in handoff data.</li>
          <li>Payment checkout or billing-portal handoffs.</li>
          <li>The <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">csn_cookie_consent</code> cookie remembers your privacy choice for up to six months.</li>
          <li>The <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">csn_preferred_state</code> cookie remembers only a two-letter state preference for up to six months. For signed-in members, the same selection also updates the home state in the account profile.</li>
          <li>Nearby search temporarily keeps a rounded device location in the current browser tab for no more than 15 minutes. It is not a cookie, is not saved to an account, and is cleared when the nearby search is cleared or the tab session ends.</li>
          <li>Device-local Floor Planner layouts, preferences, and uploaded background images stored in your browser.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="optional" title="3. Optional analytics and advertising">
        <p>If you select “Allow optional cookies,” the site may load analytics, advertising, and conversion-measurement services. Depending on the service, these providers may receive identifiers, IP address, device and browser information, page visits, referral information, and interaction data under their own terms. Card Show Nation may also use aggregate, cookie-free traffic measurement.</p>
        <p>First-party analytics cookies configured by Card Show Nation expire no later than six months after they are first set and do not renew on each visit. Advertising or measurement providers may set additional optional cookies under their own policies. Optional tools remain off when no choice has been made, after the six-month choice expires, or when you select “Essential only.” Card Show Nation does not intentionally send state-directory search text, nearby coordinates, or URL query details to these tools.</p>
      </LegalSection>
      <LegalSection id="choices" title="4. Manage your choices">
        <p>Use the <strong>Cookie settings</strong> button at the lower-left edge of any standard site page to reopen the consent panel. Choosing “Essential only” disables optional tools and removes known optional cookies accessible from this site. It does not prevent essential account or security functions.</p>
        <p>If your browser sends Global Privacy Control, optional analytics and advertising remain disabled, a previous optional choice is changed to essential-only, and known optional cookies accessible from this site are removed. The signal applies to that browser or device.</p>
        <p>You may also block or delete cookies through your browser. Blocking essential cookies can prevent sign-in, billing, saved privacy choices, or other requested features. Browser privacy controls may not remove information already processed.</p>
        <p>For more information about personal information and privacy requests, see the <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Privacy Policy</Link>.</p>
      </LegalSection>
      <LegalSection id="changes" title="5. Changes and contact">
        <p>We may update this policy when technologies or providers change. Questions may be sent to <a href="mailto:privacy@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">privacy@cardshownation.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
