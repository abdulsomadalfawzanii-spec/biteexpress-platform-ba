const nodemailer = require('nodemailer');

// Only create a real transporter when credentials are configured.
// If EMAIL_HOST / EMAIL_USER are missing the transporter is a no-op stub
// so email failures never crash the server or block registration.
const isConfigured = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  : null;

module.exports = { transporter, isConfigured };
