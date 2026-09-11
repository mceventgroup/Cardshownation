import "next/dist/server/node-environment-baseline";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { workAsyncStorage, type WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import { getModifiedCookieValues } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { logoutUser } from "@/app/account/actions";
import { logoutPromoter } from "@/app/promoter/actions";
import { logoutModerator } from "@/app/moderator/actions";
import { logoutAdmin } from "@/app/admin/actions";

const sessionNames = [
  "csn_user",
  "csn_promoter",
  "csn_moderator",
  "csn_admin",
  "floorplanner_cloud_session",
];

for (const [name, logout, destination] of [
  ["member", logoutUser, "/login"],
  ["promoter", logoutPromoter, "/login"],
  ["moderator", logoutModerator, "/moderator/login"],
  ["admin", logoutAdmin, "/admin/login"],
] as const) {
  for (const signedIn of [true, false]) {
    test(`${name} logout clears every session ${signedIn ? "with overlapping roles" : "when already signed out"}`, async () => {
      const request = new NextRequest("https://cardshownation.com/account", {
        headers: {
          cookie: [
            ...(signedIn ? sessionNames.map((cookie) => `${cookie}=old-session`) : []),
            "csn_cookie_consent=essential",
          ].join("; "),
        },
      });
      const store = createRequestStoreForAPI(
        request,
        request.nextUrl,
        { tags: [], expirationsByCacheKind: new Map() },
        undefined,
        undefined,
        undefined,
      );

      const result = workAsyncStorage.run(
        { route: "/account" } as WorkStore,
        () => workUnitAsyncStorage.run(store, logout),
      );
      await assert.rejects(result, (error: unknown) => {
        assert.equal(
          (error as { digest?: string }).digest,
          `NEXT_REDIRECT;replace;${destination};307;`,
          String(error),
        );
        return true;
      });

      const deleted = getModifiedCookieValues(store.mutableCookies);
      assert.deepEqual(deleted.map((cookie) => cookie.name).sort(), [...sessionNames].sort());
      for (const cookie of deleted) {
        assert.equal(cookie.value, "");
        assert.equal(cookie.path, "/");
        assert.ok(cookie.expires instanceof Date);
        assert.equal(cookie.expires.getTime(), 0);
      }
      assert.equal(store.mutableCookies.get("csn_cookie_consent")?.value, "essential");
    });
  }
}
