export type FixtureOrganizer = {
  id: string;
  name: string;
  email: string | null;
  publicEmail: string | null;
  publicEmailConsentAt: Date | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  verified: boolean;
};

export type FixtureVenue = {
  id: string;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  parkingInfo: string | null;
  loadInInfo: string | null;
};

export type FixtureShowTag = {
  id: string;
  label: string;
};

export type FixtureShow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  sourceType: "MANUAL" | "SUBMITTED" | "IMPORTED";
  timezone: string;
  startDate: Date;
  endDate: Date;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  city: string;
  state: string;
  isFree: boolean;
  admissionPrice: string | null;
  admissionNotes: string | null;
  tableCount: number | null;
  vendorDetails: string | null;
  estimatedAttendance: number | null;
  flyerImageUrl: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  ticketUrl: string | null;
  parkingInfo: string | null;
  loadInInfo: string | null;
  venueNotes: string | null;
  categories: string[];
  lastVerifiedAt: Date | null;
  expiresAt: Date | null;
  viewCount: number;
  favoriteCount: number;
  featuredRank: number | null;
  createdAt: Date;
  updatedAt: Date;
  organizerId: string | null;
  venueId: string | null;
  organizer: FixtureOrganizer | null;
  venue: FixtureVenue | null;
  tags: FixtureShowTag[];
};

