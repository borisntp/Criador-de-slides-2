import { SlideItem, SlideSettings } from '../types';

export interface ProjectorSyncMessage {
  type: 'SLIDE_CHANGE' | 'DATA_UPDATE' | 'BLACKOUT_TOGGLE';
  currentIndex?: number;
  slides?: SlideItem[];
  settings?: SlideSettings;
  isBlackout?: boolean;
}

const CHANNEL_NAME = 'letras_projetor_sync_channel';

export class ProjectorBroadcaster {
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }
  }

  send(message: ProjectorSyncMessage) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
    // Also save in localStorage as fallback
    try {
      localStorage.setItem('letras_projetor_state', JSON.stringify(message));
    } catch {
      // Ignore quota errors
    }
  }

  onMessage(callback: (msg: ProjectorSyncMessage) => void) {
    if (this.channel) {
      this.channel.onmessage = (event) => {
        callback(event.data);
      };
    }

    // Storage fallback for cross-window sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'letras_projetor_state' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          callback(parsed);
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }

  close() {
    if (this.channel) {
      this.channel.close();
    }
  }
}
