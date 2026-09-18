# Lock template duration to 8 seconds

The campaign-setup duration picker is removed. Template Mode always uses the recipe default of 8 seconds for the four discoverable templates. Leftover drafts that stored a different length are reset to 8 seconds on load. Advanced Mode duration controls are unchanged.

Verified with CampaignSetupStep, templates, and portable mapper tests, plus a browser pass on Premium Phone Reveal: Delivery shows format/quality only, and the summary/quote strip still reports 8 seconds.
