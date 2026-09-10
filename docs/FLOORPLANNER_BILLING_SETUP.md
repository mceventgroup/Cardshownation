# Floor Planner Billing Setup

The customer floor planner is sold as one active cloud project for **$19.99 USD per month** or
**$199 USD per year**, a 17% savings from twelve monthly payments.
Members and promoters can subscribe. Admins and moderators retain their internal workspaces. An
admin can also grant or revoke floor-planner access for any member or promoter account from
`/admin/users`; those changes are recorded in the audit log and do not create Stripe charges.

Promoter accounts with an active paid Floor Planner subscription are displayed as **Promoter Pro**.
This is a billing tier derived from Stripe status, while the underlying authorization role remains
`ORGANIZER`. Admin-granted access does not add the Pro label.

## Stripe dashboard

1. Create a Stripe Product named `Card Show Nation Floor Planner`.
2. Add an active recurring monthly Price:
   - Currency: USD
   - Amount: $19.99
   - Interval: Monthly
   - Interval count: 1
3. Copy the Price ID into `STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID`.
4. Add an active recurring yearly Price to the same Product:
   - Currency: USD
   - Amount: $199.00
   - Interval: Yearly
   - Interval count: 1
5. Copy the Price ID into `STRIPE_FLOORPLANNER_YEARLY_PRICE_ID`.
6. Activate and configure the Stripe Customer Portal so customers can update payment methods and
   cancel subscriptions.
7. Register this webhook endpoint:

   `https://cardshownation.com/api/webhooks/stripe`

8. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
9. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

The application retrieves the selected Price before checkout and refuses to sell it unless its
amount, currency, and billing interval match the advertised plan.

## Required environment variables

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID
STRIPE_FLOORPLANNER_YEARLY_PRICE_ID
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

The billing migration adds `FloorplannerSubscription` and `BillingWebhookEvent`. The user-access
migration adds `User.floorplannerAccessGranted` and carries forward existing promoter grants. The
webhook event table makes Stripe processing idempotent.

## Admin-granted access

Open **Admin → Users**, find a member or promoter account, and select **Grant floor planner**.
Admin-granted access works immediately and allows one cloud project without requiring a Stripe
subscription. Select **Revoke floor planner** to remove only the admin grant; an active paid
subscription continues to provide access.
