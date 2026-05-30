import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [MenuModule],
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
