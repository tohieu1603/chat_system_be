import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Abstract base controller — provides response formatting helpers.
 * All domain controllers extend this for consistent API responses.
 */
export abstract class BaseController {
  /** Wrap data in a success response */
  protected success<T>(data: T, message?: string): ApiResponse<T> {
    return { success: true, data, message };
  }

  /** Wrap paginated data in a success response */
  protected paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Return a success message without data */
  protected ok(message: string): ApiResponse {
    return { success: true, message };
  }
}
