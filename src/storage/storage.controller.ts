import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { BaseController } from '../common/controllers/base.controller';
import { ApiResponse } from '../common/interfaces/api-response.interface';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class StorageController extends BaseController {
  constructor(private readonly storageService: StorageService) {
    super();
  }

  /** POST /files/upload — upload a file to MinIO */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse> {
    if (!file) throw new BadRequestException('No file provided');

    const ext = file.originalname.split('.').pop() ?? 'bin';
    const key = `uploads/${userId}/${uuidv4()}.${ext}`;

    await this.storageService.uploadFile(key, file.buffer, file.mimetype);
    const url = this.storageService.getFileUrl(key);

    return this.success({ key, url, filename: file.originalname, size: file.size });
  }

  /** GET /files/download/:key — download a file from MinIO */
  @Get('download/*key')
  async download(
    @Param('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    const { body, contentType } = await this.storageService.getFile(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop()}"`);
    res.send(body);
  }
}
