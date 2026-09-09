# Future Idea: Card Show Finder Mobile App

Status: Parked for later

## Purpose

Create a small iOS and Android companion app focused on helping collectors find nearby card shows. Keep larger workflows on CardShowNation.com.

## Proposed first release

- Native list of nearby and upcoming shows
- GPS-based distance filtering
- State, radius, date, and category preferences
- Anonymous push-notification subscriptions without requiring an account
- Notifications for newly published or approaching matching shows
- Local caching for weak connections
- Tapping a show or notification opens its full listing on CardShowNation.com

## Intentionally out of scope

- Member accounts and cloud synchronization
- Google or Apple login
- Promoter and administrator tools
- Show submission and import workflows
- Floor Planner
- Stripe, in-app purchases, and subscription management
- Native advertising

## Likely implementation

- Add an Expo/React Native workspace at `apps/mobile`.
- Continue using the Next.js application and Prisma/Postgres database as the backend.
- Reuse the existing public `/api/shows` endpoint.
- Update nearby-show access for native requests.
- Add a `PushDevice` model for anonymous installation tokens and preferences.
- Add API routes to register, update, and remove notification subscriptions.
- Add a scheduled notification job with duplicate-delivery protection.
- Use canonical links such as `https://cardshownation.com/shows/{slug}` as notification destinations.

## Rough DIY estimate

- Time: approximately 50-100 focused hours
- Apple Developer Program: $99 per year
- Google Play Console: $25 one-time
- Expo: free initially, with a paid build plan optional during launch
- Expected mobile-specific first-year cash cost: approximately $124-$350, excluding existing hosting

## Why this scope

It provides useful native location and notification behavior without duplicating the website or introducing the difficult authentication, billing, and app-store policy work required by a full-featured mobile client.
