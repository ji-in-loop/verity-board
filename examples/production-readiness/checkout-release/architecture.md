# Checkout Service — Release 8.4 Architecture Notes

## What's changing

- Adds a `saved_payment_methods` table and a schema migration to introduce it.
- Migrates the order database from `db.r6g.large` to `db.r6g.xlarge` to
  absorb the added write load from payment-method lookups during checkout.
- No changes to the public API surface; the checkout REST endpoint contract
  is unchanged.

## Integration points

- `payments-service`: checkout now calls `POST /payment-methods/lookup`
  before authorization, an additional synchronous call in the checkout path.
- `inventory-service` and `notifications-service`: unchanged.

## Scalability

Load-tested at 2x current peak traffic for the checkout path itself. The
additional call to `payments-service` was not included in that load test —
`payments-service`'s own capacity under this new call pattern has not been
independently verified for this release.

## Cost

The database instance migration increases monthly infrastructure cost; see
`infrastructure-plan.json` for the estimate and variance.
