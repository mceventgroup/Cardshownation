import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicImportSources } from "./auto-import-sources";
import { extractCandidateEventUrls, extractShowsFromHtml } from "./public-show-import";

test("extractShowsFromHtml maps JSON-LD events from a public page", () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Midwest Sports Card Show",
            "description": "A sports card show with Pokemon tables too.",
            "startDate": "2026-08-15T09:00:00-05:00",
            "endDate": "2026-08-15T16:00:00-05:00",
            "url": "https://example.com/events/midwest-show",
            "location": {
              "@type": "Place",
              "name": "Douglas County Fairgrounds",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "2120 Harper St",
                "addressLocality": "Lawrence",
                "addressRegion": "KS"
              }
            },
            "offers": {
              "@type": "Offer",
              "price": "5",
              "priceCurrency": "USD"
            }
          }
        </script>
      </head>
    </html>
  `;

  const shows = extractShowsFromHtml(html, {
    name: "Example Events",
    url: "https://example.com/events",
  });

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.title, "Midwest Sports Card Show");
  assert.equal(shows[0]?.city, "Lawrence");
  assert.equal(shows[0]?.state, "KS");
  assert.equal(shows[0]?.venueName, "Douglas County Fairgrounds");
  assert.equal(shows[0]?.admissionPrice, "USD 5");
});

test("extractShowsFromHtml falls back to page-level heuristics with configured city/state", () => {
  const html = `
    <html>
      <head>
        <title>Red River Card Show</title>
        <meta name="description" content="Join us for the Red River card show on July 12, 2026.">
      </head>
      <body>
        <h1>Red River Card Show</h1>
        <p>July 12, 2026 at the community center.</p>
      </body>
    </html>
  `;

  const shows = extractShowsFromHtml(html, {
    name: "Public Facebook Post",
    url: "https://www.facebook.com/some-public-post",
    city: "Wichita Falls",
    state: "TX",
  });

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.city, "Wichita Falls");
  assert.equal(shows[0]?.state, "TX");
  assert.equal(shows[0]?.facebookUrl, "https://www.facebook.com/some-public-post");
});

test("extractShowsFromHtml infers city/state from detail page text when source fallback is missing", () => {
  const html = `
    <html>
      <head>
        <title>Beckett Sports Card Show</title>
        <meta name="description" content="Join us July 12, 2026 for a great card show in Tulsa, Oklahoma.">
      </head>
      <body>
        <article>
          <h1>Beckett Sports Card Show</h1>
          <p>July 12, 2026</p>
          <p>Tulsa, Oklahoma</p>
        </article>
      </body>
    </html>
  `;

  const shows = extractShowsFromHtml(html, {
    name: "Beckett",
    url: "https://example.com/beckett-show",
  });

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.city, "Tulsa");
  assert.equal(shows[0]?.state, "OK");
});

test("extractShowsFromHtml uses Beckett adapter for structured event blocks", () => {
  const html = `
    <html>
      <body>
        <article class="event-card">
          <h2><a href="/news/tulsa-card-show">Tulsa Sports Card Show</a></h2>
          <p>July 12, 2026</p>
          <p>Tulsa, Oklahoma</p>
          <p>Join collectors for sports cards and Pokemon.</p>
        </article>
      </body>
    </html>
  `;

  const shows = extractShowsFromHtml(html, {
    name: "Beckett Event Calendar",
    url: "https://example.com/beckett-calendar",
  });

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.title, "Tulsa Sports Card Show");
  assert.equal(shows[0]?.city, "Tulsa");
  assert.equal(shows[0]?.state, "OK");
  assert.equal(shows[0]?.websiteUrl, "https://example.com/news/tulsa-card-show");
});

test("extractCandidateEventUrls finds likely same-host event detail pages", () => {
  const html = `
    <html>
      <body>
        <a href="/events/tulsa-card-show">Tulsa Card Show</a>
        <a href="/about">About</a>
        <a href="https://external.example.com/card-show">External card show</a>
      </body>
    </html>
  `;

  const urls = extractCandidateEventUrls(html, {
    name: "Example",
    url: "https://example.com/calendar",
  });

  assert.deepEqual(urls, ["https://example.com/events/tulsa-card-show"]);
});

test("parsePublicImportSources ignores invalid entries and normalizes valid ones", () => {
  const sources = parsePublicImportSources(
    JSON.stringify([
      {
        name: "Nebraska Public Events",
        url: "example.com/shows",
        city: "Omaha",
        state: "ne",
        categories: ["Sports Cards"],
      },
      {
        name: "",
        url: "https://invalid.example.com",
      },
    ])
  );

  assert.deepEqual(sources, [
    {
      name: "Nebraska Public Events",
      url: "https://example.com/shows",
      city: "Omaha",
      state: "NE",
      organizerName: undefined,
      categories: ["Sports Cards"],
      facebookUrl: undefined,
      active: true,
      origin: "environment",
    },
  ]);
});
