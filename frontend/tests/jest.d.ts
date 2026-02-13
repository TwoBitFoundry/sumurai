import 'jest';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledOnce(): R;
    }
  }
}
