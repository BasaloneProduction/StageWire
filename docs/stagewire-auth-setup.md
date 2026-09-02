# StageWire worker sign-in setup

StageWire supports passwordless worker accounts through Supabase Auth. The adapter is disabled unless both required settings are present. Without them, development stays in honest preview mode and production refuses to start.

## Free Supabase project

1. Create one Supabase project on the Free plan.
2. In Authentication > Sign In / Providers > Email, keep email authentication enabled.
3. Edit the email template so it sends the six-digit `{{ .Token }}` instead of a magic-link button.
4. Keep the default one-minute resend window and one-hour code expiry.
5. Copy the project URL and publishable key from the project API settings.

## StageWire settings

Set these on the API server:

```text
STAGEWIRE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
STAGEWIRE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not add a Supabase service-role or secret key. StageWire needs only the publishable key because Supabase performs the verification and StageWire confirms the returned user through the authenticated `/auth/v1/user` endpoint.

## What happens after activation

- A worker enters an email address.
- Supabase sends a six-digit, one-time code.
- StageWire sends the code to Supabase for verification.
- StageWire confirms the provider user server-side.
- StageWire creates or reopens the worker-owned record and issues its own HttpOnly session cookie.
- All private data routes switch from preview ownership to the signed-in worker.
- Production startup remains blocked if either setting is missing or invalid.

Never use real worker information in a shared preview build.
