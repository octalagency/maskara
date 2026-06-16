import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AuthTokenType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/services/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const slug = dto.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const merchant = await this.prisma.merchant.create({
      data: {
        name: dto.storeName,
        slug: `${slug}-${Date.now().toString(36)}`,
        email: dto.email,
        phone: dto.phone,
        storeNameBangla: dto.storeNameBangla || dto.storeName,
        status: 'TRIAL',
        subscriptionPlan: 'FREE',
        subscriptionEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: 'MERCHANT_OWNER',
        merchantId: merchant.id,
      },
    });

    await this.prisma.subscription.create({
      data: {
        merchantId: merchant.id,
        plan: 'FREE',
        price: 0,
        callLimit: 50,
        smsLimit: 20,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, merchant.id);
    await this.sendVerificationEmail(user.id, user.email);
    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { merchant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Email not verified. Check your inbox.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.merchantId,
    );
  }

  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.merchantId,
    );
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    merchantId: string | null,
  ) {
    const payload = { sub: userId, email, role, merchantId };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role, merchantId },
    };
  }

  async validateApiKey(apiKey: string) {
    const prefix = apiKey.substring(0, 8);
    const keys = await this.prisma.apiKey.findMany({
      where: { keyPrefix: prefix, isActive: true },
      include: { merchant: true },
    });

    for (const key of keys) {
      const valid = await bcrypt.compare(apiKey, key.keyHash);
      if (valid) {
        if (key.expiresAt && key.expiresAt < new Date()) {
          throw new UnauthorizedException('API key expired');
        }
        await this.prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        });
        return key.merchant;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const token = uuidv4();
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        type: AuthTokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.email.sendPasswordResetEmail(email, token);
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.authToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !record ||
      record.type !== AuthTokenType.PASSWORD_RESET ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.delete({ where: { id: record.id } }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.authToken.findUnique({
      where: { token },
    });

    if (
      !record ||
      record.type !== AuthTokenType.EMAIL_VERIFY ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.authToken.delete({ where: { id: record.id } }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }
    await this.sendVerificationEmail(user.id, email);
    return { message: 'Verification email sent' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: { email?: string; firstName?: string; lastName?: string } = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;

    if (dto.email && dto.email !== user.email) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password required to change email');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (taken && taken.id !== userId) {
        throw new ConflictException('Email already in use');
      }
      data.email = dto.email;
    }

    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Password updated successfully' };
  }

  private async sendVerificationEmail(userId: string, email: string) {
    await this.prisma.authToken.deleteMany({
      where: { userId, type: AuthTokenType.EMAIL_VERIFY },
    });

    const token = uuidv4();
    await this.prisma.authToken.create({
      data: {
        userId,
        token,
        type: AuthTokenType.EMAIL_VERIFY,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.email.sendVerificationEmail(email, token);
  }
}
