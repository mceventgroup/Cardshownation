import assert from "node:assert/strict";
import test, { afterEach, before, mock } from "node:test";

process.env.DATABASE_URL ??= "postgresql://user@localhost:5432/csn_test";
process.env.CSN_DATA_MODE = "live";

let db: typeof import("./db").db;
let createModeratorSessionToken: typeof import("./moderator-session").createModeratorSessionToken;
let verifyModeratorSessionToken: typeof import("./moderator-session").verifyModeratorSessionToken;
let validateModeratorSessionSecret: typeof import("./moderator-auth").validateModeratorSessionSecret;
let MIN_MODERATOR_SESSION_SECRET_LENGTH: typeof import("./moderator-auth").MIN_MODERATOR_SESSION_SECRET_LENGTH;
let validateUserSessionSecret: typeof import("./user-auth").validateUserSessionSecret;
let MIN_USER_SESSION_SECRET_LENGTH: typeof import("./user-auth").MIN_USER_SESSION_SECRET_LENGTH;
let validateAdminSessionSecret: typeof import("./admin-auth").validateAdminSessionSecret;
let MIN_ADMIN_SESSION_SECRET_LENGTH: typeof import("./admin-auth").MIN_ADMIN_SESSION_SECRET_LENGTH;
let createAdminSessionToken: typeof import("./admin-session").createAdminSessionToken;
let verifyAdminSessionToken: typeof import("./admin-session").verifyAdminSessionToken;
let createPasswordResetToken: typeof import("./password-reset-token").createPasswordResetToken;
let consumePasswordResetToken: typeof import("./password-reset-token").consumePasswordResetToken;
let createVerificationToken: typeof import("./verification-token").createVerificationToken;
let consumeVerificationToken: typeof import("./verification-token").consumeVerificationToken;
let hashOpaqueToken: typeof import("./token-hash").hashOpaqueToken;
let approveShowSubmission: typeof import("./submissions").approveShowSubmission;
let rejectShowSubmission: typeof import("./submissions").rejectShowSubmission;
let getModeratorVisibleSubmissions: typeof import("./submissions").getModeratorVisibleSubmissions;
let getModeratorVisibleSubmissionById: typeof import("./submissions").getModeratorVisibleSubmissionById;
const restorers: Array<() => void> = [];

function stubMethod(
  target: any,
  key: string,
  implementation: (...args: any[]) => any
) {
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
  ({ createModeratorSessionToken, verifyModeratorSessionToken } = await import(
    "./moderator-session"
  ));
  ({ validateModeratorSessionSecret, MIN_MODERATOR_SESSION_SECRET_LENGTH } = await import(
    "./moderator-auth"
  ));
  ({ validateUserSessionSecret, MIN_USER_SESSION_SECRET_LENGTH } = await import("./user-auth"));
  ({ validateAdminSessionSecret, MIN_ADMIN_SESSION_SECRET_LENGTH } = await import("./admin-auth"));
  ({ createAdminSessionToken, verifyAdminSessionToken } = await import("./admin-session"));
  ({ createPasswordResetToken, consumePasswordResetToken } = await import("./password-reset-token"));
  ({ createVerificationToken, consumeVerificationToken } = await import("./verification-token"));
  ({ hashOpaqueToken } = await import("./token-hash"));
  ({
    approveShowSubmission,
    rejectShowSubmission,
    getModeratorVisibleSubmissions,
    getModeratorVisibleSubmissionById,
  } = await import("./submissions"));
});

afterEach(() => {
  mock.restoreAll();
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
});

test("createModeratorSessionToken returns a verifiable moderator token", async () => {
  const token = await createModeratorSessionToken("moderator-123", 3, "super-secret");
  const payload = await verifyModeratorSessionToken(token, "super-secret");

  assert.ok(payload);
  assert.equal(payload.uid, "moderator-123");
  assert.equal(payload.aud, "card-show-nation-moderator");
  assert.equal(payload.sv, 3);
  assert.equal(payload.v, 1);
});

