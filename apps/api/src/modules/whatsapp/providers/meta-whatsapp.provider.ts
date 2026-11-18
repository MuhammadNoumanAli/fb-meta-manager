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

interface MetaErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

/**
 * Meta WhatsApp Cloud API adapter. Uses the per-account access token and
 * phone number ID stored (encrypted) on the connected account.
 */
@Injectable()
export class MetaWhatsappProvider implements MessagingProvider {
  readonly name = WhatsappProvider.META;

  constructor(private readonly configService: ConfigService) {}

  async sendTemplateMessage(
    context: ProviderSendContext,
    input: TemplateMessageInput,
  ): Promise<ProviderSendResult> {
    const token = context.credentials.accessToken?.trim();
    const phoneNumberId =
      context.phoneNumberExternalId || context.credentials.phoneNumberId?.trim();

    if (!token) {
      throw new ProviderError('The Meta account is missing an access token', 400);
    }

    if (!phoneNumberId) {
      throw new ProviderError('The Meta account is missing a phone number ID', 400);
    }

    const parameters = orderedVariables(input.variables).map(({ value }) => ({
      type: 'text',
      text: value,
    }));

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientDigits(input.toPhone),
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.language },
        ...(parameters.length > 0
          ? { components: [{ type: 'body', parameters }] }
          : {}),
      },
    };

    const response = await fetch(
      `${this.baseUrl}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      throw await this.toProviderError(response);
    }

    const body = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };
    const externalMessageId = body.messages?.[0]?.id;

    if (!externalMessageId) {
      throw new ProviderError('Meta did not return a WhatsApp message id', 502);
    }

    return {
      externalMessageId,
      // The token is never included in stored payloads.
      payload: { request: requestBody, response: body },
    };
  }

  async verifyAccount(context: ProviderSendContext): Promise<ProviderAccountInfo> {
    const token = context.credentials.accessToken?.trim();
    const phoneNumberId =
      context.phoneNumberExternalId || context.credentials.phoneNumberId?.trim();

    if (!token || !phoneNumberId) {
      throw new ProviderError('Meta account credentials are incomplete', 400);
    }

    const url = new URL(
      `${this.baseUrl}/${encodeURIComponent(phoneNumberId)}`,
    );
    url.searchParams.set('fields', 'display_phone_number,verified_name,quality_rating');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw await this.toProviderError(response);
    }

    const body = (await response.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    };

    return {
      displayPhoneNumber: body.display_phone_number ?? null,
      qualityRating: body.quality_rating ?? null,
      name: body.verified_name ?? null,
    };
  }

  private get baseUrl(): string {
    const base =
      this.configService.get<string>('whatsapp.graphBaseUrl') ??
      this.configService.get<string>('meta.graphBaseUrl') ??
      'https://graph.facebook.com';
    const version =
      this.configService.get<string>('whatsapp.apiVersion') ??
      this.configService.get<string>('meta.apiVersion') ??
      'v23.0';

    return `${base.replace(/\/$/, '')}/${version}`;
  }

  private async toProviderError(response: Response): Promise<ProviderError> {
    let body: MetaErrorBody = {};

    try {
      body = (await response.json()) as MetaErrorBody;
    } catch {
      // The Graph API occasionally returns HTML error pages.
    }

    return new ProviderError(
      body.error?.message ??
        `Meta WhatsApp request failed (${response.status})`,
      response.status,
      body.error?.code ?? null,
    );
  }
}
