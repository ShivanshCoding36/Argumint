import { createClient } from '@supabase/supabase-js';

// Best practice: use Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
console.log(supabaseUrl,supabaseKey);
export const supabase = createClient(supabaseUrl, supabaseKey);
