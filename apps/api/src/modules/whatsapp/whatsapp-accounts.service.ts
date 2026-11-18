import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAccountStatus } from '../../common/enums/whatsapp-account-status.enum';
import { WhatsappPhoneNumberStatus } from '../../common/enums/whatsapp-phone-number-status.enum';
import { WhatsappProvider } from '../../common/enums/whatsapp-provider.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappPhoneNumber } from '../../database/entities/whatsapp-phone-number.entity';
import { AuditService } from '../audit/audit.service';
import { IntegrationCryptoService } from '../integrations/integration-crypto.service';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { UpdateWhatsappAccountDto } from './dto/update-whatsapp-account.dto';
import { MessagingProviderRegistry } from './providers/messaging-provider.registry';
import { ProviderCredentials } from './providers/messaging-provider';
import { WhatsappAccountView, toAccountView } from './whatsapp.mappers';

const PROVIDER = 'whatsapp';

const isDuplicateError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'ER_DUP_ENTRY';

@Injectable()
export class WhatsappAccountsService {
  constructor(
    @InjectRepository(WhatsappAccount)
    private readonly accounts: Repository<WhatsappAccount>,
    @InjectRepository(WhatsappPhoneNumber)
    private readonly phoneNumbers: Repository<WhatsappPhoneNumber>,
    private readonly crypto: IntegrationCryptoService,
    private readonly registry: MessagingProviderRegistry,
    private readonly audit: AuditService,
  ) {}

  async list(businessId: string): Promise<WhatsappAccountView[]> {
    const accounts = await this.accounts.find({
      where: { businessId },
      order: { createdAt: 'ASC' },
    });

    if (accounts.length === 0) {
      return [];
    }

    const phones = await this.phoneNumbers.find({
      where: accounts.map((account) => ({ accountId: account.id })),
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });

    return accounts.map((account) =>
      toAccountView(
        account,
        phones.filter((phone) => phone.accountId === account.id),
      ),
    );
  }

  async get(businessId: string, accountId: string): Promise<WhatsappAccountView> {
    const account = await this.findAccount(businessId, accountId);
    const phones = await this.phoneNumbers.find({
      where: { accountId: account.id },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });

    return toAccountView(account, phones);
  }

  async create(
    userId: string,
    businessId: string,
    dto: CreateWhatsappAccountDto,
    context?: RequestContext,
  ): Promise<WhatsappAccountView> {
    const defaults = dto.phoneNumbers.filter((phone) => phone.isDefault);

    if (defaults.length > 1) {
      throw new BadRequestException('Only one phone number can be the default');
    }

    const credentials = this.buildCredentials(dto);

    let account: WhatsappAccount;

    try {
      const result = await this.accounts.insert({
        businessId,
        provider: dto.provider,
        name: dto.name.trim(),
        externalAccountId: dto.externalAccountId.trim(),
        credentialsEncrypted: this.crypto.encrypt(JSON.stringify(credentials)),
        status: WhatsappAccountStatus.ACTIVE,
        createdByUserId: userId,
      });
      account = await this.accounts.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new ConflictException('This WhatsApp account is already connected');
      }

      throw error;
    }

    const hasDefault = dto.phoneNumbers.some((phone) => phone.isDefault);

    for (const [index, phone] of dto.phoneNumbers.entries()) {
      await this.phoneNumbers.insert({
        businessId,
        accountId: account.id,
        externalPhoneNumberId: phone.externalPhoneNumberId.trim(),
        displayPhoneNumber: phone.displayPhoneNumber.trim(),
        status: WhatsappPhoneNumberStatus.ACTIVE,
        isDefault: hasDefault ? phone.isDefault === true : index === 0,
      });
    }

    await this.audit.record({
      action: 'whatsapp.account_connected',
      actorUserId: userId,
      businessId,
      entityType: PROVIDER,
      entityId: account.id,
      metadata: {
        provider: account.provider,
        externalAccountId: account.externalAccountId,
      },
      context,
    });

