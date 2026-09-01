import type { Metadata } from "next";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Accessibility Statement", description: "Card Show Nation's accessibility commitment and barrier-reporting process." };

const sections = [
  { id: "commitment", label: "Our commitment" }, { id: "standard", label: "Accessibility standard" },
  { id: "measures", label: "Measures we take" }, { id: "limitations", label: "Known limitations" },
  { id: "feedback", label: "Feedback and assistance" },
];

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility Statement" summary="Card Show Nation wants collectors, promoters, moderators, and staff with disabilities to be able to use the service." updated="September 1, 2026" currentPath="/accessibility" sections={sections}>
      <LegalSection id="commitment" title="1. Our commitment">
        <p>We work to make core discovery, account, submission, billing, and planning experiences perceivable, operable, understandable, and robust. Accessibility is an ongoing practice, and we welcome reports from people who encounter barriers.</p>
      </LegalSection>
      <LegalSection id="standard" title="2. Accessibility standard">
        <p>Our goal is to align the public website and account experiences with the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA where reasonably possible. This statement describes a goal and ongoing work; it is not a claim that every page or advanced editing interaction currently conforms.</p>
      </LegalSection>
      <LegalSection id="measures" title="3. Measures we take">
        <LegalList>
          <li>Use semantic headings, landmarks, labels, and link text.</li>
          <li>Provide visible keyboard focus, skip navigation, and keyboard-operable menus and dialogs.</li>
          <li>Use responsive layouts, readable contrast, and touch targets designed for mobile use.</li>
          <li>Provide text alternatives for meaningful images when supplied by content authors.</li>
          <li>Include accessibility checks in design, code review, and testing of important flows.</li>
          <li>Offer support when a feature or document is not accessible in its current form.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="limitations" title="4. Known limitations">
        <p>The visual Floor Planner canvas is a complex, pointer-oriented editing surface and may not yet provide equivalent access for every screen-reader or keyboard-only workflow. Uploaded flyers, linked third-party pages, event venue information, and promoter-provided content may also vary in accessibility.</p>
        <p>If you need show information, a floor-plan export, or another service in a different format, contact us. We will make a reasonable effort to provide the information or an alternative way to complete the task.</p>
      </LegalSection>
      <LegalSection id="feedback" title="5. Feedback and assistance">
        <p>When reporting a barrier, tell us the page or feature, what you were trying to do, the assistive technology and browser used if relevant, and your preferred way to receive a response. Do not include passwords or unnecessary sensitive information.</p>
        <LegalContact><p className="font-semibold text-slate-950">Accessibility help</p><p className="mt-1">Email <a href="mailto:support@cardshownation.com?subject=Accessibility%20help" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a> with the subject “Accessibility help.”</p></LegalContact>
      </LegalSection>
    </LegalPage>
  );
}
