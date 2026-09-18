# Local infrastructure

The local application stack uses MongoDB 8 as its only database.

- MongoDB replica set on `127.0.0.1:27017`
- Cloudflare R2 object storage (credentials required)
- Mailpit SMTP/UI on `127.0.0.1:1025` and `127.0.0.1:8025`
- Hono API on `127.0.0.1:8787`
- MongoDB-backed durable worker

Start and verify the complete local stack from the repository root:

```sh
node .local-setup/run.mjs up
node .local-setup/verify-runtime.mjs
```

MongoDB runs as a single-node replica set because generation billing and outbox writes use transactions. Local data stays in the `mongodb-data` Docker volume when the stack is stopped.
