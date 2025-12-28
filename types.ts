
export interface Station {
  id: string;
  name: string;
  streamUrl: string;
  coverUrl?: string;
  homepageUrl?: string;
  tags?: string[];
  addedAt: number;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'offline';

export interface AppSettings {
  autoplay: boolean;
  quality: 'auto' | 'low' | 'high';
  hapticEnabled: boolean;
}

export type ExportSchemaV2 = {
  schemaVersion: 2;
  appVersion: string;
  exportedAt: number;
  stations: Array<{
    id: string;
    title: string;
    streamUrl: string;
    coverUrl?: string;
    homepageUrl?: string;
    isFavorite: boolean;
    tags?: string[];
  }>;
};
