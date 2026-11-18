import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappTemplateCategory } from '../../common/enums/whatsapp-template-category.enum';
import { WhatsappTemplateStatus } from '../../common/enums/whatsapp-template-status.enum';
import type { RequestContext } from '../../common/utilities/request-context';
import { WhatsappAccount } from '../../database/entities/whatsapp-account.entity';
import { WhatsappTemplate } from '../../database/entities/whatsapp-template.entity';
import { AuditService } from '../audit/audit.service';
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { ListWhatsappTemplatesQueryDto } from './dto/list-whatsapp-templates-query.dto';
import { UpdateWhatsappTemplateDto } from './dto/update-whatsapp-template.dto';
import {
  WhatsappTemplateListResult,
  WhatsappTemplateView,
  toTemplateView,
} from './whatsapp.mappers';

const DEFAULT_TEMPLATES: Array<{
  name: string;
  language: string;
  category: WhatsappTemplateCategory;
  body: string;
  variableMapping: Record<string, string>;
}> = [
  {
    name: 'lead_acknowledgment',
    language: 'en',
    category: WhatsappTemplateCategory.UTILITY,
    body: 'Hi {{1}}, thanks for contacting {{2}}. Our team will get back to you shortly.',
    variableMapping: { '1': 'lead.fullName', '2': 'business.name' },
  },
  {
    name: 'lead_acknowledgment',
    language: 'ms',
    category: WhatsappTemplateCategory.UTILITY,
    body: 'Hai {{1}}, terima kasih kerana menghubungi {{2}}. Pasukan kami akan menghubungi anda tidak lama lagi.',
    variableMapping: { '1': 'lead.fullName', '2': 'business.name' },
  },
];

const isDuplicateError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'ER_DUP_ENTRY';

@Injectable()
export class WhatsappTemplatesService {
  constructor(
    @InjectRepository(WhatsappTemplate)
    private readonly templates: Repository<WhatsappTemplate>,
    @InjectRepository(WhatsappAccount)
    private readonly accounts: Repository<WhatsappAccount>,
    private readonly audit: AuditService,
  ) {}

  async list(
    businessId: string,
    query: ListWhatsappTemplatesQueryDto,
  ): Promise<WhatsappTemplateListResult> {
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 100);
    const where: Record<string, unknown> = { businessId };

