import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { hashPassword, verifyPassword } from "@/lib/passwords";

export const MIN_ADMIN_PASSWORD_LENGTH = 15;

type RegisterAdminInput = {
  email: string;
  password: string;
  name: string;
};

export async function authenticateAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}

export async function registerInitialAdmin(input: RegisterAdminInput) {
  const email = input.email.trim().toLowerCase();

  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`Admin passwords must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }

  const [existingUser, adminCount, passwordHash] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.user.count({ where: { role: "ADMIN" } }),
    hashPassword(input.password),
  ]);

  if (adminCount > 0) {
    throw new Error("An admin account already exists.");
  }

  if (existingUser) {
    return db.user.update({
      where: { id: existingUser.id },
      data: {
        name: input.name,
        passwordHash,
        role: "ADMIN",
      },
    });
  }

  return db.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });
}

export async function hasAnyAdminUsers() {
  const count = await db.user.count({ where: { role: "ADMIN" } });
  return count > 0;
}

export async function updateAdminPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  if (input.nextPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`Admin passwords must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user || user.role !== "ADMIN") {
    throw new Error("Admin account not found.");
  }

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new Error("Current password was incorrect.");
  }

  const passwordHash = await hashPassword(input.nextPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionVersion: {
        increment: 1,
      },
    },
  });

  await writeAuditLog({
    actorId: user.id,
    actorRole: "ADMIN",
    action: "admin.password_changed",
    targetType: "User",
    targetId: user.id,
  });
}
