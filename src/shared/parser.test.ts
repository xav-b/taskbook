import { expect, test } from 'vitest'
import { isPriorityOpt, isBoardOpt, isTagOpt, getPriority, hasTerms } from './parser'

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
