import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WooCommerceWebhookGuard } from '../common/guards/woocommerce-webhook.guard';

@Module({
  imports: [OrdersModule, SubscriptionsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WooCommerceWebhookGuard],
})
export class WebhooksModule {}
