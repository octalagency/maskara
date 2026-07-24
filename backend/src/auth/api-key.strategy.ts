import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-header-strategy';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private authService: AuthService) {
    super({
      header: 'X-API-Key',
      passReqToCallback: true,
      optional: true,
    });
  }

  async validate(req: Request, apiKey: string) {
    let key = (apiKey || '').trim();
    if (!key) {
      key = String(
        req.headers['x-api-key'] || req.headers['api-key'] || '',
      ).trim();
    }
    if (!key) {
      const auth = String(req.headers.authorization || '');
      if (/^bearer\s+/i.test(auth)) {
        key = auth.replace(/^bearer\s+/i, '').trim();
      }
    }
    if (!key) {
      throw new UnauthorizedException('API key required');
    }
    return this.authService.validateApiKey(key);
  }
}