test("verifyModeratorSessionToken rejects tampered signatures", async () => {
  const token = await createModeratorSessionToken("moderator-123", 1, "super-secret");
  const [payloadSegment, signatureSegment] = token.split(".");
  const decodedPayload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  decodedPayload.uid = "moderator-456";
  const tamperedPayloadSegment = Buffer.from(JSON.stringify(decodedPayload), "utf8").toString(
    "base64url"
  );
  const tamperedToken = `${tamperedPayloadSegment}.${signatureSegment}`;

  const payload = await verifyModeratorSessionToken(tamperedToken, "super-secret");

  assert.equal(payload, null);
});

test("verifyModeratorSessionToken rejects tokens issued too far in the future", async () => {
  const now = 1_700_000_000_000;
  const dateNowMock = mock.method(Date, "now", () => now + 120_000);
  const token = await createModeratorSessionToken("moderator-123", 1, "super-secret");

  dateNowMock.mock.mockImplementation(() => now);
  const payload = await verifyModeratorSessionToken(token, "super-secret");

  assert.equal(payload, null);
});

test("verifyModeratorSessionToken rejects expired tokens", async () => {
  const now = 1_700_000_000_000;
  const dateNowMock = mock.method(Date, "now", () => now);
  const token = await createModeratorSessionToken("moderator-123", 1, "super-secret", 10);

  dateNowMock.mock.mockImplementation(() => now + 11_000);
  const payload = await verifyModeratorSessionToken(token, "super-secret");

  assert.equal(payload, null);
});

test("validateModeratorSessionSecret rejects missing secrets", () => {
  assert.deepEqual(validateModeratorSessionSecret(""), {
    secret: null,
    error: "missing",
  });
});

test("validateModeratorSessionSecret rejects short secrets", () => {
  assert.deepEqual(validateModeratorSessionSecret("x".repeat(31)), {
    secret: null,
    error: "too_short",
  });
});

test("validateModeratorSessionSecret accepts trimmed strong secrets", () => {
  const strongSecret = `  ${"x".repeat(MIN_MODERATOR_SESSION_SECRET_LENGTH)}  `;

  assert.deepEqual(validateModeratorSessionSecret(strongSecret), {
    secret: "x".repeat(MIN_MODERATOR_SESSION_SECRET_LENGTH),
    error: null,
  });
});

test("validateUserSessionSecret rejects short secrets", () => {
  assert.deepEqual(validateUserSessionSecret("x".repeat(31)), {
    secret: null,
    error: "too_short",
  });
});

test("validateUserSessionSecret accepts trimmed strong secrets", () => {
  const strongSecret = `  ${"x".repeat(MIN_USER_SESSION_SECRET_LENGTH)}  `;

  assert.deepEqual(validateUserSessionSecret(strongSecret), {
    secret: "x".repeat(MIN_USER_SESSION_SECRET_LENGTH),
    error: null,
  });
});

test("validateAdminSessionSecret rejects short secrets", () => {
  assert.deepEqual(validateAdminSessionSecret("x".repeat(31)), {
    secret: null,
    error: "too_short",
  });
});

test("validateAdminSessionSecret accepts trimmed strong secrets", () => {
  const strongSecret = `  ${"x".repeat(MIN_ADMIN_SESSION_SECRET_LENGTH)}  `;

  assert.deepEqual(validateAdminSessionSecret(strongSecret), {
    secret: "x".repeat(MIN_ADMIN_SESSION_SECRET_LENGTH),
    error: null,
  });
});

test("createAdminSessionToken returns a verifiable admin token with session version", async () => {
  const token = await createAdminSessionToken("admin-123", 4, "super-secret");
  const payload = await verifyAdminSessionToken(token, "super-secret");

  assert.ok(payload);
  assert.equal(payload.uid, "admin-123");
  assert.equal(payload.aud, "card-show-nation-admin");
  assert.equal(payload.sv, 4);
  assert.equal(payload.v, 1);
});

