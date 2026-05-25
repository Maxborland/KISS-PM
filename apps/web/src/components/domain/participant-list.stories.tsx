import type { Meta, StoryObj } from "@storybook/react";

import { ParticipantList } from "./participant-list";

const meta: Meta<typeof ParticipantList> = {
  title: "Composites/ParticipantList",
  component: ParticipantList,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ParticipantList>;

const SAMPLE = [
  { id: "1", name: "Иванов Игорь", initials: "ИИ", role: "Владелец" },
  { id: "2", name: "Петрова Анна", initials: "ПА", role: "Аналитик" },
  { id: "3", name: "Сидоров Кирилл", initials: "СК", role: "Разработчик" },
  { id: "4", name: "Козлова Мария", initials: "КМ", role: "QA" }
];

export const Default: Story = {
  name: "Список",
  render: () => <ParticipantList participants={SAMPLE} maxAvatars={3} />
};
