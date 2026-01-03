import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';

interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async handleGoogleLogin(profile: GoogleProfile) {
    const { email, name, picture, providerId, accessToken, refreshToken } =
      profile;

    // Find or create user
    let user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.databaseService.user.create({
        data: {
          email,
          name,
          image: picture,
          emailVerified: new Date(),
        },
      });
    }

    // Upsert account
    await this.databaseService.account.upsert({
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

    await this.databaseService.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: expiresAt,
      },
    });

    return { sessionToken, user };
  }

  async getUserFromSession(sessionToken: string) {
    const session = await this.databaseService.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session || session.expires < new Date()) {
      return null;
    }

    return session.user;
  }

  async logout(sessionToken: string) {
    await this.databaseService.session.delete({
      where: { sessionToken },
    });
  }
}
