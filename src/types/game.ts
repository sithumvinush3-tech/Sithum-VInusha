/**
 * Game types and data structures for Zero-Gravity Trash Sorter.
 */

export type DebrisCategory = 'organic' | 'metal' | 'hazard' | 'powerup';

export interface DebrisTemplate {
  emoji: string;
  category: DebrisCategory;
  name: string;
  glowColor: string;
  borderColor: string;
  bgColor: string;
  points: number;
  isSpecial?: boolean;
  powerupType?: 'repair' | 'stasis' | 'magnet';
}

export interface DebrisItem {
  id: string;
  emoji: string;
  category: DebrisCategory;
  name: string;
  glowColor: string;
  borderColor: string;
  bgColor: string;
  points: number;
  powerupType?: 'repair' | 'stasis' | 'magnet';

  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;

  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  pointerId?: number;

  // History for throw velocity calculation
  lastPositions: { x: number; y: number; time: number }[];

  // Visual effects
  scale: number;
  pulsePhase: number;
  isAbsorbed: boolean;
  absorbTarget?: { x: number; y: number };
  absorbedProgress?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  scale: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
  scale: number;
}

export interface BinZone {
  type: 'organic' | 'metal' | 'hazard';
  name: string;
  label: string;
  icon: string;
  color: string;
  glowColor: string;
  bgRgba: string;
  borderHex: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isHovered: boolean;
  pulseTimer: number;
  totalSorted: number;
}

export interface GameStats {
  totalSorted: number;
  organicSorted: number;
  metalSorted: number;
  hazardSorted: number;
  powerupsUsed: number;
  maxCombo: number;
}

export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

// Item database with variety
export const DEBRIS_CATALOG: DebrisTemplate[] = [
  // Organic items (Green)
  {
    emoji: '🍌',
    category: 'organic',
    name: 'Banana Peel',
    glowColor: '#22c55e',
    borderColor: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.25)',
    points: 15,
  },
  {
    emoji: '🍎',
    category: 'organic',
    name: 'Apple Core',
    glowColor: '#22c55e',
    borderColor: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.25)',
    points: 15,
  },
  {
    emoji: '🍃',
    category: 'organic',
    name: 'Hydroponic Leaf',
    glowColor: '#22c55e',
    borderColor: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.25)',
    points: 15,
  },
  {
    emoji: '🥪',
    category: 'organic',
    name: 'Ration Scrap',
    glowColor: '#22c55e',
    borderColor: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.25)',
    points: 20,
  },
  {
    emoji: '🍄',
    category: 'organic',
    name: 'Alien Spores',
    glowColor: '#22c55e',
    borderColor: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.25)',
    points: 25,
  },

  // Metal items (Blue)
  {
    emoji: '🔩',
    category: 'metal',
    name: 'Titanium Bolt',
    glowColor: '#38bdf8',
    borderColor: '#7dd3fc',
    bgColor: 'rgba(56, 189, 248, 0.25)',
    points: 15,
  },
  {
    emoji: '⚙️',
    category: 'metal',
    name: 'Gear Assembly',
    glowColor: '#38bdf8',
    borderColor: '#7dd3fc',
    bgColor: 'rgba(56, 189, 248, 0.25)',
    points: 15,
  },
  {
    emoji: '🥫',
    category: 'metal',
    name: 'Crushed Can',
    glowColor: '#38bdf8',
    borderColor: '#7dd3fc',
    bgColor: 'rgba(56, 189, 248, 0.25)',
    points: 15,
  },
  {
    emoji: '🛰️',
    category: 'metal',
    name: 'Satellite Part',
    glowColor: '#38bdf8',
    borderColor: '#7dd3fc',
    bgColor: 'rgba(56, 189, 248, 0.25)',
    points: 25,
  },
  {
    emoji: '🖲️',
    category: 'metal',
    name: 'Micro Circuit',
    glowColor: '#38bdf8',
    borderColor: '#7dd3fc',
    bgColor: 'rgba(56, 189, 248, 0.25)',
    points: 20,
  },

  // Hazard items (Red)
  {
    emoji: '☢️',
    category: 'hazard',
    name: 'Nuclear Core',
    glowColor: '#ef4444',
    borderColor: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.25)',
    points: 25,
  },
  {
    emoji: '🔋',
    category: 'hazard',
    name: 'Leaking Cell',
    glowColor: '#ef4444',
    borderColor: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.25)',
    points: 20,
  },
  {
    emoji: '☣️',
    category: 'hazard',
    name: 'Biohazard Vial',
    glowColor: '#ef4444',
    borderColor: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.25)',
    points: 25,
  },
  {
    emoji: '🛢️',
    category: 'hazard',
    name: 'Toxic Barrel',
    glowColor: '#ef4444',
    borderColor: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.25)',
    points: 20,
  },

  // Rare Utility Powerups
  {
    emoji: '🛠️',
    category: 'powerup',
    name: 'Nanite Repair Kit',
    glowColor: '#eab308',
    borderColor: '#fde047',
    bgColor: 'rgba(234, 179, 8, 0.3)',
    points: 50,
    isSpecial: true,
    powerupType: 'repair',
  },
  {
    emoji: '⏳',
    category: 'powerup',
    name: 'Stasis Time-Warp',
    glowColor: '#a855f7',
    borderColor: '#d8b4fe',
    bgColor: 'rgba(168, 85, 247, 0.3)',
    points: 40,
    isSpecial: true,
    powerupType: 'stasis',
  },
];
