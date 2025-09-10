import { PoolType } from '../types/inventory';

export const SERVICE_PROVISIONING: Record<string, { poolType: PoolType; defaultSeats: number; defaultDurationDays: number } | null> = {
  adobe: { poolType: 'admin_console', defaultSeats: 10, defaultDurationDays: 14 },
  acrobat: { poolType: 'admin_console', defaultSeats: 10, defaultDurationDays: 14 },
  apple_one: { poolType: 'family', defaultSeats: 6, defaultDurationDays: 30 },
  canva: { poolType: 'team', defaultSeats: 5, defaultDurationDays: 30 },
  chatgpt: { poolType: 'workspace', defaultSeats: 5, defaultDurationDays: 30 },
  duolingo: { poolType: 'family', defaultSeats: 5, defaultDurationDays: 14 },
  lastpass: { poolType: 'team', defaultSeats: 5, defaultDurationDays: 14 },
  microsoft_365: { poolType: 'family', defaultSeats: 5, defaultDurationDays: 30 },
  spotify: { poolType: 'family', defaultSeats: 6, defaultDurationDays: 30 },
  // services without tracking → null
  cursor: null,
  crunchyroll: null,
  chess: null,
};

export const PROVIDER_ICONS: Record<string, string> = {
  adobe: '🎨',
  acrobat: '📄',
  apple_one: '🍎',
  canva: '🎨',
  chatgpt: '🤖',
  duolingo: '🦉',
  lastpass: '🔐',
  microsoft_365: '🏢',
  spotify: '🎵',
};

export const POOL_TYPE_LABELS: Record<string, string> = {
  admin_console: 'Admin Console',
  family: 'Family Plan',
  team: 'Team Plan',
  workspace: 'Workspace',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  paused: 'slate',
  completed: 'indigo',
  overdue: 'amber',
  expired: 'red',
};
