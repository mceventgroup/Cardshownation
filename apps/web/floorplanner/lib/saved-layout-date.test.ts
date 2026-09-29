import assert from 'node:assert/strict'
import test from 'node:test'
import { compareSavedLayouts, formatSavedLayoutDate } from './saved-layout-date'

test('saved shows sort newest first with missing or invalid dates last', () => {
  const shows = [
    { id: 'missing' },
    { id: 'older', savedAt: '2026-09-28T12:00:00Z' },
    { id: 'invalid', savedAt: 'not a date' },
    { id: 'newest', savedAt: '2026-09-29T08:00:00-05:00' },
    { id: 'null', savedAt: null },
    { id: 'earlier-today', savedAt: '2026-09-29T12:00:00Z' },
  ]
  assert.deepEqual(shows.sort(compareSavedLayouts).map(show => show.id), [
    'newest', 'earlier-today', 'older', 'missing', 'invalid', 'null',
  ])
})

test('saved shows display unknown dates without inventing a timestamp', () => {
  for (const value of [undefined, null, '', 'invalid']) {
    assert.equal(formatSavedLayoutDate(value), 'Unknown date')
  }
  const date = '2026-09-29T12:00:00Z'
  assert.equal(formatSavedLayoutDate(date), new Date(date).toLocaleDateString())
})
