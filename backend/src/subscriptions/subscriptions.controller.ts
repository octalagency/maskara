import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  getPlans() {
    return this.subscriptionsService.getPublicPlans();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current merchant subscription & billing' })
  getMySubscription(@CurrentUser('merchantId') merchantId: string) {
    return this.subscriptionsService.getMerchantSubscription(merchantId);
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe or upgrade plan' })
  subscribe(
    @CurrentUser('merchantId') merchantId: string,
    @Body('planCode') planCode: string,
    @Body('paymentMethod') paymentMethod?: string,
  ) {
    return this.subscriptionsService.subscribe(merchantId, planCode, paymentMethod);
  }
}
