import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().user);
