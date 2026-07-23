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
  @ApiOperation({ summary: 'Daily report for last N days or custom from/to (YYYY-MM-DD)' })
  getDaily(
    @CurrentUser('merchantId') merchantId: string,
    @Query('days') days?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getDailyReport(
      merchantId,
      days ? Number(days) : 30,
      from,
      to,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Report summary' })
  getSummary(@CurrentUser('merchantId') merchantId: string) {
    return this.reportsService.getSummary(merchantId);
  }
}
