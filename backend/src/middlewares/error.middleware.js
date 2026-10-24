
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isApiError = err instanceof ApiError;
  const isMalformedJson = err?.type === "entity.parse.failed";

  let statusCode = 500;
  let message = "Internal server error";

  if (isMalformedJson) {
    statusCode = 400;
    message = "Invalid JSON request body";
  } else if (isApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  if (env.NODE_ENV !== "production" || statusCode >= 500) {
    console.error(
      `[${statusCode}] ${req.method} ${req.originalUrl}`,
      err
    );
  }

  const response = {
  message,
  data: null,
};

if (isApiError && err.details) {
  response.errors = err.details;
}

return res.status(statusCode).json(response);
}