export type FixtureSubmission = {
  id: string;
  submitterName: string;
  submitterEmail: string;
  payloadJson: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  reviewerId: string | null;
  reviewerRole: "MODERATOR" | "ADMIN" | "ORGANIZER" | "FAN" | null;
  reviewedShowId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const organizers: Record<string, FixtureOrganizer> = {
  kansasCardShow: {
    id: "org-kansas-card-show",
    name: "Kansas Card Show",
    email: "info@kansascardshow.com",
    publicEmail: "info@kansascardshow.com",
    publicEmailConsentAt: new Date("2026-01-01T00:00:00.000Z"),
    websiteUrl: "https://kansascardshow.com",
    facebookUrl: null,
    instagramUrl: null,
    verified: true,
  },
  midwestHobbyEvents: {
    id: "org-midwest-hobby-events",
    name: "Midwest Hobby Events",
    email: "team@midwesthobbyevents.com",
    publicEmail: null,
    publicEmailConsentAt: null,
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    verified: true,
  },
  redDirtCollectibles: {
    id: "org-red-dirt-collectibles",
    name: "Red Dirt Collectibles",
    email: "hello@reddirtcollectibles.com",
    publicEmail: null,
    publicEmailConsentAt: null,
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    verified: true,
  },
  plainsCardMarket: {
    id: "org-plains-card-market",
    name: "Plains Card Market",
    email: "info@plainscardmarket.com",
    publicEmail: null,
    publicEmailConsentAt: null,
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    verified: true,
  },
  gatewayPromotions: {
    id: "org-gateway-card-promotions",
    name: "Gateway Card Promotions",
    email: "events@gatewaycardpromotions.com",
    publicEmail: null,
    publicEmailConsentAt: null,
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    verified: true,
  },
};

const venues: Record<string, FixtureVenue> = {
  wichitaForum: {
    id: "venue-wichita-forum",
    name: "Wichita Sports Forum",
    address1: "2668 N Greenwich Rd",
    address2: null,
    city: "Wichita",
    state: "KS",
    postalCode: "67226",
    parkingInfo: "Free parking surrounds the venue.",
    loadInInfo: "Dealer setup opens at 7:30 AM.",
  },
  overlandParkCenter: {
    id: "venue-overland-park-event-center",
    name: "Overland Park Event Center",
    address1: "6000 College Blvd",
    address2: null,
    city: "Overland Park",
    state: "KS",
    postalCode: "66211",
    parkingInfo: "Surface parking is free on weekends.",
    loadInInfo: "Vendor check-in starts at 6:45 AM.",
  },
  kciExpo: {
    id: "venue-kci-expo-hall",
    name: "KCI Expo Hall",
    address1: "11730 N Ambassador Dr",
    address2: null,
    city: "Kansas City",
    state: "MO",
    postalCode: "64153",
    parkingInfo: "Main lot parking is included with admission.",
    loadInInfo: "Dealer load-in starts at 7:00 AM on Saturday.",
  },
  stCharles: {
    id: "venue-st-charles-convention-center",
    name: "St. Charles Convention Center",
    address1: "1 Convention Center Plz",
    address2: null,
    city: "St. Charles",
    state: "MO",
    postalCode: "63303",
    parkingInfo: "Free attached lot parking.",
    loadInInfo: "Promoter staff begins vendor check-in at 7:00 AM.",
  },
  okcHall: {
    id: "venue-okc-event-hall",
    name: "OKC Event Hall",
    address1: "311 S Klein Ave",
    address2: null,
    city: "Oklahoma City",
    state: "OK",
    postalCode: "73108",
    parkingInfo: "Paid parking garage next to the hall.",
    loadInInfo: "Vendor entry opens at 8:00 AM.",
  },
  tulsaMarket: {
    id: "venue-tulsa-expo-market-hall",
    name: "Tulsa Expo Market Hall",
    address1: "4145 E 21st St",
    address2: null,
    city: "Tulsa",
    state: "OK",
    postalCode: "74114",
    parkingInfo: "Free parking available around Expo Square.",
    loadInInfo: "Trade night setup begins Friday at 5:00 PM.",
  },
  omahaCenter: {
    id: "venue-omaha-fire-hall",
    name: "Omaha Fire Hall Event Center",
    address1: "6005 Grover St",
    address2: null,
    city: "Omaha",
    state: "NE",
    postalCode: "68106",
    parkingInfo: "Free surface parking behind the hall.",
    loadInInfo: "Dealer setup starts at 7:00 AM.",
  },
  lincolnPavilion: {
    id: "venue-lincoln-event-pavilion",
    name: "Lincoln Event Pavilion",
    address1: "4100 Pioneer Woods Dr",
    address2: null,
    city: "Lincoln",
    state: "NE",
    postalCode: "68506",
    parkingInfo: "Free parking lot on site.",
    loadInInfo: "Vendor doors open at 7:30 AM.",
  },
  desMoinesHall: {
    id: "venue-iowa-events-hall",
    name: "Iowa Events Hall",
    address1: "730 3rd St",
    address2: null,
    city: "Des Moines",
    state: "IA",
    postalCode: "50309",
    parkingInfo: "Garage parking is available across the street.",
    loadInInfo: "Dealers may set up starting at 6:30 AM.",
  },
  chicagoHall: {
    id: "venue-chicagoland-convention-hall",
    name: "Chicagoland Convention Hall",
    address1: "5555 N River Rd",
    address2: null,
    city: "Rosemont",
    state: "IL",
    postalCode: "60018",
    parkingInfo: "Convention parking garage available onsite.",
    loadInInfo: "Vendor move-in opens at 7:00 AM.",
  },
};

function show(values: Omit<FixtureShow, "viewCount" | "favoriteCount" | "tags">): FixtureShow {
  return {
    viewCount: 0,
    favoriteCount: 0,
    tags: [],
    ...values,
  };
}

export const FIXTURE_SHOWS: FixtureShow[] = [
  show({
    id: "fixture-show-ks-wichita-spring-weekend",
    title: "Kansas Card Show Spring Weekend",
    slug: "kansas-card-show-spring-weekend-wichita-2026",
    description:
      "A collector-first weekend with sports cards, Pokemon, and TCG tables across vintage, modern, wax, and singles. This sample listing shows the level of detail Card Show Nation can support for a flagship regional event.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-04-25T09:00:00"),
    endDate: new Date("2026-04-25T16:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "4:00 PM",
    city: "Wichita",
    state: "KS",
    isFree: false,
    admissionPrice: "$5",
    admissionNotes: "Kids 12 and under are free with a paid adult.",
    tableCount: 140,
    vendorDetails: "Dealer floor is nearly sold out. Promoter waitlist is open.",
    estimatedAttendance: 850,
    flyerImageUrl: null,
    websiteUrl: "https://kansascardshow.com",
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.wichitaForum.parkingInfo,
    loadInInfo: venues.wichitaForum.loadInInfo,
    venueNotes: "Main hall entrance opens to the public at 8:45 AM.",
    categories: ["Sports Cards", "Pokemon", "TCG"],
    lastVerifiedAt: new Date("2026-04-10T12:00:00"),
    expiresAt: new Date("2026-04-26T23:59:59"),
    featuredRank: 1,
    createdAt: new Date("2026-03-28T09:00:00"),
    updatedAt: new Date("2026-04-10T12:00:00"),
    organizerId: organizers.kansasCardShow.id,
    venueId: venues.wichitaForum.id,
    organizer: organizers.kansasCardShow,
    venue: venues.wichitaForum,
  }),
  show({
    id: "fixture-show-ks-op-weekend",
    title: "Overland Park Card and TCG Weekend",
    slug: "overland-park-card-and-tcg-weekend-2026",
    description:
      "A strong suburban Kansas City market event with modern sports cards, graded inventory, sealed Pokemon product, and family-friendly traffic.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-05-09T09:00:00"),
    endDate: new Date("2026-05-09T15:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "3:00 PM",
    city: "Overland Park",
    state: "KS",
    isFree: false,
    admissionPrice: "$3",
    admissionNotes: "Early buyer entry starts at 8:00 AM for $10.",
    tableCount: 85,
    vendorDetails: "A few dealer tables remain. TCG-focused vendors encouraged.",
    estimatedAttendance: 420,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.overlandParkCenter.parkingInfo,
    loadInInfo: venues.overlandParkCenter.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "Pokemon", "TCG"],
    lastVerifiedAt: new Date("2026-04-11T12:00:00"),
    expiresAt: new Date("2026-05-10T23:59:59"),
    featuredRank: 3,
    createdAt: new Date("2026-04-01T09:00:00"),
    updatedAt: new Date("2026-04-11T12:00:00"),
    organizerId: organizers.kansasCardShow.id,
    venueId: venues.overlandParkCenter.id,
    organizer: organizers.kansasCardShow,
    venue: venues.overlandParkCenter,
  }),
  show({
    id: "fixture-show-mo-kc-weekend",
    title: "Kansas City Card Weekend",
    slug: "kansas-city-card-weekend-2026",
    description:
      "A metro draw for Missouri and Kansas collectors featuring vintage showcases, bargain boxes, and a broad dealer floor.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-05-02T09:00:00"),
    endDate: new Date("2026-05-03T15:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "3:00 PM",
    city: "Kansas City",
    state: "MO",
    isFree: false,
    admissionPrice: "$7 weekend pass",
    admissionNotes: "Saturday-only admission is $5.",
    tableCount: 160,
    vendorDetails: "Full dealer floor plus Sunday trade tables.",
    estimatedAttendance: 900,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.kciExpo.parkingInfo,
    loadInInfo: venues.kciExpo.loadInInfo,
    venueNotes: "Trade night runs after close on Saturday.",
    categories: ["Sports Cards", "Pokemon", "Memorabilia"],
    lastVerifiedAt: new Date("2026-04-12T12:00:00"),
    expiresAt: new Date("2026-05-04T23:59:59"),
    featuredRank: 2,
    createdAt: new Date("2026-03-30T10:00:00"),
    updatedAt: new Date("2026-04-12T12:00:00"),
    organizerId: organizers.midwestHobbyEvents.id,
    venueId: venues.kciExpo.id,
    organizer: organizers.midwestHobbyEvents,
    venue: venues.kciExpo,
  }),
  show({
    id: "fixture-show-mo-stl-showcase",
    title: "St. Louis Sports Card Showcase",
    slug: "st-louis-sports-card-showcase-2026",
    description:
      "A larger regional show built around sports cards with autograph guests, vintage showcases, and a broad Midwest dealer mix.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-05-16T10:00:00"),
    endDate: new Date("2026-05-17T16:00:00"),
    startTimeLabel: "10:00 AM",
    endTimeLabel: "4:00 PM",
    city: "St. Charles",
    state: "MO",
    isFree: false,
    admissionPrice: "$8",
    admissionNotes: "VIP early entry starts at 9:00 AM.",
    tableCount: 220,
    vendorDetails: "Promoter is accepting a limited number of premium corner booths.",
    estimatedAttendance: 1200,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.stCharles.parkingInfo,
    loadInInfo: venues.stCharles.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "Memorabilia", "Autograph Guests"],
    lastVerifiedAt: new Date("2026-04-13T12:00:00"),
    expiresAt: new Date("2026-05-18T23:59:59"),
    featuredRank: 4,
    createdAt: new Date("2026-04-02T10:00:00"),
    updatedAt: new Date("2026-04-13T12:00:00"),
    organizerId: organizers.gatewayPromotions.id,
    venueId: venues.stCharles.id,
    organizer: organizers.gatewayPromotions,
    venue: venues.stCharles,
  }),
  show({
    id: "fixture-show-ok-okc-expo",
    title: "Oklahoma City Collectors Expo",
    slug: "oklahoma-city-collectors-expo-2026",
    description:
      "A broad hobby event with sports cards, Pokemon, and sealed product sellers serving the OKC market and surrounding states.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-05-23T10:00:00"),
    endDate: new Date("2026-05-23T16:00:00"),
    startTimeLabel: "10:00 AM",
    endTimeLabel: "4:00 PM",
    city: "Oklahoma City",
    state: "OK",
    isFree: true,
    admissionPrice: null,
    admissionNotes: "Free public admission all day.",
    tableCount: 90,
    vendorDetails: "Dealer registration remains open through May 10.",
    estimatedAttendance: 500,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.okcHall.parkingInfo,
    loadInInfo: venues.okcHall.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "Pokemon", "TCG"],
    lastVerifiedAt: new Date("2026-04-14T12:00:00"),
    expiresAt: new Date("2026-05-24T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-03T11:00:00"),
    updatedAt: new Date("2026-04-14T12:00:00"),
    organizerId: organizers.redDirtCollectibles.id,
    venueId: venues.okcHall.id,
    organizer: organizers.redDirtCollectibles,
    venue: venues.okcHall,
  }),
  show({
    id: "fixture-show-ok-tulsa-trade-night",
    title: "Tulsa Trade Night and Card Show",
    slug: "tulsa-trade-night-and-card-show-2026",
    description:
      "A one-two punch weekend with a Friday trade night and a Saturday card show focused on active buying, selling, and trading.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-06-06T09:00:00"),
    endDate: new Date("2026-06-06T15:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "3:00 PM",
    city: "Tulsa",
    state: "OK",
    isFree: false,
    admissionPrice: "$5",
    admissionNotes: "Friday trade night is free with Saturday admission.",
    tableCount: 75,
    vendorDetails: "Promoter expects a fast-moving singles-heavy floor.",
    estimatedAttendance: 350,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.tulsaMarket.parkingInfo,
    loadInInfo: venues.tulsaMarket.loadInInfo,
    venueNotes: "Saturday opens with a trade pit near the entrance.",
    categories: ["Sports Cards", "Trade Night", "TCG"],
    lastVerifiedAt: new Date("2026-04-14T12:00:00"),
    expiresAt: new Date("2026-06-07T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-05T11:00:00"),
    updatedAt: new Date("2026-04-14T12:00:00"),
    organizerId: organizers.redDirtCollectibles.id,
    venueId: venues.tulsaMarket.id,
    organizer: organizers.redDirtCollectibles,
    venue: venues.tulsaMarket,
  }),
  show({
    id: "fixture-show-ne-omaha-hobby",
    title: "Omaha Hobby Card Show",
    slug: "omaha-hobby-card-show-2026",
    description:
      "A Nebraska regional event with strong sports card inventory, wax, and value tables aimed at local collectors and weekend travelers.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-05-30T09:00:00"),
    endDate: new Date("2026-05-30T15:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "3:00 PM",
    city: "Omaha",
    state: "NE",
    isFree: false,
    admissionPrice: "$4",
    admissionNotes: "Cash and card accepted at the door.",
    tableCount: 70,
    vendorDetails: "Promoter is still accepting local dealer applications.",
    estimatedAttendance: 325,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.omahaCenter.parkingInfo,
    loadInInfo: venues.omahaCenter.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "Pokemon", "Mixed"],
    lastVerifiedAt: new Date("2026-04-15T12:00:00"),
    expiresAt: new Date("2026-05-31T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-06T10:00:00"),
    updatedAt: new Date("2026-04-15T12:00:00"),
    organizerId: organizers.plainsCardMarket.id,
    venueId: venues.omahaCenter.id,
    organizer: organizers.plainsCardMarket,
    venue: venues.omahaCenter,
  }),
  show({
    id: "fixture-show-ne-lincoln-market",
    title: "Lincoln Card and Collectibles Market",
    slug: "lincoln-card-and-collectibles-market-2026",
    description:
      "A collector-focused Nebraska weekend show with sports cards, Pokemon, and entry-level table pricing for smaller dealers.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-06-13T10:00:00"),
    endDate: new Date("2026-06-13T16:00:00"),
    startTimeLabel: "10:00 AM",
    endTimeLabel: "4:00 PM",
    city: "Lincoln",
    state: "NE",
    isFree: true,
    admissionPrice: null,
    admissionNotes: "Free public admission.",
    tableCount: 55,
    vendorDetails: "Low-cost vendor tables available for new dealers.",
    estimatedAttendance: 250,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.lincolnPavilion.parkingInfo,
    loadInInfo: venues.lincolnPavilion.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "Pokemon", "TCG"],
    lastVerifiedAt: new Date("2026-04-15T12:00:00"),
    expiresAt: new Date("2026-06-14T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-06T11:00:00"),
    updatedAt: new Date("2026-04-15T12:00:00"),
    organizerId: organizers.plainsCardMarket.id,
    venueId: venues.lincolnPavilion.id,
    organizer: organizers.plainsCardMarket,
    venue: venues.lincolnPavilion,
  }),
  show({
    id: "fixture-show-ia-des-moines",
    title: "Des Moines Sports Card Show",
    slug: "des-moines-sports-card-show-2026",
    description:
      "A growing Iowa sports card event with modern singles, grading-ready inventory, and family-friendly hours.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-06-20T09:00:00"),
    endDate: new Date("2026-06-20T15:00:00"),
    startTimeLabel: "9:00 AM",
    endTimeLabel: "3:00 PM",
    city: "Des Moines",
    state: "IA",
    isFree: false,
    admissionPrice: "$3",
    admissionNotes: "Kids 10 and under are free.",
    tableCount: 65,
    vendorDetails: "Sports cards lead the floor, with a smaller TCG section.",
    estimatedAttendance: 280,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.desMoinesHall.parkingInfo,
    loadInInfo: venues.desMoinesHall.loadInInfo,
    venueNotes: null,
    categories: ["Sports Cards", "TCG"],
    lastVerifiedAt: new Date("2026-04-15T12:00:00"),
    expiresAt: new Date("2026-06-21T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-07T10:00:00"),
    updatedAt: new Date("2026-04-15T12:00:00"),
    organizerId: organizers.midwestHobbyEvents.id,
    venueId: venues.desMoinesHall.id,
    organizer: organizers.midwestHobbyEvents,
    venue: venues.desMoinesHall,
  }),
  show({
    id: "fixture-show-il-chicagoland",
    title: "Chicagoland Card Expo",
    slug: "chicagoland-card-expo-2026",
    description:
      "A larger Illinois market event with modern, vintage, memorabilia, and Pokemon inventory from dealers across the region.",
    status: "APPROVED",
    sourceType: "MANUAL",
    timezone: "America/Chicago",
    startDate: new Date("2026-06-27T10:00:00"),
    endDate: new Date("2026-06-28T16:00:00"),
    startTimeLabel: "10:00 AM",
    endTimeLabel: "4:00 PM",
    city: "Rosemont",
    state: "IL",
    isFree: false,
    admissionPrice: "$10 weekend pass",
    admissionNotes: "Early entry badge available online only.",
    tableCount: 240,
    vendorDetails: "Dealer floor is full with a waitlist for premium placement.",
    estimatedAttendance: 1400,
    flyerImageUrl: null,
    websiteUrl: null,
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: venues.chicagoHall.parkingInfo,
    loadInInfo: venues.chicagoHall.loadInInfo,
    venueNotes: "Main stage programming begins at noon on Saturday.",
    categories: ["Sports Cards", "Pokemon", "Memorabilia"],
    lastVerifiedAt: new Date("2026-04-16T12:00:00"),
    expiresAt: new Date("2026-06-29T23:59:59"),
    featuredRank: null,
    createdAt: new Date("2026-04-08T10:00:00"),
    updatedAt: new Date("2026-04-16T12:00:00"),
    organizerId: organizers.midwestHobbyEvents.id,
    venueId: venues.chicagoHall.id,
    organizer: organizers.midwestHobbyEvents,
    venue: venues.chicagoHall,
  }),
];
