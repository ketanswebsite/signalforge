/**
 * lib/shared/input.js - the checks that turn malformed request input into a 400 before it reaches
 * Postgres (which threw on it, and the handlers answered 500).
 */

const Input = require('../../lib/shared/input');

describe('isoDate', () => {
    test.each([
        ['2026-02-28', '2026-02-28'],
        ['2024-02-29', '2024-02-29'],
        ['2025-02-29', null],
        ['2026-02-30', null],
        ['2026-13-01', null],
        ['2026-1-01', null],
        ['31-12-2026', null],
        ['not-a-date', null],
        [123, null],
        [null, null],
        [['2026-01-01'], null]
    ])('%p -> %p', (value, expected) => {
        expect(Input.isoDate(value)).toBe(expected);
    });
});

describe('isoTimestamp', () => {
    test.each([
        ['2099-01-01', true],
        ['2099-01-01T10:00:00.000Z', true],
        ['2099-01-01T10:00', true],
        ['2099-01-01 10:00:00+01:00', true],
        ['2026-02-30T00:00:00Z', false],
        ['2099-01-01T25:00:00Z', false],
        ['not-a-date', false],
        ['', false],
        [4102444800000, false]
    ])('%p accepted: %p', (value, ok) => {
        expect(Input.isoTimestamp(value) !== null).toBe(ok);
    });
});

describe('numbers', () => {
    test.each([
        [105, 105], ['105', 105], ['1e3', 1000], [0.5, 0.5],
        [0, null], ['0', null], [-5, null], ['not-a-price', null], ['', null], [null, null], [true, null], [Infinity, null]
    ])('positiveNumber(%p) -> %p', (value, expected) => {
        expect(Input.positiveNumber(value)).toBe(expected);
    });

    test.each([[0, 0], ['2.5', 2.5], [-0.01, null], ['abc', null], [undefined, null]])('nonNegativeNumber(%p) -> %p', (value, expected) => {
        expect(Input.nonNegativeNumber(value)).toBe(expected);
    });

    test.each([[0, 0], ['7', 7], [7.5, null], [-1, null], ['abc', null]])('nonNegativeInteger(%p) -> %p', (value, expected) => {
        expect(Input.nonNegativeInteger(value)).toBe(expected);
    });
});

describe('chatId', () => {
    test.each([
        ['-1000000000001', '-1000000000001'],
        [-1000000000001, '-1000000000001'],
        [' 123 ', '123'],
        [123, '123'],
        ['12.5', null],
        [1.5, null],
        ['not-a-chat-id', null],
        ['', null],
        [null, null],
        [{}, null]
    ])('%p -> %p', (value, expected) => {
        expect(Input.chatId(value)).toBe(expected);
    });
});
