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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrderStatus } from '@prisma/client';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Create order via API key (webhook integration)' })
  createViaApiKey(
    @CurrentUser() merchant: { id: string },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(merchant.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders for merchant dashboard' })
  findAll(
    @CurrentUser('merchantId') merchantId: string,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(merchantId, {
      status,
      page,
      limit,
      search,
      from,
      to,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order statistics (optional from/to YYYY-MM-DD)' })
  getStats(
    @CurrentUser('merchantId') merchantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.getStats(merchantId, { from, to });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details' })
  findOne(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.findOne(merchantId, id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status manually' })
  updateStatus(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(merchantId, id, dto);
  }

  @Post(':id/retry-call')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry verification call' })
  retryCall(
    @CurrentUser('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.retryCall(merchantId, id);
  }
}
