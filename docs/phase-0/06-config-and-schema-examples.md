# Configuration and Schema Examples

These examples illustrate the shape config authors will write and the shape
runtime objects will take. All YAML is validated against Zod schemas derived
from [05-interfaces.md](05-interfaces.md) before use; malformed config is
rejected with a specific error, never silently coerced.

## 1. Actor definition (YAML)

```yaml
id: sre-reviewer
version: 1
displayName: Site Reliability Engineer

mandate:
  - Assess operational readiness
  - Identify reliability blockers
  - Validate recovery readiness

criteria:
  - availability
  - observability
  - capacity
  - rollback
  - disaster_recovery
  - support_ownership

requiredCapabilities:
  - telemetry.slo_status
  - infrastructure.change_summary
  - testing.performance_results
  - deployment.rollback_validation

allowedCapabilities:
  - telemetry.*
  - infrastructure.read
  - testing.read
  - deployment.read

questionLimits:
  maximumQuestions: 3
  maximumEvidenceRequests: 5

authority:
  blockerCategories:
    - reliability
    - rollback
    - disaster_recovery

outputSchema: actor-review.v1
```

## 2. Committee definition (YAML)

```yaml
id: production-readiness
version: 1

actors:
  required:
    - senior-engineering-lead
    - sre-reviewer
    - solution-architect
    - product-manager
  conditional:
    - actor: security-architect
      when:
        any:
          - expr: "case.publicEndpoint == true"
          - expr: "case.dataClassification == 'restricted'"

execution:
  mode: parallel
  maximumClarificationRounds: 1
  maximumQuestionsPerActor: 3
  maximumEvidenceRequests: 20
  stopWhenNoNewEvidence: true
  stopWhenMandatoryBlockerFound: true
  stopWhenAllActorsFinal: true

decisionPolicy: production-readiness-policy

humanApproval:
  required: true
  decisionOwnerField: humanDecisionOwner
```

## 3. Playbook definition (YAML)

```yaml
id: production-readiness-playbook
version: 1

reviewTask: production-readiness

inputRequirements:
  - application
  - riskClassification
  - evidenceReferences
  - humanDecisionOwner

applicableCommittees:
  - production-readiness

outcomeVocabulary:
  - GO
  - CONDITIONAL_GO
  - NO_GO
  - ESCALATE

mandatoryControls:
  - testing.mandatory_suite_failed
  - reliability.rollback_unverified

decisionRules: production-readiness-policy

reportFormat:
  - json
  - markdown
```

## 4. Decision policy (YAML)

```yaml
id: production-readiness-policy
version: 1

criticalBlockers:
  - testing.mandatory_suite_failed
  - reliability.rollback_unverified
  - security.critical_finding
  - ownership.production_owner_missing

rules:
  - when: { expr: "criticalBlockers.count > 0" }
    result: NO_GO

  - when: { expr: "disagreements.critical.count > 0" }
    result: ESCALATE

  - when: { expr: "materialRisks.count > 0" }
    result: CONDITIONAL_GO

  - when:
      all:
        - expr: "criticalBlockers.count == 0"
        - expr: "mandatoryEvidence.missing == 0"
    result: GO
```

Rules are evaluated **in order**; the first matching rule wins. This is a
deliberately small expression grammar (see [ADR-0004](09-adrs.md#adr-0004))
over a fixed set of facts the orchestrator computes from `ActorReview[]` and
`Evidence[]` — not a general-purpose scripting language, and specifically not
`eval`-based.

## 5. Evidence record (JSON, runtime output)

```json
{
  "evidenceId": "ev-0012",
  "capability": "deployment.rollback_validation",
  "subject": "checkout-service",
  "status": "CONTRADICTED",
  "summary": "Rollback validation was attempted in staging and failed at step 3 (database migration reversal).",
  "facts": {
    "attempted": true,
    "succeeded": false,
    "failedStep": "db_migration_reversal",
    "environment": "staging"
  },
  "provenance": {
    "provider": "local-file",
    "sourceRef": "examples/production-readiness/checkout-release/rollback-report.json",
    "retrievedAt": "2026-07-25T18:04:12Z"
  },
  "freshness": {
    "asOf": "2026-07-24T09:00:00Z",
    "isStale": false
  },
  "classification": "internal"
}
```

## 6. Finding (JSON, runtime output)

```json
{
  "actorId": "sre-reviewer",
  "criterion": "rollback",
  "status": "CONTRADICTED",
  "severity": "critical",
  "explanation": "Rollback validation failed in staging at the database migration reversal step. This is a required control for any release with a schema migration.",
  "evidenceRefs": ["ev-0012"],
  "requiredAction": "Correct and rerun rollback validation before release.",
  "confidence": 0.95,
  "isInferred": false
}
```

## 7. Committee recommendation excerpt (JSON, runtime output)

```json
{
  "committeeId": "production-readiness",
  "reviewCaseId": "checkout-release-8.4",
  "overallRecommendation": "CONDITIONAL_GO",
  "consolidatedBlockers": [
    {
      "actorId": "sre-reviewer",
      "criterion": "rollback",
      "severity": "critical",
      "explanation": "Rollback validation failed in staging.",
      "evidenceRefs": ["ev-0012"]
    }
  ],
  "missingEvidence": [
    {
      "evidenceId": "ev-0019",
      "capability": "testing.performance_results",
      "subject": "payments-service (dependency)",
      "status": "MISSING",
      "summary": "No load-test result was supplied for the dependent payments service."
    }
  ],
  "requiredActions": [
    "Correct and rerun rollback validation.",
    "Attach dependent-service load-test evidence.",
    "Assign an owner to the infrastructure-cost variance."
  ],
  "policyEvaluation": {
    "policyId": "production-readiness-policy",
    "ruleFired": "materialRisks.count > 0",
    "outcome": "CONDITIONAL_GO",
    "reasoning": "No critical blockers reached NO_GO threshold in isolation once mitigations were noted, but material risks (dependency load-test gap) require conditional approval."
  },
  "humanDecisionOwner": "Release Director"
}
```

Note this example intentionally shows a case where the SRE's rollback finding
is `critical` but the *policy* still resolves to `CONDITIONAL_GO` rather than
`NO_GO` — that would only be correct if the policy's rule ordering and
`criticalBlockers` list treat this specific blocker as conditionally
mitigable. Getting this consistent (a `critical`-severity `Finding` from an
actor whose `authority.blockerCategories` includes `rollback` should, per
[ADR-0001](09-adrs.md#adr-0001), force `NO_GO`, not `CONDITIONAL_GO`) is
exactly the kind of policy-engine test case called out in
[08-testing-strategy.md](08-testing-strategy.md) — Version 0.1 must get this
right and have a table-driven test proving it, not just a plausible-looking
example.

## 8. Markdown report (rendering target)

```
verity-board COMMITTEE REVIEW

Case: Checkout Platform Release 8.4
Committee: Production Readiness
Recommendation: NO_GO

Senior Engineering Lead: GO
SRE: NO_GO
Product Manager: GO
Solution Architect: CONDITIONAL_GO

Critical blocker:
Rollback validation failed in staging (SRE, evidence ev-0012).

Missing evidence:
Dependent service load-testing result was not provided (payments-service).

Required actions:
1. Correct and rerun rollback validation.
2. Attach dependent-service load-test evidence.
3. Assign an owner to the infrastructure-cost variance.

Human decision owner: Release Director
(This is a recommendation. It is not a decision. No deployment action
has been taken.)
```
