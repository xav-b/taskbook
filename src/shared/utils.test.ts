import { expect, test } from 'vitest'
import Task from '../domain/task'
import { randomHexString, removeDuplicates, sortByPriorities } from './utils'

test('generate random hex strings', () => {
  expect(randomHexString().length).toBe(8)
  expect(randomHexString(6).length).toBe(6)
})

test('remove array duplicates', () => {
  expect(removeDuplicates(['foo', 'bar', 'foo']).length).toBe(2)
  expect(removeDuplicates(['foo', 'bar', 'foo'])).toStrictEqual(['foo', 'bar'])
})

test('sort items by priorities', () => {
  const board = [
    new Task({ _id: 1, description: 'qa 1', priority: 1 }),
    new Task({ _id: 2, description: 'qa 2', priority: 3 }),
    new Task({ _id: 3, description: 'qa 3', priority: 2 }),
    new Task({ _id: 4, description: 'qa 4', priority: 1 }),
  ]

  const sorted = board.sort(sortByPriorities)
  expect(sorted[0].priority).toBe(3)
  expect(sorted[1].priority).toBe(2)
  expect(sorted[2].priority).toBe(1)
  expect(sorted[3].priority).toBe(1)
})

// TODO: test `ensureDir`, with proper stuff or cleanup
