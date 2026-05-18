import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MenuCategoryEntity,
  MenuImportJobEntity,
  MenuItemEntity,
} from '@tabley/database';
import { RealtimeModule } from '../realtime/realtime.module';
import { SearchModule } from '../search/search.module';
import { MENU_IMPORT_QUEUE } from './constants';
import { MenuImportController } from './menu-import.controller';
import { MenuImportProcessor } from './menu-import.processor';
import { MenuImportService } from './menu-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuImportJobEntity, MenuCategoryEntity, MenuItemEntity]),
    BullModule.registerQueue({ name: MENU_IMPORT_QUEUE }),
    RealtimeModule,
    SearchModule,
  ],
  controllers: [MenuImportController],
  providers: [MenuImportService, MenuImportProcessor],
})
export class MenuImportModule {}
