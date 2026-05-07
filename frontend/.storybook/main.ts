import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-mcp'],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  async viteFinal(config) {
    return mergeConfig(config, {
      define: {
        __dirname: JSON.stringify(''),
      },
    });
  },
};

export default config;
