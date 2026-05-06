import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';

const preview: Preview = {
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