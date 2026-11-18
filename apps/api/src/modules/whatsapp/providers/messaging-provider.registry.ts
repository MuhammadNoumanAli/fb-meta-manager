import { BadRequestException, Injectable } from '@nestjs/common';
import { WhatsappProvider } from '../../../common/enums/whatsapp-provider.enum';
import { MetaWhatsappProvider } from './meta-whatsapp.provider';
import { MessagingProvider } from './messaging-provider';
import { TwilioWhatsappProvider } from './twilio-whatsapp.provider';

/** Resolves the adapter for a connected account's provider. */
@Injectable()
export class MessagingProviderRegistry {
  private readonly providers: Map<WhatsappProvider, MessagingProvider>;

  constructor(
    meta: MetaWhatsappProvider,
    twilio: TwilioWhatsappProvider,
  ) {
    this.providers = new Map<WhatsappProvider, MessagingProvider>([
      [WhatsappProvider.META, meta],
      [WhatsappProvider.TWILIO, twilio],
    ]);
  }

  get(provider: WhatsappProvider): MessagingProvider {
    const adapter = this.providers.get(provider);

    if (!adapter) {
      throw new BadRequestException(`Unsupported WhatsApp provider: ${provider}`);
    }

    return adapter;
  }
}
