/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const { sessionToken } = await this.authService.handleGoogleLogin(
        req.user as any,
      );

      const isProduction = process.env.NODE_ENV === 'production';

      // Set httpOnly cookie with cross-domain settings
      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: isProduction, // true in production (HTTPS only)
        sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-domain in production
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      // Redirect to frontend
      const frontendUrl =
        process.env.FRONTEND_CALLBACK_URL || 'http://localhost:3000/callback';
      return res.redirect(frontendUrl);
    } catch (err) {
      console.error('Auth error:', err);
      const frontendUrl =
        process.env.FRONTEND_CALLBACK_URL || 'http://localhost:3000/callback';
      // Strip /callback for error redirect
      const baseUrl = frontendUrl.replace('/callback', '');
      return res.redirect(`${baseUrl}/login?error=auth_failed`);
    }
  }

  @Get('me')
  async getCurrentUser(@Req() req: Request) {
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) return { user: null };

    const user = await this.authService.getUserFromSession(sessionToken);
    return { user };
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionToken = req.cookies?.sessionToken;

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.json({ message: 'Logged out successfully' });
  }
}
