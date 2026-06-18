import assert from "node:assert/strict";
import test, { afterEach, before, mock } from "node:test";

process.env.DATABASE_URL ??= "postgresql://user@localhost:5432/csn_test";
process.env.CSN_DATA_MODE = "live";
process.env.NEXT_PUBLIC_APP_URL = "https://cardshownation.com";

let db: typeof import("./db").db;
let usersModule: typeof import("./users");
const restorers: Array<() => void> = [];

function stubMethod(target: any, key: string, implementation: (...args: any[]) => any) {
  const original = target[key];
  const calls: Array<{ arguments: any[] }> = [];

  const wrapped = (...args: any[]) => {
    calls.push({ arguments: args });
    return implementation(...args);
  };

  target[key] = wrapped;
  restorers.push(() => {
    target[key] = original;
  });

  return { mock: { calls } };
}

before(async () => {
  ({ db } = await import("./db"));
  usersModule = await import("./users");
});

afterEach(() => {
  mock.restoreAll();
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
});

test("assignModeratorAccessByAdmin promotes fan accounts and writes an audit log", async () => {
  const findUserMock = stubMethod(db.user, "findUnique", async () => ({
    id: "fan-1",
    email: "fan@example.com",
    role: "FAN",
  }));
  const updateUserMock = stubMethod(db.user, "update", async (input) => input);
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  await usersModule.assignModeratorAccessByAdmin({
    actorId: "admin-1",
    userId: "fan-1",
  });

  assert.equal(findUserMock.mock.calls.length, 1);
  assert.deepEqual(updateUserMock.mock.calls[0]?.arguments[0], {
    where: { id: "fan-1" },
    data: { role: "MODERATOR" },
  });
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "moderator.assigned",
      targetType: "User",
      targetId: "fan-1",
      details: {
        email: "fan@example.com",
        previousRole: "FAN",
      },
    },
  });
});

test("assignModeratorAccessByAdmin rejects organizer accounts", async () => {
  stubMethod(db.user, "findUnique", async () => ({
    id: "organizer-1",
    email: "promoter@example.com",
    role: "ORGANIZER",
  }));

  await assert.rejects(
    () =>
      usersModule.assignModeratorAccessByAdmin({
        actorId: "admin-1",
        userId: "organizer-1",
      }),
    /cannot be converted to moderator/i
  );
});

test("createManagedAccountByAdmin creates member accounts and records the audit log", async () => {
  stubMethod(db.user, "findUnique", async () => null);
  const createUserMock = stubMethod(db.user, "create", async (input) => ({
    id: "fan-2",
    email: input.data.email,
    role: input.data.role,
    name: input.data.name,
  }));
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  const result = await usersModule.createManagedAccountByAdmin({
    actorId: "admin-1",
    role: "FAN",
    email: "newfan@example.com",
    name: "New Fan",
  });

  assert.equal(createUserMock.mock.calls.length, 1);
  assert.deepEqual(createUserMock.mock.calls[0]?.arguments[0], {
    data: {
      name: "New Fan",
      email: "newfan@example.com",
      passwordHash: createUserMock.mock.calls[0]?.arguments[0].data.passwordHash,
      role: "FAN",
    },
  });
  assert.equal(typeof createUserMock.mock.calls[0]?.arguments[0].data.passwordHash, "string");
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "user.created_by_admin",
      targetType: "User",
      targetId: "fan-2",
      details: {
        email: "newfan@example.com",
        role: "FAN",
        organizerName: null,
      },
    },
  });
  assert.deepEqual(result, {
    id: "fan-2",
    email: "newfan@example.com",
    role: "FAN",
    name: "New Fan",
  });
});

