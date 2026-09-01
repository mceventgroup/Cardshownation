import type { Metadata } from "next";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contact & Support",
  description: "Contact Card Show Nation for account, billing, privacy, accessibility, content, or security help.",
};

const sections = [
  { id: "support", label: "General support" },
  { id: "privacy", label: "Privacy requests" },
  { id: "accessibility", label: "Accessibility help" },
  { id: "content", label: "Content and rights reports" },
  { id: "security", label: "Security reports" },
  { id: "mail", label: "Mailing address" },
];

const supportLinkClass = "font-semibold text-brand-700 underline-offset-4 hover:underline";

export default function ContactPage() {
  return (
    <LegalPage title="Contact & Support" summary="Use the channel below that best matches your request. Please do not email passwords, full payment-card numbers, or unnecessary sensitive information." updated="September 1, 2026" currentPath="/contact" sections={sections}>
      <LegalSection id="support" title="1. General and account support">
        <p>Email <a href="mailto:support@cardshownation.com" className={supportLinkClass}>support@cardshownation.com</a> for account access, show listings, promoter tools, Floor Planner, billing questions, or cancellation help.</p>
        <p>Include the email address associated with your account and a concise description of the problem. Do not send your password or full card number.</p>
      </LegalSection>
      <LegalSection id="privacy" title="2. Privacy requests">
        <p>Email <a href="mailto:privacy@cardshownation.com" className={supportLinkClass}>privacy@cardshownation.com</a> to request access, correction, deletion, or a copy of personal information, or to ask a privacy question. We may need to verify your identity before fulfilling a request.</p>
      </LegalSection>
      <LegalSection id="accessibility" title="3. Accessibility help">
        <p>Email <a href="mailto:support@cardshownation.com?subject=Accessibility%20help" className={supportLinkClass}>support@cardshownation.com</a> with the subject “Accessibility help.” Tell us the page or feature involved, what happened, and the assistive technology or browser you used if you are comfortable sharing it.</p>
      </LegalSection>
      <LegalSection id="content" title="4. Content, copyright, and rights reports">
        <p>Email <a href="mailto:support@cardshownation.com?subject=Content%20or%20rights%20report" className={supportLinkClass}>support@cardshownation.com</a> to report inaccurate, unlawful, infringing, or privacy-invasive content.</p>
        <LegalList>
          <li>Identify the affected work, right, listing, flyer, or other content.</li>
          <li>Provide the exact Card Show Nation URL or enough detail to locate it.</li>
          <li>Explain the issue and include your name and a reliable way to contact you.</li>
          <li>If you represent someone else, describe your authority to act for them.</li>
        </LegalList>
      </LegalSection>
      <LegalSection id="security" title="5. Security reports">
        <p>Email <a href="mailto:support@cardshownation.com?subject=Security%20report" className={supportLinkClass}>support@cardshownation.com</a> with the subject “Security report” if you believe you found a vulnerability or unauthorized access.</p>
        <p>Describe the affected page, the steps needed to reproduce the issue, and its likely impact. Do not access other users&apos; information, disrupt the service, use social engineering, or publicly disclose an unresolved issue.</p>
      </LegalSection>
      <LegalSection id="mail" title="6. Mailing address">
        <LegalContact>
          <p className="font-semibold text-slate-950">MC Event Group LLC</p>
          <address className="mt-1 not-italic">PO Box 655<br />Moundridge, KS 67107</address>
        </LegalContact>
      </LegalSection>
    </LegalPage>
  );
}
