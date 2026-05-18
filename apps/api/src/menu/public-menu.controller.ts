import { Controller, Get, Param } from '@nestjs/common';
import { MenuService } from './menu.service';

@Controller('public/r')
export class PublicMenuController {
  constructor(private readonly service: MenuService) {}

  @Get(':slug/menu')
  getMenu(@Param('slug') slug: string) {
    return this.service.getPublicMenu(slug.toLowerCase());
  }
}
