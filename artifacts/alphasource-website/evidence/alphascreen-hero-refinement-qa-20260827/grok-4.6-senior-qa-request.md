# Grok Build 4.6 Senior QA Review Request

Act as the Senior QA Engineer with final release authority for this narrowly scoped alphaScreen QA frontend change. Return exactly one decision at the top: `APPROVE` or `DENY`. If `DENY`, list every required fix needed to reach approval, ordered by severity. If `APPROVE`, state why the acceptance criteria and regression boundaries are satisfied and identify any non-blocking residual risk.

## Environment and release boundary

- Repository: alphaSource public website frontend.
- Target: QA only. Production must remain untouched.
- Review the current working-tree versions of the files named below.
- The current branch began byte-identical to `origin/main` at commit `ba5a39b`.

## User-approved requirements

On the main public alphaScreen page hero:

1. Remove both pills above the main alphaScreen lockup: `AI Interview Agent` and the separate Patent Pending badge.
2. Move `Patent Pending` to a restrained subscript associated with the alphaScreen name.
3. Increase the alphaScreen vector mark and wordmark by about 15% at desktop sizes.
4. Move the lockup upward so its top begins slightly higher than the top of the demo-video card to the right.
5. Preserve the hero's remaining copy, video, calls to action, alphaScreen 08/09 breathing vector masters, reduced-motion behavior, public-site visual system, and responsive usability.
6. Do not introduce prohibited patent claims, application numbers, or extra Patent Pending occurrences.

## Files to inspect

- `src/pages/AlphaScreenPage.tsx`
- `src/components/AlphaScreenBrand.tsx`
- `src/components/PatentPendingBadge.tsx`
- `test/patent-pending-notice.test.mjs`
- `scripts/verify-alphascreen-brand.mjs`
- `design-qa.md` — review the final section, `alphaScreen Hero Lockup Refinement QA — 2026-08-27`.

## Evidence already collected

- Desktop implementation screenshot: `/private/tmp/alphascreen-hero-refinement-desktop-local-v2-20260827.png`
- Mobile implementation screenshot: `/private/tmp/alphascreen-hero-refinement-mobile-local-v2-20260827.png`
- Narrow-mobile implementation screenshot: `/private/tmp/alphascreen-hero-refinement-320-local-v2-20260827.png`
- Source-to-implementation focused comparison: `/private/tmp/alphascreen-hero-refinement-focused-comparison-v2-20260827.png`
- At the measured desktop viewport, wordmark top = 160 CSS px; vector mark top = 170.69 CSS px; video-card top = 176 CSS px.
- At 390 px width, the Patent Pending line is visible under the wordmark and document horizontal overflow is zero.
- At 320 px width, the H1 spans x=24 to x=292.28 inside the viewport, the Patent Pending line is fully visible, and document horizontal overflow is zero.
- Browser console warnings/errors: zero.
- Focused tests: 11 passed, 0 failed.
- Strict TypeScript: passed.
- alphaScreen brand verifier: passed (10 vector masters).
- Production build, 13-route prerender, and 14-file HTML boot-integrity verification: passed.
- Full repository discovery: 122 passed, 2 failed. Both failures are in pre-existing support-voice assertions. `src/components/SupportVoicePopover.tsx`, `test/support-phone-ui.test.mjs`, and `test/support-voice-playback-regression.test.mjs` are unchanged from `origin/main`; this hero change neither touches nor affects them.

## Review priorities

- Confirm the implementation really removes both former pills and does not accidentally remove Patent Pending coverage from the page.
- Confirm the new patent treatment is semantically and visually subordinate to the wordmark, not another badge.
- Confirm desktop sizing is reasonably near a 15% increase from the prior 4.025rem mark / 3.45rem wordmark and the alignment meets the stated geometry.
- Confirm the breakpoint-specific mobile sizing and absolute-to-static patent positioning cannot clip, overlap, or create horizontal overflow at common narrow widths.
- This is a second review after the first APPROVE: the earlier residual-risk note correctly identified that 320 px was untested. A live 320 px capture then exposed clipping hidden by the hero's `overflow-hidden`. The code now adds a sub-360 px size tier; independently determine whether that correction resolves the risk without regressing the approved 390 px and desktop treatments.
- Confirm no accessibility, motion, content, or patent-notice regression is introduced.
- Treat the two unrelated unchanged support-voice baseline test failures as non-blocking only if the supplied code/evidence supports that conclusion.

End with a concise `Final decision: APPROVE` or `Final decision: DENY` line.
