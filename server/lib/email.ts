import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = 'updates@ipe.city'; // Domain verified for production
const EMAIL_TEST_MODE = process.env.NODE_ENV === 'development';

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send email verification code to user
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  farcasterUsername?: string
): Promise<boolean> {
  const emailContent = {
    from: FROM_EMAIL,
    to: email,
    subject: 'Ipê City - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email Address</h2>
        <p>Hello${farcasterUsername ? ` ${farcasterUsername}` : ''},</p>
        <p>Please use the following code to verify your email address for Ipê City membership:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #8B5CF6; margin: 0; font-size: 32px; letter-spacing: 4px;">${code}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <p>Welcome to Ipê City!</p>
      </div>
    `
  };

  if (EMAIL_TEST_MODE) {
    console.log('\n📧 EMAIL (Development Mode - Not Sent):');
    console.log(`To: ${email}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log(`Code: ${code}`);
    console.log('────────────────────────────────────\n');
    return true;
  }

  try {
    await resend.emails.send(emailContent);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
}

/**
 * Send membership approval notification
 */
export async function sendApprovalEmail(
  email: string,
  farcasterUsername?: string,
  passport?: string
): Promise<boolean> {
  const emailContent = {
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to Ipê City - Membership Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🎉 Welcome to Ipê City!</h2>
        <p>Hello${farcasterUsername ? ` ${farcasterUsername}` : ''},</p>
        <p>Your membership has been approved and you now have full access to Ipê City Pulse!</p>
        ${passport ? `<p>Your Ipê passport <strong>${passport}</strong> has been confirmed.</p>` : ''}
        <p>You can now participate in daily pulse activities and engage with the community.</p>
        <p><a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}" style="background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Ipê City Pulse</a></p>
        <p>Welcome aboard!</p>
      </div>
    `
  };

  if (EMAIL_TEST_MODE) {
    console.log('\n📧 APPROVAL EMAIL (Development Mode - Not Sent):');
    console.log(`To: ${email}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log('────────────────────────────────────\n');
    return true;
  }

  try {
    await resend.emails.send(emailContent);
    console.log(`✅ Approval email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    return false;
  }
}