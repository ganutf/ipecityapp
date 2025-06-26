import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set - email functionality disabled");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('Email would be sent (SENDGRID_API_KEY not configured):', params);
    return true; // Return true for development
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  return sendEmail({
    to: email,
    from: 'noreply@ipecity.eth', // You'll need to verify this sender in SendGrid
    subject: 'Ipê City Pulse - Email Verification',
    text: `Your verification code is: ${code}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ipê City Pulse - Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #8B5CF6; font-size: 32px; letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `
  });
}

export async function sendApprovalEmail(email: string, ipePassport: string): Promise<boolean> {
  return sendEmail({
    to: email,
    from: 'noreply@ipecity.eth',
    subject: 'Welcome to Ipê City Pulse!',
    text: `Your registration has been approved! Your Ipê passport is: ${ipePassport}.ipecity.eth`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Ipê City Pulse!</h2>
        <p>Congratulations! Your registration has been approved.</p>
        <p>Your Ipê passport is:</p>
        <h3 style="color: #8B5CF6;">${ipePassport}.ipecity.eth</h3>
        <p>You can now access the platform and participate in daily pulse activities.</p>
      </div>
    `
  });
}

export async function sendDenialEmail(email: string): Promise<boolean> {
  return sendEmail({
    to: email,
    from: 'noreply@ipecity.eth',
    subject: 'Ipê City Pulse Registration Update',
    text: 'Your registration for Ipê City Pulse was not approved at this time.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Ipê City Pulse Registration Update</h2>
        <p>Thank you for your interest in Ipê City Pulse.</p>
        <p>Your registration was not approved at this time.</p>
        <p>If you have any questions, please contact our support team.</p>
      </div>
    `
  });
}