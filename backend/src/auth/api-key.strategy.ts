import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-header-strategy';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private authService: AuthService) {
    super({ header: 'X-API-Key', passReqToCallback: false });
  }

  async validate(apiKey: string) {
    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }
    return this.authService.validateApiKey(apiKey);
  }
}
