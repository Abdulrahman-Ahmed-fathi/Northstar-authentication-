
import "dotenv/config";

import {
  sendPasswordResetEmail,
} from "../services/email.service.js";

const recipient = process.env.TEST_EMAIL_TO?.trim();

if (!recipient) {
  console.error(
    "Missing TEST_EMAIL_TO in your local .env file."
  );

  process.exit(1);
}

try {
  const result = await sendPasswordResetEmail({
    to: recipient,
    name: "Northstar Test",
    token: "test-reset-token-not-valid",
    testMode: true,
  });

  console.log(
    "Password reset test email accepted by Resend."
  );

  console.log("Email ID:", result.id);

  console.log(
    "The test reset link is intentionally invalid."
  );
} catch (error) {
  console.error(
    "Password reset email test failed:",
    error.message
  );

  if (error.cause?.message) {
    console.error(
      "Provider message:",
      error.cause.message
    );
  }

  process.exitCode = 1;
}
