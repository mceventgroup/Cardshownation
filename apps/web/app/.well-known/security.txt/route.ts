const SECURITY_TEXT = [
  "Contact: mailto:support@cardshownation.com?subject=Security%20report",
  "Contact: https://cardshownation.com/contact#security",
  "Expires: 2027-08-31T23:59:59Z",
  "Preferred-Languages: en",
  "Canonical: https://cardshownation.com/.well-known/security.txt",
  "Policy: https://cardshownation.com/contact#security",
  "",
].join("\n");

export function GET() {
  return new Response(SECURITY_TEXT, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
