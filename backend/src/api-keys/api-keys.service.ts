import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateApiKeyDto) {
    const rawKey = `mk_${randomBytes(32).toString('hex')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        merchantId,
        name: dto.name,
        keyHash,
        keyPrefix,
        permissions: dto.permissions || ['orders:write', 'orders:read'],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  async findAll(merchantId: string) {
    return this.prisma.apiKey.findMany({
      where: { merchantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(merchantId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, merchantId },
    });
    if (!key) throw new NotFoundException('API key not found');

    return this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
