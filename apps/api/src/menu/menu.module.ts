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
import { SearchModule } from '../search/search.module';
import { TranslateModule } from '../translate/translate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuCategoryEntity, MenuItemEntity, TenantEntity]),
    SearchModule,
    TranslateModule,
  ],
  controllers: [ManageMenuController, PublicMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
