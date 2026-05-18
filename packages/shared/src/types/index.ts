export interface TenantContext {
  tenantId: string;
  userId: string | null;
  role: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
