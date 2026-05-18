export const UserRole = {
  PLATFORM_ADMIN: 'platform_admin',
  MANAGER: 'manager',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
  CASHIER: 'cashier',
  CUSTOMER: 'customer',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const OrderStatus = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  IN_KITCHEN: 'in_kitchen',
  READY: 'ready',
  SERVED: 'served',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderChannel = {
  DINE_IN: 'dine_in',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
} as const;
export type OrderChannel = (typeof OrderChannel)[keyof typeof OrderChannel];

export const PaymentMethod = {
  CASH: 'cash',
  CARD: 'card',
  ONLINE: 'online',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  REFUNDED: 'refunded',
  FAILED: 'failed',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const Locale = {
  EN: 'en',
  FR: 'fr',
  AR: 'ar',
  ES: 'es',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
