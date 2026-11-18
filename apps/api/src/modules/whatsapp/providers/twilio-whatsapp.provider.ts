import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappProvider } from '../../../common/enums/whatsapp-provider.enum';
import {
  MessagingProvider,
  ProviderAccountInfo,
  ProviderError,
  ProviderSendContext,
  ProviderSendResult,
  TemplateMessageInput,
  orderedVariables,
  recipientDigits,
} from './messaging-provider';

interface TwilioErrorBody {
  message?: string;
  code?: number;
  status?: number;
}

/**
 * Twilio adapter for teams that use Twilio as their WhatsApp BSP. Approved
 * templates are addressed through Twilio ContentSid/ContentVariables.
 */
@Injectable()
export class TwilioWhatsappProvider implements MessagingProvider {
  readonly name = WhatsappProvider.TWILIO;

  constructor(private readonly configService: ConfigService) {}

  async sendTemplateMessage(
    context: ProviderSendContext,
    input: TemplateMessageInput,
  ): Promise<ProviderSendResult> {
    const accountSid = context.credentials.accountSid?.trim();
    const authToken = context.credentials.authToken?.trim();
    const contentSid = input.providerTemplateId?.trim();

    if (!accountSid || !authToken) {
      throw new ProviderError('The Twilio account is missing credentials', 400);
    }

    if (!contentSid) {
      throw new ProviderError(
        'The Twilio template is missing its content SID',
        400,
      );
    }

    const form = new URLSearchParams();
    form.set('To', this.address(input.toPhone));
    form.set('From', this.address(context.phoneNumberExternalId));
    form.set('ContentSid', contentSid);

    const variables = orderedVariables(input.variables);
    if (variables.length > 0) {
      form.set(
        'ContentVariables',
        JSON.stringify(
          Object.fromEntries(variables.map(({ key, value }) => [key, value])),
        ),
      );
    }

    const response = await fetch(
      `${this.apiBase}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: this.basicAuth(accountSid, authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    if (!response.ok) {
      throw await this.toProviderError(response);
    }

    const body = (await response.json()) as { sid?: string; status?: string };

    if (!body.sid) {
      throw new ProviderError('Twilio did not return a message SID', 502);
    }

    return {
      externalMessageId: body.sid,
      payload: {
        request: {
          to: form.get('To'),
          from: form.get('From'),
          contentSid,
        },
        response: body,
      },
    };
  }

  async verifyAccount(context: ProviderSendContext): Promise<ProviderAccountInfo> {
    const accountSid = context.credentials.accountSid?.trim();
    const authToken = context.credentials.authToken?.trim();

    if (!accountSid || !authToken) {
      throw new ProviderError('Twilio account credentials are incomplete', 400);
    }

    const response = await fetch(
      `${this.apiBase}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
      { headers: { Authorization: this.basicAuth(accountSid, authToken) } },
    );

    if (!response.ok) {
      throw await this.toProviderError(response);
    }

    const body = (await response.json()) as {
      friendly_name?: string;
      status?: string;
    };

    return {
      displayPhoneNumber: context.phoneNumberDisplay || null,
      qualityRating: null,
      name: body.friendly_name ?? null,
    };
  }

  private get apiBase(): string {
    return (
      this.configService.get<string>('whatsapp.twilioApiBaseUrl') ??
      'https://api.twilio.com'
    ).replace(/\/$/, '');
  }

  private address(phone: string): string {
    return `whatsapp:+${recipientDigits(phone)}`;
  }

  private basicAuth(accountSid: string, authToken: string): string {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  private async toProviderError(response: Response): Promise<ProviderError> {
    let body: TwilioErrorBody = {};

    try {
      body = (await response.json()) as TwilioErrorBody;
    } catch {
      // Twilio can return plain-text errors for malformed requests.
    }

    return new ProviderError(
      body.message ?? `Twilio WhatsApp request failed (${response.status})`,
      response.status,
      body.code ?? null,
    );
  }
}
