
import "dotenv/config";
import { sendVerificationEmail } from "../services/email.service.js";

const recipient = process.env.TEST_EMAIL_TO?.trim();

if (!recipient) {
  console.error(
    "Missing TEST_EMAIL_TO. Add it to your local backend/.env file."
  );

  process.exit(1);
}

try {
  const result = await sendVerificationEmail({
    to: recipient,
    name: "Northstar Test",
    token: "test-token-not-valid",
    testMode: true,
  });

  console.log("Resend accepted the test email.");
  console.log("Email ID:", result.id);
  console.log(
    "The test verification link is intentionally not valid."
  );
} catch (error) {
  console.error("Email test failed:", error.message);

  if (error.cause?.message) {
    console.error("Provider message:", error.cause.message);
  }

  process.exitCode = 1;
}
