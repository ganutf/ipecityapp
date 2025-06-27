import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!resend) {
    console.log('Email would be sent (RESEND_API_KEY not configured):', params);
    return true; // Return true for development
  }

  try {
    // Environment-based email routing
    const isDevelopment = process.env.NODE_ENV === 'development';
    const actualRecipient = params.to;
    
    const emailData: any = {
      from: isDevelopment ? 'noreply@resend.dev' : params.from,
      to: isDevelopment ? 'delivered@resend.dev' : params.to,
      subject: isDevelopment ? `[DEV] ${params.subject} (for ${actualRecipient})` : params.subject,
    };
    
    if (params.text) emailData.text = params.text;
    if (params.html) emailData.html = params.html;
    
    const result = await resend!.emails.send(emailData);
    
    console.log(`Email sent successfully (${isDevelopment ? 'TEST' : 'PROD'}) to ${emailData.to}`, result);
    return true;
  } catch (error) {
    console.error('Resend email error:', error);
    // For development, log the error but continue the flow
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: treating email as sent despite error');
      return true;
    }
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const fromEmail = isDevelopment 
    ? 'onboarding@resend.dev' 
    : 'noreply@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
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
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
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
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
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