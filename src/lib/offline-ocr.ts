import Tesseract from 'tesseract.js';

export interface BasicContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: string;
  rawText: string;
}

// Regex patterns for extracting contact info
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/\S*)?/gi;

// Common job title keywords
const JOB_TITLE_KEYWORDS = [
  'manager', 'director', 'president', 'vp', 'vice president', 'ceo', 'cto', 'cfo', 'coo',
  'executive', 'coordinator', 'specialist', 'analyst', 'engineer', 'developer', 'designer',
  'consultant', 'advisor', 'associate', 'assistant', 'supervisor', 'lead', 'head', 'chief',
  'officer', 'representative', 'sales', 'marketing', 'operations', 'hr', 'human resources',
  'admin', 'administrative', 'technician', 'foreman', 'superintendent', 'owner', 'partner'
];

/**
 * Perform local OCR on an image using Tesseract.js
 * Works completely offline after initial model download
 */
export async function performLocalOCR(
  imageData: string,
  onProgress?: (progress: number) => void
): Promise<BasicContactInfo> {
  try {
    const result = await Tesseract.recognize(imageData, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const text = result.data.text;
    return extractContactInfo(text);
  } catch (error) {
    console.error('OCR failed:', error);
    throw new Error('Failed to perform text recognition');
  }
}

/**
 * Extract structured contact info from raw OCR text
 */
function extractContactInfo(text: string): BasicContactInfo {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Extract emails
  const emails = text.match(EMAIL_REGEX) || [];
  const email = emails[0];

  // Extract phone numbers
  const phones = text.match(PHONE_REGEX) || [];
  const phone = phones[0];

  // Extract URLs (might indicate company website)
  const urls = text.match(URL_REGEX) || [];

  // Try to identify name (usually first line with 2-4 words, no special chars except spaces)
  let name: string | undefined;
  let company: string | undefined;
  let jobTitle: string | undefined;
  let address: string | undefined;

  const addressLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Skip if line contains email or phone (already extracted)
    if (emails.some(e => line.includes(e)) || phones.some(p => line.includes(p))) {
      continue;
    }
    
    // Skip URLs
    if (urls.some(u => lowerLine.includes(u.toLowerCase()))) {
      continue;
    }

    // Check if it's a job title
    if (!jobTitle && JOB_TITLE_KEYWORDS.some(keyword => lowerLine.includes(keyword))) {
      jobTitle = line;
      continue;
    }

    // First clean line with 2-4 words is likely a name
    if (!name) {
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && /^[a-zA-Z\s.'-]+$/.test(line)) {
        name = line;
        continue;
      }
    }

    // Lines with Inc, LLC, Corp, Co, Ltd are likely company names
    if (!company && /\b(inc\.?|llc|corp\.?|co\.?|ltd\.?|company|group|enterprises?|solutions?)\b/i.test(line)) {
      company = line;
      continue;
    }

    // Lines with numbers and common address words are likely addresses
    if (/\d/.test(line) && /\b(st\.?|street|ave\.?|avenue|rd\.?|road|blvd|dr\.?|drive|suite|floor|box)\b/i.test(lowerLine)) {
      addressLines.push(line);
      continue;
    }

    // State + ZIP pattern
    if (/\b[A-Z]{2}\s*\d{5}(-\d{4})?\b/.test(line)) {
      addressLines.push(line);
      continue;
    }
  }

  // If no company found, look for lines that might be company (all caps, or second line after name)
  if (!company && name) {
    const nameIndex = lines.findIndex(l => l === name);
    if (nameIndex >= 0 && nameIndex + 1 < lines.length) {
      const nextLine = lines[nameIndex + 1];
      // If next line isn't job title, email, phone - it might be company
      const nextLineLower = nextLine.toLowerCase();
      if (!JOB_TITLE_KEYWORDS.some(k => nextLineLower.includes(k)) &&
          !emails.some(e => nextLine.includes(e)) &&
          !phones.some(p => nextLine.includes(p))) {
        company = nextLine;
      }
    }
  }

  if (addressLines.length > 0) {
    address = addressLines.join(', ');
  }

  return {
    name,
    email,
    phone,
    company,
    jobTitle,
    address,
    rawText: text,
  };
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Store a pending scan for AI enhancement when back online
 */
export interface PendingScan {
  id: string;
  imageData: string;
  localResult: BasicContactInfo;
  timestamp: string;
}

const PENDING_SCANS_KEY = 'pending_business_card_scans';

export function savePendingScan(imageData: string, localResult: BasicContactInfo): string {
  const id = crypto.randomUUID();
  const pendingScans = getPendingScans();
  const newScan: PendingScan = {
    id,
    imageData,
    localResult,
    timestamp: new Date().toISOString(),
  };
  pendingScans.push(newScan);
  localStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(pendingScans));
  return id;
}

export function getPendingScans(): PendingScan[] {
  try {
    const data = localStorage.getItem(PENDING_SCANS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function removePendingScan(id: string): void {
  const pendingScans = getPendingScans().filter(s => s.id !== id);
  localStorage.setItem(PENDING_SCANS_KEY, JSON.stringify(pendingScans));
}

export function clearPendingScans(): void {
  localStorage.removeItem(PENDING_SCANS_KEY);
}
