import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { GoogleProfile } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async handleGoogleLogin(profile: GoogleProfile) {
    const { email, name, picture, providerId, accessToken, refreshToken } =
      profile;

    const client = this.databaseService.client;

    // Find or create user
    let user = await client.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await client.user.create({
        data: {
          email,
          name,
          image: picture,
          emailVerified: new Date(),
        },
      });
    }

    // Upsert account
    await client.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: providerId,
        },
      },
      create: {
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: providerId,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      update: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    });

    // Create session
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await client.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: expiresAt,
      },
    });

    return { sessionToken, user };
  }

  async getUserFromSession(sessionToken: string) {
    const client = this.databaseService.client;

    const session = await client.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      return null;
    }

    return session.user;
  }

  async logout(sessionToken: string) {
    const client = this.databaseService.client;
    await client.session.delete({
      where: { sessionToken },
    });
  }
}
