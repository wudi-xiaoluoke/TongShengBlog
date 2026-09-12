# Live shop customer cast integration

User requested continued development after the mixed cast was delivered. Integrate all eight approved-style customer identities into the actual shop renderer, using the accepted 16-frame locomotion and slime hop. Keep simulation, economics, routes, DOM contracts and saves unchanged. Cashier keeps the existing red uniform.

- [x] Add grounded idle/reach poses and six-row game atlases.
- [x] Add stable presentation-only identity selection and state-to-animation mapping.
- [x] Connect PNG loading and scene depth/status overlays; preserve load retry.
- [x] Test active and stopped routes, all cast identities, gameplay and responsive UI.
- [x] Validate target hashes, sync authorized project and compiled resources, run target tests, open actual game.

Target: C:/Users/伟嘉/WorkBuddy/Worktrees/Tongshengbolg/main-b59f4cb7. Stage: current tmp/snack-redwhite workspace. Production writes occur only after verification and source hash comparison.

Verified 2026-09-10: 137/137 target Node tests passed. Browser checks passed against target guest preview on port 8767: 8 production atlases, animation-state mapping, asset retry, mobile layout, all gameplay regression scenarios and archived animation viewer. Approved arm-swing regression also passed. 971 source/assets/test/docs files synchronized with hash guards and resource copies verified against target/classes. Backups: tmp/live-cast-original-20260910. Independent review found an archived viewer loader mismatch; corrected with a separate legacy loader and browser regression. No remaining actionable review findings.
