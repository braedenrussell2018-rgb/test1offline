import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { contacts } = await req.json() as { contacts: ContactData[] };
    
    console.log(`Starting import of ${contacts.length} contacts`);
    
    // Get existing companies
    const { data: existingCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name');
    
    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      throw companiesError;
    }
    
    const companyMap = new Map<string, string>();
    for (const company of existingCompanies || []) {
      companyMap.set(company.name.toLowerCase(), company.id);
    }
    
    console.log(`Found ${companyMap.size} existing companies`);
    
    // Track new companies to create
    const newCompanies = new Set<string>();
    for (const contact of contacts) {
      if (contact.companyName) {
        const lowerName = contact.companyName.toLowerCase();
        if (!companyMap.has(lowerName)) {
          newCompanies.add(contact.companyName);
        }
      }
    }
    
    // Create new companies
    if (newCompanies.size > 0) {
      console.log(`Creating ${newCompanies.size} new companies`);
      const companiesToInsert = Array.from(newCompanies).map(name => ({ name }));
      
      const { data: createdCompanies, error: createError } = await supabase
        .from('companies')
        .insert(companiesToInsert)
        .select('id, name');
      
      if (createError) {
        console.error('Error creating companies:', createError);
        throw createError;
      }
      
      for (const company of createdCompanies || []) {
        companyMap.set(company.name.toLowerCase(), company.id);
      }
    }
    
    // Prepare contacts for insertion
    const peopleToInsert = contacts.map(contact => {
      const companyId = contact.companyName 
        ? companyMap.get(contact.companyName.toLowerCase()) 
        : null;
      
      return {
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        address: contact.address || null,
        company_id: companyId,
        job_title: contact.jobTitle || null,
        notes: contact.notes ? [{ text: contact.notes, timestamp: new Date().toISOString() }] : null,
        excavator_lines: contact.excavatorLines || null,
      };
    });
    
    // Insert contacts in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < peopleToInsert.length; i += batchSize) {
      const batch = peopleToInsert.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} contacts)`);
      
      const { error: insertError } = await supabase
        .from('people')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch:`, insertError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        insertedCount += batch.length;
      }
    }
    
    console.log(`Import complete: ${insertedCount} contacts inserted`);
    
    return new Response(JSON.stringify({
      success: true,
      insertedCount,
      newCompaniesCreated: newCompanies.size,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
