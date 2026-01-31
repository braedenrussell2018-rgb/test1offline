import { useState, useRef, useCallback, useEffect } from 'react';

interface UseLocalWhisperReturn {
  isLoading: boolean;
  isModelLoaded: boolean;
  loadProgress: number;
  transcript: string;
  isTranscribing: boolean;
  error: string | null;
  loadModel: () => Promise<void>;
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
  resetTranscript: () => void;
}

export function useLocalWhisper(): UseLocalWhisperReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pipelineRef = useRef<any>(null);
  const isLoadingRef = useRef(false);

  const loadModel = useCallback(async () => {
    if (pipelineRef.current || isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      // Dynamic import to avoid SSR issues
      const { pipeline } = await import('@huggingface/transformers');
      
      console.log('Loading Whisper model...');
      
      // Use a smaller, faster model for browser
      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        {
          device: 'webgpu',
          progress_callback: (progress: any) => {
            if (progress.status === 'progress' && progress.progress) {
              setLoadProgress(Math.round(progress.progress));
            }
          },
        }
      );

      pipelineRef.current = transcriber;
      setIsModelLoaded(true);
      setLoadProgress(100);
      console.log('Whisper model loaded successfully');

    } catch (err) {
      console.error('Failed to load Whisper model:', err);
      
      // Try fallback without WebGPU
      try {
        console.log('Retrying without WebGPU...');
        const { pipeline } = await import('@huggingface/transformers');
        
        const transcriber = await pipeline(
          'automatic-speech-recognition',
          'onnx-community/whisper-tiny.en',
          {
            progress_callback: (progress: any) => {
              if (progress.status === 'progress' && progress.progress) {
                setLoadProgress(Math.round(progress.progress));
              }
            },
          }
        );

        pipelineRef.current = transcriber;
        setIsModelLoaded(true);
        setLoadProgress(100);
        console.log('Whisper model loaded (CPU fallback)');
        
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        setError('Failed to load transcription model. Please use "Slow Device" mode.');
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    if (!pipelineRef.current) {
      throw new Error('Model not loaded');
    }

    setIsTranscribing(true);
    setError(null);

    try {
      // Convert blob to array buffer then to audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Create audio context to decode the audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio data as Float32Array
      const audioData = audioBuffer.getChannelData(0);
      
      console.log('Transcribing audio...', audioData.length, 'samples');
      
      const result = await pipelineRef.current(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const text = result.text?.trim() || '';
      setTranscript(prev => prev ? `${prev} ${text}` : text);
      
      await audioContext.close();
      
      return text;

    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio');
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current = null;
    };
  }, []);

  return {
    isLoading,
    isModelLoaded,
    loadProgress,
    transcript,
    isTranscribing,
    error,
    loadModel,
    transcribeAudio,
    resetTranscript,
  };
}
