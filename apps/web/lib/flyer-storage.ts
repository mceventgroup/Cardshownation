import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

export type FlyerStorageDriver = "vercel-blob" | "local";

const blobReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
const isProduction = process.env.NODE_ENV === "production";

function getFlyerStorageDriver(): FlyerStorageDriver {
  return blobReadWriteToken ? "vercel-blob" : "local";
}

export function isHostedFlyerAssetUrl(url: URL, appHost: string) {
  if (url.host === appHost && url.pathname.startsWith("/uploads/flyers/")) {
    return true;
  }

  return (
    url.host.includes("vercel-storage.com") &&
    url.pathname.includes("/flyers/") &&
    url.pathname.toLowerCase().endsWith(".webp")
  );
}

export async function persistFlyerAsset(finalName: string, normalizedBytes: Buffer) {
  const driver = getFlyerStorageDriver();

  if (driver === "vercel-blob") {
    const blob = await put(`flyers/${finalName}`, normalizedBytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
      token: blobReadWriteToken,
    });

    return blob.url;
  }

  if (isProduction) {
    throw new Error("Flyer uploads require configured production storage.");
  }

  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "flyers");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, finalName), normalizedBytes);

  return `/uploads/flyers/${finalName}`;
}
