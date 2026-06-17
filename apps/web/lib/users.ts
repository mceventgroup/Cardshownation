import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { getEmailConfigStatus, sendFanVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { US_STATES } from "@/lib/states";
import { hashOpaqueToken } from "@/lib/token-hash";
import type { Prisma, UserRole } from "@csn/db";

type RegisterFanInput = {
  email: string;
  password: string;
  name: string;
  stateCodes: string[];
  organizerIds: string[];
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

type UpdateFanProfileInput = {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
};

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VALID_STATE_CODES = new Set(US_STATES.map((state) => state.code));

type FanAccountData = Prisma.UserGetPayload<{
  include: {
    favoriteOrganizers: {
      include: {
        organizer: {
          select: {
            id: true;
            name: true;
            verified: true;
          };
        };
      };
      orderBy: {
        organizer: {
          name: "asc";
        };
      };
    };
    subscriptions: {
      orderBy: {
        stateCode: "asc";
      };
    };
    _count: {
      select: {
        savedShows: true;
      };
    };
  };
}>;

export type FavoriteOrganizerOption = {
  id: string;
  name: string;
  verified: boolean;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeOptionalField(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function createEmailVerificationTokenValue() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS);
  return { token, tokenHash, expiresAt };
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
  const organizerIds = [...new Set(input.organizerIds.map((id) => id.trim()).filter(Boolean))];

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
      favoriteOrganizers: organizerIds.length
        ? {
            create: organizerIds.map((organizerId) => ({
              organizerId,
            })),
          }
        : undefined,
    },
    include: {
      favoriteOrganizers: true,
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

export async function getFanAccountData(userId: string): Promise<FanAccountData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      favoriteOrganizers: {
        include: {
          organizer: {
            select: {
              id: true,
              name: true,
              verified: true,
            },
          },
        },
        orderBy: {
          organizer: {
            name: "asc",
          },
        },
      },
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

export async function updateFanFavoriteOrganizers(userId: string, organizerIds: string[]) {
  const normalizedIds = [...new Set(organizerIds.map((id) => id.trim()).filter(Boolean))];

  const availableOrganizers = normalizedIds.length
    ? await db.organizer.findMany({
        where: {
          id: { in: normalizedIds },
        },
        select: {
          id: true,
        },
      })
    : [];
  const validOrganizerIds = new Set(availableOrganizers.map((organizer) => organizer.id));

  await db.$transaction(async (tx) => {
    await tx.userFavoriteOrganizer.deleteMany({
      where: {
        userId,
        organizerId: {
          notIn: normalizedIds.length ? normalizedIds : ["__NONE__"],
        },
      },
    });

    for (const organizerId of normalizedIds) {
      if (!validOrganizerIds.has(organizerId)) {
        continue;
      }

      await tx.userFavoriteOrganizer.upsert({
        where: {
          userId_organizerId: {
            userId,
            organizerId,
          },
        },
        create: {
          userId,
          organizerId,
        },
        update: {},
      });
    }
  });
}

export async function listFavoriteOrganizerOptions(): Promise<FavoriteOrganizerOption[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const organizers = await db.organizer.findMany({
    where: {
      shows: {
        some: {
          status: "APPROVED",
          startDate: { gte: today },
          OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
        },
      },
    },
    select: {
      id: true,
      name: true,
      verified: true,
    },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
    take: 24,
  });

  return organizers;
}

export async function updateFanProfile(input: UpdateFanProfileInput) {
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 320);
  const phone = normalizeOptionalField(input.phone, 40);
  const city = normalizeOptionalField(input.city, 80);
  const state = normalizeOptionalField(input.state, 2)?.toUpperCase() ?? null;

  if (!name || !isValidEmail(email)) {
    throw new Error("Please enter a valid name and email address.");
  }

  if (state && !VALID_STATE_CODES.has(state)) {
    throw new Error("Please choose a valid state.");
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user || user.role !== "FAN") {
    throw new Error("User account not found.");
  }

  const profileData = {
    name,
    phone,
    city,
    state,
  };

  const emailChanged = email !== user.email;
  if (!emailChanged) {
    await db.user.update({
      where: { id: user.id },
      data: {
        ...profileData,
        email,
      },
    });

    return { emailChanged: false as const };
  }

  const emailConfig = getEmailConfigStatus();
  if (!emailConfig.ready) {
    throw new Error(emailConfig.error);
  }

  const existingUser = await db.user.findUnique({
    where: { email },
  });
  if (existingUser && existingUser.id !== user.id) {
    throw new Error("An account already exists for that email.");
  }

  await db.user.update({
    where: { id: user.id },
    data: profileData,
  });

  const verification = createEmailVerificationTokenValue();

  await db.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        email,
        emailVerifiedAt: null,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verification.tokenHash,
        expiresAt: verification.expiresAt,
      },
    });
  });

  try {
    const verifyUrl = `${getAppUrl()}/account/verify?token=${verification.token}`;
    await sendFanVerificationEmail(email, verifyUrl);
  } catch (error) {
    await db.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      });
    });

    throw error;
  }

  return { emailChanged: true as const };
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

  let updatedUser = user;
  if (user.role !== "MODERATOR") {
    updatedUser = await db.user.update({
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

  return updatedUser;
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
