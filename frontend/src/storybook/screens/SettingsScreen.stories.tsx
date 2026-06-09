import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import {
  type SettingsScreenScenario,
  SettingsScreenSlice,
} from '@/storybook/screenSlices/SettingsScreenSlice';
import { jsonResponse, route, StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';

const passkeyHandlers = [
  route('GET', '/auth/passkey', () =>
    jsonResponse([
      {
        id: 'pk-story-01',
        name: 'MacBook Pro',
        created_at: '2026-04-15T10:00:00.000Z',
        last_used_at: '2026-06-01T08:30:00.000Z',
      },
    ])
  ),
];

const meta = {
  title: 'App/Screens/Settings',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AuthenticatedScreenShell currentTab="settings">
        <StoryApiScope handlers={passkeyHandlers}>
          <div className="px-4 py-8">
            <Story />
          </div>
        </StoryApiScope>
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

export const DeleteModal: Story = scenarioStory('deleteModal');

export const DeleteModalError: Story = scenarioStory('deleteModalError');

export const DeleteConfirmTyping: Story = scenarioStory('deleteConfirmTyping');

export const DeleteConfirmReady: Story = scenarioStory('deleteConfirmReady');
