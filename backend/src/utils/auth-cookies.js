
import { env } from "../config/env.js";
import {
  REFRESH_TOKEN_TTL_SECONDS,
} from "../services/refresh-token.service.js";

export const REFRESH_TOKEN_COOKIE_NAME = "northstar_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
};

export function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions);
}
