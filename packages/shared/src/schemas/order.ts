import { z } from 'zod';
import { OrderChannel, PaymentMethod } from '../enums';

export const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
  note: z.string().max(280).optional(),
});
export type OrderLineInput = z.infer<typeof orderLineSchema>;

export const createOrderSchema = z.object({
  tableToken: z.string().min(8).optional(),
  channel: z.nativeEnum(OrderChannel),
  lines: z.array(orderLineSchema).min(1),
  customerNote: z.string().max(500).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const callWaiterSchema = z.object({
  tableToken: z.string().min(8),
  reason: z.string().max(120).optional(),
});
export type CallWaiterInput = z.infer<typeof callWaiterSchema>;
