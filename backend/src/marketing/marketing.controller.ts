import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarketingService } from './marketing.service';

@ApiTags('Marketing')
@Controller('marketing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  @Get()
  @ApiOperation({ summary: 'Facebook & Marketing settings (ShopIn-style)' })
  get(@CurrentUser('merchantId') merchantId: string) {
    return this.marketing.getSettings(merchantId);
  }

  @Put()
  @ApiOperation({ summary: 'Save store URL + Facebook Pixel / CAPI settings' })
  update(
    @CurrentUser('merchantId') merchantId: string,
    @Body()
    body: {
      storePublicUrl?: string;
      pixels?: Array<{
        id?: string;
        label?: string;
        pixelId?: string;
        testEventCode?: string;
        accessToken?: string;
      }>;
    },
  ) {
    return this.marketing.updateSettings(merchantId, body);
  }
}
