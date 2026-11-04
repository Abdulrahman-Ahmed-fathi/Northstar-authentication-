
// the importing sequence is important
import { Router } from "express";
import { registerController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { registerSchema } from "../schemas/auth.schema.js";
import {
  verifyEmailController,
} from "../controllers/auth.controller.js";
import {
  verifyEmailSchema,
} from "../schemas/auth.schema.js";
const router = Router()
import {
  resendVerificationController,
} from "../controllers/auth.controller.js";

import {
  resendVerificationSchema,
} from "../schemas/auth.schema.js";

import {
  resendVerificationIpLimiter,
  resendVerificationEmailLimiter,
} from "../middlewares/resend-verification-rate-limit.middleware.js";
import { loginController } from "../controllers/auth.controller.js";

import { loginSchema } from "../schemas/auth.schema.js";

import { loginRateLimiter } from "../middlewares/login-rate-limit.middleware.js";
import {
  refreshController,
  logoutController,
} from "../controllers/auth.controller.js";

import {
  requireFrontendOrigin,
} from "../middlewares/require-frontend-origin.middleware.js";

import {
  refreshRateLimiter,
} from "../middlewares/refresh-rate-limit.middleware.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { getMeController } from "../controllers/auth.controller.js";
import {
  forgotPasswordController,
} from "../controllers/auth.controller.js";

import {
  forgotPasswordSchema,
} from "../schemas/auth.schema.js";

import {
  forgotPasswordRateLimiter,
} from "../middlewares/forgot-password-rate-limit.middleware.js";

import {
  resetPasswordController,
} from "../controllers/auth.controller.js";
import {
  resetPasswordSchema,
} from "../schemas/auth.schema.js";
import {
  resetPasswordRateLimiter,
} from "../middlewares/reset-password-rate-limit.middleware.js";

router.post(
    "/register",
    validate(registerSchema),
    registerController
)

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  verifyEmailController
);

router.post(
  "/resend-verification",
  resendVerificationIpLimiter,
  validate(resendVerificationSchema),
  resendVerificationEmailLimiter,
  resendVerificationController
);

router.post(
  "/login",
  loginRateLimiter,
  validate(loginSchema),
  loginController
);


router.post(
  "/refresh",
  refreshRateLimiter,
  requireFrontendOrigin,
  refreshController
);

router.post(
  "/logout",
  requireFrontendOrigin,
  logoutController
);

router.get(
  "/me",
  authenticate,
  getMeController
);

router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController
);

router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController
);
export default router