import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create new API key' })
  create(
    @CurrentUser('merchantId') merchantId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  findAll(@CurrentUser('merchantId') merchantId: string) {
    return this.apiKeysService.findAll(merchantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke API key' })
  revoke(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.apiKeysService.revoke(merchantId, id);
  }
}
