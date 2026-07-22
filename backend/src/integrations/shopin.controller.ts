import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { ShopInConnectDto } from './dto/shopin-connect.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ShopIn Integration')
@Controller('integrations/shopin')
export class ShopInController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post('connect')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Connect ShopIn store — binds callback URL for verification results',
  })
  connect(
    @CurrentUser() merchant: { id: string },
    @Body() dto: ShopInConnectDto,
  ) {
    return this.integrationsService.connectShopIn(merchant.id, dto);
  }

  @Post('bind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Dashboard: paste ShopIn webhook URL (…/webhooks/maskara/{shopId}) to bind callback',
  })
  bind(
    @CurrentUser('merchantId') merchantId: string,
    @Body() dto: ShopInConnectDto,
  ) {
    return this.integrationsService.connectShopIn(merchantId, dto);
  }

  @Get('ping')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Test API key from ShopIn Maskara settings (API টেস্ট)' })
  ping(@CurrentUser() merchant: { id: string; name?: string }) {
    return {
      ok: true,
      merchantId: merchant.id,
      merchantName: merchant.name,
      message: 'Maskara API connection successful (ShopIn)',
      integration: 'SHOPIN',
    };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ShopIn connection status for merchant dashboard' })
  status(@CurrentUser('merchantId') merchantId: string) {
    return this.integrationsService.getShopInStatus(merchantId);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect ShopIn integration' })
  disconnect(@CurrentUser('merchantId') merchantId: string) {
    return this.integrationsService.disconnectShopIn(merchantId);
  }
}
