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
  return db.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await tx.emailVerificationToken.deleteMany({ where: { id: record.id } });
      }
      return null;
    }

    const consumed = await tx.emailVerificationToken.deleteMany({
      where: {
        id: record.id,
        token: tokenHash,
      },
    });
    if (consumed.count !== 1) return null;

    return tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
  });
}
