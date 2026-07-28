import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = {
  ...CORS,
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

Deno.serve((request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  return new Response(JSON.stringify({
    error: 'E2E-testidatan luonti on poistettu käytöstä tuotantoympäristössä.',
  }), {
    status: 410,
    headers: JSON_HEADERS,
  });
});
