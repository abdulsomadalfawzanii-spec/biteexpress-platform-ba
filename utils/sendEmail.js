const { transporter, isConfigured } = require('../config/nodemailer');

/**
 * Send an email. Always resolves — never throws.
 * If email is not configured, logs a note and returns gracefully.
 * This means email failure NEVER blocks registration or any other flow.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!isConfigured || !transporter) {
    console.log(`[sendEmail] Email not configured — skipping email to: ${to} | Subject: ${subject}`);
    return { accepted: [to], skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `BiteExpress <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (err) {
    // Log the error but DO NOT re-throw — email failure must never break registration
    console.error(`[sendEmail] Failed to send email to ${to}:`, err.message);
    return { accepted: [], failed: true, error: err.message };
  }
};

module.exports = sendEmail;
