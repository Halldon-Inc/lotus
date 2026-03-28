import { prisma } from '@/lib/db'

// QuickBooks API base URLs
const QB_PRODUCTION_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

// OAuth URLs
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function getBaseUrl(): string {
  return process.env.QB_ENVIRONMENT === 'production'
    ? QB_PRODUCTION_BASE
    : QB_SANDBOX_BASE
}

interface QBTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  x_refresh_token_expires_in: number
}

interface QBCustomer {
  Id?: string
  DisplayName: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
  }
  SyncToken?: string
}

interface QBVendor {
  Id?: string
  DisplayName: string
  SyncToken?: string
}

interface QBBillLine {
  Amount: number
  DetailType: string
  AccountBasedExpenseLineDetail: {
    AccountRef: { value: string; name?: string }
  }
  Description?: string
}

interface QBInvoiceLine {
  Amount: number
  DetailType: string
  SalesItemLineDetail: {
    ItemRef: { value: string; name?: string }
    Qty?: number
    UnitPrice?: number
  }
  Description?: string
}

interface QBQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[] | number | undefined
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
}

interface QBEntityResponse<T> {
  [key: string]: T
}

interface ClientData {
  name: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

interface InvoiceData {
  vendorName: string
  totalAmount: number
  invoiceNumber: string
  dueDate?: Date | null
  notes?: string | null
}

interface InvoiceLineItemData {
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface ClientInvoiceData {
  invoiceNumber: string
  totalAmount: number
  dueDate?: Date | null
  paidAt?: Date | null
  notes?: string | null
}

interface QuoteLineItemData {
  productName: string
  description?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export class QuickBooksClient {
  private realmId: string
  private accessToken: string
  private refreshToken: string
  private connectionId: string

  constructor(
    connectionId: string,
    realmId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.connectionId = connectionId
    this.realmId = realmId
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  /**
   * Build the OAuth 2.0 authorization URL for connecting to QuickBooks.
   */
  static getAuthUrl(state: string): string {
    const clientId = process.env.QB_CLIENT_ID
    const redirectUri = process.env.QB_REDIRECT_URI
    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    })
    return `${QB_AUTH_URL}?${params.toString()}`
  }

  /**
   * Exchange an authorization code for access and refresh tokens.
   */
  static async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<QBTokenResponse> {
    const clientId = process.env.QB_CLIENT_ID || ''
    const clientSecret = process.env.QB_CLIENT_SECRET || ''
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<QBTokenResponse>
  }

  /**
   * Refresh the access token using the stored refresh token.
   */
  async refreshTokens(): Promise<void> {
    const clientId = process.env.QB_CLIENT_ID || ''
    const clientSecret = process.env.QB_CLIENT_SECRET || ''
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
    }

    const tokens = (await response.json()) as QBTokenResponse
    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token

