import { supabase } from "@/integrations/supabase/client";

interface ContactData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  jobTitle?: string;
  notes?: string;
  excavatorLines?: string[];
}

export async function importContactsFromData(contacts: ContactData[]): Promise<{ success: boolean; insertedCount: number; errors?: string[] }> {
  try {
    const { data, error } = await supabase.functions.invoke('bulk-import-contacts', {
      body: { contacts }
    });

    if (error) {
      console.error('Import error:', error);
      return { success: false, insertedCount: 0, errors: [error.message] };
    }

    return data;
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, insertedCount: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

// Parse a pipe-separated row from the Excel export
function parseRow(row: string): ContactData | null {
  const columns = row.split('|').map(col => col.trim());
  
  // Skip header row or empty rows
  if (columns.length < 10 || columns[1] === 'Person - Name' || columns[1] === '-') {
    return null;
  }

  const name = columns[1]?.replace(/\\/g, '') || '';
  if (!name) return null;

  // Clean up email - remove backslashes before @
  const email = columns[3]?.replace(/\\@/g, '@').replace(/\\/g, '') || undefined;
  
  // Get phone - use work phone first, then mobile
  const workPhone = columns[6]?.replace(/[^\d-+() ]/g, '') || '';
  const mobilePhone = columns[8]?.replace(/[^\d-+() ]/g, '') || '';
  const phone = workPhone.split(',')[0]?.trim() || mobilePhone.split(',')[0]?.trim() || undefined;
  
  // Get address - use full combined address
  const address = columns[14]?.replace(/\\/g, '') || undefined;
  
  // Get company name
  const companyName = columns[11]?.replace(/\\/g, '') || columns[2]?.replace(/\\/g, '') || undefined;
  
  // Get job title - prefer column 26 (Person - Job title) over column 24
  const jobTitle = columns[26]?.replace(/\\/g, '') || columns[24]?.replace(/\\/g, '') || undefined;
  
  // Get notes
  const notes = columns[12]?.replace(/\\/g, '').replace(/<br\/?>/g, '\n') || undefined;
  
  // Get excavator lines
  const excavatorLinesRaw = columns[13]?.replace(/\\/g, '') || '';
  const excavatorLines = excavatorLinesRaw 
    ? excavatorLinesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;

  return {
    name,
    email: email && email.includes('@') ? email : undefined,
    phone,
    address,
    companyName,
    jobTitle,
    notes,
    excavatorLines: excavatorLines && excavatorLines.length > 0 ? excavatorLines : undefined,
  };
}

export function parseContactsFromMarkdownTable(tableContent: string): ContactData[] {
  const lines = tableContent.split('\n');
  const contacts: ContactData[] = [];
  
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    
    const contact = parseRow(line);
    if (contact) {
      contacts.push(contact);
    }
  }
  
  return contacts;
}
