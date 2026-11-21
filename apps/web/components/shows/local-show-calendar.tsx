import Link from "next/link";
import { ShowListItem } from "@/components/shows/show-list-item";
import { serializeJsonLd } from "@/lib/safe-json-ld";
import { absoluteSiteUrl } from "@/lib/site-url";
import type { ShowCard } from "@/types";

type Props = {
  title: string;
  description: string;
  dateLabel: string;
  path: string;
  parentPath: string;
  parentName: string;
  shows: ShowCard[];
};

export function LocalShowCalendar({ title, description, dateLabel, path, parentPath, parentName, shows }: Props) {
  const pageUrl = absoluteSiteUrl(path);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: title,
        description,
        url: pageUrl,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: shows.length,
          itemListElement: shows.map((show, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: show.title,
            url: absoluteSiteUrl("/shows/" + show.slug),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Card shows", item: absoluteSiteUrl("/card-shows") },
          { "@type": "ListItem", position: 2, name: parentName, item: absoluteSiteUrl(parentPath) },
          { "@type": "ListItem", position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div className="container-wide py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Link href="/card-shows" className="hover:underline">Card shows</Link>
        <span aria-hidden="true">/</span>
        <Link href={parentPath} className="hover:underline">{parentName}</Link>
      </nav>
      <header className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-lg font-medium text-slate-800">{dateLabel}</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
      </header>
      <section aria-labelledby="calendar-events" className="mt-8">
        <h2 id="calendar-events" className="mb-4 text-xl font-semibold text-slate-950">
          {shows.length === 1 ? "1 listed card show" : shows.length + " listed card shows"}
        </h2>
        {shows.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-slate-600">Open a show for details and confirm hours and admission with the organizer before traveling.</p>
            <ul className="space-y-2">{shows.map(show => <li key={show.id}><ShowListItem show={show} /></li>)}</ul>
          </>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            No shows are currently listed for these dates. Browse the full state calendar for more dates.
          </p>
        )}
      </section>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-brand-700">
        <Link href={parentPath} className="underline underline-offset-4">Browse all {parentName}</Link>
        <Link href="/submit-show" className="underline underline-offset-4">Submit a card show</Link>
      </div>
    </div>
  );
}