test("createManagedAccountByAdmin links promoter accounts to existing organizer records", async () => {
  stubMethod(db.user, "findUnique", async () => null);
  stubMethod(db.organizer, "findFirst", async () => ({
    id: "organizer-1",
  }));
  const createUserMock = stubMethod(db.user, "create", async (input) => ({
    id: "promoter-user-1",
    email: input.data.email,
    role: input.data.role,
    name: input.data.name,
  }));
  const updateOrganizerMock = stubMethod(db.organizer, "update", async (input) => input);
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  const result = await usersModule.createManagedAccountByAdmin({
    actorId: "admin-1",
    role: "ORGANIZER",
    email: "promoter@example.com",
    name: "Promoter Person",
    organizerName: "Big Card Shows",
  });

  assert.equal(createUserMock.mock.calls.length, 1);
  assert.deepEqual(updateOrganizerMock.mock.calls[0]?.arguments[0], {
    where: { id: "organizer-1" },
    data: {
      userId: "promoter-user-1",
      name: "Big Card Shows",
    },
  });
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "user.created_by_admin",
      targetType: "User",
      targetId: "promoter-user-1",
      details: {
        email: "promoter@example.com",
        role: "ORGANIZER",
        organizerName: "Big Card Shows",
      },
    },
  });
  assert.deepEqual(result, {
    id: "promoter-user-1",
    email: "promoter@example.com",
    role: "ORGANIZER",
    name: "Promoter Person",
  });
});

test("createTestAccountByAdmin creates auto-verified test accounts with a login path", async () => {
  const createUserMock = stubMethod(db.user, "create", async (input) => ({
    id: "test-user-1",
    email: input.data.email,
    role: input.data.role,
    name: input.data.name,
  }));
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  const result = await usersModule.createTestAccountByAdmin({
    actorId: "admin-1",
    role: "MODERATOR",
    name: "QA Moderator",
  });

  assert.equal(createUserMock.mock.calls.length, 1);
  assert.match(createUserMock.mock.calls[0]?.arguments[0].data.email, /^moderator-test-/);
  assert.match(createUserMock.mock.calls[0]?.arguments[0].data.email, /@cardshownation\.test$/);
  assert.equal(createUserMock.mock.calls[0]?.arguments[0].data.role, "MODERATOR");
  assert.equal(typeof createUserMock.mock.calls[0]?.arguments[0].data.passwordHash, "string");
  assert.ok(createUserMock.mock.calls[0]?.arguments[0].data.emailVerifiedAt instanceof Date);
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "user.test_created_by_admin",
      targetType: "User",
      targetId: "test-user-1",
      details: {
        email: createUserMock.mock.calls[0]?.arguments[0].data.email,
        role: "MODERATOR",
        organizerName: null,
      },
    },
  });
  assert.equal(result.user.id, "test-user-1");
  assert.equal(result.user.role, "MODERATOR");
  assert.equal(result.loginPath, "/moderator/login");
  assert.match(result.password, /^Csn-/);
});

test("getPasswordResetPathForRole returns the correct route for each account type", () => {
  assert.equal(usersModule.getPasswordResetPathForRole("FAN"), "/account/reset-password");
  assert.equal(usersModule.getPasswordResetPathForRole("MODERATOR"), "/moderator/reset-password");
  assert.equal(usersModule.getPasswordResetPathForRole("ORGANIZER"), "/promoter/reset-password");
});

test("deleteUserAccountByAdmin deletes non-admin users and records the action", async () => {
  stubMethod(db.user, "findUnique", async () => ({
    id: "user-1",
    email: "user@example.com",
    role: "FAN",
    organizer: null,
  }));
  const transactionCalls: any[] = [];
  const organizerUpdateCalls: any[] = [];
  const userDeleteCalls: any[] = [];
  const originalTransaction = db.$transaction;

  (db as any).$transaction = async (callback: (tx: any) => Promise<void>) => {
    transactionCalls.push(true);
    await callback({
      organizer: {
        update: async (input: any) => {
          organizerUpdateCalls.push(input);
          return input;
        },
      },
      user: {
        delete: async (input: any) => {
          userDeleteCalls.push(input);
          return input;
        },
      },
    });
  };
  restorers.push(() => {
    (db as any).$transaction = originalTransaction;
  });

  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  await usersModule.deleteUserAccountByAdmin({
    actorId: "admin-1",
    userId: "user-1",
  });

  assert.equal(transactionCalls.length, 1);
  assert.equal(organizerUpdateCalls.length, 0);
  assert.deepEqual(userDeleteCalls[0], {
    where: { id: "user-1" },
  });
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "user.deleted",
      targetType: "User",
      targetId: "user-1",
      details: {
        email: "user@example.com",
        role: "FAN",
        organizerId: null,
        organizerDetached: false,
      },
    },
  });
});

