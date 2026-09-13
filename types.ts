/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  MENU = 'MENU',
  STORY = 'STORY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ObjectType {
  OBSTACLE = 'OBSTACLE',
  GEM = 'GEM',
  LETTER = 'LETTER',
  SHOP_PORTAL = 'SHOP_PORTAL',
  ALIEN = 'ALIEN',
  MISSILE = 'MISSILE',
  HOOP = 'HOOP',
  MOVING_WALL = 'MOVING_WALL',
  SWEEPER = 'SWEEPER'
}

export interface GameObject {
  id: string;
  type: ObjectType;
  position: [number, number, number]; // x, y, z
  active: boolean;
  value?: string; // For letters (G, E, M...)
  color?: string;
  targetIndex?: number; // Index in the GEMINI target word
  points?: number; // Score value for gems
  hasFired?: boolean; // For Aliens
  isDunked?: boolean; // For Basketball Hoops
  hasMissed?: boolean; // For missed hoop detection
  isShowtime?: boolean; // Showtime Lane dunk checkpoint
  hasAnnounced?: boolean; // Showtime announcement emitted
  baseX?: number; // Oscillation center for MOVING_WALL / SWEEPER
  amplitude?: number; // Lateral sweep amplitude
  phase?: number; // Oscillation phase offset
  oscSpeed?: number; // Lateral sweep frequency
}

export const LANE_WIDTH = 2.2;
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.6; // seconds
export const RUN_SPEED_BASE = 22.5;
export const SPAWN_DISTANCE = 120;
export const REMOVE_DISTANCE = 20; // Behind player

// Basketball Varsity Colors: Orange, Royal Blue, Amber Gold, Emerald, Crimson Red, Electric Purple
export const GEMINI_COLORS = [
    '#ea580c', // B - Basketball Orange
    '#2563eb', // A - Royal Blue
    '#f59e0b', // S - Court Amber
    '#10b981', // K - Emerald Green
    '#dc2626', // E - Crimson Red
    '#7c3aed', // T - Deep Purple
];

export const BASKET_TARGET = ['B', 'A', 'S', 'K', 'E', 'T'];

export interface SkinDef {
    id: string;
    name: string;
    jersey: string;
    shorts: string;
    accent: string;
    unlockAtBest: number;
}

export const SKINS: SkinDef[] = [
    { id: 'royal', name: 'Royal Blue', jersey: '#2563eb', shorts: '#1e3a8a', accent: '#ffffff', unlockAtBest: 0 },
    { id: 'orange', name: 'Court Orange', jersey: '#ea580c', shorts: '#7c2d12', accent: '#fff7ed', unlockAtBest: 500 },
    { id: 'midnight', name: 'Midnight', jersey: '#0f172a', shorts: '#111827', accent: '#f59e0b', unlockAtBest: 1500 },
    { id: 'blaze', name: 'Blaze', jersey: '#dc2626', shorts: '#991b1b', accent: '#fbbf24', unlockAtBest: 3000 },
    { id: 'clutch', name: 'Clutch Gold', jersey: '#b45309', shorts: '#78350f', accent: '#fde68a', unlockAtBest: 5000 },
    { id: 'legend', name: 'Legend', jersey: '#312e81', shorts: '#1e1b4b', accent: '#f59e0b', unlockAtBest: 8000 },
];

// Daily-seeded run (fixed RNG per calendar day so scores are comparable)
export function getDailySeed(): number {
  const d = new Date();
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

export function getDailySeedLabel(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}
