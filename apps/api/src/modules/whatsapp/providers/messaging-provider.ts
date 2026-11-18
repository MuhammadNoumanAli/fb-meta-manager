import { WhatsappProvider } from '../../../common/enums/whatsapp-provider.enum';

/** Decrypted credentials for one connected WhatsApp account. */
export interface ProviderCredentials {
  accessToken?: string;
  authToken?: string;
  accountSid?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
}

export interface ProviderSendContext {
  credentials: ProviderCredentials;
  phoneNumberExternalId: string;
  phoneNumberDisplay: string;
}

export interface TemplateMessageInput {
  toPhone: string;
  templateName: string;
  language: string;
  /** Ordered template parameters keyed by placeholder index ("1", "2", ...). */
  variables: Record<string, string>;
  /** Locally rendered preview of the message body. */
  body: string;
  /** Provider-side template identifier (Meta: none, Twilio: ContentSid). */
  providerTemplateId: string | null;
}

export interface ProviderSendResult {
  externalMessageId: string;
  payload: Record<string, unknown>;
}

export interface ProviderAccountInfo {
  displayPhoneNumber: string | null;
  qualityRating: string | null;
  name: string | null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /** Rate limits and provider outages are safe to retry. */
  get retryable(): boolean {
    if (this.status === null) {
      return false;
    }

    return this.status === 429 || this.status >= 500;
  }
}

export interface MessagingProvider {
  readonly name: WhatsappProvider;
  sendTemplateMessage(
    context: ProviderSendContext,
    input: TemplateMessageInput,
  ): Promise<ProviderSendResult>;
  verifyAccount?(context: ProviderSendContext): Promise<ProviderAccountInfo>;
}

/** Meta and Twilio expect the recipient without separators or a plus sign. */
export function recipientDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** Ordered template parameters, ignoring gaps. */
export function orderedVariables(
  variables: Record<string, string>,
): Array<{ key: string; value: string }> {
  return Object.entries(variables)
    .filter(([, value]) => typeof value === 'string')
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([key, value]) => ({ key, value }));
}
