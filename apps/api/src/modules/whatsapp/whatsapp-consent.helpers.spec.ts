import { isOptOutMessage } from './whatsapp-consent.service';

describe('isOptOutMessage', () => {
  it('matches English opt-out keywords', () => {
    expect(isOptOutMessage('STOP')).toBe(true);
    expect(isOptOutMessage('unsubscribe')).toBe(true);
    expect(isOptOutMessage('opt out')).toBe(true);
    expect(isOptOutMessage('optout')).toBe(true);
    expect(isOptOutMessage('Quit')).toBe(true);
  });

  it('matches Bahasa Malaysia opt-out keywords', () => {
    expect(isOptOutMessage('berhenti')).toBe(true);
    expect(isOptOutMessage('Batal')).toBe(true);
    expect(isOptOutMessage('jangan hantar')).toBe(true);
  });

  it('ignores surrounding whitespace and trailing punctuation', () => {
    expect(isOptOutMessage('  stop.  ')).toBe(true);
    expect(isOptOutMessage('Unsubscribe!')).toBe(true);
    expect(isOptOutMessage('jangan hantar?')).toBe(true);
  });

  it('normalises repeated internal whitespace', () => {
    expect(isOptOutMessage('stop    promotion')).toBe(true);
  });

  it('does not treat keywords inside sentences as opt-outs', () => {
    expect(isOptOutMessage('please stop by tomorrow')).toBe(false);
    expect(isOptOutMessage('stop sending me offers tomorrow')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isOptOutMessage(null)).toBe(false);
    expect(isOptOutMessage(undefined)).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
  });
});
