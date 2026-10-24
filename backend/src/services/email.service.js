
import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export async function sendVerificationEmail({
  to,
  name,
  token,
  testMode = false,
}) {
  const verificationUrl = new URL("/verify-email", env.FRONTEND_URL);
  verificationUrl.searchParams.set("token", token);

  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(verificationUrl.toString());

  const subject = testMode
    ? "[TEST] Verify your Northstar account"
    : "Verify your Northstar account";

  const testNotice = testMode
    ? "<p><strong>Test only:</strong> This verification link is not valid yet.</p>"
    : "";

  const textTestNotice = testMode
    ? "\nTEST ONLY: This verification link is not valid yet.\n"
    : "";

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to Northstar</h2>
        <p>Hello ${safeName},</p>
        <p>Please verify your email address to complete your registration.</p>
        ${testNotice}
        <p>
          <a href="${safeUrl}">Verify your email address</a>
        </p>
        <p>This link expires after 24 hours.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,

    text: `
Welcome to Northstar

Hello ${name || "there"},

Please verify your email address:
${verificationUrl.toString()}

This link expires after 24 hours.
${textTestNotice}
If you did not request this, you can ignore this email.
    `.trim(),
  });

  if (error) {
    const sendError = new Error(
      "The email provider could not send the verification email."
    );

    sendError.cause = error;
    throw sendError;
  }

  if (!data?.id) {
    throw new Error("The email provider did not return an email ID.");
  }

  return { id: data.id };
}
