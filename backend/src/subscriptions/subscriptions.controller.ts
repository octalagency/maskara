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
  @ApiOperation({ summary: 'Request plan (pending until payment confirmed)' })
  subscribe(
    @CurrentUser('merchantId') merchantId: string,
    @Body('planCode') planCode: string,
    @Body('paymentMethod') paymentMethod?: string,
  ) {
    return this.subscriptionsService.subscribe(
      merchantId,
      planCode,
      paymentMethod || 'bkash_manual',
    );
  }

  @Post('bkash-manual')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit non-API bKash payment proof (TrxID + phone + amount)',
  })
  submitBkashManual(
    @CurrentUser('merchantId') merchantId: string,
    @Body()
    body: {
      planCode: string;
      trxId: string;
      senderPhone: string;
      amount: number;
    },
  ) {
    return this.subscriptionsService.submitBkashManual(merchantId, body);
  }
}
