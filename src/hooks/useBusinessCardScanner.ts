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
}

export function useBusinessCardScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [online, setOnline] = useState(isOnline());

  // Track online/offline status
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

  // Load pending scans on mount
  useEffect(() => {
    setPendingScans(getPendingScans());
  }, []);

  // Process pending scans when coming back online
  useEffect(() => {
    if (online && pendingScans.length > 0) {
      toast({
        title: 'Back online',
        description: `${pendingScans.length} business card(s) ready for AI enhancement`,
      });
    }
  }, [online, pendingScans.length, toast]);

  /**
   * Scan a business card - uses local OCR first, then AI if online
   */
  const scanBusinessCard = useCallback(async (imageData: string): Promise<ScanResult> => {
    setIsScanning(true);
    setScanProgress(0);

    try {
      // Step 1: Always do local OCR first for immediate results
      toast({
        title: online ? 'Scanning...' : 'Scanning offline...',
        description: 'Extracting text from image...',
      });

      const localResult = await performLocalOCR(imageData, (progress) => {
        setScanProgress(progress);
      });

      // Step 2: If online, enhance with AI
      if (online) {
        setScanProgress(100);
        toast({
          title: 'Enhancing with AI...',
          description: 'Getting more accurate results...',
        });

        try {
          const { data, error } = await supabase.functions.invoke('scan-business-card', {
            body: { imageData },
          });

          if (!error && data?.contactInfo) {
            return {
              ...data.contactInfo,
              isAIEnhanced: true,
            };
          }
        } catch (aiError) {
          console.warn('AI enhancement failed, using local result:', aiError);
        }
      } else {
        // Save for later AI enhancement
        savePendingScan(imageData, localResult);
        setPendingScans(getPendingScans());
        
        toast({
          title: 'Offline scan complete',
          description: 'Results saved. AI enhancement available when online.',
        });
      }

      // Return local result
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

  /**
   * Enhance a pending scan with AI
   */
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
      const { data, error } = await supabase.functions.invoke('scan-business-card', {
        body: { imageData: pendingScan.imageData },
      });

      if (error) throw error;

      // Remove from pending list
      removePendingScan(pendingScan.id);
      setPendingScans(getPendingScans());

      toast({
        title: 'Enhanced',
        description: 'Business card enhanced with AI',
      });

      return {
        ...data.contactInfo,
        isAIEnhanced: true,
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

  /**
   * Dismiss a pending scan
   */
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
