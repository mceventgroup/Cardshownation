import {
  authenticateCloudPassword,
  createCloudSessionToken,
  isCloudSessionAuthorized,
} from '@/lib/server/cloud-auth'

describe('cloud auth', () => {
  const originalPassword = process.env.FLOORPLANNER_ADMIN_PASSWORD
  const originalLegacyPassword = process.env.FLOORPLANNER_SAVE_KEY
  const originalSecret = process.env.FLOORPLANNER_SESSION_SECRET

  beforeEach(() => {
    process.env.FLOORPLANNER_ADMIN_PASSWORD = 'top-secret'
    process.env.FLOORPLANNER_SAVE_KEY = ''
    process.env.FLOORPLANNER_SESSION_SECRET = 'session-secret'
  })

  afterAll(() => {
    process.env.FLOORPLANNER_ADMIN_PASSWORD = originalPassword
    process.env.FLOORPLANNER_SAVE_KEY = originalLegacyPassword
    process.env.FLOORPLANNER_SESSION_SECRET = originalSecret
  })

  it('accepts the configured password and rejects others', () => {
    expect(authenticateCloudPassword('top-secret')).toBe(true)
    expect(authenticateCloudPassword('wrong')).toBe(false)
  })

  it('creates verifiable session tokens that expire', () => {
    const issuedAt = Date.UTC(2026, 5, 8, 12, 0, 0)
    const token = createCloudSessionToken(issuedAt)

    expect(isCloudSessionAuthorized(token, issuedAt + 1000)).toBe(true)
    expect(isCloudSessionAuthorized(token, issuedAt + 1000 * 60 * 60 * 13)).toBe(false)
  })
})
