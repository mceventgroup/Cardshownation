import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import { AdSlot } from "@/components/ads/ad-slot";
import { normalizeFlyerUrlForRender } from "@/lib/flyers";
import { getStateByCode } from "@/lib/states";
import { ensureManagedShowFlyerImage, getShowBySlug } from "@/lib/shows";
import { normalizeExternalUrl } from "@/lib/url";
import { formatShowDate, stateCodeToSlug } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/safe-json-ld";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
const SHOW_SIDEBAR_AD_SLOT = process.env.NEXT_PUBLIC_AD_SLOT_SHOW_SIDEBAR?.trim() ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowBySlug(slug);

  if (!show) return {};

  const stateName = getStateByCode(show.state)?.name ?? show.state;

  return {
    title: show.title,
    description:
      show.description ??
      `${show.title} takes place ${formatShowDate(show.startDate, show.endDate)} in ${show.city}, ${stateName}. Find venue, admission, organizer, and vendor details on Card Show Nation.`,
  };
}

function formatExternalHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function buildHoursLabel(show: Awaited<ReturnType<typeof getShowBySlug>>) {
  if (!show?.startTimeLabel) {
    return "Hours not listed";
  }

  return `${show.startTimeLabel}${show.endTimeLabel ? ` - ${show.endTimeLabel}` : ""}`;
}

