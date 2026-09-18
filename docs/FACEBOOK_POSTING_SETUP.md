# Facebook state roundups

Open **Admin → Facebook Posts** (`/admin/facebook`). Choose this week, next week,
the next seven days, or a custom range of up to 31 days. Review and edit one post
per state, then click **Publish to Facebook**. Publication is immediate; this
feature does not schedule or automatically publish anything.

## One-time setup

1. Create/configure a Meta developer app for the Facebook Page you manage.
2. Obtain a **Page access token** with `pages_manage_posts` and
   `pages_read_engagement`. Discovering managed Pages also uses `pages_show_list`.
   The connected person must have permission to create content on the Page.
   Follow Meta's current access-level and app-review requirements for your app;
   using your own Page as an app administrator differs from connecting other users.
3. Set these **private server environment variables** in the deployment:

   ```dotenv
   FACEBOOK_PAGE_ID=your_numeric_page_id
   FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
   FACEBOOK_GRAPH_API_VERSION=v25.0
   NEXT_PUBLIC_APP_URL=https://cardshownation.com
   ```

   Never prefix the Facebook credentials with `NEXT_PUBLIC_`, commit them, log
   them, or paste them into chat. Manage token renewal/revocation in Meta's tools.
   The API version is configurable; use a version supported by your Meta app.
4. Apply checked-in database migrations using the project's deployment process
   (`npm run db:deploy` with the intended production database configured).
   The migration adds only the `FacebookRoundupPost` table.
5. Deploy the app, use live data, and open `/admin/facebook`. Confirm the displayed
   Page name. The connection check reads `me` with the token and requires its ID
   to match `FACEBOOK_PAGE_ID`; a user token is not accepted as a Page connection.
6. Review a state post and publish it. The success link opens the published post.

Primary API references:
- [Meta Page posts](https://developers.facebook.com/docs/pages-api/posts/)
- [Meta Pages API getting started](https://developers.facebook.com/docs/pages-api/getting-started/)
- [Meta's official Facebook API workspace](https://www.postman.com/meta/facebook/overview)

## Date and content rules

- “This week” runs from today through Sunday in America/Chicago, including today.
- Shows use the calendar dates stored in the directory. Rendering does not shift
  a midnight show date backward when the server runs in a different timezone.
- Only approved, non-expired shows overlapping the range are included. Ongoing
  multi-day shows are included; shows ending before today are excluded.
- There is no fixed show-count cap or silent truncation. Posts exceeding the
  60,000-character application limit must be shortened or use a smaller range.
- Multi-day shows link to details instead of assuming identical hours each day.
- Reloading the page or changing dates discards unsent edits. Published text is retained.
- The server rechecks the source preview before publishing. Changed or removed
  shows require a fresh preview. The approved admin's edited text is sent exactly.

## History, retries, and recovery

An atomic unique reservation on Page + state + exact date range prevents duplicate
requests across clicks, tabs, and server instances. Changing the date range creates
a different roundup and may include shows already promoted in another roundup.
Only explicit failed requests can be retried. Fixture mode blocks all publishing.

Timeouts, lost connections, unexpected responses, and server errors may occur
after Facebook creates a post. These attempts stay locked as `UNKNOWN` or
`PUBLISHING`; the app does not blindly send again. A successful Facebook write
with an unsuccessful receipt save also leaves a locked reservation.

For a locked attempt, an administrator should inspect the Page and the saved
`FacebookRoundupPost.message`. After checking Meta directly, repair that exact
record: set `PUBLISHED` with the real `postId` if found; only set `FAILED` if you
have established that no post was created and no request is still in flight.
Do not delete publishing records as a retry shortcut.

The preview page and every publishing action require an admin session. Page
credentials remain server-side and Meta error bodies are never returned to the
browser. No Graph writes are made during page loads, previews, builds, or tests.
