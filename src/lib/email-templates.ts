interface EmailTemplate {
  subject: string
  html: string
}

function wrapInTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0D7377;padding:28px 32px;border-radius:8px 8px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Lotus</span>
                    <span style="font-size:24px;font-weight:300;color:#D4A843;letter-spacing:0.5px;"> Connect</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1f2937;">${title}</h1>
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Lotus Connect | Procurement &amp; Order Management
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`
}

function highlight(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td style="padding:10px 14px;background-color:#f0fdfa;border-left:3px solid #0D7377;border-radius:4px;">
        <span style="font-size:13px;color:#6b7280;font-weight:500;">${label}:</span>
        <span style="font-size:15px;color:#0D7377;font-weight:600;margin-left:8px;">${value}</span>
      </td>
    </tr>
  </table>`
}

function ctaButton(text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr>
      <td style="background-color:#0D7377;border-radius:6px;padding:12px 28px;">
        <span style="font-size:14px;font-weight:600;color:#ffffff;">${text}</span>
      </td>
    </tr>
  </table>`
}

export function poReceived(clientName: string, poNumber: string): EmailTemplate {
  const content = [
    paragraph(`Hello ${clientName},`),
    paragraph('Your purchase order has been received and is now being reviewed by our team.'),
    highlight('PO Number', poNumber),
    paragraph('We will notify you once the order has been verified and moves into procurement.'),
    ctaButton('View in Lotus Connect'),
  ].join('')

  return {
    subject: `Purchase Order ${poNumber} Received`,
    html: wrapInTemplate('Purchase Order Received', content),
  }
}

export function poNeedsCorrection(poNumber: string, reason: string, recipientName: string): EmailTemplate {
  const content = [
    paragraph(`Hi ${recipientName},`),
    paragraph(`Purchase order <strong>${poNumber}</strong> requires a correction before it can proceed.`),
    highlight('PO Number', poNumber),
    highlight('Reason', reason),
    paragraph('Please review and resubmit the corrected purchase order at your earliest convenience.'),
    ctaButton('Review Purchase Order'),
  ].join('')

  return {
    subject: `Action Required: PO ${poNumber} Needs Correction`,
    html: wrapInTemplate('Purchase Order Needs Correction', content),
  }
}

export function procurementAlert(poNumber: string, itemCount: number): EmailTemplate {
  const content = [
    paragraph('A new purchase order has been verified and is ready for procurement.'),
    highlight('PO Number', poNumber),
    highlight('Items', String(itemCount)),
    paragraph('Please begin sourcing and purchasing the items listed in this order.'),
    ctaButton('Start Procurement'),
  ].join('')

  return {
    subject: `New PO ${poNumber} Ready for Procurement (${itemCount} items)`,
    html: wrapInTemplate('New Purchase Order Ready', content),
  }
}

export function deliveryConfirmed(clientName: string, poNumber: string): EmailTemplate {
  const content = [
    paragraph(`Hello ${clientName},`),
    paragraph('We are pleased to confirm that your order has been delivered.'),
    highlight('PO Number', poNumber),
    paragraph('If you have any questions about your delivery, please contact our team.'),
    ctaButton('View Delivery Details'),
  ].join('')

  return {
    subject: `Order ${poNumber} Delivered`,
    html: wrapInTemplate('Delivery Confirmed', content),
  }
}

export function invoiceSent(
  clientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string
): EmailTemplate {
  const content = [
    paragraph(`Hello ${clientName},`),
    paragraph('An invoice has been issued for your recent order. Please find the details below.'),
    highlight('Invoice Number', invoiceNumber),
    highlight('Amount Due', amount),
    highlight('Due Date', dueDate),
    paragraph('Please arrange payment by the due date. Contact us if you have any questions.'),
    ctaButton('View Invoice'),
  ].join('')

  return {
    subject: `Invoice ${invoiceNumber} for ${amount}`,
    html: wrapInTemplate('Invoice Issued', content),
  }
}

export function paymentReceived(
  clientName: string,
  invoiceNumber: string,
  amount: string
): EmailTemplate {
  const content = [
    paragraph(`Hello ${clientName},`),
    paragraph('We have received your payment. Thank you!'),
    highlight('Invoice Number', invoiceNumber),
    highlight('Amount Paid', amount),
    paragraph('This invoice is now marked as paid. No further action is required.'),
  ].join('')

  return {
    subject: `Payment Confirmed for Invoice ${invoiceNumber}`,
    html: wrapInTemplate('Payment Received', content),
  }
}

export function discrepancyAlert(poNumber: string, type: string): EmailTemplate {
  const formattedType = type.replace(/_/g, ' ').toLowerCase()

  const content = [
    paragraph(`A discrepancy has been reported and requires your attention.`),
    highlight('PO Number', poNumber),
    highlight('Type', formattedType),
    paragraph('Please review the discrepancy details and take the appropriate action.'),
    ctaButton('Review Discrepancy'),
  ].join('')

  return {
    subject: `Discrepancy Reported on PO ${poNumber}: ${formattedType}`,
    html: wrapInTemplate('Discrepancy Alert', content),
  }
}

export function approvalNeeded(entityType: string, requestedBy: string): EmailTemplate {
  const formattedType = entityType.replace(/_/g, ' ').toLowerCase()

  const content = [
    paragraph('A new approval request has been submitted and requires your review.'),
    highlight('Entity Type', formattedType),
    highlight('Requested By', requestedBy),
    paragraph('Please review and approve or reject this request.'),
    ctaButton('Review Approval'),
  ].join('')

  return {
    subject: `Approval Required: ${formattedType}`,
    html: wrapInTemplate('Approval Required', content),
  }
}