export default async function ShowDetailPage({ params }: Props) {
  const { slug } = await params;
  const show = await getShowBySlug(slug);

  if (!show || show.status !== "APPROVED") notFound();

  const stateRecord = getStateByCode(show.state);
  const stateName = stateRecord?.name ?? show.state;
  const stateSlug = stateRecord?.slug ?? stateCodeToSlug(show.state);
  const cityHref = `/card-shows?state=${show.state}&city=${encodeURIComponent(show.city)}`;
  const mapsQuery = encodeURIComponent(
    [
      show.venue?.name,
      show.venue?.address1,
      show.city,
      show.state,
      show.venue?.postalCode,
    ]
      .filter(Boolean)
      .join(", ")
  );
  const vendorLabel =
    show.vendorDetails ??
    (show.tableCount ? `${show.tableCount.toLocaleString()} tables expected` : null);
  const hoursLabel = buildHoursLabel(show);
  const admissionLabel = show.isFree
    ? "Free admission"
    : show.admissionPrice ?? "Paid admission";
  const websiteUrl = normalizeExternalUrl(show.websiteUrl);
  const facebookUrl = normalizeExternalUrl(show.facebookUrl);
  const ticketUrl = normalizeExternalUrl(show.ticketUrl);
  const organizerWebsiteUrl = normalizeExternalUrl(show.organizer?.websiteUrl);
  const organizerFacebookUrl = normalizeExternalUrl(show.organizer?.facebookUrl);
  const organizerInstagramUrl = normalizeExternalUrl(show.organizer?.instagramUrl);
  const managedFlyerImageUrl = await ensureManagedShowFlyerImage(
    show.id,
    show.title,
    show.flyerImageUrl
  );
  const flyerImageUrl = normalizeFlyerUrlForRender(managedFlyerImageUrl);
  const organizerEmail = show.organizer?.email?.trim() || null;
  const promoterContacts: Array<{
    href: string;
    icon: "email" | "globe" | "ticket" | "link";
    label: string;
    meta: string;
  }> = [];
  const seenPromoterLinks = new Set<string>();

  if (organizerEmail && organizerEmail.includes("@")) {
    promoterContacts.push({
      href: `mailto:${organizerEmail}`,
      icon: "email",
      label: "Email promoter",
      meta: organizerEmail,
    });
  }

  function pushPromoterContact(
    href: string | null,
    label: string,
    icon: "globe" | "ticket" | "link"
  ) {
    if (!href || seenPromoterLinks.has(href)) {
      return;
    }

    seenPromoterLinks.add(href);
    promoterContacts.push({
      href,
      icon,
      label,
      meta: formatExternalHost(href),
    });
  }

  pushPromoterContact(websiteUrl, "Event website", "globe");
  pushPromoterContact(facebookUrl, "Facebook event", "link");
  pushPromoterContact(
    ticketUrl,
    show.isFree ? "Registration details" : "Tickets / registration",
    "ticket"
  );
  pushPromoterContact(organizerWebsiteUrl, "Promoter website", "globe");
  pushPromoterContact(organizerFacebookUrl, "Promoter Facebook", "link");
  pushPromoterContact(organizerInstagramUrl, "Promoter Instagram", "link");

  const hasPromoterSection = Boolean(
    show.organizer || promoterContacts.length > 0 || show.loadInInfo
  );

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: show.title,
    startDate: show.startDate.toISOString(),
    endDate: show.endDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: show.description ?? undefined,
    image: flyerImageUrl ?? undefined,
    url: websiteUrl ?? `https://cardshownation.com/shows/${show.slug}`,
    isAccessibleForFree: show.isFree,
    organizer: show.organizer
      ? {
          "@type": "Organization",
          name: show.organizer.name,
          url: organizerWebsiteUrl ?? undefined,
        }
      : undefined,
    location: {
      "@type": "Place",
      name: show.venue?.name ?? `${show.city}, ${stateName}`,
      address: {
        "@type": "PostalAddress",
        streetAddress: show.venue?.address1 ?? undefined,
        addressLocality: show.city,
        addressRegion: show.state,
        postalCode: show.venue?.postalCode ?? undefined,
        addressCountry: "US",
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Card Shows",
        item: "https://cardshownation.com/card-shows",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${stateName} Card Shows`,
        item: `https://cardshownation.com/card-shows/${stateSlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: show.title,
        item: `https://cardshownation.com/shows/${show.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="container-wide py-6 sm:py-10">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-brand-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/card-shows" className="transition-colors hover:text-brand-700">
            Card shows
          </Link>
          <span>/</span>
          <Link
            href={`/card-shows/${stateSlug}`}
            className="transition-colors hover:text-brand-700"
          >
            {stateName}
          </Link>
          <span>/</span>
          <span className="text-slate-900">{show.title}</span>
        </nav>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap gap-2">
            {show.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
              >
                {category}
              </span>
            ))}
            {show.featuredRank !== null && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Featured listing
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                {show.title}
              </h1>
              <div className="mt-4 space-y-2 text-sm text-slate-600 sm:text-base">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                  <span>{formatShowDate(show.startDate, show.endDate)}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                  <span>
                    {show.venue?.name ? `${show.venue.name}, ` : ""}
                    {show.city}, {stateName}
                  </span>
                </div>
                {show.startTimeLabel && (
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                    <span>{hoursLabel}</span>
                  </div>
                )}
              </div>

              {show.description && (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  {show.description}
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Ticket className="h-4 w-4 text-brand-700" />
                    Admission
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{admissionLabel}</p>
                  {show.admissionNotes && (
                    <p className="mt-1 text-sm leading-6 text-slate-500">{show.admissionNotes}</p>
                  )}
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-brand-700" />
                    Vendors
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {vendorLabel ?? "Vendor details coming soon"}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-brand-700" />
                    Venue
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {show.venue?.name ?? `${show.city}, ${stateName}`}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock className="h-4 w-4 text-brand-700" />
                    Parking
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {show.parkingInfo ?? show.venue?.parkingInfo ?? "Parking details not listed"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">
                Quick info
              </p>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <span className="text-slate-400">When</span>
                  <span className="text-right font-medium">{formatShowDate(show.startDate, show.endDate)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <span className="text-slate-400">Hours</span>
                  <span className="text-right font-medium">{hoursLabel}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <span className="text-slate-400">Admission</span>
                  <span className="text-right font-medium">{admissionLabel}</span>
                </div>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <span className="text-slate-400">Vendors</span>
                  <span className="text-right font-medium">
                    {vendorLabel ?? "Details coming soon"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">Organizer</span>
                  <span className="text-right font-medium">
                    {show.organizer?.name ?? "Card Show Nation listing"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                  >
                    Event website
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Facebook event
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {ticketUrl && (
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    {show.isFree ? "Registration details" : "Tickets"}
                    <Ticket className="h-4 w-4" />
                  </a>
                )}
                <a
                  href={`https://maps.google.com/?q=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Get directions
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {flyerImageUrl && (
              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flyerImageUrl}
                  alt={`${show.title} flyer`}
                  className="w-full bg-slate-50 object-cover"
                />
              </section>
            )}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-950">Venue</h2>
              <div className="mt-5 space-y-2 text-sm leading-6 text-slate-600">
                {show.venue ? (
                  <>
                    <p className="font-medium text-slate-900">{show.venue.name}</p>
                    <p>{show.venue.address1}</p>
                    {show.venue.address2 && <p>{show.venue.address2}</p>}
                    <p>
                      {show.city}, {stateName} {show.venue.postalCode ?? ""}
                    </p>
                  </>
                ) : (
                  <p>
                    {show.city}, {stateName}
                  </p>
                )}
              </div>

              {(show.parkingInfo || show.venue?.parkingInfo || show.venueNotes) && (
                <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">
                  {(show.parkingInfo || show.venue?.parkingInfo) && (
                    <div>
                      <p className="font-semibold text-slate-900">Parking</p>
                      <p>{show.parkingInfo ?? show.venue?.parkingInfo}</p>
                    </div>
                  )}
                  {show.venueNotes && (
                    <div>
                      <p className="font-semibold text-slate-900">Venue notes</p>
                      <p>{show.venueNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {hasPromoterSection && (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-950">
                  Promoter and vendor contact
                </h2>

                {show.organizer && (
                  <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">
                        {show.organizer.name}
                      </p>
                      {show.organizer.verified && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Verified promoter
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {promoterContacts.length > 0 && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {promoterContacts.map((contact) => (
                      <a
                        key={`${contact.label}-${contact.href}`}
                        href={contact.href}
                        target={contact.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel={
                          contact.href.startsWith("mailto:")
                            ? undefined
                            : "noopener noreferrer"
                        }
                        className="group rounded-[1.5rem] border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-2xl bg-slate-100 p-2 text-slate-700 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                              {contact.icon === "email" ? (
                                <Mail className="h-4 w-4" />
                              ) : contact.icon === "globe" ? (
                                <Globe className="h-4 w-4" />
                              ) : contact.icon === "ticket" ? (
                                <Ticket className="h-4 w-4" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">
                                {contact.label}
                              </p>
                              <p className="truncate text-sm text-slate-500">
                                {contact.meta}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {show.loadInInfo && (
                  <div className="mt-5 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">
                    <p className="font-semibold text-slate-900">Vendor load-in</p>
                    <p>{show.loadInInfo}</p>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">More shows</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <Link
                  href={`/card-shows/${stateSlug}`}
                  className="rounded-full border border-slate-200 px-4 py-3 font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  View all {stateName} shows
                </Link>
                <Link
                  href={cityHref}
                  className="rounded-full border border-slate-200 px-4 py-3 font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  Browse {show.city} listings
                </Link>
              </div>
            </section>

            {SHOW_SIDEBAR_AD_SLOT && (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sponsored
                </p>
                <AdSlot
                  slot={SHOW_SIDEBAR_AD_SLOT}
                  format="rectangle"
                  className="min-h-[250px]"
                />
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
