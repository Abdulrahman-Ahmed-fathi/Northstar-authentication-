
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

export default router