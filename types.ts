/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  MENU = 'MENU',
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
  HOOP = 'HOOP'
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

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}
