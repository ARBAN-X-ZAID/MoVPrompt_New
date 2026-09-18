# Debug authentication fetch failure and stuck sign-in

## Symptoms
- Sign-up returns `Failed to fetch`; no user is inserted in MongoDB `user`/`users` storage.
- Sign-in without an existing account remains in loading state.

## Investigation
- Verify active web and API origins plus browser request/console evidence.
- Verify API health, Better Auth route mounting, CORS, MongoDB connection, and collection configuration.
- Reproduce sign-up and sign-in against the local API.
- Fix the transport or runtime configuration, then guarantee cleanup for sign-in and reset flows as well as sign-up.
- Validate database insertion and a real sign-in round trip using a temporary local test account, then remove the test record.

## Boundaries
Keep all work local and uncommitted. Do not push or deploy.
