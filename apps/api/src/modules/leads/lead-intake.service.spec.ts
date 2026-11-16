import { normaliseMetaLeadFields } from './lead-intake.service';
import type { MetaLeadDetails } from '../integrations/meta-graph.client';

const details = (
  fields: Array<{ name: string; values: string[] }>,
): MetaLeadDetails => ({
  id: 'leadgen-1',
  createdTime: '2026-11-16T09:30:00+0000',
  formId: 'form-1',
  adId: 'ad-1',
  adSetId: 'adset-1',
  campaignId: 'campaign-1',
  pageId: 'page-1',
  isOrganic: false,
  fields,
});

describe('normaliseMetaLeadFields', () => {
  it('prefers a full name and trims provider values', () => {
    const result = normaliseMetaLeadFields(
      details([
        { name: 'full_name', values: ['  Ada Lovelace  '] },
        { name: 'first_name', values: ['Ignored'] },
      ]),
    );

    expect(result.fullName).toBe('Ada Lovelace');
  });

  it('combines separate first and last names', () => {
    const result = normaliseMetaLeadFields(
      details([
        { name: 'first_name', values: ['Grace'] },
        { name: 'last_name', values: ['Hopper'] },
      ]),
    );

    expect(result.fullName).toBe('Grace Hopper');
  });

  it('maps contact, locale and message aliases', () => {
    const result = normaliseMetaLeadFields(
      details([
        { name: 'Email', values: ['ada@example.com'] },
        { name: 'whatsapp_number', values: ['+60111222333'] },
        { name: 'locale', values: ['en-MY'] },
        { name: 'notes', values: ['Call after 5pm'] },
      ]),
    );

    expect(result).toMatchObject({
      email: 'ada@example.com',
      phone: '+60111222333',
      language: 'en-MY',
      message: 'Call after 5pm',
      fullName: null,
    });
  });

  it('interprets consent answers conservatively', () => {
    const granted = normaliseMetaLeadFields(
      details([{ name: 'consent', values: ['I agree to be contacted'] }]),
    );
    const denied = normaliseMetaLeadFields(
      details([{ name: 'opt_in', values: ['No'] }]),
    );
    const unknown = normaliseMetaLeadFields(
      details([{ name: 'marketing_consent', values: ['maybe'] }]),
    );

    expect(granted.consentStatus).toBe('granted');
    expect(denied.consentStatus).toBe('denied');
    expect(unknown.consentStatus).toBe('unknown');
  });

  it('returns nulls when Meta sends no usable fields', () => {
    const result = normaliseMetaLeadFields(details([]));

    expect(result).toEqual({
      fullName: null,
      email: null,
      phone: null,
      language: null,
      message: null,
      consentStatus: 'unknown',
    });
  });
});
