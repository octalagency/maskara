import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start bKash or Nagad payment for subscription' })
  initiate(
    @CurrentUser('merchantId') merchantId: string,
    @Body('planCode') planCode: string,
    @Body('provider') provider: 'bkash' | 'nagad',
  ) {
    return this.paymentsService.initiatePayment(merchantId, planCode, provider);
  }

  @Get('bkash/callback')
  @ApiOperation({ summary: 'bKash payment callback' })
  bkashCallback(@Query() query: Record<string, string>) {
    return this.paymentsService.handleBkashCallback(query);
  }

  @Post('nagad/callback')
  @ApiOperation({ summary: 'Nagad payment callback' })
  nagadCallback(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleNagadCallback(body);
  }
}
