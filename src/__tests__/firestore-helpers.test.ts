import { describe, it, expect } from 'vitest';
import { toFirestoreValue, fromFirestoreValue } from '../client/firebase.js';

describe('toFirestoreValue', () => {
  it('converts a string', () => {
    expect(toFirestoreValue('hello')).toEqual({ stringValue: 'hello' });
  });

  it('converts an integer', () => {
    expect(toFirestoreValue(42)).toEqual({ integerValue: '42' });
  });

  it('converts a float', () => {
    expect(toFirestoreValue(3.14)).toEqual({ doubleValue: 3.14 });
  });

  it('converts a boolean true', () => {
    expect(toFirestoreValue(true)).toEqual({ booleanValue: true });
  });

  it('converts a boolean false', () => {
    expect(toFirestoreValue(false)).toEqual({ booleanValue: false });
  });

  it('converts null', () => {
    expect(toFirestoreValue(null)).toEqual({ nullValue: null });
  });

  it('converts undefined as null', () => {
    expect(toFirestoreValue(undefined)).toEqual({ nullValue: null });
  });

  it('converts an empty array', () => {
    expect(toFirestoreValue([])).toEqual({ arrayValue: { values: [] } });
  });

  it('converts a string array', () => {
    expect(toFirestoreValue(['a', 'b'])).toEqual({
      arrayValue: {
        values: [{ stringValue: 'a' }, { stringValue: 'b' }],
      },
    });
  });

  it('converts a nested object', () => {
    expect(toFirestoreValue({ x: 1 })).toEqual({
      mapValue: { fields: { x: { integerValue: '1' } } },
    });
  });

  it('converts a deeply nested structure', () => {
    const input = { sets: [{ weight: 80, reps: 8 }] };
    expect(toFirestoreValue(input)).toEqual({
      mapValue: {
        fields: {
          sets: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      weight: { integerValue: '80' },
                      reps: { integerValue: '8' },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });
  });
});

describe('fromFirestoreValue', () => {
  it('converts stringValue', () => {
    expect(fromFirestoreValue({ stringValue: 'hello' })).toBe('hello');
  });

  it('converts integerValue', () => {
    expect(fromFirestoreValue({ integerValue: '42' })).toBe(42);
  });

  it('converts doubleValue', () => {
    expect(fromFirestoreValue({ doubleValue: 3.14 })).toBe(3.14);
  });

  it('converts booleanValue true', () => {
    expect(fromFirestoreValue({ booleanValue: true })).toBe(true);
  });

  it('converts booleanValue false', () => {
    expect(fromFirestoreValue({ booleanValue: false })).toBe(false);
  });

  it('converts nullValue', () => {
    expect(fromFirestoreValue({ nullValue: null })).toBeNull();
  });

  it('converts empty arrayValue', () => {
    expect(fromFirestoreValue({ arrayValue: {} })).toEqual([]);
  });

  it('converts arrayValue with values', () => {
    expect(
      fromFirestoreValue({
        arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] },
      })
    ).toEqual(['a', 'b']);
  });

  it('converts mapValue', () => {
    expect(
      fromFirestoreValue({
        mapValue: { fields: { x: { integerValue: '1' } } },
      })
    ).toEqual({ x: 1 });
  });

  it('converts empty mapValue', () => {
    expect(fromFirestoreValue({ mapValue: {} })).toEqual({});
  });
});

describe('round-trip', () => {
  it('preserves a workout exercise structure', () => {
    const original = {
      name: 'Bench Press',
      sets: [
        { weight: 80, reps: 8, rir: 2 },
        { weight: 80, reps: 7, rir: 1 },
      ],
    };
    const firestoreValue = toFirestoreValue(original);
    const restored = fromFirestoreValue(firestoreValue);
    expect(restored).toEqual(original);
  });

  it('preserves an integer 0', () => {
    expect(fromFirestoreValue(toFirestoreValue(0))).toBe(0);
  });

  it('preserves an empty string', () => {
    expect(fromFirestoreValue(toFirestoreValue(''))).toBe('');
  });

  it('preserves a float weight', () => {
    expect(fromFirestoreValue(toFirestoreValue(102.5))).toBe(102.5);
  });
});
