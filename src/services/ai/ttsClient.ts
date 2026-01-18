// OpenAI Text-to-Speech Client

import { logger } from '../../utils/logger.js';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

interface TTSOptions {
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number; // 0.25 to 4.0
}

export class TTSClient {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/audio';
  private defaultVoice: TTSVoice = 'alloy';
  private defaultModel: TTSModel = 'tts-1';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('OPENAI_API_KEY not set - TTS will not work');
    }

    // Use configured default voice if available
    const configuredVoice = process.env.OPENAI_TTS_VOICE as TTSVoice;
    if (configuredVoice && this.isValidVoice(configuredVoice)) {
      this.defaultVoice = configuredVoice;
    }
  }

  private isValidVoice(voice: string): voice is TTSVoice {
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice);
  }

  /**
   * Convert text to speech and return audio buffer
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = options.voice || this.defaultVoice;
    const model = options.model || this.defaultModel;
    const speed = options.speed || 1.0;

    // Validate speed
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));

    logger.debug({ textLength: text.length, voice, model }, 'Generating TTS audio');

    try {
      const response = await fetch(`${this.baseUrl}/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed: clampedSpeed,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error({ error, status: response.status }, 'TTS API error');
        throw new Error(`TTS API error: ${error.error?.message || response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.debug({ audioSize: buffer.length }, 'TTS audio generated');

      return buffer;
    } catch (error) {
      logger.error({ error }, 'Failed to generate TTS audio');
      throw error;
    }
  }

  /**
   * Stream TTS audio (for real-time playback)
   */
  async *streamSynthesize(
    text: string,
    options: TTSOptions = {}
  ): AsyncGenerator<Buffer, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = options.voice || this.defaultVoice;
    const model = options.model || this.defaultModel;

    try {
      const response = await fetch(`${this.baseUrl}/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`TTS API error: ${error.error?.message || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to stream TTS audio');
      throw error;
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): TTSVoice[] {
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }

  /**
   * Get voice description
   */
  getVoiceDescription(voice: TTSVoice): string {
    const descriptions: Record<TTSVoice, string> = {
      alloy: 'Neutral and balanced',
      echo: 'Warm and conversational',
      fable: 'Expressive and dynamic',
      onyx: 'Deep and authoritative',
      nova: 'Friendly and upbeat',
      shimmer: 'Clear and professional',
    };
    return descriptions[voice];
  }
}

// Singleton instance
let ttsClientInstance: TTSClient | null = null;

export function getTTSClient(): TTSClient {
  if (!ttsClientInstance) {
    ttsClientInstance = new TTSClient();
  }
  return ttsClientInstance;
}
