import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  verifyHmacSha256,
  verifySharedSecret,
} from '../utils/webhook-signature.util';

@Injectable()
export class WooCommerceWebhookGuard implements CanActivate {
  private readonly logger = new Logger(WooCommerceWebhookGuard.name);
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const envSecret = this.config.get<string>('WOOCOMMERCE_WEBHOOK_SECRET') || '';
    const isProd = this.config.get('NODE_ENV') === 'production';
    const req = context.switchToHttp().getRequest();
    const merchant = req.user as { webhookSecret?: string } | undefined;
    const merchantSecret = merchant?.webhookSecret || '';
    const secrets = [envSecret, merchantSecret].filter((s, i, a) => !!s && a.indexOf(s) === i);

    if (!secrets.length) {
      if (isProd) {
        throw new UnauthorizedException('WOOCOMMERCE_WEBHOOK_SECRET not configured');
      }
      return true;
    }

    const shared =
      (req.headers['x-webhook-secret'] as string | undefined) ||
      (req.headers['x-maskara-webhook-secret'] as string | undefined);
    for (const secret of secrets) {
      if (verifySharedSecret(shared, secret)) {
        return true;
      }
    }

    const signature = req.headers['x-maskara-signature'] as string | undefined;
    if (signature) {
      const candidates: string[] = [];
      if (req.rawBody) {
        candidates.push(
          Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody),
        );
      }
      if (typeof req.body === 'string') candidates.push(req.body);
      if (req.body && typeof req.body === 'object') candidates.push(JSON.stringify(req.body));

      for (const secret of secrets) {
        for (const raw of candidates) {
          if (verifyHmacSha256(raw, signature, secret)) return true;
        }
      }
    }

    this.logger.warn('WooCommerce webhook auth failed (shared secret / signature)');
    throw new UnauthorizedException(
      'Invalid WooCommerce webhook auth — set Webhook Secret in plugin to match server',
    );
  }
}
