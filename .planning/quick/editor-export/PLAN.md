# Editor export visibility and control alignment

Continue the approved GSD bypass; changes stay local. No provider generation is authorized or needed for this fix.

1. Reproduce the export overlay in the user's running browser and inspect computed styles.
2. Cover the export interaction: current-video download, pending feedback, alternate format selection without automatic generation, and Arabic dialog labels.
3. Give the portalled export panel the creator theme and an appropriate drawer layout. Align scene controls, color picker, change-request fields, and toolbar actions.
4. Run focused automated checks, then verify the existing video export and responsive light/dark English/Arabic layout in the browser.

Observed cause: export panel custom properties are scoped to `.creator-app`, but Radix renders the panel under the document body. Its background and control colors therefore resolve as invalid/transparent. The editor duration buttons also lack icon centering, and the color input uses the browser's oversized native swatch.
