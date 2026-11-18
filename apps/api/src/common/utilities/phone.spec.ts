import { displayPhone, normalisePhone } from './phone';

describe('normalisePhone', () => {
  it('strips formatting characters down to digits', () => {
    expect(normalisePhone('+60 12-345 6789')).toBe('60123456789');
    expect(normalisePhone('(011) 234 5678')).toBe('0112345678');
  });

  it('returns null for empty values', () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone('')).toBeNull();
  });

  it('rejects strings with too few digits to be a phone number', () => {
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('no digits at all')).toBeNull();
  });
});

describe('displayPhone', () => {
  it('adds a leading plus to stored digit-only addresses', () => {
    expect(displayPhone('60123456789')).toBe('+60123456789');
  });

  it('keeps formatted numbers unchanged', () => {
    expect(displayPhone('+60 12-345 6789')).toBe('+60 12-345 6789');
  });
});
