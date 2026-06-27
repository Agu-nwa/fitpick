# FitPick Production Environment Checklist

Use this checklist to create the production `.env.local` on EC2. Do not commit real values.

## App and Session

```bash
NODE_ENV=production
APP_URL=
NEXT_PUBLIC_APP_URL=
SESSION_COOKIE_NAME=fitpick_session
JWT_SECRET=
```

Notes:

- `APP_URL` and `NEXT_PUBLIC_APP_URL` should use the production domain after DNS is ready.
- `JWT_SECRET` must be a long, random secret.
- Keep session cookies HTTP-only through the backend session implementation.

## Database

```bash
MONGODB_URI=
```

Notes:

- Use a production MongoDB database.
- Restrict network access where possible.
- Use a database user with only the permissions FitPick needs.

## S3 + CloudFront

```bash
STORAGE_PROVIDER=s3
S3_BUCKET=fitpick1
S3_REGION=eu-north-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

Notes:

- `S3_SECRET_ACCESS_KEY` must remain server-only.
- Test signed S3 upload before public launch.
- Customer UI should never show raw S3 errors, signed URLs, access keys, or provider internals.

## AI Tagging

```bash
AI_TAGGING_PROVIDER=mock
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Allowed provider values:

```text
mock | gemini | openai
```

Notes:

- `mock` is the safest default until provider testing is complete.
- Keep user tag review required.
- Do not auto-save AI suggestions without user confirmation.

## Payments

```bash
PAYMENT_PROVIDER=placeholder
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FITPICK_PLUS_STRIPE_PRICE_ID=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
FITPICK_PLUS_PAYSTACK_PLAN_CODE=
PAYSTACK_CALLBACK_URL=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
```

Allowed provider values:

```text
auto | stripe | paystack | placeholder
```

Notes:

- Use sandbox keys until HTTPS and webhook verification are complete.
- Stripe webhook URL: `https://YOUR_DOMAIN/api/billing/webhook/stripe`
- Paystack webhook URL: `https://YOUR_DOMAIN/api/billing/webhook/paystack`
- Live payments should not be activated before HTTPS is working.

## Optional

```bash
RATE_LIMIT_REDIS_URL=
```

Notes:

- Add Redis-backed rate limiting when production traffic begins.
- Leave blank only if the current deployment does not require external rate limiting.

## Final Review

- `.env.local` exists on EC2.
- `.env.local` is not committed.
- No real secrets appear in docs, screenshots, logs, or client code.
- `npm run test:secret-scan` passes.
- `npm run deploy:check` passes.
- `curl -I http://127.0.0.1:3000/api/health` returns `200 OK`.