test("deleteUserAccountByAdmin explicitly detaches organizer records before deleting organizer users", async () => {
  stubMethod(db.user, "findUnique", async () => ({
    id: "organizer-user-1",
    email: "promoter@example.com",
    role: "ORGANIZER",
    organizer: {
      id: "organizer-1",
    },
  }));

  const transactionCalls: any[] = [];
  const organizerUpdateCalls: any[] = [];
  const userDeleteCalls: any[] = [];
  const originalTransaction = db.$transaction;

  (db as any).$transaction = async (callback: (tx: any) => Promise<void>) => {
    transactionCalls.push(true);
    await callback({
      organizer: {
        update: async (input: any) => {
          organizerUpdateCalls.push(input);
          return input;
        },
      },
      user: {
        delete: async (input: any) => {
          userDeleteCalls.push(input);
          return input;
        },
      },
    });
  };
  restorers.push(() => {
    (db as any).$transaction = originalTransaction;
  });

  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  await usersModule.deleteUserAccountByAdmin({
    actorId: "admin-1",
    userId: "organizer-user-1",
  });

  assert.equal(transactionCalls.length, 1);
  assert.deepEqual(organizerUpdateCalls[0], {
    where: { id: "organizer-1" },
    data: {
      userId: null,
    },
  });
  assert.deepEqual(userDeleteCalls[0], {
    where: { id: "organizer-user-1" },
  });
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "user.deleted",
      targetType: "User",
      targetId: "organizer-user-1",
      details: {
        email: "promoter@example.com",
        role: "ORGANIZER",
        organizerId: "organizer-1",
        organizerDetached: true,
      },
    },
  });
});

test("updateFanProfile updates profile fields without reverification when email is unchanged", async () => {
  const findUserMock = stubMethod(db.user, "findUnique", async (input) => {
    if (input.where.id === "fan-1") {
      return {
        id: "fan-1",
        email: "fan@example.com",
        role: "FAN",
        emailVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
      };
    }

    return null;
  });
  const updateUserMock = stubMethod(db.user, "update", async (input) => input);

  const result = await usersModule.updateFanProfile({
    userId: "fan-1",
    name: "Updated Fan",
    email: "fan@example.com",
    phone: "555-111-2222",
    city: "Wichita",
    state: "ks",
  });

  assert.equal(findUserMock.mock.calls.length, 1);
  assert.deepEqual(updateUserMock.mock.calls[0]?.arguments[0], {
    where: { id: "fan-1" },
    data: {
      name: "Updated Fan",
      phone: "555-111-2222",
      city: "Wichita",
      state: "KS",
      email: "fan@example.com",
    },
  });
  assert.deepEqual(result, { emailChanged: false });
});

test("updateFanProfile changes email, stores a verification token, and sends verification email", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "Card Show Nation <noreply@cardshownation.com>";

  stubMethod(db.user, "findUnique", async (input) => {
    if (input.where.id === "fan-1") {
      return {
        id: "fan-1",
        email: "fan@example.com",
        role: "FAN",
        emailVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
      };
    }

    if (input.where.email === "new@example.com") {
      return null;
    }

    return null;
  });

  const updateUserCalls: any[] = [];
  const deleteTokenCalls: any[] = [];
  const createTokenCalls: any[] = [];
  const sentEmails: any[] = [];
  const originalTransaction = db.$transaction;
  const originalFetch = global.fetch;

  stubMethod(db.user, "update", async (input) => {
    updateUserCalls.push(input);
    return input;
  });

  global.fetch = async (_input: any, init?: any) => {
    sentEmails.push(JSON.parse(init?.body ?? "{}"));
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  (db as any).$transaction = async (callback: (tx: any) => Promise<void>) => {
    await callback({
      emailVerificationToken: {
        deleteMany: async (input: any) => {
          deleteTokenCalls.push(input);
          return input;
        },
        create: async (input: any) => {
          createTokenCalls.push(input);
          return input;
        },
      },
      user: {
        update: async (input: any) => {
          updateUserCalls.push(input);
          return input;
        },
      },
    });
  };

  restorers.push(() => {
    (db as any).$transaction = originalTransaction;
    global.fetch = originalFetch;
  });

  const result = await usersModule.updateFanProfile({
    userId: "fan-1",
    name: "Updated Fan",
    email: "new@example.com",
    city: "Omaha",
    state: "NE",
  });

  assert.deepEqual(updateUserCalls[0], {
    where: { id: "fan-1" },
    data: {
      name: "Updated Fan",
      phone: null,
      city: "Omaha",
      state: "NE",
    },
  });
  assert.deepEqual(deleteTokenCalls[0], {
    where: { userId: "fan-1" },
  });
  assert.equal(createTokenCalls.length, 1);
  assert.equal(createTokenCalls[0]?.data.userId, "fan-1");
  assert.equal(typeof createTokenCalls[0]?.data.token, "string");
  assert.deepEqual(updateUserCalls[1], {
    where: { id: "fan-1" },
    data: {
      email: "new@example.com",
      emailVerifiedAt: null,
      sessionVersion: {
        increment: 1,
      },
    },
  });
  assert.equal(sentEmails[0]?.from, "Card Show Nation <noreply@cardshownation.com>");
  assert.equal(sentEmails[0]?.to, "new@example.com");
  assert.match(sentEmails[0]?.subject ?? "", /confirm your new/i);
  assert.deepEqual(result, { emailChanged: true });
});

