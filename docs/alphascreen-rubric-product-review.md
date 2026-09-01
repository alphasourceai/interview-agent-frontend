# Sanitized alphaScreen rubric product review

This fixture reviews the authoritative TypeScript frontend contract without hosted client or candidate data. The example roles are synthetic and correspond to `artifacts/alphasource-website/test/fixtures/sanitized-rubric-product-review.json`.

## Role creation states

### Core

- Example role: Operations Coordinator
- Membership: Essential — 10 minutes, 5 scored questions
- Interview type: Core — broad experience, judgment, ownership, communication, and readiness
- Tooltip: Broad screening of relevant experience, judgment, ownership, communication, adaptability, and role readiness.
- Submitted value: `core`

### Leadership

- Example role: Regional Operations Manager
- Membership: Pro — 12 minutes, 6 scored questions
- Interview type: Leadership — coaching, accountability, decisions, and execution
- Tooltip: Management and leadership screening focused on coaching, accountability, prioritization, conflict, change, and execution.
- Submitted value: `leadership`

### Technical

- Example role: Full-Stack Engineer
- Membership: Enterprise — 15 minutes, 7 scored questions
- Interview type: Technical — applied knowledge, troubleshooting, tradeoffs, risk, and quality
- Tooltip: Role-specific applied assessment of technical knowledge, troubleshooting, implementation, tradeoffs, risk, and quality.
- Submitted value: `technical`

The membership and interview-type cards are separate. Selecting a different type changes only the second card; selecting a different membership changes only the duration and scored-question count in the first card.

## Legacy role rendering

| Stored value | Visible label |
| --- | --- |
| `basic` | Core |
| `detailed` | Leadership |
| `technical` | Technical |

Opening a role or its manual configuration editor performs a read only. The existing prompt and rubric questions are patched only after the user chooses Save; merely displaying a normalized label does not write the role or regenerate its rubric.

## FAQ and playbook review

The role-creation surfaces expose the collapsed “Interview type selection guide and FAQ” panel. It contains all three selection guides, the five approved cautions, and all eight approved FAQ answers. The reusable written version is `docs/alphascreen-rubric-selection-guide.md`.

Review status: PASS against the sanitized text fixture.
