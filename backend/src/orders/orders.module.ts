import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CallsModule } from '../calls/calls.module';
import { CallsQueueModule } from '../calls/calls-queue.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    CallsQueueModule,
    forwardRef(() => CallsModule),
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
