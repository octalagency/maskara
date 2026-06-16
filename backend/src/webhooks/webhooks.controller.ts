import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { WooCommerceWebhookGuard } from '../common/guards/woocommerce-webhook.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('shopify')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Shopify order webhook' })
  handleShopify(
    @CurrentUser() merchant: { id: string },
    @Body() payload: Record<string, unknown>,
    @Headers('x-shopify-topic') topic: string,
  ) {
    if (topic && !topic.includes('orders/create') && !topic.includes('orders/updated')) {
      return { received: true, skipped: true };
    }
    return this.webhooksService.handleShopifyWebhook(merchant.id, payload);
  }

  @Post('woocommerce')
  @UseGuards(ApiKeyGuard, WooCommerceWebhookGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'WooCommerce order webhook' })
  handleWooCommerce(
    @CurrentUser() merchant: { id: string },
    @Body() payload: Record<string, unknown>,
  ) {
    return this.webhooksService.handleWooCommerceWebhook(merchant.id, payload);
  }

  @Post('custom')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Custom website order webhook' })
  handleCustom(
    @CurrentUser() merchant: { id: string },
    @Body() payload: CreateOrderDto,
  ) {
    return this.webhooksService.handleCustomWebhook(merchant.id, payload);
  }

  @Post('incoming/:merchantSlug')
  @ApiOperation({ summary: 'Public webhook endpoint by merchant slug' })
  async handleBySlug(
    @Param('merchantSlug') merchantSlug: string,
    @Body() payload: CreateOrderDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    return this.webhooksService.handleBySlug(merchantSlug, secret, payload);
  }
}
