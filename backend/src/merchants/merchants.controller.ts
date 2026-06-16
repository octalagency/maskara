import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Merchants')
@Controller('merchants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current merchant profile' })
  getProfile(@CurrentUser('merchantId') merchantId: string) {
    return this.merchantsService.findOne(merchantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update merchant profile' })
  update(
    @CurrentUser('merchantId') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(merchantId, dto);
  }

  @Patch('me/webhook')
  @ApiOperation({ summary: 'Update webhook configuration' })
  updateWebhook(
    @CurrentUser('merchantId') merchantId: string,
    @Body('webhookUrl') webhookUrl: string,
    @Body('webhookSecret') webhookSecret: string,
  ) {
    return this.merchantsService.updateWebhookConfig(
      merchantId,
      webhookUrl,
      webhookSecret,
    );
  }
}
