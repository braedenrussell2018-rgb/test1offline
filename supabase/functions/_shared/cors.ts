/**
 * Secure CORS configuration for Edge Functions
 * Restricts origins to known application domains instead of allowing all origins (*)
 */

// Allowed origins for CORS - includes production domains and local development
const ALLOWED_ORIGINS = [
  // Lovable preview domains
  'https://eyuzakziwgkaogiqfhro.lovableproject.com',
  'https://preview--eyuzakziwgkaogiqfhro.lovableproject.com',
  // Custom domains can be added here
  // 'https://yourdomain.com',
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * Get CORS headers with origin validation
 * Returns headers that only allow requests from known origins
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  // Check if the origin is in our allowed list
  const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (origin === allowed) return true;
    // Allow any lovableproject.com subdomain
    if (origin.endsWith('.lovableproject.com')) return true;
    // Allow any lovable.app subdomain (production)
    if (origin.endsWith('.lovable.app')) return true;
    return false;
  });
  
  // If origin is allowed, reflect it back; otherwise use the first allowed origin
  // This prevents requests from unknown origins
  const allowedOrigin = isAllowedOrigin ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests
 */
export function handleCorsPrelight(req: Request): Response {
  return new Response(null, { 
    status: 204,
    headers: getCorsHeaders(req) 
  });
}
