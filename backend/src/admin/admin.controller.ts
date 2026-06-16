import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('merchants')
  getMerchants(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getMerchants(page, limit, search);
  }

  @Post('merchants')
  createMerchant(
    @Body() body: { name: string; email: string; phone: string; password: string; planCode?: string },
  ) {
    return this.adminService.createMerchant(body);
  }

  @Get('platform-status')
  getPlatformStatus() {
    return this.adminService.getPlatformStatus();
  }

  @Get('merchants/:id')
  getMerchantDetail(@Param('id') id: string) {
    return this.adminService.getMerchantDetail(id);
  }

  @Patch('merchants/:id/status')
  updateMerchantStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateMerchantStatus(id, status);
  }

  @Patch('merchants/:id/plan')
  assignPlan(
    @Param('id') id: string,
    @Body('planCode') planCode: string,
    @Body('markPaid') markPaid?: boolean,
  ) {
    return this.adminService.assignMerchantPlan(id, planCode, markPaid ?? true);
  }

  @Get('plans')
  getPlans() {
    return this.adminService.getPlans();
  }

  @Post('plans')
  createPlan(@Body() body: Record<string, unknown>) {
    return this.adminService.createPlan(body as never);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updatePlan(id, body as never);
  }

  @Get('billing')
  getBilling(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getBillingRecords(page, limit, status);
  }

  @Patch('billing/:id/confirm')
  confirmBilling(
    @Param('id') id: string,
    @Body('paymentRef') paymentRef?: string,
  ) {
    return this.adminService.confirmBilling(id, paymentRef);
  }

  @Get('config')
  getConfig() {
    return this.adminService.getPlatformConfig();
  }

  @Patch('config')
  updateConfig(@Body() body: Record<string, unknown>) {
    return this.adminService.updatePlatformConfig(body);
  }

  @Get('analytics/calls')
  getCallAnalytics(@Query('days') days?: number) {
    return this.adminService.getCallAnalytics(days);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSystemSettings();
  }

  @Patch('settings/:key')
  updateSetting(@Param('key') key: string, @Body('value') value: unknown) {
    return this.adminService.updateSystemSetting(key, value);
  }
}
