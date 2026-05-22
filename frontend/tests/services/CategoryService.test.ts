import { ApiClient } from '@/services/ApiClient';
import { CategoryService } from '@/services/CategoryService';

describe('CategoryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the categories endpoint without duplicating the api base path', async () => {
    const getSpy = jest.spyOn(ApiClient, 'get').mockResolvedValue({
      system: ['FOOD_AND_DRINK'],
      custom: [],
    } as any);

    await CategoryService.listCategories();

    expect(getSpy).toHaveBeenCalledWith('/categories');
  });

  it('creates and deletes custom categories without duplicating the api base path', async () => {
    const postSpy = jest.spyOn(ApiClient, 'post').mockResolvedValue({
      id: 'custom-1',
      display_name: 'Coffee',
      lookup_key: 'coffee',
    } as any);
    const deleteSpy = jest.spyOn(ApiClient, 'delete').mockResolvedValue(undefined as any);

    await CategoryService.createCustomCategory('Coffee');
    await CategoryService.deleteCustomCategory('custom-1');

    expect(postSpy).toHaveBeenCalledWith('/categories/custom', { name: 'Coffee' });
    expect(deleteSpy).toHaveBeenCalledWith('/categories/custom/custom-1');
  });
});
