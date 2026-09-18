# Lock template duration to 8 seconds

Implement locally under the previously approved GSD bypass. Keep changes local; no commit, push, or paid generation.

1. Remove the campaign-setup duration picker. Template Mode always uses the recipe default of 8 seconds for the four discoverable templates.
2. Reset leftover drafts that stored a user-chosen duration so quotes, prompts, and generation stay on the 8-second recipe.
3. Keep Advanced Mode duration controls unchanged.
4. Cover the missing picker and 8-second default with automated tests; verify the campaign setup screen in the browser without starting a paid job.
