# Pre-fix rubric contract evidence

- Authoritative frontend baseline: `4ad501f3535edfba15a7a036673eff46e470c8e5`
- Review method: source inspection of role creation, role detail, overview, FAQ, and package/lock state before integration

The baseline evidence showed that the authoritative frontend:

1. Displayed the legacy Basic/Detailed/Technical interview-type options in both role-creation surfaces.
2. Duplicated legacy read normalization across role and overview pages.
3. Did not expose a membership-owned exact duration/scored-question display mapping on role creation or editing.
4. Described type as a shorter/deeper intensity choice.
5. Submitted uppercase legacy type values in new writes.
6. Had no approved in-repository rubric FAQ or selection playbook.
7. Did not contain the three approved exact tooltips.

The integrated regression suite turns each observation into an automated gate while preserving the baseline candidate-readiness, CVI reliability, recovery, route, and build checks.
