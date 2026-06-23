import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/token-hash";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createVerificationToken(userId: string) {
  await db.emailVerificationToken.deleteMany({ where: { userId } });
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.emailVerificationToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });
  return token;
}

export async function consumeVerificationToken(token: string) {
  const tokenHash = hashOpaqueToken(token);
  const record = await db.emailVerificationToken.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  await db.emailVerificationToken.delete({ where: { id: record.id } });

  await db.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return record.user;
}
