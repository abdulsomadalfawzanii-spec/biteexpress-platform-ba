const { transporter, isConfigured } = require('../config/nodemailer');


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
    
    console.error(`[sendEmail] Failed to send email to ${to}:`, err.message);
    return { accepted: [], failed: true, error: err.message };
  }
};

module.exports = sendEmail;
