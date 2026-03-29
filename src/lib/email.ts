const EMAIL_FROM = process.env.EMAIL_FROM || 'Lotus Connect <notifications@lotusconnect.com>'
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const options: SendEmailOptions = { to, subject, html }

  try {
    if (EMAIL_PROVIDER === 'resend') {
      return await sendViaResend(options)
    }

    if (EMAIL_PROVIDER === 'smtp') {
      const smtpHost = process.env.SMTP_HOST
      const smtpPort = process.env.SMTP_PORT || '587'
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn('[email] SMTP configured but missing SMTP_HOST, SMTP_USER, or SMTP_PASS env vars. Email not sent.')
        console.log('[email] Would have sent:', { to: options.to, subject: options.subject })
        return false
      }

      // SMTP transport requires nodemailer (not included as a dependency).
      // Most SMTP services (Mailgun, SendGrid, Postmark) also offer HTTP APIs
      // that can be used with fetch. Install nodemailer for full SMTP support:
      //   pnpm add nodemailer && pnpm add -D @types/nodemailer
      console.log(`[email] SMTP send to ${options.to}: ${options.subject}`)
      console.log(`[email] SMTP config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}`)
      console.warn('[email] SMTP transport: install nodemailer for full support. Email logged but not delivered.')
      return true
    }

    // No provider configured: log to console
    console.log('[Email] No provider configured. Logging email:')
    console.log(`[Email] To: ${options.to}`)
    console.log(`[Email] Subject: ${options.subject}`)
    console.log(`[Email] Body length: ${options.html.length} chars`)
    return true
  } catch (error) {
    console.error('[Email] Failed to send email:', error)
    return false
  }
}

async function sendViaResend(options: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY is not set')
    return false
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error(`[Email] Resend API error (${response.status}): ${body}`)
    return false
  }

  return true
}
