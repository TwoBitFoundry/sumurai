import { jest } from '@jest/globals';

jest.mock('@/hooks/useTellerConnect', () => ({
  useTellerConnect: jest.fn(),
}));
