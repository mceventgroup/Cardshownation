/** Read known USD admission prices without treating missing prices as free. */
export function getEventAdmissionPrice(isFree: boolean, admissionPrice: string | null | undefined) {
  if (isFree) return 0;

  const value = admissionPrice?.trim();
  if (!value) return undefined;

  // Public event imports use "USD 5"; submissions commonly use "$5".
  const amount = "(\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?)(?![\\d.,])";
  const prefixed = value.match(new RegExp(`(?:\\$|\\bUSD\\s+)\\s*${amount}`, "i"));
  const suffixed = value.match(new RegExp(`^${amount}\\s+USD$`, "i"));
  const numeric = value.match(new RegExp(`^${amount}$`));
  const price = (prefixed ?? suffixed ?? numeric)?.[1];

  return price === undefined ? undefined : Number(price.replace(/,/g, ""));
}
