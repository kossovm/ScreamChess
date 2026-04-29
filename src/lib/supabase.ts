import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Build-time / unconfigured environments may not have env vars set.
// Returning a real client without a key throws ("supabaseKey is required") and
// breaks `next build` static prerendering. Provide a no-op stub instead and let
// callers gate behaviour on `isSupabaseConfigured`.
function createStubClient(): SupabaseClient {
  const notConfigured = async () => ({ data: null, error: new Error('Supabase not configured') as any });
  const stub: any = {
    auth: {
      getUser: notConfigured,
      getSession: notConfigured,
      signInWithPassword: notConfigured,
      signUp: notConfigured,
      signInWithOAuth: notConfigured,
      signOut: notConfigured,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          single: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
      subscribe: () => ({}),
      send: () => Promise.resolve({}),
      track: () => Promise.resolve({}),
      presenceState: () => ({}),
    }),
    removeChannel: () => Promise.resolve({}),
    realtime: {} as any,
  };
  return stub as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : createStubClient();
