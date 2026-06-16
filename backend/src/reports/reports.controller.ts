import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Daily report for last N days' })
  getDaily(
    @CurrentUser('merchantId') merchantId: string,
    @Query('days') days?: number,
  ) {
    return this.reportsService.getDailyReport(merchantId, days);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Report summary' })
  getSummary(@CurrentUser('merchantId') merchantId: string) {
    return this.reportsService.getSummary(merchantId);
  }
}
