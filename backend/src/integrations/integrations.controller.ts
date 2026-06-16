import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create integration' })
  create(
    @CurrentUser('merchantId') merchantId: string,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.create(merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List integrations' })
  findAll(@CurrentUser('merchantId') merchantId: string) {
    return this.integrationsService.findAll(merchantId);
  }

  @Get('guide/:type')
  @ApiOperation({ summary: 'Get integration setup guide' })
  getGuide(@Param('type') type: string) {
    return this.integrationsService.getSetupGuide(type);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle integration active status' })
  toggle(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.integrationsService.toggle(merchantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete integration' })
  remove(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.integrationsService.remove(merchantId, id);
  }
}