test("verifyAdminSessionToken rejects tampered admin tokens", async () => {
  const token = await createAdminSessionToken("admin-123", 1, "super-secret");
  const [payloadSegment, signatureSegment] = token.split(".");
  const decodedPayload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  decodedPayload.sv = 99;
  const tamperedPayloadSegment = Buffer.from(JSON.stringify(decodedPayload), "utf8").toString(
    "base64url"
  );
  const tamperedToken = `${tamperedPayloadSegment}.${signatureSegment}`;

  const payload = await verifyAdminSessionToken(tamperedToken, "super-secret");

  assert.equal(payload, null);
});

test("createPasswordResetToken stores a hashed token and consumePasswordResetToken looks it up by hash", async () => {
  const deleteManyMock = stubMethod(db.passwordResetToken, "deleteMany", async () => undefined);
  const createMock = stubMethod(db.passwordResetToken, "create", async (input) => input);
  const findUniqueMock = stubMethod(db.passwordResetToken, "findUnique", async () => ({
    id: "reset-1",
    user: { id: "user-1", email: "fan@example.com" },
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const deleteMock = stubMethod(db.passwordResetToken, "delete", async (input) => input);

  const token = await createPasswordResetToken("user-1");
  const user = await consumePasswordResetToken(token);

  assert.equal(deleteManyMock.mock.calls.length, 1);
  assert.equal(createMock.mock.calls.length, 1);
  assert.equal(findUniqueMock.mock.calls.length, 1);
  assert.equal(deleteMock.mock.calls.length, 1);
  assert.notEqual(token, hashOpaqueToken(token));
  assert.deepEqual(createMock.mock.calls[0]?.arguments[0], {
    data: {
      userId: "user-1",
      token: hashOpaqueToken(token),
      expiresAt: createMock.mock.calls[0]?.arguments[0].data.expiresAt,
    },
  });
  assert.deepEqual(findUniqueMock.mock.calls[0]?.arguments[0], {
    where: { token: hashOpaqueToken(token) },
    include: { user: true },
  });
  assert.deepEqual(deleteMock.mock.calls[0]?.arguments[0], {
    where: { id: "reset-1" },
  });
  assert.deepEqual(user, { id: "user-1", email: "fan@example.com" });
});

test("createVerificationToken stores a hashed token and consumeVerificationToken looks it up by hash", async () => {
  const deleteManyMock = stubMethod(db.emailVerificationToken, "deleteMany", async (input) => input);
  const createMock = stubMethod(db.emailVerificationToken, "create", async (input) => input);
  const findUniqueMock = stubMethod(db.emailVerificationToken, "findUnique", async () => ({
    id: "verify-1",
    userId: "user-1",
    user: { id: "user-1", email: "fan@example.com" },
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const deleteMock = stubMethod(db.emailVerificationToken, "delete", async (input) => input);
  const updateMock = stubMethod(db.user, "update", async (input) => input);

  const token = await createVerificationToken("user-1");
  const user = await consumeVerificationToken(token);

  assert.equal(createMock.mock.calls.length, 1);
  assert.equal(deleteManyMock.mock.calls.length, 1);
  assert.equal(findUniqueMock.mock.calls.length, 1);
  assert.equal(deleteMock.mock.calls.length, 1);
  assert.equal(updateMock.mock.calls.length, 1);
  assert.notEqual(token, hashOpaqueToken(token));
  assert.deepEqual(createMock.mock.calls[0]?.arguments[0], {
    data: {
      userId: "user-1",
      token: hashOpaqueToken(token),
      expiresAt: createMock.mock.calls[0]?.arguments[0].data.expiresAt,
    },
  });
  assert.deepEqual(findUniqueMock.mock.calls[0]?.arguments[0], {
    where: { token: hashOpaqueToken(token) },
    include: { user: true },
  });
  assert.deepEqual(updateMock.mock.calls[0]?.arguments[0], {
    where: { id: "user-1" },
    data: { emailVerifiedAt: updateMock.mock.calls[0]?.arguments[0].data.emailVerifiedAt },
  });
  assert.deepEqual(user, { id: "user-1", email: "fan@example.com" });
});

test("getModeratorVisibleSubmissions returns only pending and self-reviewed submissions", async () => {
  const findManyMock = stubMethod(db.showSubmission, "findMany", async () => [
    { id: "pending-1", status: "PENDING", reviewerId: null },
    { id: "reviewed-by-self", status: "APPROVED", reviewerId: "moderator-1" },
  ]);

  const result = await getModeratorVisibleSubmissions("moderator-1");

  assert.equal(findManyMock.mock.calls.length, 1);
  assert.deepEqual(findManyMock.mock.calls[0]?.arguments[0], {
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    where: {
      OR: [{ status: "PENDING" }, { reviewerId: "moderator-1" }],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  assert.deepEqual(result, [
    { id: "pending-1", status: "PENDING", reviewerId: null },
    { id: "reviewed-by-self", status: "APPROVED", reviewerId: "moderator-1" },
  ]);
});

test("getModeratorVisibleSubmissionById allows pending submissions for any moderator", async () => {
  const getSubmissionMock = stubMethod(db.showSubmission, "findUnique", async () => ({
    id: "submission-1",
    status: "PENDING",
    reviewerId: null,
  }));

  const result = await getModeratorVisibleSubmissionById("submission-1", "moderator-1");

  assert.equal(getSubmissionMock.mock.calls.length, 1);
  assert.deepEqual(result, {
    id: "submission-1",
    status: "PENDING",
    reviewerId: null,
  });
});

test("getModeratorVisibleSubmissionById hides other moderators reviewed submissions", async () => {
  const getSubmissionMock = stubMethod(db.showSubmission, "findUnique", async () => ({
    id: "submission-1",
    status: "APPROVED",
    reviewerId: "moderator-2",
  }));

  const result = await getModeratorVisibleSubmissionById("submission-1", "moderator-1");

  assert.equal(getSubmissionMock.mock.calls.length, 1);
  assert.equal(result, null);
});

test("approveShowSubmission rejects non-admin, non-moderator reviewer roles", async () => {
  await assert.rejects(
    () =>
      approveShowSubmission("submission-1", {
        reviewerId: "fan-1",
        reviewerRole: "FAN",
      }),
    /Only admin or moderator reviewers can approve submissions\./
  );
});

test("approveShowSubmission returns the existing reviewed show for already-approved submissions", async () => {
  const findSubmissionMock = stubMethod(db.showSubmission, "findUnique", async () => ({
    id: "submission-1",
    status: "APPROVED",
    reviewedShowId: "show-42",
  }));
  const findShowMock = stubMethod(db.show, "findUnique", async () => ({
    id: "show-42",
    title: "Existing Show",
  }));
  const updateSubmissionMock = stubMethod(db.showSubmission, "update", async () => {
    throw new Error("approve should not update an already-reviewed submission");
  });
  const auditLogMock = stubMethod(db.auditLog, "create", async () => {
    throw new Error("approve should not write an audit log when it short-circuits");
  });

  const result = await approveShowSubmission("submission-1", {
    reviewerId: "moderator-1",
    reviewerRole: "MODERATOR",
  });

  assert.deepEqual(result, {
    id: "show-42",
    title: "Existing Show",
  });
  assert.equal(findSubmissionMock.mock.calls.length, 1);
  assert.equal(findShowMock.mock.calls.length, 1);
  assert.equal(updateSubmissionMock.mock.calls.length, 0);
  assert.equal(auditLogMock.mock.calls.length, 0);
});

test("rejectShowSubmission rejects non-admin, non-moderator reviewer roles", async () => {
  await assert.rejects(
    () =>
      rejectShowSubmission("submission-1", "Nope", {
        reviewerId: "fan-1",
        reviewerRole: "FAN",
      }),
    /Only admin or moderator reviewers can reject submissions\./
  );
});

test("rejectShowSubmission returns null when the submission does not exist", async () => {
  const findSubmissionMock = stubMethod(db.showSubmission, "findUnique", async () => null);
  const updateSubmissionMock = stubMethod(db.showSubmission, "update", async () => {
    throw new Error("reject should not update a missing submission");
  });
  const auditLogMock = stubMethod(db.auditLog, "create", async () => {
    throw new Error("reject should not write an audit log for a missing submission");
  });

  const result = await rejectShowSubmission("missing-submission", "Nope", {
    reviewerId: "moderator-1",
    reviewerRole: "MODERATOR",
  });

  assert.equal(result, null);
  assert.equal(findSubmissionMock.mock.calls.length, 1);
  assert.equal(updateSubmissionMock.mock.calls.length, 0);
  assert.equal(auditLogMock.mock.calls.length, 0);
});

test("rejectShowSubmission short-circuits already-reviewed submissions", async () => {
  const existingSubmission = {
    id: "submission-1",
    status: "APPROVED",
    notes: "Already handled",
  };

  const findSubmissionMock = stubMethod(
    db.showSubmission,
    "findUnique",
    async () => existingSubmission
  );
  const updateSubmissionMock = stubMethod(db.showSubmission, "update", async () => {
    throw new Error("reject should not update an already-reviewed submission");
  });
  const auditLogMock = stubMethod(db.auditLog, "create", async () => {
    throw new Error("reject should not write an audit log when it short-circuits");
  });

  const result = await rejectShowSubmission("submission-1", "New note", {
    reviewerId: "moderator-1",
    reviewerRole: "MODERATOR",
  });

  assert.equal(result, existingSubmission);
  assert.equal(findSubmissionMock.mock.calls.length, 1);
  assert.equal(updateSubmissionMock.mock.calls.length, 0);
  assert.equal(auditLogMock.mock.calls.length, 0);
});

test("rejectShowSubmission updates and audits pending submissions", async () => {
  const findSubmissionMock = stubMethod(db.showSubmission, "findUnique", async () => ({
    id: "submission-1",
    status: "PENDING",
    submitterEmail: "submitter@example.com",
  }));
  const updateSubmissionMock = stubMethod(db.showSubmission, "update", async ({ data }) => ({
    id: "submission-1",
    submitterEmail: "submitter@example.com",
    ...data,
  }));
  const auditLogMock = stubMethod(db.auditLog, "create", async (input) => input);

  const result = await rejectShowSubmission("submission-1", "Missing dates", {
    reviewerId: "moderator-1",
    reviewerRole: "MODERATOR",
  });

  assert.equal(findSubmissionMock.mock.calls.length, 1);
  assert.equal(updateSubmissionMock.mock.calls.length, 1);
  assert.equal(auditLogMock.mock.calls.length, 1);

  const updateArgs = updateSubmissionMock.mock.calls[0]?.arguments[0];
  assert.deepEqual(updateArgs, {
    where: { id: "submission-1" },
    data: {
      status: "REJECTED",
      notes: "Missing dates",
      reviewerId: "moderator-1",
      reviewerRole: "MODERATOR",
    },
  });

  const auditArgs = auditLogMock.mock.calls[0]?.arguments[0];
  assert.deepEqual(auditArgs, {
    data: {
      actorId: "moderator-1",
      actorRole: "MODERATOR",
      action: "submission.rejected",
      targetType: "ShowSubmission",
      targetId: "submission-1",
      details: {
        notes: "Missing dates",
        submitterEmail: "submitter@example.com",
      },
    },
  });

  assert.deepEqual(result, {
    id: "submission-1",
    submitterEmail: "submitter@example.com",
    status: "REJECTED",
    notes: "Missing dates",
    reviewerId: "moderator-1",
    reviewerRole: "MODERATOR",
  });
});
