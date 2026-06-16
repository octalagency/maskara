-- Auth tokens (email verify, password reset) + payment sessions

CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');
CREATE TYPE "PaymentProvider" AS ENUM ('BKASH', 'NAGAD', 'MANUAL');
CREATE TYPE "PaymentSessionStatus" AS ENUM ('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");
CREATE INDEX "AuthToken_userId_idx" ON "AuthToken"("userId");
CREATE INDEX "AuthToken_token_idx" ON "AuthToken"("token");

ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "billingId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" "PaymentSessionStatus" NOT NULL DEFAULT 'CREATED',
    "gatewayTrxId" TEXT,
    "paymentUrl" TEXT,
    "callbackData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentSession_merchantId_idx" ON "PaymentSession"("merchantId");
CREATE INDEX "PaymentSession_billingId_idx" ON "PaymentSession"("billingId");
CREATE INDEX "PaymentSession_status_idx" ON "PaymentSession"("status");

ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
