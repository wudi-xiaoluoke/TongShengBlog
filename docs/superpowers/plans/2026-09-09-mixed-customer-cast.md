# Mixed customer cast, batch 1

User approved the blue customer's 4-direction 16-frame walk and requested varied fantasy, sci-fi, monster and modern customer identities. Scope for the first mixed cast: archer, rogue, cleric, cyber soldier, robot, goblin, slime, doctor. Existing blue customer and gait are preserved. Other suggested professions remain candidates for later batches.

Create original four-view texture sheets using built-in imagegen, one per identity. Each sheet has a uniform 2×2 layout: front/back/left/right. Validate real alpha transparency and silhouettes. Normalize the source texture bounds into a common rig coordinate system at runtime. Humanoids use the accepted gait; slime gets a periodic squash-and-stretch hop with directional art. Export actual 16-frame sequences from the renderer, and present a roster picker, four direction playback, pause/step controls, full sheet and download pack.

- [x] Generate, inspect and save 8 identity sheets and their prompts.
- [x] Adapt texture normalization and costume rendering without changing accepted gait.
- [x] Add slime motion and tests.
- [x] Build roster preview and validate every identity and direction.
- [x] Export per-character PNG sequences, metadata and ZIP.

This batch builds art and animation assets in the isolated preview workspace. Full production integration follows complete validation of the expanded cast.

Validation: all 8 identities pass four-direction render/export checks, transparent silhouettes, cell-edge clipping checks, role switching and step controls. 512 walk/hop frames exported; humanoid sequences have 16 distinct frames per direction, slime uses a symmetric bounce loop. Browser mobile width and uncaught-error checks pass. Original approved character arm test and 4 gait/slime tests pass. Neutral-source costume masks adjusted to avoid duplicating the stationary arms. Eight individual ZIPs plus the full-cast ZIP include frames, original generated source and prompts.
