import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://djyephboyfoglucmcopn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVwaGJveWZvZ2x1Y21jb3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODg2OTYsImV4cCI6MjEwMjQ2NDY5Nn0.5SL4QSdQ0LPCw4wCsiy2JxTlxtxpYhGq21tghdaNOuE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log('======================================================================');
  console.log('CHECKING SUPABASE DATABASE TABLES');
  console.log('======================================================================');

  // 1. Check ambulances table
  console.log('\n--- Query 1: SELECT * FROM public.ambulances LIMIT 5 ---');
  const { data: ambulances, error: ambErr } = await supabase.from('ambulances').select('*').limit(5);
  if (ambErr) {
    console.error('ERROR querying ambulances:', ambErr);
  } else {
    console.log('AMBULANCES RAW DATA (Count:', ambulances?.length, '):');
    console.log(JSON.stringify(ambulances, null, 2));
  }

  // 2. Check hospitals table
  console.log('\n--- Query 2: SELECT * FROM public.hospitals LIMIT 5 ---');
  const { data: hospitals, error: hospErr } = await supabase.from('hospitals').select('*').limit(5);
  if (hospErr) {
    console.error('ERROR querying hospitals:', hospErr);
  } else {
    console.log('HOSPITALS RAW DATA (Count:', hospitals?.length, '):');
    console.log(JSON.stringify(hospitals, null, 2));
  }

  // 3. Check incidents table
  console.log('\n--- Query 3: SELECT * FROM public.incidents LIMIT 5 ---');
  const { data: incidents, error: incErr } = await supabase.from('incidents').select('*').limit(5);
  if (incErr) {
    console.error('ERROR querying incidents:', incErr);
  } else {
    console.log('INCIDENTS RAW DATA (Count:', incidents?.length, '):');
    console.log(JSON.stringify(incidents, null, 2));
  }
}

checkDatabase();
