const DEFAULT_CARD_SHOW_NATION_BASE_URL = 'https://cardshownation.com'

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_CARD_SHOW_NATION_BASE_URL

  try {
    const url = new URL(trimmed)
    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_CARD_SHOW_NATION_BASE_URL
  }
}

export function getCardShowNationBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_CSN_BASE_URL)
}

export function getCardShowNationHost(): string {
  return new URL(getCardShowNationBaseUrl()).host
}

export function getCardShowNationShowsApiUrl(): string {
  return `${getCardShowNationBaseUrl()}/api/shows`
}

export function getCardShowNationSubmitShowUrl(): string {
  return `${getCardShowNationBaseUrl()}/submit-show`
}
