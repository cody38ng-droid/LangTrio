import { Language } from '../types';

export const DUMMY_LEADERBOARDS: Record<Language, { name: string; xp: number; avatar: string; isMe?: boolean }[]> = {
  English: [
    { name: "JunHao", xp: 2450, avatar: "JH" },
    { name: "Sarah", xp: 2210, avatar: "SA" },
    { name: "Adam", xp: 2100, avatar: "AD" },
    { name: "Emily", xp: 1950, avatar: "EM" },
    { name: "Chris", xp: 1800, avatar: "CH" },
    { name: "You", xp: 150, avatar: "ME", isMe: true },
  ],
  Malay: [
    { name: "Aiman", xp: 1880, avatar: "AI" },
    { name: "Siti", xp: 1750, avatar: "SI" },
    { name: "Zul", xp: 1600, avatar: "ZU" },
    { name: "You", xp: 320, avatar: "ME", isMe: true },
    { name: "Farah", xp: 280, avatar: "FA" },
  ],
  Chinese: [
    { name: "Mei Ling", xp: 3200, avatar: "ML" },
    { name: "Wei", xp: 2900, avatar: "WE" },
    { name: "You", xp: 1200, avatar: "ME", isMe: true },
    { name: "Chen", xp: 1100, avatar: "CE" },
    { name: "Xun", xp: 950, avatar: "XU" },
  ]
};
