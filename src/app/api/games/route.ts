import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, message: 'Supabase not configured' });

  const { error } = await sb.from('games').insert({
    user_id: body.userId ?? null,
    pgn: body.pgn,
    moves: body.moves,
    result: body.result,
    mode: body.mode,
    difficulty: body.difficulty ?? null,
    city: body.city ?? null,
    profile: body.profile ?? null,
    rating_delta: body.ratingDelta ?? 0,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sb = admin();
  if (!sb) return NextResponse.json({ games: [] });
  const userId = req.nextUrl.searchParams.get('userId');
  const q = sb.from('games').select('*').order('created_at', { ascending: false }).limit(50);
  if (userId) q.eq('user_id', userId);
  const { data } = await q;
  return NextResponse.json({ games: data ?? [] });
}
