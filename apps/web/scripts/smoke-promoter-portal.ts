import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(scriptDirectory, "..", ".env.local");
const envContent = readFileSync(envPath, "utf8");

for (const line of envContent.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) {
    continue;
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex === -1) {
    continue;
  }

  const key = line.slice(0, separatorIndex).trim();
  const rawValue = line.slice(separatorIndex + 1).trim();
  process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
}

async function main() {
  const { db } = await import("../lib/db");
  const {
    authenticatePromoter,
    createPromoterShow,
    registerPromoterAccount,
  } = await import("../lib/promoters");
  const email = `portal-test-${Date.now()}@example.com`;
  const password = "PortalTest123!";

  const user = await registerPromoterAccount({
    contactName: "Portal Test",
    organizerName: "Portal Test Promotions",
    email,
    password,
    websiteUrl: "https://example.com",
    facebookUrl: "https://facebook.com/example",
    instagramUrl: "https://instagram.com/example",
  });

  const authed = await authenticatePromoter(email, password);
  if (!authed) {
    throw new Error("Authentication failed after signup.");
  }

  const first = await createPromoterShow(user.id, {
    showName: "Portal Test Show One",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    city: "Kansas City",
    state: "MO",
    venueName: "Test Venue One",
    venueAddress: "123 Test St",
    categories: ["Sports Cards"],
    description: "First promoter portal test show",
    tableCount: "40",
    vendorDetails: "Open tables",
    websiteUrl: "https://example.com/show-1",
    facebookUrl: "https://facebook.com/events/test-1",
    isFree: false,
    admissionPrice: "$5",
    admissionNotes: "Cash at door",
    parkingInfo: "Free lot",
    flyerFile: null,
  });

  const organizer = await db.organizer.findUniqueOrThrow({
    where: { userId: user.id },
  });

  await db.organizerApproval.upsert({
    where: {
      organizerId_city_state: {
        organizerId: organizer.id,
        city: "Kansas City",
        state: "MO",
      },
    },
    create: {
      organizerId: organizer.id,
      city: "Kansas City",
      state: "MO",
      autoApprove: true,
      reviewEvery: 4,
    },
    update: {
      autoApprove: true,
      reviewEvery: 4,
    },
  });

  const second = await createPromoterShow(user.id, {
    showName: "Portal Test Show Two",
    startDate: "2026-08-14",
    endDate: "2026-08-14",
    city: "Kansas City",
    state: "MO",
    venueName: "Test Venue Two",
    venueAddress: "456 Test Ave",
    categories: ["Sports Cards", "Pokemon"],
    description: "Second promoter portal test show",
    tableCount: "55",
    vendorDetails: "Waitlist open",
    websiteUrl: "https://example.com/show-2",
    facebookUrl: "https://facebook.com/events/test-2",
    isFree: true,
    admissionPrice: "",
    admissionNotes: "",
    parkingInfo: "Garage nearby",
    flyerFile: null,
  });

  const approval = await db.organizerApproval.findUnique({
    where: {
      organizerId_city_state: {
        organizerId: organizer.id,
        city: "Kansas City",
        state: "MO",
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        email,
        firstStatus: first.status,
        firstTerritoryStatus: "territoryStatus" in first ? first.territoryStatus : first.status,
        secondStatus: second.status,
        secondTerritoryStatus: "territoryStatus" in second ? second.territoryStatus : second.status,
        approvalCount: approval?.approvedShowCount ?? null,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import("../lib/db");
    await db.$disconnect();
  });
