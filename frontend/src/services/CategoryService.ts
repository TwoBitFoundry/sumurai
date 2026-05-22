import type { CategoryListResponse, CustomCategory } from '../types/api';
import { ApiClient } from './ApiClient';

export class CategoryService {
  static async listCategories(): Promise<CategoryListResponse> {
    return ApiClient.get<CategoryListResponse>('/categories');
  }

  static async createCustomCategory(name: string): Promise<CustomCategory> {
    return ApiClient.post<CustomCategory>('/categories/custom', { name });
  }

  static async deleteCustomCategory(id: string): Promise<void> {
    await ApiClient.delete(`/categories/custom/${id}`);
  }
}
