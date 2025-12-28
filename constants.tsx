
import React from 'react';
import { motion } from 'framer-motion';
import { Station } from './types.ts';

export const DEFAULT_STATIONS: Station[] = [
  {
    id: 'eurodance',
    name: 'Eurodance',
    streamUrl: 'https://hls-01-radiorecord.hostingradio.ru/record-eurodance/96/playlist.m3u8',
    coverUrl: 'https://raw.githubusercontent.com/amun-ra-dev/pic/refs/heads/main/Eurodance.jpg',
    homepageUrl: 'https://www.radiorecord.ru/',
    tags: ['dance', '90s'],
    addedAt: Date.now()
  },
  {
    id: 'mds-station',
    name: 'MDS Station',
    streamUrl: 'https://stream03.pcradio.ru/mdsst_ru_1-hi',
    coverUrl: 'https://raw.githubusercontent.com/amun-ra-dev/pic/refs/heads/main/audiobook.jpg',
    homepageUrl: 'https://mds-station.com/',
    tags: ['audiobook'],
    addedAt: Date.now()
  },
  {
    id: 'synthwave-radio',
    name: 'Synthwave',
    streamUrl: 'https://hls-01-radiorecord.hostingradio.ru/record-synth/96/playlist.m3u8',
    coverUrl: 'https://raw.githubusercontent.com/amun-ra-dev/pic/refs/heads/main/Synthwave.jpg',
    homepageUrl: 'https://www.radiorecord.ru/',
    tags: ['synth', 'retro'],
    addedAt: Date.now()
  }
];

// Added style prop support to StarMotion
const StarMotion: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = "w-6 h-6", style }) => (
    <motion.div whileTap={{ scale: 1.4, rotate: 15 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className={className} style={style}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
    </motion.div>
);

// Added style prop support to StarOutlineMotion
const StarOutlineMotion: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = "w-6 h-6", style }) => (
    <motion.div whileTap={{ scale: 1.4, rotate: -15 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className={className} style={style}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" /></svg>
    </motion.div>
);

// Define a common interface for Icon props to improve consistency and fix type errors
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// Updated all icon components to accept and apply the style prop
export const Icons = {
  Play: ({ className = "w-8 h-8", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M8 5v14l11-7z" /></svg>,
  Pause: ({ className = "w-8 h-8", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  Next: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>,
  Prev: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M18 6l-8.5 6 8.5 6V6zM6 6v12H4V6h2z" /></svg>,
  List: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" /></svg>,
  Settings: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>,
  Add: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>,
  Export: ({ className = "w-5 h-5", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2v2h14v-2H5z" /></svg>,
  Import: ({ className = "w-5 h-5", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>,
  Reset: ({ className = "w-5 h-5", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>,
  Drag: ({ className = "w-5 h-5 opacity-30", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>,
  Help: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>,
  Timer: ({ className = "w-6 h-6", style }: IconProps) => <svg viewBox="0 0 24 24" fill="none" className={className} style={style}><path d="M9.99998 9.99998H14L9.99998 16H14M3 6L6.5 3M21 6L17.5 3M12 21C16.4183 21 20 17.4183 20 13C20 8.58172 16.4183 5 12 5C7.58172 5 4 8.58172 4 13C4 17.4183 7.58172 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Copy: ({ className = "w-5 h-5", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>,
  Paste: ({ className = "w-5 h-5", style }: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" /></svg>,
  Globe: ({ className = "w-4 h-4", style }: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Star: StarMotion,
  StarOutline: StarOutlineMotion
};
