import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  performLocalOCR,
  isOnline,
  savePendingScan,
  getPendingScans,
  removePendingScan,
  BasicContactInfo,
  PendingScan,
} from '@/lib/offline-ocr';

export interface ScanResult {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: string;
  isAIEnhanced: boolean;
  rawText?: string;
  needsReview?: boolean;
  confidence?: Record<string, boolean>;
}

/**
 * Resize image to max dimension while maintaining aspect ratio.
 * Returns a base64 data URL.
 */
function resizeImage(dataUrl: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function useBusinessCardScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setPendingScans(getPendingScans());
  }, []);

  useEffect(() => {
    if (online && pendingScans.length > 0) {
      toast({
        title: 'Back online',
        description: `${pendingScans.length} business card(s) ready for AI enhancement`,
      });
    }
  }, [online, pendingScans.length, toast]);

  const scanBusinessCard = useCallback(async (imageData: string): Promise<ScanResult> => {
    setIsScanning(true);
    setScanProgress(0);

    try {
      // Step 1: Local OCR for immediate results
      toast({
        title: online ? 'Scanning...' : 'Scanning offline...',
        description: 'Extracting text from image...',
      });

      const localResult = await performLocalOCR(imageData, (progress) => {
        setScanProgress(progress);
      });

      // Step 2: If online, enhance with AI (using compressed image)
      if (online) {
        setScanProgress(100);
        toast({
          title: 'Enhancing with AI...',
          description: 'Getting more accurate results...',
        });

        try {
          const compressedImage = await resizeImage(imageData, 1200);

          const { data, error } = await supabase.functions.invoke('scan-business-card', {
            body: { imageData: compressedImage },
          });

          if (!error && data?.contactInfo) {
            return {
              ...data.contactInfo,
              isAIEnhanced: true,
              needsReview: data.needsReview ?? false,
              confidence: data.confidence,
            };
          }
        } catch (aiError) {
          console.warn('AI enhancement failed, using local result:', aiError);
        }
      } else {
        savePendingScan(imageData, localResult);
        setPendingScans(getPendingScans());

        toast({
          title: 'Offline scan complete',
          description: 'Results saved. AI enhancement available when online.',
        });
      }

      return {
        name: localResult.name,
        email: localResult.email,
        phone: localResult.phone,
        company: localResult.company,
        jobTitle: localResult.jobTitle,
        address: localResult.address,
        rawText: localResult.rawText,
        isAIEnhanced: false,
      };
    } catch (error) {
      console.error('Scan failed:', error);
      throw error;
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [online, toast]);

  const enhancePendingScan = useCallback(async (pendingScan: PendingScan): Promise<ScanResult | null> => {
    if (!online) {
      toast({
        title: 'Offline',
        description: 'AI enhancement requires internet connection',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const compressedImage = await resizeImage(pendingScan.imageData, 1200);

      const { data, error } = await supabase.functions.invoke('scan-business-card', {
        body: { imageData: compressedImage },
      });

      if (error) throw error;

      removePendingScan(pendingScan.id);
      setPendingScans(getPendingScans());

      toast({
        title: 'Enhanced',
        description: 'Business card enhanced with AI',
      });

      return {
        ...data.contactInfo,
        isAIEnhanced: true,
        needsReview: data.needsReview ?? false,
        confidence: data.confidence,
      };
    } catch (error) {
      console.error('AI enhancement failed:', error);
      toast({
        title: 'Enhancement failed',
        description: 'Could not enhance with AI. Try again later.',
        variant: 'destructive',
      });
      return null;
    }
  }, [online, toast]);

  const dismissPendingScan = useCallback((id: string) => {
    removePendingScan(id);
    setPendingScans(getPendingScans());
  }, []);

  return {
    scanBusinessCard,
    enhancePendingScan,
    dismissPendingScan,
    isScanning,
    scanProgress,
    pendingScans,
    isOnline: online,
  };
}
