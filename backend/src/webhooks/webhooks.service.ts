import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  async handleShopifyWebhook(merchantId: string, payload: Record<string, unknown>) {
    const orderData: CreateOrderDto = {
      externalId: String(payload.id),
      orderNumber: payload.name as string || `#${payload.order_number}`,
      customerName: this.extractShopifyCustomerName(payload),
      customerPhone: this.extractShopifyPhone(payload),
      customerEmail: (payload.email as string) || undefined,
      totalAmount: parseFloat(payload.total_price as string) || 0,
      currency: (payload.currency as string) || 'BDT',
      items: (payload.line_items as Record<string, unknown>[]) || [],
      shippingAddress: payload.shipping_address as Record<string, unknown>,
      paymentMethod: this.extractShopifyPaymentMethod(payload),
      source: 'SHOPIFY',
      metadata: { shopifyOrderId: payload.id, financialStatus: payload.financial_status },
    };

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }

    return this.ordersService.create(merchantId, orderData);
  }

  async handleWooCommerceWebhook(merchantId: string, payload: Record<string, unknown>) {
    const externalId = String(payload.id);
    const existing = await this.prisma.order.findFirst({
      where: { merchantId, externalId, source: 'WOOCOMMERCE' },
    });
    if (existing) {
      return { received: true, duplicate: true, order: existing };
    }

    await this.prisma.integration.updateMany({
      where: { merchantId, type: 'WOOCOMMERCE', isActive: true },
      data: { lastSyncAt: new Date() },
    });

    const billing = payload.billing as Record<string, string>;
    const orderData: CreateOrderDto = {
      externalId: String(payload.id),
      orderNumber: `#${payload.number || payload.id}`,
      customerName: `${billing?.first_name || ''} ${billing?.last_name || ''}`.trim() || 'Customer',
      customerPhone: billing?.phone || '',
      customerEmail: billing?.email,
      totalAmount: parseFloat(payload.total as string) || 0,
      currency: (payload.currency as string) || 'BDT',
      items: (payload.line_items as Record<string, unknown>[]) || [],
      shippingAddress: payload.shipping as Record<string, unknown>,
      paymentMethod: (payload.payment_method_title as string) || 'COD',
      source: 'WOOCOMMERCE',
      metadata: { wooOrderId: payload.id, status: payload.status },
    };

    if (!orderData.customerPhone) {
      throw new BadRequestException('Customer phone number required for verification');
    }

    return this.ordersService.create(merchantId, orderData);
  }

  async handleCustomWebhook(merchantId: string, payload: CreateOrderDto) {
    return this.ordersService.create(merchantId, payload);
  }

  async handleBySlug(merchantSlug: string, secret: string, payload: CreateOrderDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { slug: merchantSlug },
    });

    if (!merchant || merchant.webhookSecret !== secret) {
      throw new BadRequestException('Invalid webhook');
    }

    return this.handleCustomWebhook(merchant.id, payload);
  }

  private extractShopifyCustomerName(payload: Record<string, unknown>): string {
    const customer = payload.customer as Record<string, string>;
    if (customer) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    const shipping = payload.shipping_address as Record<string, string>;
    if (shipping) {
      return `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim();
    }
    return 'Customer';
  }

  private extractShopifyPhone(payload: Record<string, unknown>): string {
    const customer = payload.customer as Record<string, string>;
    if (customer?.phone) return customer.phone;

    const shipping = payload.shipping_address as Record<string, string>;
    if (shipping?.phone) return shipping.phone;

    const billing = payload.billing_address as Record<string, string>;
    if (billing?.phone) return billing.phone;

    return '';
  }

  private extractShopifyPaymentMethod(payload: Record<string, unknown>): string {
    const gateways = payload.payment_gateway_names as string[];
    if (gateways?.length) return gateways[0];
    return (payload.financial_status as string) === 'pending' ? 'COD' : 'Paid';
  }
}
