import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { WooCommerceConnectDto } from './dto/woocommerce-connect.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WooCommerce Integration')
@Controller('integrations/woocommerce')
export class WooCommerceController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post('connect')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Connect WooCommerce store (called from WordPress plugin)' })
  connect(
    @CurrentUser() merchant: { id: string },
    @Body() dto: WooCommerceConnectDto,
  ) {
    return this.integrationsService.connectWooCommerce(merchant.id, dto);
  }

  @Get('ping')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Test API key from WooCommerce plugin' })
  ping(@CurrentUser() merchant: { id: string; name?: string }) {
    return {
      ok: true,
      merchantId: merchant.id,
      message: 'Maskara API connection successful',
    };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'WooCommerce connection status for merchant dashboard' })
  status(@CurrentUser('merchantId') merchantId: string) {
    return this.integrationsService.getWooCommerceStatus(merchantId);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect WooCommerce integration' })
  disconnect(@CurrentUser('merchantId') merchantId: string) {
    return this.integrationsService.disconnectWooCommerce(merchantId);
  }
}
