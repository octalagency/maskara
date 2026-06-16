import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifySharedSecret } from '../utils/webhook-signature.util';

/**
 * Protects voice provider webhooks (ePBX, ippbx, Twilio callbacks).
 * Set VOICE_WEBHOOK_SECRET in production.
 */
@Injectable()
export class VoiceWebhookGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('VOICE_WEBHOOK_SECRET');
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (!secret) {
      if (isProd) {
        throw new UnauthorizedException(
          'VOICE_WEBHOOK_SECRET not configured — voice webhooks blocked in production',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const header =
      req.headers['x-maskara-webhook-secret'] ||
      req.headers['x-webhook-secret'] ||
      req.headers['x-epbx-signature'];
    const querySecret = req.query?.secret as string | undefined;

    if (
      verifySharedSecret(header as string, secret) ||
      verifySharedSecret(querySecret, secret)
    ) {
      return true;
    }

    throw new UnauthorizedException('Invalid voice webhook signature');
  }
}
