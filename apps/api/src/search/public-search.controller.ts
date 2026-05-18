import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '@tabley/database';
import { SearchService } from './search.service';

@Controller('public/r')
export class PublicSearchController {
  constructor(
    private readonly service: SearchService,
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
  ) {}

  @Get(':slug/search')
  async search(@Param('slug') slug: string, @Query('q') q?: string) {
    const tenant = await this.tenants.findOne({
      where: { slug: slug.toLowerCase(), isActive: true },
    });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Restaurant not found' });
    }
    return this.service.search({
      tenantId: tenant.id,
      q: q ?? '',
      onlyAvailable: true,
    });
  }
}
