# FitPick Integration Status

## Completed Phases

- Frontend Phase 4D: mobile-first app shell, routes, mock screens, and UI states.
- Backend Phase 5A-5E: auth, sessions, MongoDB models, wardrobe, uploads, occasions, outfits, looks, preferences, notifications, Plus, audit, and safe API responses.
- S3 Storage Integration: signed upload foundation, image metadata, CloudFront URLs, and safe not-configured fallback.
- AI Tagging Phase: provider-based clothing tag suggestions with mandatory user review.
- Integration Phase 6A-6F: API client, auth, wardrobe, upload, AI tagging, occasion, outfit recommendation, looks, preferences, Plus status, payment foundation, and readiness cleanup.

## Integrated Screens

- `/login`, `/register`, `/profile`
- `/wardrobe`, `/wardrobe/add`, `/wardrobe/[id]`
- `/occasion`
- `/outfit`, `/outfit/[id]`
- `/looks`
- `/profile/preferences`
- `/plus`
- `/backend-ready`, `/frontend-complete`, `/states`

## Connected APIs

- Auth: register, login, logout, session check.
- Wardrobe: list, create, detail, update, tag update, archive, upload metadata, signed upload, suggest tags, review tags.
- Occasions: list and custom creation.
- Outfits: recommend, detail, swap, save, wear, feedback.
- Looks: saved, worn, favorites.
- Profile: current user, safe user update, style preferences, notification preferences.
- Plus and billing: plus status, checkout provider foundation, provider readiness, Stripe webhook, Paystack webhook.

## Fallback Behavior

- Logged-out users see auth-required cards and example previews where useful.
- Backend unavailable states use safe copy and preserve helpful mock previews.
- Empty wardrobe and looks states guide users toward next actions.
- S3, AI tagging, Stripe, and Paystack return safe not-configured messages when environment variables are missing.

## Environment Variables

- App/auth: `APP_URL`, `NEXT_PUBLIC_APP_URL`, `MONGODB_URI`, `JWT_SECRET`, `SESSION_COOKIE_NAME`
- Storage: `STORAGE_PROVIDER`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
- AI tagging: `AI_TAGGING_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
- Payments: `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FITPICK_PLUS_STRIPE_PRICE_ID`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `FITPICK_PLUS_PAYSTACK_PLAN_CODE`, `PAYSTACK_CALLBACK_URL`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

## Known Limitations

- Stripe and Paystack are foundation-ready; production account activation and live plan verification remain.
- Flutterwave is intentionally left for a future provider adapter.
- AI tagging uses provider abstraction; production image-understanding quality tuning remains.
- Push notification delivery is not implemented.
- Account deletion/export execution needs production workflow hardening.

## Local Commands

- `npm install`
- `npm run dev`
- `npm run build`

## EC2 Notes

- `npm install`
- `npm run build`
- `pm2 start npm --name fitpick -- start -- --hostname 0.0.0.0 --port 3000`
- Nginx can proxy port 80 to 3000.

## Next Phase

Testing Phase 7: end-to-end QA, mobile/accessibility verification, backend smoke coverage, payment sandbox checks, upload QA, and deployment readiness.

See `docs/testing-phase-7.md` for the active QA checklist and command sequence.
