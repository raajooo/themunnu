import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Extract SMTP variables strictly from SMTP_* environment keys to avoid pollution from generic variables like PORT (which is 3000) or USER (which is the system user)
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

console.log(`[EMAIL SYSTEM] Initializing SMTP Transporter using host: ${host}, port: ${port}, user: ${user ? "CONFIGURED" : "MISSING"}`);

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // true for 465, false for other ports like 587
  auth: {
    user,
    pass,
  },
  tls: {
    // Avoid blockages due to self-signed or unexpected SMTP certificates in container environments
    rejectUnauthorized: false
  }
});

export let isSmtpVerified = false;
export let smtpVerificationError = "";

// Immediately verify connection in the background if credentials exist
if (user && pass) {
  transporter.verify()
    .then(() => {
      isSmtpVerified = true;
      smtpVerificationError = "";
      console.log(`[EMAIL SYSTEM] SMTP Connection verified successfully on ${host}:${port}`);
    })
    .catch((err: any) => {
      smtpVerificationError = err.message || "Unknown SMTP Verification Error";
      isSmtpVerified = false;
      console.error(`[EMAIL SYSTEM] SMTP Background Verification failed:`, err.message);
    });
} else {
  console.warn("[EMAIL SYSTEM] SMTP credentials (USER/PASS) not fully provided. Falling back to MOCK mode.");
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Sends an email using the configured SMTP transporter.
 * Falls back to mock logging if SMTP credentials are not configured.
 */
export async function sendEmail(to: string, template: EmailTemplate) {
  const finalUser = process.env.SMTP_USER || user;
  const finalPass = process.env.SMTP_PASS || pass;

  if (!finalUser || !finalPass) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${template.subject}`);
    return { success: true, isMock: true, message: `Mock email to ${to} simulated successfully` };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Munnu Store" <${finalUser}>`,
      to,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[EMAIL SYSTEM] Email sent to ${to}: ${template.subject} (Message ID: ${info.messageId})`);
    return { success: true, isMock: false, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EMAIL SYSTEM] Failed to send email to ${to}:`, error);
    throw error;
  }
}
