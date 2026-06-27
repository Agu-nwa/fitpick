# FitPick Backend API Contract

All API responses use:

```json
{ "ok": true, "data": {} }
```

Errors use:

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "Please sign in to continue." } }
```

Protected routes return `401` when logged out. User-owned data is scoped by `userId`.

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Preferences And Profile

- `PATCH /api/users/me`
- `POST /api/users/me/delete-request`
- `GET /api/preferences`
- `PATCH /api/preferences`
- `GET /api/notifications/preferences`
- `PATCH /api/notifications/preferences`

## Wardrobe

- `GET /api/wardrobe`
- `POST /api/wardrobe`
- `GET /api/wardrobe/[id]`
- `PATCH /api/wardrobe/[id]`
- `DELETE /api/wardrobe/[id]`
- `PATCH /api/wardrobe/[id]/tags`
- `POST /api/wardrobe/upload`
- `POST /api/wardrobe/upload/[id]/review-tags`

## Outfits And Looks

- `POST /api/outfits/recommend`
- `GET /api/outfits/[id]`
- `POST /api/outfits/[id]/swap`
- `POST /api/outfits/[id]/save`
- `POST /api/outfits/[id]/wear`
- `POST /api/outfits/[id]/feedback`
- `GET /api/looks`

Recommendation text is template/rule based and must never mention body shape, size, complexion, attractiveness, or physical traits.

## Billing And Uploads

- `GET /api/billing/plus-status`
- `POST /api/billing/checkout`
- `POST /api/uploads/signed-url`
- `GET /api/uploads/[key]/view`

Checkout and storage signing are provider-ready placeholders. No secrets or raw public storage URLs are returned.

## Admin

- `POST /api/admin/seed`
- `GET /api/admin/content`
- `GET /api/admin/audit`

Admin routes require an authenticated user with `role: "admin"`.

## Frontend Integration Order

1. Auth session: `/api/auth/me`, login, logout.
2. Preferences and notification settings.
3. Wardrobe list/create/upload metadata/tag review.
4. Outfit recommendation/detail/save/wear/feedback.
5. Looks.
6. Plus status and upgrade prompts.
7. Signed upload/view once storage provider is configured.

## Environment Variables

Required for real backend use:

- `MONGODB_URI`
- `JWT_SECRET`
- `SESSION_COOKIE_NAME`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`

Optional/provider-specific:

- `STORAGE_PROVIDER`
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FITPICK_PLUS_PRICE_ID`
- `RATE_LIMIT_REDIS_URL`

## Smoke Test

Start the app, then run:

```bash
BACKEND_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:backend-smoke
```
