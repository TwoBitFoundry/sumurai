import type { Preview } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/context/ThemeContext';
import '../src/app/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const preview: Preview = {
  tags: ['!test'],
  decorators: [
    (Story, context) => {
      const raw = context.globals.theme;
      const initialPreference = raw === 'system' || raw === 'dark' ? raw : ('light' as const);
      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider initialPreference={initialPreference}>
            <Story />
          </ThemeProvider>
        </QueryClientProvider>
      );
    },
  ],
  globalTypes: {
    theme: {
      description: 'Color scheme for stories',
      defaultValue: 'system',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#f8fafc' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
};

export default preview;
