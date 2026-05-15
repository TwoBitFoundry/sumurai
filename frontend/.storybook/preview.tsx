import type { Preview } from '@storybook/nextjs-vite';
import { ThemeProvider } from '../src/context/ThemeContext';
import '../src/app/globals.css';

const preview: Preview = {
  tags: ['!test'],
  decorators: [
    (Story, context) => {
      const raw = context.globals.theme;
      const initialPreference = raw === 'system' || raw === 'dark' ? raw : ('light' as const);
      return (
        <ThemeProvider initialPreference={initialPreference}>
          <Story />
        </ThemeProvider>
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
