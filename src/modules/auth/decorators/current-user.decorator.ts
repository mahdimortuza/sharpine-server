import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth.service';

export const CurrentUser = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) return null;
    const authService = req.app.get(AuthService);
    return authService.validateSession(sessionToken);
  },
);
