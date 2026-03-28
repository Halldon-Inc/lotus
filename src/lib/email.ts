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
      // SMTP via nodemailer: stub for future implementation
      console.log('[Email] SMTP provider configured but not yet implemented')
      console.log(`[Email] To: ${options.to} | Subject: ${options.subject}`)
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
