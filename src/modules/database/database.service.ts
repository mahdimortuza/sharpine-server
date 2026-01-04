import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  private readonly adapter = new PrismaPg(this.pool);

  public readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      adapter: this.adapter, // REQUIRED for Prisma 7
      log: ['info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.client.$connect();
    console.log('✅ Prisma connected');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
    console.log('❌ Prisma disconnected');
  }
}
