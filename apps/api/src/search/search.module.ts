import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MenuCategoryEntity,
  MenuItemEntity,
  TenantEntity,
} from '@tabley/database';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PublicSearchController } from './public-search.controller';
import { SearchSync } from './search.sync';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItemEntity, MenuCategoryEntity, TenantEntity])],
  providers: [SearchService, SearchSync],
  controllers: [SearchController, PublicSearchController],
  exports: [SearchService, SearchSync],
})
export class SearchModule {}