    if (query.accountId) {
      where.accountId = query.accountId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.templates.findAndCount({
      where,
      order: { isAcknowledgment: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map(toTemplateView),
      total,
      page,
      pageSize,
    };
  }

  async create(
    userId: string,
    businessId: string,
    dto: CreateWhatsappTemplateDto,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    await this.assertAccount(businessId, dto.accountId ?? null);

    let template: WhatsappTemplate;

    try {
      const result = await this.templates.insert({
        businessId,
        accountId: dto.accountId ?? null,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        status: WhatsappTemplateStatus.DRAFT,
        providerTemplateId: dto.providerTemplateId ?? null,
        body: dto.body,
        variableMapping: (dto.variableMapping ?? null) as never,
        isEnabled: true,
        isAcknowledgment: dto.isAcknowledgment === true,
        createdByUserId: userId,
      });
      template = await this.templates.findOneByOrFail({
        id: result.identifiers[0]?.id as string,
      });
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new ConflictException(
          'A template with this name and language already exists',
        );
      }

      throw error;
    }

    if (template.isAcknowledgment) {
      await this.clearOtherAcknowledgments(businessId, template);
    }

    await this.audit.record({
      action: 'whatsapp.template_created',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      metadata: {
        name: template.name,
        language: template.language,
        isAcknowledgment: template.isAcknowledgment,
      },
      context,
    });

    return toTemplateView(template);
  }

  async update(
    userId: string,
    businessId: string,
    templateId: string,
    dto: UpdateWhatsappTemplateDto,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    const template = await this.findTemplate(businessId, templateId);

    if (dto.accountId !== undefined) {
      await this.assertAccount(businessId, dto.accountId);
    }

    const changes: Partial<WhatsappTemplate> = {};

    if (dto.body !== undefined) {
      changes.body = dto.body;
    }

    if (dto.category !== undefined) {
      changes.category = dto.category;
    }

    if (dto.variableMapping !== undefined) {
      changes.variableMapping = dto.variableMapping as never;
    }

    if (dto.accountId !== undefined) {
      changes.accountId = dto.accountId;
    }

    if (dto.providerTemplateId !== undefined) {
      changes.providerTemplateId = dto.providerTemplateId;
    }

    if (dto.isEnabled !== undefined) {
      changes.isEnabled = dto.isEnabled;
    }

    if (dto.isAcknowledgment !== undefined) {
      changes.isAcknowledgment = dto.isAcknowledgment;
    }

    if (Object.keys(changes).length > 0) {
      await this.templates.update(template.id, changes);
    }

    Object.assign(template, changes);

    if (dto.isAcknowledgment === true) {
      await this.clearOtherAcknowledgments(businessId, template);
    }

    await this.audit.record({
      action: 'whatsapp.template_updated',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      metadata: { fields: Object.keys(changes) },
      context,
    });

    return toTemplateView(template);
  }

  async submit(
    userId: string,
    businessId: string,
    templateId: string,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    const template = await this.findTemplate(businessId, templateId);

    if (
      template.status === WhatsappTemplateStatus.APPROVED ||
      template.status === WhatsappTemplateStatus.PENDING
    ) {
      throw new BadRequestException('The template is already submitted');
    }

    await this.templates.update(template.id, {
      status: WhatsappTemplateStatus.PENDING,
      rejectionReason: null,
    });

    await this.audit.record({
      action: 'whatsapp.template_submitted',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      context,
    });

    return this.get(businessId, template.id);
  }

  async approve(
    userId: string,
    businessId: string,
    templateId: string,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    const template = await this.findTemplate(businessId, templateId);

    if (template.status !== WhatsappTemplateStatus.PENDING) {
      throw new BadRequestException('Only pending templates can be approved');
    }

    await this.templates.update(template.id, {
      status: WhatsappTemplateStatus.APPROVED,
      approvedAt: new Date(),
      rejectionReason: null,
      isEnabled: true,
    });

    await this.audit.record({
      action: 'whatsapp.template_approved',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      context,
    });

    return this.get(businessId, template.id);
  }

  async reject(
    userId: string,
    businessId: string,
    templateId: string,
    reason: string,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    const template = await this.findTemplate(businessId, templateId);

    if (template.status !== WhatsappTemplateStatus.PENDING) {
      throw new BadRequestException('Only pending templates can be rejected');
    }

    await this.templates.update(template.id, {
      status: WhatsappTemplateStatus.REJECTED,
      rejectionReason: reason.slice(0, 500),
      isAcknowledgment: false,
    });

    await this.audit.record({
      action: 'whatsapp.template_rejected',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      metadata: { reason },
      context,
    });

    return this.get(businessId, template.id);
  }

  async disable(
    userId: string,
    businessId: string,
    templateId: string,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView> {
    const template = await this.findTemplate(businessId, templateId);

    await this.templates.update(template.id, {
      status: WhatsappTemplateStatus.DISABLED,
      isEnabled: false,
      isAcknowledgment: false,
    });

    await this.audit.record({
      action: 'whatsapp.template_disabled',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      entityId: template.id,
      context,
    });

    return this.get(businessId, template.id);
  }

  /**
   * Creates the bilingual lead acknowledgment templates for a business.
   * Existing templates are left untouched, so the call is idempotent.
   */
  async seedDefaults(
    userId: string,
    businessId: string,
    context?: RequestContext,
  ): Promise<WhatsappTemplateView[]> {
    const created: WhatsappTemplateView[] = [];

    for (const definition of DEFAULT_TEMPLATES) {
      const existing = await this.templates.findOne({
        where: {
          businessId,
          name: definition.name,
          language: definition.language,
        },
      });

      try {
        if (existing) {
          if (
            existing.status !== WhatsappTemplateStatus.APPROVED &&
            existing.status !== WhatsappTemplateStatus.DISABLED
          ) {
            await this.templates.update(existing.id, {
              status: WhatsappTemplateStatus.APPROVED,
              approvedAt: new Date(),
              isEnabled: true,
              isAcknowledgment: true,
            });
            created.push(
              toTemplateView(
                await this.templates.findOneByOrFail({ id: existing.id }),
              ),
            );
          }

          continue;
        }

        const result = await this.templates.insert({
          businessId,
          name: definition.name,
          language: definition.language,
          category: definition.category,
          status: WhatsappTemplateStatus.APPROVED,
          body: definition.body,
          variableMapping: definition.variableMapping as never,
          isEnabled: true,
          isAcknowledgment: true,
          approvedAt: new Date(),
          createdByUserId: userId,
        });
        created.push(
          toTemplateView(
            await this.templates.findOneByOrFail({
              id: result.identifiers[0]?.id as string,
            }),
          ),
        );
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }

    await this.audit.record({
      action: 'whatsapp.default_templates_seeded',
      actorUserId: userId,
      businessId,
      entityType: 'whatsapp_template',
      metadata: { created: created.length },
      context,
    });

    return created;
  }

  /** Resolves the acknowledgment template for a language with a safe fallback. */
  async findAcknowledgmentTemplate(
    businessId: string,
    language: string | null,
  ): Promise<WhatsappTemplate | null> {
    const base = {
      businessId,
      isAcknowledgment: true,
      isEnabled: true,
      status: WhatsappTemplateStatus.APPROVED,
    };
    const preferred = language?.trim().toLowerCase() ?? '';
    const short = preferred.split(/[-_]/)[0];

    for (const candidate of [preferred, short, 'en']) {
      if (!candidate) {
        continue;
      }

      const match = await this.templates.findOne({
        where: { ...base, language: candidate },
      });

      if (match) {
        return match;
      }
    }

    return this.templates.findOne({ where: base });
  }

  async findTemplate(businessId: string, templateId: string): Promise<WhatsappTemplate> {
    const template = await this.templates.findOne({
      where: { id: templateId, businessId },
    });

    if (!template) {
      throw new NotFoundException('WhatsApp template not found');
    }

    return template;
  }

  private async get(
    businessId: string,
    templateId: string,
  ): Promise<WhatsappTemplateView> {
    return toTemplateView(await this.findTemplate(businessId, templateId));
  }

  private async assertAccount(
    businessId: string,
    accountId: string | null,
  ): Promise<void> {
    if (!accountId) {
      return;
    }

    const account = await this.accounts.findOne({
      where: { id: accountId, businessId },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found');
    }
  }

  private async clearOtherAcknowledgments(
    businessId: string,
    template: WhatsappTemplate,
  ): Promise<void> {
    await this.templates
      .createQueryBuilder()
      .update(WhatsappTemplate)
      .set({ isAcknowledgment: false })
      .where(
        'business_id = :businessId AND language = :language AND id != :templateId',
        {
          businessId,
          language: template.language,
          templateId: template.id,
        },
      )
      .execute();
  }
}
