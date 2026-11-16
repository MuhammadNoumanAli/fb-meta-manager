import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateWebsiteLeadDto } from './dto/create-website-lead.dto';
import { LeadIntakeService } from './lead-intake.service';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads/intake')
export class WebsiteLeadController {
  constructor(
    private readonly leads: LeadsService,
    private readonly intake: LeadIntakeService,
  ) {}

  /**
   * Public ingestion endpoint for client websites. The API key identifies the
   * business and source; unknown or revoked keys are rejected before any lead
   * record is written.
   */
  @Public()
  @Post()
  @HttpCode(201)
  @ApiHeader({ name: 'x-adpilot-lead-key', required: true })
  async create(
    @Headers('x-adpilot-lead-key') apiKey: string | undefined,
    @Body() dto: CreateWebsiteLeadDto,
  ) {
    const source = await this.leads.resolveWebsiteSource(apiKey ?? '');

    if (!source) {
      throw new UnauthorizedException('Invalid website lead key');
    }

    const result = await this.intake.intakeWebsiteLead(source, dto);

    return {
      id: result.lead.id,
      accepted: true,
      duplicate: result.duplicate,
    };
  }
}
