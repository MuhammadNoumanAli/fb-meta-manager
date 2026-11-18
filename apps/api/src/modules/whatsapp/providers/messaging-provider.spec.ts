import {
  orderedVariables,
  ProviderError,
  recipientDigits,
} from './messaging-provider';

describe('ProviderError', () => {
  it('marks rate limits and server errors as retryable', () => {
    expect(new ProviderError('rate limited', 429).retryable).toBe(true);
    expect(new ProviderError('server error', 500).retryable).toBe(true);
    expect(new ProviderError('bad gateway', 503).retryable).toBe(true);
  });

  it('treats client errors and transport failures as permanent', () => {
    expect(new ProviderError('invalid request', 400).retryable).toBe(false);
    expect(new ProviderError('unauthorised', 401).retryable).toBe(false);
    expect(new ProviderError('network down', null).retryable).toBe(false);
  });
});

describe('recipientDigits', () => {
  it('removes the plus and separators', () => {
    expect(recipientDigits('+60 12-345 6789')).toBe('60123456789');
  });
});

describe('orderedVariables', () => {
  it('sorts numeric keys and keeps string values', () => {
    expect(
      orderedVariables({ '2': 'second', '1': 'first', '10': 'tenth' }),
    ).toEqual([
      { key: '1', value: 'first' },
      { key: '2', value: 'second' },
      { key: '10', value: 'tenth' },
    ]);
  });

  it('ignores non-string values', () => {
    expect(
      orderedVariables({
        '1': 'first',
        '2': undefined as unknown as string,
      }),
    ).toEqual([{ key: '1', value: 'first' }]);
  });

  it('returns an empty list when there are no variables', () => {
    expect(orderedVariables({})).toEqual([]);
  });
});
