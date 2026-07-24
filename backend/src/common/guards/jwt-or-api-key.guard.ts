import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Accept merchant JWT (dashboard) or API key (ShopIn / integrations).
 * Prefers API key when X-API-Key is present or Bearer looks like msk_…
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const headerKey = String(
      req.headers['x-api-key'] || req.headers['api-key'] || '',
    ).trim();
    const auth = String(req.headers.authorization || '');
    const bearer = /^bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() || '';
    const preferApiKey =
      !!headerKey ||
      (!!bearer && (bearer.startsWith('msk_') || !bearer.includes('.')));

    if (preferApiKey) {
      try {
        const ok = await new (AuthGuard('api-key'))().canActivate(context);
        if (ok) return true;
      } catch {
        /* fall through to JWT */
      }
    }

    try {
      const ok = await new (AuthGuard('jwt'))().canActivate(context);
      if (ok) return true;
    } catch {
      /* below */
    }

    if (!preferApiKey) {
      try {
        const ok = await new (AuthGuard('api-key'))().canActivate(context);
        if (ok) return true;
      } catch {
        /* below */
      }
    }

    throw new UnauthorizedException('JWT or API key required');
  }
}
