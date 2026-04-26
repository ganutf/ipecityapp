import { Resend } from 'resend';
import logger from '../logger';

// Lazy-loaded email configuration
let resend: Resend | null = null;
let configLogged = false;

function getEmailConfig() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';
  const NODE_ENV = process.env.NODE_ENV;

  // Initialize Resend client if needed
  if (!resend && RESEND_API_KEY) {
    resend = new Resend(RESEND_API_KEY);
  }

  // Log configuration once
  if (!configLogged) {
    logger.info('Email configuration loaded', {
      environment: NODE_ENV,
      testMode: EMAIL_TEST_MODE,
      apiKeyConfigured: !!RESEND_API_KEY,
      clientInitialized: !!resend,
    });
    configLogged = true;
  }

  return {
    testMode: EMAIL_TEST_MODE,
    hasApiKey: !!RESEND_API_KEY,
    clientInitialized: !!resend,
    environment: NODE_ENV,
    resendClient: resend
  };
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const config = getEmailConfig();

  // Test mode - log emails without sending them (controlled by EMAIL_TEST_MODE env var)
  if (config.testMode) {
    logger.info('Email test mode - not sending', {
      to: params.to,
      from: params.from,
      subject: params.subject,
    });
    return true;
  }

  // Send real emails (development or production)
  if (!config.resendClient) {
    logger.error('Cannot send email: RESEND_API_KEY not configured');
    return false;
  }

  try {
    const emailData: any = {
      from: params.from,
      to: params.to,
      subject: params.subject,
    };
    
    if (params.text) emailData.text = params.text;
    if (params.html) emailData.html = params.html;
    
    const result = await config.resendClient!.emails.send(emailData);
    
    logger.info(`Email sent to ${params.to}`);
    return true;
  } catch (error) {
    logger.error('Email sending failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if emails can be sent (either in test mode or with real API)
 */
export function canSendEmails(): boolean {
  const config = getEmailConfig();
  return config.testMode || config.clientInitialized;
}

// Export the getEmailConfig function
export { getEmailConfig };

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const fromEmail = 'noreply@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
    subject: 'Ipê Platform - Email Verification',
    text: `Your verification code is: ${code}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ipê Platform - Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #8B5CF6; font-size: 32px; letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `
  });
}

export async function sendApprovalEmail(email: string, ipePassport: string): Promise<boolean> {
  const fromEmail = 'team@updates.ipe.city';
  const platformUrl = process.env.FRONTEND_URL || 'https://app.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
    subject: 'Welcome to the Ipê Platform!',
    text: `Your application has been approved. Your Ipê passport ${ipePassport} is now live on Ethereum and owned by your wallet — no further action needed. Sign in to the platform: ${platformUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to the Ipê Platform!</h2>
        <p>Your application has been approved and your Ipê passport is live on Ethereum:</p>
        <h3 style="color: #8B5CF6;">${ipePassport}</h3>
        <p>The subdomain is already on-chain and owned by your wallet — you don't need to sign anything.</p>
        <p><a href="${platformUrl}" style="display: inline-block; background-color: #8B5CF6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in to the platform</a></p>
      </div>
    `
  });
}

interface ApplicationNotificationData {
  displayName?: string | null;
  ipeUsername: string;
  email: string;
  walletAddress: string;
  bio?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  profileTags?: string[] | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendApplicationSubmittedNotification(
  adminEmails: string[],
  applicant: ApplicationNotificationData
): Promise<void> {
  if (adminEmails.length === 0) {
    logger.warn('No admin recipients for application notification', {
      applicantUsername: applicant.ipeUsername,
    });
    return;
  }

  const fromEmail = 'noreply@updates.ipe.city';
  const platformUrl = process.env.FRONTEND_URL || 'https://app.ipe.city';
  const adminUrl = `${platformUrl}/admin`;
  const displayLabel = applicant.displayName || applicant.ipeUsername;

  const socialLines: string[] = [];
  if (applicant.twitter) socialLines.push(`Twitter: ${applicant.twitter}`);
  if (applicant.linkedin) socialLines.push(`LinkedIn: ${applicant.linkedin}`);
  if (applicant.instagram) socialLines.push(`Instagram: ${applicant.instagram}`);
  const tagsLine =
    applicant.profileTags && applicant.profileTags.length > 0
      ? `Tags: ${applicant.profileTags.join(', ')}`
      : null;

  const textLines = [
    `${displayLabel} just submitted an application to the Ipê Platform.`,
    '',
    `Username: ${applicant.ipeUsername}`,
    `Email: ${applicant.email}`,
    `Wallet: ${applicant.walletAddress}`,
    applicant.bio ? `Bio: ${applicant.bio}` : null,
    ...socialLines,
    tagsLine,
    '',
    `Review at: ${adminUrl}`,
  ].filter((line): line is string => line !== null);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New application: ${escapeHtml(displayLabel)}</h2>
      <p>${escapeHtml(displayLabel)} just submitted an application to the Ipê Platform.</p>
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Username</td><td style="padding: 4px 0;"><strong>${escapeHtml(applicant.ipeUsername)}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td style="padding: 4px 0;">${escapeHtml(applicant.email)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Wallet</td><td style="padding: 4px 0; font-family: monospace;">${escapeHtml(applicant.walletAddress)}</td></tr>
        ${applicant.bio ? `<tr><td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top;">Bio</td><td style="padding: 4px 0;">${escapeHtml(applicant.bio)}</td></tr>` : ''}
        ${applicant.twitter ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Twitter</td><td style="padding: 4px 0;">${escapeHtml(applicant.twitter)}</td></tr>` : ''}
        ${applicant.linkedin ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">LinkedIn</td><td style="padding: 4px 0;">${escapeHtml(applicant.linkedin)}</td></tr>` : ''}
        ${applicant.instagram ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Instagram</td><td style="padding: 4px 0;">${escapeHtml(applicant.instagram)}</td></tr>` : ''}
        ${tagsLine ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Tags</td><td style="padding: 4px 0;">${escapeHtml(applicant.profileTags!.join(', '))}</td></tr>` : ''}
      </table>
      <p style="margin-top: 24px;"><a href="${adminUrl}" style="display: inline-block; background-color: #8B5CF6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Review application</a></p>
    </div>
  `;

  await Promise.all(
    adminEmails.map((adminEmail) =>
      sendEmail({
        to: adminEmail,
        from: fromEmail,
        subject: `New application: ${displayLabel}`,
        text: textLines.join('\n'),
        html,
      })
    )
  );
}

export async function sendDenialEmail(email: string): Promise<boolean> {
  const fromEmail = 'team@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
    subject: 'Ipê Platform Registration Update',
    text: 'Your registration for the Ipê Platform was not approved at this time.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ipê Platform Registration Update</h2>
        <p>Thank you for your interest in the Ipê Platform.</p>
        <p>Your registration was not approved at this time.</p>
        <p>If you have any questions, please contact our support team.</p>
      </div>
    `
  });
}