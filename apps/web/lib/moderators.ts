import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";

export async function authenticateModerator(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || user.role !== "MODERATOR") {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}

export async function getModeratorDashboardData(userId: string) {
  const [user, pendingCount, reviewedCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.showSubmission.count({ where: { status: "PENDING" } }),
    db.showSubmission.count({
      where: {
        reviewerId: userId,
      },
    }),
  ]);

  if (!user || user.role !== "MODERATOR") {
    return null;
  }

  return {
    user,
    pendingCount,
    reviewedCount,
  };
}

export async function getModeratorAccountData(userId: string) {
  return db.user.findFirst({
    where: {
      id: userId,
      role: "MODERATOR",
    },
    include: {
      subscriptions: {
        orderBy: { stateCode: "asc" },
      },
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
          organizer: { name: "asc" },
        },
      },
    },
  });
}
