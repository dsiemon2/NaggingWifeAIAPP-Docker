// OpenAI Whisper Speech-to-Text Client

import { logger } from '../../utils/logger.js';

interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
}

export class WhisperClient {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/audio';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('OPENAI_API_KEY not set - Whisper transcription will not work');
    }
  }

  /**
   * Transcribe audio buffer to text
   */
  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();

    // Create a Blob from the buffer (convert to Uint8Array for compatibility)
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    if (options.language) {
      formData.append('language', options.language);
    }
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    try {
      const response = await fetch(`${this.baseUrl}/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error({ error, status: response.status }, 'Whisper API error');
        throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json();

      logger.debug({ textLength: result.text?.length }, 'Transcription complete');

      return {
        text: result.text || '',
        duration: result.duration,
        language: result.language,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to transcribe audio');
      throw error;
    }
  }

  /**
   * Transcribe audio with word-level timestamps
   */
  async transcribeWithTimestamps(
    audioBuffer: Buffer,
    options: TranscriptionOptions = {}
  ): Promise<{
    text: string;
    words: Array<{ word: string; start: number; end: number }>;
  }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    if (options.language) {
      formData.append('language', options.language);
    }

    try {
      const response = await fetch(`${this.baseUrl}/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json();

      return {
        text: result.text || '',
        words: result.words || [],
      };
    } catch (error) {
      logger.error({ error }, 'Failed to transcribe audio with timestamps');
      throw error;
    }
  }
}

// Singleton instance
let whisperClientInstance: WhisperClient | null = null;

export function getWhisperClient(): WhisperClient {
  if (!whisperClientInstance) {
    whisperClientInstance = new WhisperClient();
  }
  return whisperClientInstance;
}
