import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CallStatus } from '@prisma/client';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Get()
  @ApiOperation({ summary: 'List call history' })
  findAll(
    @CurrentUser('merchantId') merchantId: string,
    @Query('status') status?: CallStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('orderId') orderId?: string,
  ) {
    return this.callsService.findAll(merchantId, { status, page, limit, orderId });
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get call analytics' })
  getAnalytics(
    @CurrentUser('merchantId') merchantId: string,
    @Query('days') days?: number,
  ) {
    return this.callsService.getAnalytics(merchantId, days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get call details' })
  findOne(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.callsService.findOne(merchantId, id);
  }
}
