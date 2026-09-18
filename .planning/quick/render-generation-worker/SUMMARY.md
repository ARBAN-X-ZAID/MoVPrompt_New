# Add a Render worker blueprint for generation

`render.yaml` now includes a paid Docker worker and the API generation env slots. `FEATURE_GENERATION` stays false in git. Local `.env` received the missing quote rates (not committed). Live generation still needs the operator to create the worker, paste the Gateway key, and flip the switch; production also still needs quality-calibration files before the worker advertises `generationReady`.
