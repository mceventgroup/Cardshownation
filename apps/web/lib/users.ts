import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import type { UserRole } from "@csn/db";

type RegisterFanInput = {
  email: string;
  password: string;
  name: string;
  stateCodes: string[];
};

type CreateModeratorInput = {
  email: string;
  password: string;
  name: string;
  actorId: string;
};

type AdminModeratorActionInput = {
  moderatorUserId: string;
  actorId: string;
};

type AdminUserActionInput = {
  actorId: string;
  userId: string;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com";
}

export function getPasswordResetPathForRole(role: UserRole) {
  switch (role) {
    case "MODERATOR":
      return "/moderator/reset-password";
    case "ORGANIZER":
      return "/promoter/reset-password";
    default:
      return "/account/reset-password";
  }
}

export async function registerFanAccount(input: RegisterFanInput) {
  const email = input.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account already exists for that email.");
  }

  const passwordHash = await hashPassword(input.password);
  const stateCodes = [...new Set(input.stateCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];

  return db.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      role: "FAN",
      subscriptions: stateCodes.length
        ? {
            create: stateCodes.map((stateCode) => ({
              stateCode,
              emailEnabled: true,
            })),
          }
        : undefined,
    },
    include: {
      subscriptions: true,
    },
  });
}

export async function authenticateFan(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.role !== "FAN") {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}

export async function getFanAccountData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        orderBy: { stateCode: "asc" },
      },
      _count: {
        select: {
          savedShows: true,
        },
      },
    },
  });

  if (!user || user.role !== "FAN") {
    return null;
  }

  return user;
}

export async function updateFanStateSubscriptions(userId: string, stateCodes: string[]) {
  const normalizedCodes = [...new Set(stateCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];

  await db.$transaction(async (tx) => {
    await tx.userStateSubscription.deleteMany({
      where: {
        userId,
        stateCode: {
          notIn: normalizedCodes.length ? normalizedCodes : ["__NONE__"],
        },
      },
    });

    for (const stateCode of normalizedCodes) {
      await tx.userStateSubscription.upsert({
        where: {
          userId_stateCode: {
            userId,
            stateCode,
          },
        },
        create: {
          userId,
          stateCode,
          emailEnabled: true,
        },
        update: {
          emailEnabled: true,
        },
      });
    }
  });
}

export async function createModeratorAccountByAdmin(input: CreateModeratorInput) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser && existingUser.role !== "FAN" && existingUser.role !== "MODERATOR") {
    throw new Error("That email already belongs to a protected account type.");
  }

  const user = existingUser
    ? await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          passwordHash,
          role: "MODERATOR",
        },
      })
    : await db.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: "MODERATOR",
        },
      });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "moderator.created",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
    },
  });

  return user;
}

export async function listModeratorAccounts() {
  return db.user.findMany({
    where: { role: "MODERATOR" },
    include: {
      _count: {
        select: {
          moderatedSubmissions: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function listManageableAccounts() {
  return db.user.findMany({
    where: {
      role: {
        not: "ADMIN",
      },
    },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
          verified: true,
        },
      },
      _count: {
        select: {
          moderatedSubmissions: true,
          subscriptions: true,
          savedShows: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getUserRoleStats() {
  const [fans, moderators, promoters, admins, subscriptions] = await Promise.all([
    db.user.count({ where: { role: "FAN" } }),
    db.user.count({ where: { role: "MODERATOR" } }),
    db.user.count({ where: { role: "ORGANIZER" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.userStateSubscription.count(),
  ]);

  return { fans, moderators, promoters, admins, subscriptions };
}

export async function resetModeratorPasswordByAdmin(
  input: AdminModeratorActionInput & { nextPassword: string }
) {
  const user = await db.user.findUnique({
    where: { id: input.moderatorUserId },
  });

  if (!user || user.role !== "MODERATOR") {
    throw new Error("Moderator account not found.");
  }

  const passwordHash = await hashPassword(input.nextPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "moderator.password_reset",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
    },
  });
}

export async function revokeModeratorAccessByAdmin(input: AdminModeratorActionInput) {
  const user = await db.user.findUnique({
    where: { id: input.moderatorUserId },
  });

  if (!user || user.role !== "MODERATOR") {
    throw new Error("Moderator account not found.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: "FAN" },
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "moderator.revoked",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
    },
  });
}

export async function assignModeratorAccessByAdmin(input: AdminUserActionInput) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  if (user.role === "ADMIN" || user.role === "ORGANIZER") {
    throw new Error("That account type cannot be converted to moderator.");
  }

  if (user.role !== "MODERATOR") {
    await db.user.update({
      where: { id: user.id },
      data: { role: "MODERATOR" },
    });
  }

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "moderator.assigned",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
      previousRole: user.role,
    },
  });

  return user.role === "MODERATOR"
    ? user
    : db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
}

export async function sendPasswordResetByAdmin(input: AdminUserActionInput) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user || user.role === "ADMIN") {
    throw new Error("User account not found.");
  }

  const token = await createPasswordResetToken(user.id);
  const resetUrl = `${getAppUrl()}${getPasswordResetPathForRole(user.role)}?token=${token}`;

  await sendPasswordResetEmail(user.email, resetUrl, user.role);

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "user.password_reset_sent",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
      role: user.role,
    },
  });
}

export async function deleteUserAccountByAdmin(input: AdminUserActionInput) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    include: {
      organizer: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  if (user.role === "ADMIN") {
    throw new Error("Admin accounts cannot be deleted here.");
  }

  await db.$transaction(async (tx) => {
    if (user.organizer?.id) {
      await tx.organizer.update({
        where: { id: user.organizer.id },
        data: {
          userId: null,
        },
      });
    }

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "user.deleted",
    targetType: "User",
    targetId: user.id,
    details: {
      email: user.email,
      role: user.role,
      organizerId: user.organizer?.id ?? null,
      organizerDetached: Boolean(user.organizer?.id),
    },
  });
}
