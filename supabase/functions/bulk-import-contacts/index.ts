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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    // Check role - only owner, developer, or employee can bulk import
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const allowedRoles = ['owner', 'developer', 'employee'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contacts } = await req.json() as { contacts: ContactData[] };
    
    console.log(`User ${userId} (${roleData.role}) starting import of ${contacts.length} contacts`);
    
    // Get existing companies
    const { data: existingCompanies, error: companiesError } = await serviceClient
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
      const companiesToInsert = Array.from(newCompanies).map(name => ({ name }));
      
      const { data: createdCompanies, error: createError } = await serviceClient
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
        created_by: userId,
        updated_by: userId,
      };
    });
    
    // Insert contacts in batches of 100
    const batchSize = 100;
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < peopleToInsert.length; i += batchSize) {
      const batch = peopleToInsert.slice(i, i + batchSize);
      
      const { error: insertError } = await serviceClient
        .from('people')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch:`, insertError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        insertedCount += batch.length;
      }
    }
    
    console.log(`Import complete: ${insertedCount} contacts inserted by user ${userId}`);
    
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
