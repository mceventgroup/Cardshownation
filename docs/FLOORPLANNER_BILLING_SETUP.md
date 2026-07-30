# Floor Planner Billing Setup

The customer floor planner is sold as one active cloud project for **$19.99 USD per month**.
Members and promoters can subscribe. Admins and moderators retain their internal workspaces, and
an organizer's existing `floorplanEnabled` flag acts as a complimentary access grant.

## Stripe dashboard

1. Create a Stripe Product named `Card Show Nation Floor Planner`.
2. Add an active recurring Price:
   - Currency: USD
   - Amount: $19.99
   - Interval: Monthly
   - Interval count: 1
3. Copy the Price ID into `STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID`.
4. Activate and configure the Stripe Customer Portal so customers can update payment methods and
   cancel subscriptions.
5. Register this webhook endpoint:

   `https://cardshownation.com/api/webhooks/stripe`

6. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

The application retrieves the configured Price before checkout and refuses to sell it unless it is
an active $19.99 USD monthly Price.

## Required environment variables

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID
FLOORPLANNER_SESSION_SECRET
NEXT_PUBLIC_APP_URL
DATABASE_URL
DIRECT_URL
```

Use Stripe test-mode keys and a test-mode Price locally. The success page synchronizes the Checkout
Session immediately, while the signed webhook remains the durable source of subscription updates.

## Database deployment

Deploy the Prisma migration before enabling the checkout button:

```text
npm run db:deploy
```

The migration adds `FloorplannerSubscription` and `BillingWebhookEvent`. The latter makes webhook
processing idempotent.
