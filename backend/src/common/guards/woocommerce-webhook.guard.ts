import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyHmacSha256 } from '../utils/webhook-signature.util';

/**
 * Optional HMAC verification for WooCommerce/Shopify webhook bodies.
 * When WOOCOMMERCE_WEBHOOK_SECRET is set, requires X-Maskara-Signature header.
 */
@Injectable()
export class WooCommerceWebhookGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('WOOCOMMERCE_WEBHOOK_SECRET');
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (!secret) {
      if (isProd) {
        throw new UnauthorizedException(
          'WOOCOMMERCE_WEBHOOK_SECRET not configured — webhooks blocked in production',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const rawBody =
      req.rawBody?.toString('utf8') ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const signature = req.headers['x-maskara-signature'] as string | undefined;

    if (!verifyHmacSha256(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid WooCommerce webhook signature');
    }
    return true;
  }
}
