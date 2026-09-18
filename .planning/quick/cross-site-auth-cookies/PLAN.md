# Cross-site auth cookies on Render

The previously approved GSD bypass applies. Keep secrets out of the repo. Push after tests.

Live web `https://website-xrha.onrender.com` and API `https://movprompt-new.onrender.com` are different sites. Signup succeeds, but `SameSite=Lax` session cookies are not stored for the cross-site XHR, so `/create` still shows Sign in.

1. When a trusted origin is not same-site with `BETTER_AUTH_URL`, issue auth and guest cookies as `SameSite=None; Secure; Partitioned`.
2. Keep `SameSite=Lax` for localhost so local development is unchanged.
3. Cover the cookie policy with unit tests, then commit and push.
