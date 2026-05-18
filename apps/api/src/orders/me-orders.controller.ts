import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';

@Controller('me/orders')
@UseGuards(AuthGuard)
export class MeOrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.listForCustomer(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.getCustomerOrder(user.id, id);
  }
}
