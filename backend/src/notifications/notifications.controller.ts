import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async findAll(
    @CurrentUser('merchantId') merchantId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { merchantId } }),
    ]);

    return { notifications, total, page, limit };
  }
}
