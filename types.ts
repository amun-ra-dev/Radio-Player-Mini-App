
export interface Station {
  id: string;
  name: string;
  streamUrl: string;
  coverUrl?: string;
  tags?: string[];
  addedAt: number;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'offline';

export interface AppSettings {
  autoplay: boolean;
  quality: 'auto' | 'low' | 'high';
  hapticEnabled: boolean;
}
