import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TablesService } from '../tables/tables.service';
import { OrdersService } from './orders.service';

const placeOrderSchema = z.object({
  slug: z.string().min(1),
  tableToken: z.string().min(8),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(99),
        note: z.string().max(280).optional(),
      }),
    )
    .min(1),
  customerNote: z.string().max(500).optional(),
  guestSessionId: z.string().max(64).optional(),
});

@Controller('public')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly tables: TablesService,
  ) {}

  @Get('r/:slug/t/:token')
  async resolveTable(@Param('slug') slug: string, @Param('token') token: string) {
    const { tenant, table } = await this.tables.resolvePublicToken(slug.toLowerCase(), token);
    return {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, locale: tenant.defaultLocale },
      table: { id: table.id, label: table.label, capacity: table.capacity },
    };
  }

  @Post('orders')
  placeOrder(@Body(new ZodValidationPipe(placeOrderSchema)) body: z.infer<typeof placeOrderSchema>) {
    return this.orders.placeFromTable({ ...body, slug: body.slug.toLowerCase() });
  }
}
