const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

function getAccessToken(): string | null {
  return process.env.HUBSPOT_ACCESS_TOKEN || null
}

function logSkipped(method: string, reason: string): void {
  console.log(`[HubSpot] ${method} skipped: ${reason}`)
}

interface HubSpotDealProperties {
  dealstage?: string
  [key: string]: string | undefined
}

interface HubSpotDeal {
  id: string
  properties: HubSpotDealProperties
  associations?: Record<string, { results: Array<{ id: string; type: string }> }>
}

interface HubSpotSearchResult {
  total: number
  results: HubSpotDeal[]
}

interface HubSpotNote {
  id: string
  properties: Record<string, string>
}

export interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    [key: string]: string | undefined
  }
}

export interface HubSpotCompany {
  id: string
  properties: {
    name?: string
    domain?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    industry?: string
    [key: string]: string | undefined
  }
}

interface HubSpotPaginatedResponse<T> {
  results: T[]
  paging?: {
    next?: {
      after: string
    }
  }
}

async function hubspotFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('fetch', 'no HUBSPOT_ACCESS_TOKEN configured')
    return null
  }

  const url = `${HUBSPOT_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  try {
    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[HubSpot] ${options.method || 'GET'} ${path} failed (${response.status}): ${errorBody}`)
      return null
    }

    const data = (await response.json()) as T
    return data
  } catch (error) {
    console.error(`[HubSpot] ${options.method || 'GET'} ${path} error:`, error)
    return null
  }
}

/**
 * Update the deal stage for a given deal.
 */
export async function updateDealStage(
  dealId: string,
  stageName: string
): Promise<HubSpotDeal | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('updateDealStage', `would set deal ${dealId} to stage "${stageName}"`)
    return null
  }

  return hubspotFetch<HubSpotDeal>(
    `/crm/v3/objects/deals/${dealId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        properties: { dealstage: stageName },
      }),
    }
  )
}

/**
 * Search deals by a specific property value.
 */
export async function searchDeals(
  property: string,
  value: string
): Promise<HubSpotDeal[]> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('searchDeals', `would search ${property}=${value}`)
    return []
  }

  const result = await hubspotFetch<HubSpotSearchResult>(
    '/crm/v3/objects/deals/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: property,
                operator: 'EQ',
                value,
              },
            ],
          },
        ],
      }),
    }
  )

  return result?.results ?? []
}

/**
 * Create a note and associate it with a deal.
 */
export async function createEngagementNote(
  dealId: string,
  body: string
): Promise<HubSpotNote | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('createEngagementNote', `would create note on deal ${dealId}`)
    return null
  }

  // Step 1: Create the note
  const note = await hubspotFetch<HubSpotNote>(
    '/crm/v3/objects/notes',
    {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    }
  )

  if (!note) return null

  // Step 2: Associate the note with the deal
  await hubspotFetch<unknown>(
    `/crm/v3/objects/notes/${note.id}/associations/deals/${dealId}/note_to_deal`,
    { method: 'PUT' }
  )

  return note
}

/**
 * Get a deal by ID.
 */
export async function getDeal(
  dealId: string
): Promise<HubSpotDeal | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('getDeal', `would fetch deal ${dealId}`)
    return null
  }

  return hubspotFetch<HubSpotDeal>(
    `/crm/v3/objects/deals/${dealId}`
  )
}

/**
 * Paginate through all results from a HubSpot list endpoint.
 */
export async function getAllPaginated<T>(
  fetchFn: (limit: number, after?: string) => Promise<HubSpotPaginatedResponse<T> | null>
): Promise<T[]> {
  const allResults: T[] = []
  let after: string | undefined

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetchFn(100, after)
    if (!response) break

    allResults.push(...response.results)

    if (response.paging?.next?.after) {
      after = response.paging.next.after
    } else {
      break
    }
  }

  return allResults
}

/**
 * Get contacts from HubSpot with pagination support.
 */
export async function getContacts(
  limit: number = 100,
  after?: string
): Promise<HubSpotPaginatedResponse<HubSpotContact> | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('getContacts', 'no HUBSPOT_ACCESS_TOKEN configured')
    return null
  }

  const params = new URLSearchParams({
    limit: String(limit),
    properties: 'firstname,lastname,email,phone,company,address,city,state,zip',
  })
  if (after) params.set('after', after)

  return hubspotFetch<HubSpotPaginatedResponse<HubSpotContact>>(
    `/crm/v3/objects/contacts?${params.toString()}`
  )
}

/**
 * Get companies from HubSpot with pagination support.
 */
export async function getCompanies(
  limit: number = 100,
  after?: string
): Promise<HubSpotPaginatedResponse<HubSpotCompany> | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('getCompanies', 'no HUBSPOT_ACCESS_TOKEN configured')
    return null
  }

  const params = new URLSearchParams({
    limit: String(limit),
    properties: 'name,domain,phone,address,city,state,zip,industry',
  })
  if (after) params.set('after', after)

  return hubspotFetch<HubSpotPaginatedResponse<HubSpotCompany>>(
    `/crm/v3/objects/companies?${params.toString()}`
  )
}

/**
 * Get deals from HubSpot with pagination support.
 */
export async function getDeals(
  limit: number = 100,
  after?: string
): Promise<HubSpotPaginatedResponse<HubSpotDeal> | null> {
  const token = getAccessToken()
  if (!token) {
    logSkipped('getDeals', 'no HUBSPOT_ACCESS_TOKEN configured')
    return null
  }

  const params = new URLSearchParams({
    limit: String(limit),
    properties: 'dealname,dealstage,amount,closedate,pipeline',
    associations: 'companies',
  })
  if (after) params.set('after', after)

  return hubspotFetch<HubSpotPaginatedResponse<HubSpotDeal>>(
    `/crm/v3/objects/deals?${params.toString()}`
  )
}

/**
 * Check if the HubSpot connection is active.
 * Returns the portal ID on success, null on failure.
 */
export async function checkConnection(): Promise<string | null> {
  const token = getAccessToken()
  if (!token) return null

  interface AccountInfo {
    portalId: number
  }

  const result = await hubspotFetch<AccountInfo>(
    '/account-info/v3/details'
  )

  return result ? String(result.portalId) : null
}
