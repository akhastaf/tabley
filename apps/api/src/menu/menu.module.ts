import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MenuCategoryEntity,
  MenuItemEntity,
  TenantEntity,
} from '@tabley/database';
import { ManageMenuController } from './manage-menu.controller';
import { PublicMenuController } from './public-menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategoryEntity, MenuItemEntity, TenantEntity])],
  controllers: [ManageMenuController, PublicMenuController],
  providers: [MenuService],
})
export class MenuModule {}
