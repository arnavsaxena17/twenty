import { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { ComponentDecorator, IconCheckbox } from 'twenty-ui';

import { RecoilScope } from '@/ui/utilities/recoil-scope/components/RecoilScope';

import { ChatList } from '../ChatList';

const tabs = [
  {
    id: '1',
    title: 'Tab1',
    Icon: IconCheckbox,
    hide: true,
  },
  {
    id: '2',
    title: 'Tab2',
    Icon: IconCheckbox,
    hide: false,
  },
  {
    id: '3',
    title: 'Tab3',
    Icon: IconCheckbox,
    hide: false,
    disabled: true,
  },
  {
    id: '4',
    title: 'Tab4',
    Icon: IconCheckbox,
    hide: false,
    disabled: false,
  },
];

const meta: Meta<typeof ChatList> = {
  title: 'UI/Layout/Chat/ChatList',
  component: ChatList,
  args: {
    tabListId: 'tab-list-id',
    tabs: tabs,
  },
  decorators: [
    (Story) => (
      <RecoilScope>
        <Story />
      </RecoilScope>
    ),
    ComponentDecorator,
  ],
};

export default meta;

type Story = StoryObj<typeof ChatList>;

export const TabListDisplay: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.queryByText('Tab1');
    expect(submitButton).toBeNull();
    expect(await canvas.findByText('Tab2')).toBeInTheDocument();
    expect(await canvas.findByText('Tab3')).toBeInTheDocument();
    expect(await canvas.findByText('Tab4')).toBeInTheDocument();
  },
};