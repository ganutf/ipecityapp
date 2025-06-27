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
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // In development mode, only log emails without sending them
  if (isDevelopment) {
    console.log('📧 Email would be sent (DEVELOPMENT MODE - NO QUOTA USED):');
    console.log('  To:', params.to);
    console.log('  From:', params.from);
    console.log('  Subject:', params.subject);
    if (params.text) console.log('  Text:', params.text);
    if (params.html) console.log('  HTML:', params.html.substring(0, 100) + '...');
    return true;
  }

  // Production mode - send real emails
  if (!resend) {
    console.error('RESEND_API_KEY not configured for production email sending');
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
    
    const result = await resend!.emails.send(emailData);
    
    console.log(`Email sent successfully (PRODUCTION) to ${params.to}`, result);
    return true;
  } catch (error) {
    console.error('Resend email error:', error);
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
  const isDevelopment = process.env.NODE_ENV === 'development';
  const fromEmail = isDevelopment 
    ? 'onboarding@resend.dev' 
    : 'team@updates.ipe.city';

  return sendEmail({
    to: email,
    from: fromEmail,
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
  const isDevelopment = process.env.NODE_ENV === 'development';
  const fromEmail = isDevelopment 
    ? 'onboarding@resend.dev' 
    : 'team@updates.ipe.city';

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