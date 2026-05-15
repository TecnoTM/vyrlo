import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hwljppemlwhdszdrcfdo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9aSJdEJ7oqbBB3yD7Hbusg_Nhpmq327';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);