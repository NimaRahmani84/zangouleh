const SUPABASE_URL = 'https://pngxtenvsihhuovxsdlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_86o4_QdgGc8kAa-jHjVkCQ_EQeV_QH3';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
