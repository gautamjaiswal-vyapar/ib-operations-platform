import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../decorators/auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Bearer token required');
    try { request.user = await this.jwt.verifyAsync(token); return true; } catch { throw new UnauthorizedException('Invalid or expired token'); }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const permissions: string[] = context.switchToHttp().getRequest().user?.permissions ?? [];
    if (!required.every((item) => permissions.includes(item) || permissions.includes('*'))) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
