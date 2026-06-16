import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { S3StorageService } from './services/s3-storage.service';

@Global()
@Module({
  providers: [EmailService, S3StorageService],
  exports: [EmailService, S3StorageService],
})
export class CommonServicesModule {}
