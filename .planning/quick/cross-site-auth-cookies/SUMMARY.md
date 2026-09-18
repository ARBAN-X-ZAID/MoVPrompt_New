# Cross-site auth cookies

Live web and API sit on different `*.onrender.com` hosts, so `SameSite=Lax` session cookies were never stored after sign-up. Sign-up still returned success, then `/create` and `/auth/callback` saw no session and showed Sign in.

The API now issues `SameSite=None; Secure; Partitioned` cookies when a trusted origin is cross-site with `BETTER_AUTH_URL`. Localhost and same-site custom subdomains stay Lax. Guest `mp_guest` cookies use the same policy.
