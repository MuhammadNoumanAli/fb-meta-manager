import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';
import { mapMetaStatus } from './meta-status.mapper';

describe('mapMetaStatus', () => {
  it('maps approved, review and rejected states', () => {
    expect(mapMetaStatus({ id: '1', status: 'ACTIVE', effectiveStatus: 'ACTIVE', issues: [] }))
      .toMatchObject({
        deliveryStatus: MetaDeliveryStatus.ACTIVE,
        metaReviewStatus: MetaReviewStatus.APPROVED,
      });

    expect(
      mapMetaStatus({ id: '1', status: 'ACTIVE', effectiveStatus: 'PENDING_REVIEW', issues: [] }),
    ).toMatchObject({
      deliveryStatus: MetaDeliveryStatus.IN_PROCESS,
      metaReviewStatus: MetaReviewStatus.IN_REVIEW,
    });

    expect(
      mapMetaStatus({ id: '1', status: 'ACTIVE', effectiveStatus: 'DISAPPROVED', issues: [] }),
    ).toMatchObject({
      deliveryStatus: MetaDeliveryStatus.WITH_ISSUES,
      metaReviewStatus: MetaReviewStatus.REJECTED,
    });
  });

  it('treats policy issues as a rejection but billing issues as unknown', () => {
    const policy = mapMetaStatus({
      id: '1',
      status: 'ACTIVE',
      effectiveStatus: 'WITH_ISSUES',
      issues: [{ code: 1, summary: 'Ad violates advertising policies' }],
    });
    const billing = mapMetaStatus({
      id: '1',
      status: 'ACTIVE',
      effectiveStatus: 'WITH_ISSUES',
      issues: [{ code: 2, summary: 'Payment method declined' }],
    });

    expect(policy.metaReviewStatus).toBe(MetaReviewStatus.REJECTED);
    expect(billing.metaReviewStatus).toBe(MetaReviewStatus.UNKNOWN);
  });

  it('maps paused, archived and deleted delivery states', () => {
    expect(
      mapMetaStatus({ id: '1', status: 'PAUSED', effectiveStatus: 'PAUSED', issues: [] }),
    ).toMatchObject({
      deliveryStatus: MetaDeliveryStatus.PAUSED,
      metaReviewStatus: MetaReviewStatus.APPROVED,
    });

    expect(
      mapMetaStatus({ id: '1', status: 'ARCHIVED', effectiveStatus: 'ARCHIVED', issues: [] }),
    ).toMatchObject({ deliveryStatus: MetaDeliveryStatus.ARCHIVED });

    expect(
      mapMetaStatus({ id: '1', status: null, effectiveStatus: 'DELETED', issues: [] }),
    ).toMatchObject({
      deliveryStatus: MetaDeliveryStatus.DELETED,
      metaReviewStatus: MetaReviewStatus.DISABLED,
    });
  });

  it('falls back to configured status and preserves the raw status', () => {
    const mapped = mapMetaStatus({
      id: '1',
      status: 'ACTIVE',
      effectiveStatus: null,
      issues: [],
    });

    expect(mapped.externalStatus).toBe('ACTIVE');
    expect(mapped.deliveryStatus).toBe(MetaDeliveryStatus.ACTIVE);
  });

  it('returns unknown for missing or unrecognised statuses', () => {
    expect(
      mapMetaStatus({ id: '1', status: null, effectiveStatus: null, issues: [] }),
    ).toEqual({
      externalStatus: null,
      deliveryStatus: MetaDeliveryStatus.UNKNOWN,
      metaReviewStatus: MetaReviewStatus.UNKNOWN,
    });
  });
});
