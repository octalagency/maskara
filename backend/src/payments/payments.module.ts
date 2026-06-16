import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { BkashProvider } from './providers/bkash.provider';
import { NagadProvider } from './providers/nagad.provider';
import { PaymentSettingsService } from './payment-settings.service';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [PlansModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentSettingsService, PaymentsService, BkashProvider, NagadProvider],
  exports: [PaymentsService, PaymentSettingsService],
})
export class PaymentsModule {}
