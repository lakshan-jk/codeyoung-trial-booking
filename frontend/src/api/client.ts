import type {
  AppConfig,
  BookingConfirmation,
  DayAvailability,
} from './types.js';

/** Error thrown for any non-2xx API response, carrying the backend's code/details. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'We couldn’t reach our servers. Please check your connection and try again.',
    );
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong.',
      err?.details,
      res.status,
    );
  }
  return body as T;
}

export const api = {
  getConfig: () => request<AppConfig>('/api/config'),

  getAvailability: (timezone: string, date: string) =>
    request<DayAvailability>(
      `/api/availability?timezone=${encodeURIComponent(timezone)}&date=${date}`,
    ),

  createBooking: (input: {
    parentName: string;
    parentEmail: string;
    parentTimezone: string;
    slotStartUtc: string;
  }) =>
    request<BookingConfirmation>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
