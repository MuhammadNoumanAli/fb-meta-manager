import { MetaDeliveryStatus } from '../../common/enums/meta-delivery-status.enum';
import { MetaReviewStatus } from '../../common/enums/meta-review-status.enum';

export interface MetaStatusSnapshot {
  id: string;
  /** The configured status (`ACTIVE`, `PAUSED`, `ARCHIVED`). */
  status: string | null;
  /** Meta's derived delivery status, including review outcomes. */
  effectiveStatus: string | null;
  issues: Array<{ code: number | null; summary: string | null }>;
}

export interface MappedMetaStatus {
  externalStatus: string | null;
  deliveryStatus: MetaDeliveryStatus;
  metaReviewStatus: MetaReviewStatus;
}

const DELIVERY_MAP: Record<string, MetaDeliveryStatus> = {
  ACTIVE: MetaDeliveryStatus.ACTIVE,
  PAUSED: MetaDeliveryStatus.PAUSED,
  CAMPAIGN_PAUSED: MetaDeliveryStatus.PAUSED,
  ADSET_PAUSED: MetaDeliveryStatus.PAUSED,
  ARCHIVED: MetaDeliveryStatus.ARCHIVED,
  DELETED: MetaDeliveryStatus.DELETED,
  PENDING_BILLING_INFO: MetaDeliveryStatus.PENDING_BILLING_INFO,
  IN_PROCESS: MetaDeliveryStatus.IN_PROCESS,
  PENDING_REVIEW: MetaDeliveryStatus.IN_PROCESS,
  WITH_ISSUES: MetaDeliveryStatus.WITH_ISSUES,
  DISAPPROVED: MetaDeliveryStatus.WITH_ISSUES,
};

/**
 * Maps Meta's `effective_status` onto AdPilot's delivery and review states.
 * Keeping this pure makes the mapping easy to test without the Graph API.
 */
export function mapMetaStatus(snapshot: MetaStatusSnapshot): MappedMetaStatus {
  const raw = (snapshot.effectiveStatus ?? snapshot.status ?? '').toUpperCase();
  const deliveryStatus = DELIVERY_MAP[raw] ?? MetaDeliveryStatus.UNKNOWN;

  return {
    externalStatus: snapshot.effectiveStatus ?? snapshot.status ?? null,
    deliveryStatus,
    metaReviewStatus: deriveReviewStatus(raw, snapshot.issues),
  };
}

function deriveReviewStatus(
  raw: string,
  issues: MetaStatusSnapshot['issues'],
): MetaReviewStatus {
  switch (raw) {
    case 'PENDING_REVIEW':
    case 'IN_PROCESS':
      return MetaReviewStatus.IN_REVIEW;
    case 'PREAPPROVED':
    case 'ACTIVE':
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return MetaReviewStatus.APPROVED;
    case 'DISAPPROVED':
      return MetaReviewStatus.REJECTED;
    case 'WITH_ISSUES':
      // Billing issues are not policy rejections.
      return issues.some((issue) =>
        (issue.summary ?? '').toLowerCase().includes('polic'),
      )
        ? MetaReviewStatus.REJECTED
        : MetaReviewStatus.UNKNOWN;
    case 'DISABLED':
    case 'DELETED':
      return MetaReviewStatus.DISABLED;
    default:
      return MetaReviewStatus.UNKNOWN;
  }
}