test("changeFanPassword rotates the stored password and session version", async () => {
  const { hashPassword } = await import("./passwords");

  stubMethod(db.user, "findUnique", async () => ({
    id: "fan-1",
    email: "fan@example.com",
    role: "FAN",
    passwordHash: await hashPassword("password123"),
  }));
  const updateUserMock = stubMethod(db.user, "update", async (input) => input);
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  await usersModule.changeFanPassword({
    userId: "fan-1",
    currentPassword: "password123",
    nextPassword: "new-password-456",
  });

  assert.equal(updateUserMock.mock.calls.length, 1);
  assert.equal(updateUserMock.mock.calls[0]?.arguments[0].where.id, "fan-1");
  assert.deepEqual(updateUserMock.mock.calls[0]?.arguments[0].data.sessionVersion, {
    increment: 1,
  });
  assert.equal(typeof updateUserMock.mock.calls[0]?.arguments[0].data.passwordHash, "string");
  assert.deepEqual(auditLogMock.mock.calls[0]?.arguments[0], {
    data: {
      actorId: "fan-1",
      actorRole: "FAN",
      action: "fan.password_changed",
      targetType: "User",
      targetId: "fan-1",
      details: undefined,
    },
  });
});

test("registerFanAccount creates both state and organizer preferences", async () => {
  stubMethod(db.user, "findUnique", async () => null);
  const createUserMock = stubMethod(db.user, "create", async (input) => input);

  await usersModule.registerFanAccount({
    email: "fan@example.com",
    password: "password123",
    name: "Favorite Fan",
    stateCodes: ["ks", "MO", "KS"],
    organizerIds: ["org-1", "org-2", "org-1"],
  });

  const createInput = createUserMock.mock.calls[0]?.arguments[0];
  assert.equal(createInput.data.email, "fan@example.com");
  assert.equal(createInput.data.name, "Favorite Fan");
  assert.deepEqual(createInput.data.subscriptions.create, [
    { stateCode: "KS", emailEnabled: true },
    { stateCode: "MO", emailEnabled: true },
  ]);
  assert.deepEqual(createInput.data.favoriteOrganizers.create, [
    { organizerId: "org-1" },
    { organizerId: "org-2" },
  ]);
});

test("updateFanFavoriteOrganizers replaces saved host follows", async () => {
  stubMethod(db.organizer, "findMany", async () => [{ id: "org-1" }, { id: "org-2" }]);

  const deleteCalls: any[] = [];
  const upsertCalls: any[] = [];
  const originalTransaction = db.$transaction;

  (db as any).$transaction = async (callback: (tx: any) => Promise<void>) => {
    await callback({
      userFavoriteOrganizer: {
        deleteMany: async (input: any) => {
          deleteCalls.push(input);
          return input;
        },
        upsert: async (input: any) => {
          upsertCalls.push(input);
          return input;
        },
      },
    });
  };

  restorers.push(() => {
    (db as any).$transaction = originalTransaction;
  });

  await usersModule.updateFanFavoriteOrganizers("fan-1", ["org-1", "org-2", "org-missing", "org-1"]);

  assert.deepEqual(deleteCalls[0], {
    where: {
      userId: "fan-1",
      organizerId: {
        notIn: ["org-1", "org-2", "org-missing"],
      },
    },
  });
  assert.deepEqual(upsertCalls.map((call) => call.where.userId_organizerId), [
    { userId: "fan-1", organizerId: "org-1" },
    { userId: "fan-1", organizerId: "org-2" },
  ]);
});
