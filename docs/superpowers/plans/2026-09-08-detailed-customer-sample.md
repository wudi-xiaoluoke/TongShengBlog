# Detailed customer animation sample

Approved design: one modern customer matching the user's detailed RPG pixel reference, about 2.5–3 heads tall, dark stepped outlines, layered hair/clothing shading, anatomically consistent legs and natural walk cycle. Brown short hair, blue casual jacket, cream shirt, dark trousers and light sneakers. Four directions and eight frames per direction. Preview approval comes before expanding the cast or integrating this new style in the production game.

Implementation: generate an original uniform 8-column × 4-row sprite sheet using built-in imagegen, inspect direction and identity consistency, expose the actual frames in an isolated animated browser preview with step/pause controls and the full original sheet. Keep source output and generation prompt. Avoid touching game state and production game assets. If frame registration needs correction, document the layout explicitly and align only in the preview renderer.

- [x] Generate and inspect the sample sheet.
- [x] Save source art and prompt in the staging workspace.
- [x] Create animated preview and inspect every direction.
- [x] Verify browser controls and provide visible preview for user approval.

Review: preview controls, four crops, image loading, mobile width and browser error checks pass. Image generation still produced a baked checkerboard and partially repeated poses; explicitly labeled draft in preview and user report. Do not integrate in production as final animation.
