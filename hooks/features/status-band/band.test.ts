import { expect, test } from 'claude-code/testing'

import { bar, countdown, fitSegments, lineLength, segmentsFor } from './band'

const NOW = Date.parse('2026-10-23T10:00:00Z')

test('a healthy session has no segments', () => {
  const segments = segmentsFor(
    {
      contextPercent: 30,
      limits: [{ kind: 'five_hour', percentUsed: 20 }],
    },
    NOW,
  )

  expect(segments).toEqual([])
})

test('context shows from 60 percent and warns from 85', () => {
  const [quiet] = segmentsFor({ contextPercent: 60, limits: [] }, NOW)
  const [loud] = segmentsFor({ contextPercent: 90, limits: [] }, NOW)

  expect(quiet?.text).toBe('context █████░░░ 60%')
  expect(quiet?.isWarning).toBe(false)
  expect(loud?.text).toContain('90%')
  expect(loud?.isWarning).toBe(true)
})

test('a limit shows from 75 percent with its reset, ordered 5h, 7d, spend', () => {
  const segments = segmentsFor(
    {
      limits: [
        { kind: 'seven_day', percentUsed: 80, resetsAt: '2026-10-26T14:00:00Z' },
        { kind: 'five_hour', percentUsed: 92, resetsAt: '2026-10-23T12:05:00Z' },
        { kind: 'spend_limit', percentUsed: 10 },
      ],
    },
    NOW,
  )

  expect(segments.map(s => s.text)).toEqual([
    '5h 92% (resets in 2h 05m)',
    '7d 80% (resets in 3d 4h)',
  ])
  expect(segments.map(s => s.isWarning)).toEqual([true, false])
})

test('a window past its reset is hidden', () => {
  const segments = segmentsFor(
    { limits: [{ kind: 'five_hour', percentUsed: 99, resetsAt: '2026-10-23T09:00:00Z' }] },
    NOW,
  )

  expect(segments).toEqual([])
})

test('countdown reads in minutes, hours and days', () => {
  expect(countdown('2026-10-23T10:42:00Z', NOW)).toBe('42m')
  expect(countdown('2026-10-23T10:00:00Z', NOW)).toBe('now')
  expect(countdown(undefined, NOW)).toBeUndefined()
  expect(countdown('not a date', NOW)).toBeUndefined()
})

test('bar fills in proportion and stays inside its cells', () => {
  expect(bar(0)).toBe('░░░░░░░░')
  expect(bar(100)).toBe('████████')
  expect(bar(150)).toBe('████████')
})

test('fit drops segments from the end and keeps the first', () => {
  const segments = segmentsFor(
    {
      contextPercent: 70,
      limits: [{ kind: 'five_hour', percentUsed: 80, resetsAt: '2026-10-23T11:00:00Z' }],
    },
    NOW,
  )

  expect(fitSegments(segments, 200)).toHaveLength(2)
  expect(fitSegments(segments, lineLength(segments) - 1).map(s => s.id)).toEqual(['context'])
  expect(fitSegments(segments, 3).map(s => s.id)).toEqual(['context'])
})
