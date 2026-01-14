import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return handleCorsPrelight(req);
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Create client with user's token to verify auth
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Verify user has owner role (budget forecasts are owner-only per RLS)
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData || roleData.role !== 'owner') {
      console.error('Unauthorized: User', user.id, 'attempted forecast without owner role');
      return new Response(
        JSON.stringify({ error: 'Only owners can generate budget forecasts' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Owner role verified for user:", user.id);

    // Use service role for data operations (needed for cross-user data aggregation)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    const { month } = await req.json();

    // Get historical data: invoices, expenses, and transactions
    const [invoicesRes, expensesRes, accountsRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(100),
      supabase.from('accounts').select('*').eq('is_active', true),
    ]);

    if (invoicesRes.error) throw invoicesRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const accounts = accountsRes.data || [];

    // Prepare historical summary
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const avgMonthlyRevenue = totalRevenue / Math.max(1, invoices.length / 30);
    const avgMonthlyExpenses = totalExpenses / Math.max(1, expenses.length / 30);

    const expensesByCategory = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
      return acc;
    }, {} as Record<string, number>);

    const prompt = `You are a financial analyst. Based on the following historical data, generate monthly budget forecasts for ${month}.

Historical Summary:
- Total Revenue (last 100 invoices): $${totalRevenue.toFixed(2)}
- Total Expenses (last 100 entries): $${totalExpenses.toFixed(2)}
- Average Monthly Revenue: $${avgMonthlyRevenue.toFixed(2)}
- Average Monthly Expenses: $${avgMonthlyExpenses.toFixed(2)}

Expense Breakdown by Category:
${Object.entries(expensesByCategory).map(([cat, amt]) => `- ${cat}: $${amt}`).join('\n')}

Chart of Accounts:
${accounts.map(a => `- ${a.account_number} ${a.account_name} (${a.account_type})`).join('\n')}

Generate forecasts for each expense and revenue account. Return ONLY a JSON array with objects containing:
- account_id (UUID from the accounts list)
- forecasted_amount (number, positive for revenue/assets, consider historical trends and seasonal factors)

Consider growth trends, seasonal variations, and business cycles.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a financial forecasting expert. Return only valid JSON arrays." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error("AI API error:", error);
      throw new Error("AI forecasting failed");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Invalid AI response format");
    
    const forecasts = JSON.parse(jsonMatch[0]) as Array<{ account_id: string; forecasted_amount: number }>;

    // Save forecasts to database
    const forecastRecords = forecasts.map((f) => ({
      month,
      account_id: f.account_id,
      forecasted_amount: f.forecasted_amount,
      actual_amount: 0,
      generated_by_ai: true,
    }));

    const { data: savedForecasts, error: saveError } = await supabase
      .from('budget_forecasts')
      .upsert(forecastRecords, { onConflict: 'month,account_id' })
      .select();

    if (saveError) throw saveError;

    console.log("Forecasts generated successfully for user:", user.id);

    return new Response(JSON.stringify(savedForecasts), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
