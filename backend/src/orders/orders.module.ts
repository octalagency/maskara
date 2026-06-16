import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CallsModule } from '../calls/calls.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'calls' }),
    forwardRef(() => CallsModule),
    SubscriptionsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
