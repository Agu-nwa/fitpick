import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/types/api";

export function apiSuccess<T>(data: T, init?: { message?: string; status?: number }) {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    ...(init?.message ? { message: init.message } : {})
  };

  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  init?: { status?: number; details?: unknown }
) {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
      ...(init?.details ? { details: init.details } : {})
    }
  };

  return NextResponse.json(body, { status: init?.status ?? statusForCode(code) });
}

export function statusForCode(code: ApiErrorCode) {
  switch (code) {
    case "BAD_REQUEST":
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "PLUS_REQUIRED":
      return 402;
    case "SETUP_REQUIRED":
      return 503;
    default:
      return 500;
  }
}

export function safeMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Error && error.message) return fallback;
  return fallback;
}
