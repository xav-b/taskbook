import { expect, test } from 'vitest'
import {
  isPriorityOpt,
  isBoardOpt,
  isTagOpt,
  getPriority,
  hasTerms,
  parseDuration,
  parseOptions,
} from './parser'

test('valid priority options', () => {
  expect(isPriorityOpt('p:1')).toBeTruthy()
  expect(isPriorityOpt('p:2')).toBeTruthy()
  expect(isPriorityOpt('p:3')).toBeTruthy()
})

test('invalid priority options', () => {
  expect(isPriorityOpt('word')).toBeFalsy()
  expect(isPriorityOpt('p:4')).toBeFalsy()
})

test('valid board options', () => {
  expect(isBoardOpt('@board')).toBeTruthy()
})

test('invalid board options', () => {
  expect(isBoardOpt('board')).toBeFalsy()
})

test('valid tag options', () => {
  expect(isTagOpt('+tag')).toBeTruthy()
})

test('invalid tag options', () => {
  expect(isTagOpt('tag')).toBeFalsy()
})

test('find a task priority', () => {
  expect(getPriority('important task p:3 i tell you'.split(' '))).toBe(3)
  expect(getPriority('less important task p:2 but still'.split(' '))).toBe(2)
})

test('no task priority default to lower', () => {
  expect(getPriority('whatever task'.split(' '))).toBe(1)
})

test('find term occurences', () => {
  expect(hasTerms('Hello, world!', ['bar', 'Hello', ''])).toBeTruthy()
  expect(hasTerms('Hello, world!', ['WORLD', 'foo'])).toBeTruthy()
})

test('failed to find term occurences', () => {
  expect(hasTerms('Hello, world!', [])).toBeFalsy()
})

test('handle parsing missing duration', () => {
  expect(parseDuration(null)).toBeNull()
  expect(parseDuration(0)).toBeNull()
  expect(parseDuration(-1)).toBeNull()
})

test('converts minutes duration in ms', () => {
  expect(parseDuration(1)).toBe(60000)
})

test('parse simple line', () => {
  const given = 'Nothing much in there'
  const line = parseOptions(given.split(' '))
  expect(line.description).toBe(given)
})

test('line parser default board', () => {
  const given = 'Nothing much in there'
  let line = parseOptions(given.split(' '))
  expect(line.boards.length).toBe(0)

  line = parseOptions(given.split(' '), { defaultBoard: 'Super Board' })
  expect(line.boards[0]).toBe('Super Board')
})

test('parse line with priority tags and boards', () => {
  const given = 'Task with prio p:2 on @qa and @test +yolo'
  const line = parseOptions(given.split(' '))
  expect(line.description).toBe('Task with prio on and')
  expect(line.tags).toMatchObject(['+yolo'])
  expect(line.boards).toMatchObject(['@qa', '@test'])
  expect(line.priority).toBe(2)
})
