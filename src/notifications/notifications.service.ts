import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../common/enums';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService extends BaseService<Notification> {
  protected readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {
    super(notifRepo);
  }

  async findByUser(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.notifRepo.findAndCount({
      where: { user_id: userId },
      skip,
      take: limit,
      order: { created_at: 'DESC' } as any,
    });

    this.logger.log(`findByUser: userId=${userId}, total=${total}`);
    return { data, total, page, limit };
  }

  async createNotification(
    userId: string,
    title: string,
    content: string,
    type: NotificationType,
    refType?: string,
    refId?: string,
  ): Promise<Notification> {
    const notif = this.notifRepo.create({
      user_id: userId,
      title,
      content,
      type,
      reference_type: refType ?? null,
      reference_id: refId ?? null,
      is_read: false,
    } as unknown as Notification);
    const saved = await this.notifRepo.save(notif) as Notification;
    this.logger.log(`createNotification: userId=${userId}, type=${type}, id=${saved.id}`);
    return saved;
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notif = await this.findByIdOrFail(id);
    if (notif.user_id !== userId) {
      throw new ForbiddenException('Cannot mark another user\'s notification as read');
    }
    notif.is_read = true;
    const updated = await this.notifRepo.save(notif);
    this.logger.log(`markRead: id=${id}, userId=${userId}`);
    return updated;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ user_id: userId, is_read: false }, { is_read: true });
    this.logger.log(`markAllRead: userId=${userId}`);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.notifRepo.count({ where: { user_id: userId, is_read: false } });
    this.logger.log(`getUnreadCount: userId=${userId}, count=${count}`);
    return count;
  }
}
