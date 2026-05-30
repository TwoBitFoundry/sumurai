import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import {
  type SettingsScreenScenario,
  SettingsScreenSlice,
} from '@/storybook/screenSlices/SettingsScreenSlice';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

const meta = {
  title: 'App/Screens/Settings',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AuthenticatedScreenShell currentTab="settings">
        <div className="px-4 py-8">
          <Story />
        </div>
      </AuthenticatedScreenShell>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function scenarioStory(scenario: SettingsScreenScenario): Story {
  return {
    render: () => <SettingsScreenSlice scenario={scenario} />,
  };
}

export const Default: Story = scenarioStory('default');

export const DefaultDark: Story = {
  ...storyDarkTheme,
  render: () => <SettingsScreenSlice scenario="default" />,
};

export const DeleteModal: Story = scenarioStory('deleteModal');

export const DeleteModalError: Story = scenarioStory('deleteModalError');

export const DeleteConfirmTyping: Story = scenarioStory('deleteConfirmTyping');

export const DeleteConfirmReady: Story = scenarioStory('deleteConfirmReady');
