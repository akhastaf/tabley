import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';
import { FilesController } from './files.controller';

@Module({
  imports: [MenuModule],
  controllers: [UploadsController, FilesController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
