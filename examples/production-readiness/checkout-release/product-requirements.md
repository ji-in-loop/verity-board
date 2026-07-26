# Checkout Platform Release 8.4 — Product Requirements

## Acceptance criteria

1. A returning customer can select a previously saved payment method during
   checkout without re-entering card details. **Met** — verified in staging.
2. Checkout completion time does not regress by more than 200ms at p95.
   **Met** — see `telemetry-summary.json`.
3. Existing guest checkout (no saved payment method) is unaffected. **Met**.

## Critical user journeys

- Guest checkout: unaffected by this release.
- Returning-customer checkout with a saved payment method: new in this
  release, covered by the acceptance criteria above.

## Known limitations

- Saved payment methods are limited to one card per customer in this
  release; multi-card support is planned for a future release and is not a
  blocker for 8.4.
- The saved-payment-method lookup adds one additional network call to
  `payments-service` in the checkout path; see the architecture notes for
  the associated capacity caveat.

## Stakeholder acceptance

Sign-off received from Checkout PM and Payments PM. Sign-off from the SRE
on-call lead is pending final rollback validation.
