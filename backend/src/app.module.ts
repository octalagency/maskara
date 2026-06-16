import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MerchantsModule } from './merchants/merchants.module';
import { OrdersModule } from './orders/orders.module';
import { CallsModule } from './calls/calls.module';
import { VoiceModule } from './voice/voice.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CommonServicesModule } from './common/common-services.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    PrismaModule,
    AuthModule,
    MerchantsModule,
    OrdersModule,
    CallsModule,
    VoiceModule,
    WebhooksModule,
    IntegrationsModule,
    NotificationsModule,
    PlansModule,
    SubscriptionsModule,
    CommonServicesModule,
    PaymentsModule,
    AdminModule,
    ReportsModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