    // Persist refreshed tokens
    await prisma.quickBooksConnection.update({
      where: { id: this.connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  }

  /**
   * Make an authenticated request to the QuickBooks API.
   * Automatically retries once with refreshed tokens on 401.
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${getBaseUrl()}/${this.realmId}/${endpoint}`
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    }

    const options: RequestInit = { method, headers }
    if (body) {
      options.body = JSON.stringify(body)
    }

    let response = await fetch(url, options)

    // Retry once on 401 after refreshing tokens
    if (response.status === 401) {
      await this.refreshTokens()
      headers['Authorization'] = `Bearer ${this.accessToken}`
      response = await fetch(url, { method, headers, body: options.body })
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QB API error: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Fetch company info for the connected realm.
   */
  async getCompanyInfo(): Promise<Record<string, unknown>> {
    const data = await this.makeRequest<Record<string, unknown>>(
      'GET',
      `companyinfo/${this.realmId}`
    )
    return data
  }

  /**
   * Find an existing customer in QuickBooks by display name.
   */
  async findCustomerByName(name: string): Promise<QBCustomer | null> {
    const escaped = name.replace(/'/g, "\\'")
    const query = `select * from Customer where DisplayName = '${escaped}'`
    const data = await this.makeRequest<QBQueryResponse<QBCustomer>>(
      'GET',
      `query?query=${encodeURIComponent(query)}`
    )
    const customers = data.QueryResponse?.Customer as QBCustomer[] | undefined
    return customers && customers.length > 0 ? customers[0] : null
  }

  /**
   * Find an existing vendor in QuickBooks by display name.
   */
  async findVendorByName(name: string): Promise<QBVendor | null> {
    const escaped = name.replace(/'/g, "\\'")
    const query = `select * from Vendor where DisplayName = '${escaped}'`
    const data = await this.makeRequest<QBQueryResponse<QBVendor>>(
      'GET',
      `query?query=${encodeURIComponent(query)}`
    )
    const vendors = data.QueryResponse?.Vendor as QBVendor[] | undefined
    return vendors && vendors.length > 0 ? vendors[0] : null
  }

  /**
   * Create a new vendor in QuickBooks.
   */
  async createVendor(name: string): Promise<QBVendor> {
    const data = await this.makeRequest<QBEntityResponse<QBVendor>>(
      'POST',
      'vendor',
      { DisplayName: name }
    )
    return data.Vendor
  }

  /**
   * Create or update a customer in QuickBooks from Lotus client data.
   */
  async createOrUpdateCustomer(
    client: ClientData,
    existingQbId?: string | null
  ): Promise<string> {
    const nameParts = (client.contactName || '').split(' ')
    const givenName = nameParts[0] || undefined
    const familyName = nameParts.slice(1).join(' ') || undefined

    const customerPayload: Record<string, unknown> = {
      DisplayName: client.name,
      GivenName: givenName,
      FamilyName: familyName,
    }

    if (client.contactEmail) {
      customerPayload.PrimaryEmailAddr = { Address: client.contactEmail }
    }
    if (client.contactPhone) {
      customerPayload.PrimaryPhone = { FreeFormNumber: client.contactPhone }
    }
    if (client.address || client.city || client.state || client.zip) {
      customerPayload.BillAddr = {
        Line1: client.address || undefined,
        City: client.city || undefined,
        CountrySubDivisionCode: client.state || undefined,
        PostalCode: client.zip || undefined,
      }
    }

    if (existingQbId) {
      // Sparse update: fetch SyncToken, then update
      const existing = await this.findCustomerByName(client.name)
      if (existing) {
        customerPayload.Id = existingQbId
        customerPayload.SyncToken = existing.SyncToken
        customerPayload.sparse = true
      }
    }

    const data = await this.makeRequest<QBEntityResponse<QBCustomer>>(
      'POST',
      'customer',
      customerPayload
    )
    return data.Customer.Id || ''
  }

  /**
   * Create a Bill (vendor invoice) in QuickBooks.
   */
  async createBill(
    invoice: InvoiceData,
    lineItems: InvoiceLineItemData[]
  ): Promise<string> {
    // Look up or create the vendor
    let vendor = await this.findVendorByName(invoice.vendorName)
    if (!vendor) {
      vendor = await this.createVendor(invoice.vendorName)
    }

    const lines: QBBillLine[] = lineItems.map((item) => ({
      Amount: item.totalPrice,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: '7', name: 'Expenses' },
      },
      Description: item.description,
    }))

    const billPayload: Record<string, unknown> = {
      VendorRef: { value: vendor.Id },
      Line: lines,
      DocNumber: invoice.invoiceNumber,
      TotalAmt: invoice.totalAmount,
    }

    if (invoice.dueDate) {
      billPayload.DueDate = invoice.dueDate.toISOString().split('T')[0]
    }

    const data = await this.makeRequest<QBEntityResponse<{ Id: string }>>(
      'POST',
      'bill',
      billPayload
    )
    return data.Bill.Id
  }

  /**
   * Create an Invoice in QuickBooks from a Lotus client invoice.
   */
  async createInvoice(
    clientInvoice: ClientInvoiceData,
    customerQbId: string,
    lineItems: QuoteLineItemData[]
  ): Promise<string> {
    const lines: QBInvoiceLine[] = lineItems.map((item) => ({
      Amount: item.totalPrice,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        Qty: item.quantity,
        UnitPrice: item.unitPrice,
      },
      Description: item.description || item.productName,
    }))

    const invoicePayload: Record<string, unknown> = {
      CustomerRef: { value: customerQbId },
      Line: lines,
      DocNumber: clientInvoice.invoiceNumber,
    }

    if (clientInvoice.dueDate) {
      invoicePayload.DueDate = clientInvoice.dueDate.toISOString().split('T')[0]
    }

    const data = await this.makeRequest<QBEntityResponse<{ Id: string }>>(
      'POST',
      'invoice',
      invoicePayload
    )
    return data.Invoice.Id
  }

  /**
   * Record a payment for a QuickBooks invoice.
   */
  async recordPayment(
    amount: number,
    customerQbId: string,
    invoiceQbId: string
  ): Promise<string> {
    const paymentPayload: Record<string, unknown> = {
      TotalAmt: amount,
      CustomerRef: { value: customerQbId },
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: invoiceQbId,
              TxnType: 'Invoice',
            },
          ],
        },
      ],
    }

    const data = await this.makeRequest<QBEntityResponse<{ Id: string }>>(
      'POST',
      'payment',
      paymentPayload
    )
    return data.Payment.Id
  }
}

/**
 * Load the active QuickBooks connection and return a ready-to-use client.
 * Throws if no active connection exists.
 */
export async function getQuickBooksClient(): Promise<QuickBooksClient> {
  const connection = await prisma.quickBooksConnection.findFirst({
    where: { isActive: true },
  })

  if (!connection) {
    throw new Error('No active QuickBooks connection found')
  }

  const client = new QuickBooksClient(
    connection.id,
    connection.realmId,
    connection.accessToken,
    connection.refreshToken
  )

  // Proactively refresh if token expires within 5 minutes
  const fiveMinutes = 5 * 60 * 1000
  if (connection.tokenExpiresAt.getTime() - Date.now() < fiveMinutes) {
    await client.refreshTokens()
  }

  return client
}
