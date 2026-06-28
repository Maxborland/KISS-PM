import type { ChannelListView, ConversationView } from "./types";

// Static literal fixtures for the Storybook twin (Russian copy, no fetch).

export const CHAT_CHANNELS_MOCK: ChannelListView = {
  channels: [
    { id: "general", name: "Общий", kind: "channel", active: true },
    { id: "crm-romashka", name: "Внедрение «Ромашка»", kind: "channel", unread: 3 },
    { id: "design", name: "Дизайн", kind: "channel" },
    { id: "dm-petrov", name: "Пётр Алексеев", kind: "dm", presence: "online" },
    { id: "dm-kozlova", name: "Елена Козлова", kind: "dm", presence: "away", unread: 1 }
  ]
};

export const CHAT_CONVERSATION_MOCK: ConversationView = {
  title: "Общий",
  subtitle: "Команда внедрения · 8 участников",
  messages: [
    {
      id: "m1",
      authorName: "Мария Иванова",
      authorInitials: "МИ",
      authorColor: "c1",
      time: "14:32",
      text: "Подготовила черновик КП. Проверьте раздел «Цена».",
      reactions: [{ emoji: "👍", count: 2, reactedByMe: true }]
    },
    {
      id: "m2",
      authorName: "Пётр Алексеев",
      authorInitials: "ПА",
      authorColor: "c3",
      time: "14:40",
      text: "Смотрю. Расхождение −4% от базового плана — приемлемо.",
      edited: true
    },
    {
      id: "m3",
      authorName: "Вы",
      authorInitials: "Я",
      authorColor: "c5",
      time: "14:41",
      text: "Тогда отправляю заказчику сегодня.",
      own: true
    },
    {
      id: "m4",
      authorName: "Елена Козлова",
      authorInitials: "ЕК",
      authorColor: "c4",
      time: "14:45",
      text: "Готова к ревью завтра в 11:00.",
      pinned: true,
      reactions: [
        { emoji: "🔥", count: 1 },
        { emoji: "✅", count: 3 }
      ]
    }
  ]
};

export const CHAT_EMPTY_CONVERSATION_MOCK: ConversationView = {
  title: "Дизайн",
  subtitle: "Канал команды",
  messages: []
};
