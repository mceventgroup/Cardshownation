# Google Sign-In Setup

Google sign-in is available for member accounts. Promoter, moderator, and admin
accounts continue to use their role-specific password login so a matching email
address cannot silently grant privileged access.

## Account-linking rules

- Returning Google users are matched by Google's stable `sub` identifier.
- A verified Gmail address, or a verified Google Workspace address with an `hd`
  claim, can create or link a member account with the same normalized email.
- Other consumer addresses used as Google accounts must complete Card Show
  Nation's email verification before they can be linked.
- An email already belonging to a promoter, moderator, or admin account is never
  linked by Google sign-in.
- The Google account chooser is shown on every sign-in attempt to reduce the
  chance of using the wrong browser account.

## Google Cloud configuration

1. In Google Cloud Console, configure the OAuth consent screen for the Card Show
   Nation application.
2. Create an OAuth 2.0 Client ID with application type **Web application**.
3. Add the production origin:

   `https://cardshownation.com`

4. Add the exact production redirect URI:

   `https://cardshownation.com/api/auth/google/callback`

5. For local testing, also add:

   `http://localhost:3000/api/auth/google/callback`

See Google's
[OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
and
[web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server)
for provider-side setup details.

## Application configuration

Set these variables in each environment:

```dotenv
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="https://cardshownation.com/api/auth/google/callback"
```

`USER_SESSION_SECRET` must also be configured. The Google button remains hidden
unless all required values are present.

Before enabling the variables in production, deploy the database migration:

```shell
npm run db:deploy
```

## Release checks

- Sign in with an existing verified Gmail member and confirm the same account is
  opened.
- Sign in again after signing into multiple Google accounts and confirm the
  account chooser appears.
- Try an email that belongs to a promoter and confirm Google sign-in refuses to
  link it.
- Try a non-Gmail consumer Google account and confirm Card Show Nation email
  verification is required.
- Confirm an unverified member can request another verification email without
  the page revealing whether arbitrary email addresses exist.
