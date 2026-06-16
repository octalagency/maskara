-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MERCHANT_OWNER', 'MERCHANT_STAFF');
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CALLING', 'VERIFIED', 'CANCELLED', 'FAILED', 'ESCALATED');
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED');
CREATE TYPE "CallOutcome" AS ENUM ('CONFIRMED', 'CANCELLED', 'ESCALATED', 'NO_RESPONSE', 'INVALID_INPUT');
CREATE TYPE "IntegrationType" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'CUSTOM_API', 'FACEBOOK');
CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'WEBHOOK', 'IN_APP');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MERCHANT_OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "merchantId" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "logo" TEXT,
    "status" "MerchantStatus" NOT NULL DEFAULT 'TRIAL',
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "subscriptionEnds" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "voiceLanguage" TEXT NOT NULL DEFAULT 'bn-BD',
    "storeNameBangla" TEXT,
    "customGreeting" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "maxCallRetries" INTEGER NOT NULL DEFAULT 3,
    "retryIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['orders:write', 'orders:read']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB,
    "webhookUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "externalId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB,
    "shippingAddress" JSONB,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "source" "IntegrationType" NOT NULL DEFAULT 'CUSTOM_API',
    "metadata" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "callAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "twilioCallSid" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "outcome" "CallOutcome",
    "dtmfInput" TEXT,
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "recordingS3Key" TEXT,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "callLimit" INTEGER NOT NULL,
    "callsUsed" INTEGER NOT NULL DEFAULT 0,
    "smsLimit" INTEGER NOT NULL DEFAULT 0,
    "smsUsed" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentProvider" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "callsSuccess" INTEGER NOT NULL DEFAULT 0,
    "ordersReceived" INTEGER NOT NULL DEFAULT 0,
    "ordersVerified" INTEGER NOT NULL DEFAULT 0,
    "ordersCancelled" INTEGER NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_merchantId_idx" ON "User"("merchantId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");
CREATE INDEX "Merchant_slug_idx" ON "Merchant"("slug");
CREATE INDEX "Merchant_status_idx" ON "Merchant"("status");
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_merchantId_idx" ON "ApiKey"("merchantId");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "Integration_merchantId_idx" ON "Integration"("merchantId");
CREATE INDEX "Integration_type_idx" ON "Integration"("type");
CREATE UNIQUE INDEX "Order_merchantId_externalId_key" ON "Order"("merchantId", "externalId");
CREATE INDEX "Order_merchantId_idx" ON "Order"("merchantId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE UNIQUE INDEX "Call_twilioCallSid_key" ON "Call"("twilioCallSid");
CREATE INDEX "Call_merchantId_idx" ON "Call"("merchantId");
CREATE INDEX "Call_orderId_idx" ON "Call"("orderId");
CREATE INDEX "Call_status_idx" ON "Call"("status");
CREATE INDEX "Call_createdAt_idx" ON "Call"("createdAt");
CREATE INDEX "Notification_merchantId_idx" ON "Notification"("merchantId");
CREATE INDEX "Notification_status_idx" ON "Notification"("status");
CREATE INDEX "Subscription_merchantId_idx" ON "Subscription"("merchantId");
CREATE INDEX "Subscription_isActive_idx" ON "Subscription"("isActive");
CREATE UNIQUE INDEX "UsageRecord_merchantId_date_key" ON "UsageRecord"("merchantId", "date");
CREATE INDEX "UsageRecord_merchantId_idx" ON "UsageRecord"("merchantId");
CREATE INDEX "UsageRecord_date_idx" ON "UsageRecord"("date");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
