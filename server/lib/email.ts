import { Resend } from 'resend';

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
    console.log('📧 Email Configuration (Lazy-loaded):');
    console.log(`  NODE_ENV: ${NODE_ENV}`);
    console.log(`  EMAIL_TEST_MODE: ${EMAIL_TEST_MODE}`);
    console.log(`  RESEND_API_KEY: ${RESEND_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
    console.log(`  Resend Client: ${resend ? 'Initialized ✓' : 'Not initialized ✗'}`);
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
    console.log('📧 Email would be sent (TEST MODE - NO QUOTA USED):');
    console.log('  To:', params.to);
    console.log('  From:', params.from);
    console.log('  Subject:', params.subject);
    if (params.text) console.log('  Text:', params.text);
    if (params.html) console.log('  HTML:', params.html.substring(0, 200) + '...');
    console.log('  💡 To send real emails, set EMAIL_TEST_MODE=false in .env');
    return true;
  }

  // Send real emails (development or production)
  if (!config.resendClient) {
    console.error('📧 Cannot send email: RESEND_API_KEY not configured');
    console.error('💡 Add RESEND_API_KEY to your .env file or set EMAIL_TEST_MODE=true for testing');
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
    
    console.log(`📧 Email sent successfully to ${params.to}`, result);
    return true;
  } catch (error) {
    console.error('📧 Email sending failed:', error);
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
  const fromEmail = 'team@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
    subject: 'Welcome to Ipê City Pulse!',
    text: `Your registration has been approved! Your Ipê passport is: ${ipePassport}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Ipê City Pulse!</h2>
        <p>Congratulations! Your registration has been approved.</p>
        <p>Your Ipê passport is:</p>
        <h3 style="color: #8B5CF6;">${ipePassport}</h3>
        <p>You can now access the platform and participate in daily pulse activities.</p>
      </div>
    `
  });
}

export async function sendDenialEmail(email: string): Promise<boolean> {
  const fromEmail = 'team@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
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