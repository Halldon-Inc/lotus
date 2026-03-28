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
}

interface HubSpotSearchResult {
  total: number
  results: HubSpotDeal[]
}

interface HubSpotNote {
  id: string
  properties: Record<string, string>
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
