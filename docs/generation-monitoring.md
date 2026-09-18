# Monitor local video generation

Run `bun run dev`. Database readiness and structured API/worker logs appear in the same terminal. To keep a copy:

```sh
bun run dev 2>&1 | tee /tmp/movprompt-generation-monitor.log
```

Start only one dev stack. Use Ctrl+C to stop it before starting another.

Follow a video by its `renderRunId`; each worker entry also identifies the job, project, request, worker, retry count, and timestamp where applicable. The API request and outbox request identifiers can differ; the render run ID connects them.

| Log | Meaning |
| --- | --- |
| `generation_job_submitted` | Campaign validation succeeded and MongoDB saved the asynchronous run. |
| `render_outbox_dispatched` / `worker_job_picked` | The durable queue dispatched the job and the worker acquired it. |
| `render_configuration_validated` | Template version, uploaded image count, duration, format and quality were validated. |
| `render_provider_submit_started` | Attempt preflight succeeded; the worker is contacting Vercel AI Gateway. |
| `render_provider_submit_returned` / `render_provider_accepted` | Gateway accepted the request; its identity is stored for reconciliation. |
| `render_provider_status` | Actual Gateway state, checked approximately every 15 seconds. |
| `render_output_processing_started` / `render_media_downloaded` | Gateway completed; the worker is validating and processing its video. |
| `render_media_normalized` | Processing finished, including a closing card for nonempty campaign contact/offer fields. |
| `render_clean_master_saved_r2` / `render_watermarked_preview_saved_r2` | The private clean master and preview were uploaded to R2. |
| `render_quality_review_started` / `render_quality_review_finished` | Configured quality checks are running or finished. Local development can use the configured development reviewer. |
| `render_video_ready` | MongoDB completion and media records are saved; playback/download can proceed. |
| `render_stage_failed` / `worker_job_failed` | A stable error code, retry decision, and next retry time where applicable. The saved run also exposes a safe error to the browser. |

The browser's percentage and remaining time are estimates. Only a completed saved run means the video is ready. Processing status is different from a queue or database failure.

Logs intentionally exclude API credentials, signed media URLs, raw provider responses, uploaded image contents, and full prompts.

Startup creates the canonical unique `renderRunId` indexes and removes the obsolete `runId` indexes without deleting media or application records. A new attempt is saved before a billable submission; an accepted provider ID survives dependent transaction failures. Retries with a saved ID reconcile that request instead of submitting another one. Unexpected failures are exposed on the run and terminate after bounded retries.

There is still a distributed-system boundary between a remote submission and saving its response. Provider idempotency and reconciliation protect normal retries; logs cannot prove remote cancellation when an older failed transaction lost its tracking ID.