    return this.get(businessId, account.id);
  }

  async update(
    userId: string,
    businessId: string,
    accountId: string,
    dto: UpdateWhatsappAccountDto,
    context?: RequestContext,
  ): Promise<WhatsappAccountView> {
    const account = await this.findAccount(businessId, accountId);
    const changes: Partial<WhatsappAccount> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name.trim();
    }

    if (dto.status !== undefined) {
      changes.status = dto.status;
    }

    if (dto.accessToken !== undefined) {
      const credentials = this.decryptCredentials(account);

      if (account.provider === WhatsappProvider.META) {
        credentials.accessToken = dto.accessToken;
      } else {
        credentials.authToken = dto.accessToken;
      }

      changes.credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify(credentials),
      );
      changes.lastError = null;
    }

    if (Object.keys(changes).length > 0) {
      await this.accounts.update(account.id, changes);

      if (dto.status === WhatsappAccountStatus.DISABLED) {
        await this.phoneNumbers.update(
          { accountId: account.id },
          { status: WhatsappPhoneNumberStatus.DISABLED },
        );
      }
    }

    await this.audit.record({
      action: 'whatsapp.account_updated',
      actorUserId: userId,
      businessId,
      entityType: PROVIDER,
      entityId: account.id,
      metadata: {
        fields: Object.keys(changes),
        credentialsRotated: dto.accessToken !== undefined,
      },
      context,
    });

    return this.get(businessId, account.id);
  }

  /** Disabling keeps message history and blocks new outbound messages. */
  async disable(
    userId: string,
    businessId: string,
    accountId: string,
    context?: RequestContext,
  ): Promise<WhatsappAccountView> {
    const account = await this.findAccount(businessId, accountId);

    await this.accounts.update(account.id, {
      status: WhatsappAccountStatus.DISABLED,
    });
    await this.phoneNumbers.update(
      { accountId: account.id },
      { status: WhatsappPhoneNumberStatus.DISABLED },
    );

    await this.audit.record({
      action: 'whatsapp.account_disabled',
      actorUserId: userId,
      businessId,
      entityType: PROVIDER,
      entityId: account.id,
      context,
    });

    return this.get(businessId, account.id);
  }

  /** Checks credentials with the provider and records the connection health. */
  async validate(
    userId: string,
    businessId: string,
    accountId: string,
    context?: RequestContext,
  ): Promise<WhatsappAccountView> {
    const account = await this.findAccount(businessId, accountId);
    const phones = await this.phoneNumbers.find({
      where: { accountId: account.id },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    const primary = phones[0];

    if (!primary) {
      throw new BadRequestException('Connect a phone number before validating');
    }

    const credentials = this.decryptCredentials(account);
    const provider = this.registry.get(account.provider);
    let status = WhatsappAccountStatus.ACTIVE;
    let lastError: string | null = null;

    try {
      if (provider.verifyAccount) {
        const info = await provider.verifyAccount({
          credentials,
          phoneNumberExternalId: primary.externalPhoneNumberId,
          phoneNumberDisplay: primary.displayPhoneNumber,
        });

        if (info.displayPhoneNumber) {
          await this.phoneNumbers.update(primary.id, {
            displayPhoneNumber: info.displayPhoneNumber,
          });
        }

        if (info.qualityRating) {
          await this.phoneNumbers.update(primary.id, {
            qualityRating: info.qualityRating,
          });
        }
      }
    } catch (error) {
      status = WhatsappAccountStatus.ATTENTION;
      lastError = (
        error instanceof Error ? error.message : 'Account validation failed'
      ).slice(0, 500);
    }

    await this.accounts.update(account.id, {
      status,
      lastError,
      lastValidatedAt: new Date(),
    });

    await this.audit.record({
      action: 'whatsapp.account_validated',
      actorUserId: userId,
      businessId,
      entityType: PROVIDER,
      entityId: account.id,
      metadata: { status, lastError },
      context,
    });

    return this.get(businessId, account.id);
  }

  /** Loads and decrypts credentials for outbound delivery. */
  async loadCredentials(account: WhatsappAccount): Promise<ProviderCredentials> {
    return this.decryptCredentials(account);
  }

  /**
   * Selects the account and sender number for an outbound message. An explicit
   * account (for example the template's account) is preferred.
   */
  async resolveSender(
    businessId: string,
    preferredAccountId: string | null,
  ): Promise<{ account: WhatsappAccount; phone: WhatsappPhoneNumber }> {
    const account = preferredAccountId
      ? await this.findAccount(businessId, preferredAccountId)
      : await this.accounts.findOne({
          where: { businessId, status: WhatsappAccountStatus.ACTIVE },
          order: { createdAt: 'ASC' },
        });

    if (!account) {
      throw new BadRequestException(
        'Connect an active WhatsApp account before sending messages',
      );
    }

    if (account.status !== WhatsappAccountStatus.ACTIVE) {
      throw new BadRequestException('The WhatsApp account is not active');
    }

    const phone = await this.phoneNumbers.findOne({
      where: {
        accountId: account.id,
        status: WhatsappPhoneNumberStatus.ACTIVE,
      },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });

    if (!phone) {
      throw new BadRequestException(
        'The WhatsApp account has no active phone number',
      );
    }

    return { account, phone };
  }

  async findAccount(
    businessId: string,
    accountId: string,
  ): Promise<WhatsappAccount> {
    const account = await this.accounts.findOne({
      where: { id: accountId, businessId },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found');
    }

    return account;
  }

  private buildCredentials(dto: CreateWhatsappAccountDto): ProviderCredentials {
    if (dto.provider === WhatsappProvider.TWILIO) {
      return {
        authToken: dto.accessToken,
        accountSid: dto.externalAccountId.trim(),
      };
    }

    return {
      accessToken: dto.accessToken,
      phoneNumberId: dto.phoneNumbers[0]?.externalPhoneNumberId.trim(),
      businessAccountId: dto.businessAccountId ?? dto.externalAccountId.trim(),
    };
  }

  private decryptCredentials(account: WhatsappAccount): ProviderCredentials {
    try {
      return JSON.parse(
        this.crypto.decrypt(account.credentialsEncrypted),
      ) as ProviderCredentials;
    } catch {
      throw new BadRequestException(
        'Stored WhatsApp credentials could not be read. Reconnect the account.',
      );
    }
  }
}
