import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (!authToken) {
      if (isProd) return true; // Twilio optional if not using Twilio
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature) {
      throw new UnauthorizedException('Missing Twilio signature');
    }

    const publicUrl =
      this.config.get('PUBLIC_API_URL') || this.config.get('API_URL');
    const url = `${publicUrl?.replace(/\/$/, '')}${req.originalUrl}`;

    const valid = validateRequest(
      authToken,
      signature,
      url,
      req.body ?? {},
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid Twilio webhook signature');
    }
    return true;
  }
}
