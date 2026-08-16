import pg from 'pg';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const connectionString = 'postgresql://postgres:Vinay@776742@db.djyephboyfoglucmcopn.supabase.co:5432/postgres';
const supabaseUrl = 'https://djyephboyfoglucmcopn.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVwaGJveWZvZ2x1Y21jb3BuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg4ODY5NiwiZXhwIjoyMTAyNDY0Njk2fQ.94ziNvn8ab0mubXMPcMyahqWdi_BFNzziLRY2Y1rKp4';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVwaGJveWZvZ2x1Y21jb3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODg2OTYsImV4cCI6MjEwMjQ2NDY5Nn0.5SL4QSdQ0LPCw4wCsiy2JxTlxtxpYhGq21tghdaNOuE';

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anonSupabase = createClient(supabaseUrl, anonKey);

async function run() {
  console.log('======================================================================');
  console.log('STEP 1: APPLYING POSTGRESQL MIGRATION');
  console.log('======================================================================');

  await client.connect();
  const sql = fs.readFileSync('./supabase/migrations/20260816_init_cad_schema.sql', 'utf8');
  await client.query(sql);
  console.log('✅ Migration executed successfully on PostgreSQL!');

  console.log('\n======================================================================');
  console.log('STEP 2: RUNNING 5-POINT PHASE 1 VERIFICATION TESTS');
  console.log('======================================================================');

  // Test 1: INSERT incident with assigned ambulance
  console.log('\n--- TEST 1: INSERT Incident with assigned ambulance (AMB-001) ---');
  await client.query(`
    INSERT INTO public.incidents (
      id, incident_type, severity, status, location_address, location_lat, location_lng, assigned_ambulance_id
    ) VALUES (
      'TEST-INC-001', 'Cardiac Arrest', 'CRITICAL', 'PENDING', 'Palace Grounds, Jayamahal', 12.9982, 77.5921, 'AMB-001'
    ) ON CONFLICT (id) DO UPDATE SET assigned_ambulance_id = 'AMB-001', status = 'PENDING';
  `);
  const res1 = await client.query(`SELECT id, call_sign, status, assigned_incident_id, destination FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 1 RAW RESULT:', JSON.stringify(res1.rows, null, 2));

  // Test 2: Lifecycle progression
  console.log('\n--- TEST 2a: UPDATE status -> EN_ROUTE_TO_SCENE ---');
  await client.query(`UPDATE public.incidents SET status = 'EN_ROUTE_TO_SCENE' WHERE id = 'TEST-INC-001';`);
  const res2a = await client.query(`SELECT id, call_sign, status, assigned_incident_id FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 2a RAW RESULT:', JSON.stringify(res2a.rows, null, 2));

  console.log('\n--- TEST 2b: UPDATE status -> ON_SCENE ---');
  await client.query(`UPDATE public.incidents SET status = 'ON_SCENE' WHERE id = 'TEST-INC-001';`);
  const res2b = await client.query(`SELECT id, call_sign, status, assigned_incident_id FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 2b RAW RESULT:', JSON.stringify(res2b.rows, null, 2));

  console.log('\n--- TEST 2c: UPDATE status -> TRANSPORTING_TO_HOSPITAL ---');
  await client.query(`UPDATE public.incidents SET status = 'TRANSPORTING_TO_HOSPITAL' WHERE id = 'TEST-INC-001';`);
  const res2c = await client.query(`SELECT id, call_sign, status, assigned_incident_id FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 2c RAW RESULT:', JSON.stringify(res2c.rows, null, 2));

  // Test 3: Update assigned_hospital_id independently (Condition C)
  console.log('\n--- TEST 3: UPDATE assigned_hospital_id independently of status (Condition C) ---');
  await client.query(`UPDATE public.incidents SET assigned_hospital_id = 'H-001' WHERE id = 'TEST-INC-001';`);
  const res3 = await client.query(`SELECT id, call_sign, status, destination FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 3 RAW RESULT:', JSON.stringify(res3.rows, null, 2));

  // Test 4: Update status to RESOLVED
  console.log('\n--- TEST 4: UPDATE status -> RESOLVED (Closes loop back to AVAILABLE) ---');
  await client.query(`UPDATE public.incidents SET status = 'RESOLVED', resolved_at = NOW() WHERE id = 'TEST-INC-001';`);
  const res4 = await client.query(`SELECT id, call_sign, status, assigned_incident_id, destination FROM public.ambulances WHERE id = 'AMB-001';`);
  console.log('TEST 4 RAW RESULT:', JSON.stringify(res4.rows, null, 2));

  // Test 5: Real Driver Session trigger rejection test
  console.log('\n--- TEST 5: Security trigger check (Simulated Authenticated Driver Session) ---');
  let test5Passed = false;
  let test5Message = '';
  try {
    await client.query(`
      DO $$
      DECLARE
        v_test_driver_id UUID := '00000000-0000-0000-0000-000000000001';
      BEGIN
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (v_test_driver_id, 'test.driver@cad.emergency.in', 'Test Driver', 'DRIVER')
        ON CONFLICT (id) DO UPDATE SET role = 'DRIVER';

        INSERT INTO public.incidents (id, incident_type, severity, status, location_address, location_lat, location_lng, assigned_ambulance_id)
        VALUES ('TEST-INC-SEC', 'Cardiac Arrest', 'CRITICAL', 'ASSIGNED', 'MG Road', 12.9756, 77.6066, 'AMB-001')
        ON CONFLICT (id) DO NOTHING;

        -- Set simulated Supabase JWT Claims for driver role
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_driver_id::text, 'role', 'authenticated')::text, true);

        -- Attempt illegal update
        UPDATE public.incidents SET severity = 'LOW' WHERE id = 'TEST-INC-SEC';
      END $$;
    `);
  } catch (err) {
    test5Passed = err.message.includes('Drivers are only permitted to update incident lifecycle status');
    test5Message = err.message;
  }
  console.log('TEST 5 RAW RESULT: Passed =', test5Passed, '| Output Message =', test5Message);

  // Cleanup test records
  await client.query(`
    DELETE FROM public.incidents WHERE id IN ('TEST-INC-001', 'TEST-INC-SEC');
    DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.ambulances SET status = 'AVAILABLE', assigned_incident_id = NULL, destination = NULL WHERE id IN ('AMB-001', 'AMB-002');
  `);

  console.log('\n======================================================================');
  console.log('STEP 3: PHASE 2 PROGRAMMATIC AUTH & RLS ENFORCEMENT TESTING');
  console.log('======================================================================');

  // Create real test users in Supabase Auth via Admin API
  const dispatcherEmail = 'dispatcher@cad.emergency.in';
  const driverEmail = 'driver.alpha1@cad.emergency.in';
  const password = 'Emergency@123';

  // 1. Create or ensure Dispatcher user
  const { data: dispUser, error: dErr } = await adminSupabase.auth.admin.createUser({
    email: dispatcherEmail,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: 'Chief Dispatcher', role: 'DISPATCHER' }
  }).catch(() => ({ data: null }));

  // Upsert profile for dispatcher
  if (dispUser?.user?.id) {
    await adminSupabase.from('profiles').upsert({
      id: dispUser.user.id,
      email: dispatcherEmail,
      full_name: 'Chief Dispatcher',
      role: 'DISPATCHER'
    });
  }

  // 2. Create or ensure Driver user
  const { data: drvUser, error: drvErr } = await adminSupabase.auth.admin.createUser({
    email: driverEmail,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: 'Rajesh Kumar (Alpha-1)', role: 'DRIVER' }
  }).catch(() => ({ data: null }));

  if (drvUser?.user?.id) {
    await adminSupabase.from('profiles').upsert({
      id: drvUser.user.id,
      email: driverEmail,
      full_name: 'Rajesh Kumar',
      role: 'DRIVER'
    });

    // Bind driver to AMB-001
    await adminSupabase.from('ambulances').update({ assigned_driver_id: drvUser.user.id }).eq('id', 'AMB-001');
  }

  // 3. Test sign in as Dispatcher via client SDK
  console.log('\n--- AUTH TEST 1: Client Sign in as Dispatcher ---');
  const dispClient = createClient(supabaseUrl, anonKey);
  const { data: dispSession, error: dispSignErr } = await dispClient.auth.signInWithPassword({
    email: dispatcherEmail,
    password: password,
  });

  if (dispSignErr) {
    console.error('Dispatcher Sign In Error:', dispSignErr);
  } else {
    const { data: dispProf } = await dispClient.from('profiles').select('*').eq('id', dispSession.user.id).single();
    console.log('DISPATCHER AUTH SESSION RAW:', {
      userId: dispSession.user.id,
      email: dispSession.user.email,
      roleInProfile: dispProf.role,
      fullName: dispProf.full_name
    });
  }

  // 4. Test sign in as Driver via client SDK
  console.log('\n--- AUTH TEST 2: Client Sign in as Driver (Alpha-1) ---');
  const drvClient = createClient(supabaseUrl, anonKey);
  const { data: drvSession, error: drvSignErr } = await drvClient.auth.signInWithPassword({
    email: driverEmail,
    password: password,
  });

  if (drvSignErr) {
    console.error('Driver Sign In Error:', drvSignErr);
  } else {
    const { data: drvProf } = await drvClient.from('profiles').select('*').eq('id', drvSession.user.id).single();
    const { data: drvAmb } = await drvClient.from('ambulances').select('*').eq('assigned_driver_id', drvSession.user.id).single();
    console.log('DRIVER AUTH SESSION RAW:', {
      userId: drvSession.user.id,
      email: drvSession.user.email,
      roleInProfile: drvProf?.role,
      assignedAmbulanceId: drvAmb?.id,
      assignedAmbulanceCallSign: drvAmb?.call_sign
    });

    // 5. Test RLS Isolation: Driver attempting to modify another ambulance (e.g. AMB-002)
    console.log('\n--- AUTH TEST 3: RLS Isolation Test (Driver updating unauthorized AMB-002) ---');
    const { data: illegalUpdate, error: rlsErr } = await drvClient
      .from('ambulances')
      .update({ status: 'MAINTENANCE' })
      .eq('id', 'AMB-002')
      .select();

    console.log('DRIVER RLS UPDATE ATTEMPT ON AMB-002 RAW RESULT:', {
      updatedRows: illegalUpdate?.length || 0,
      error: rlsErr ? rlsErr.message : 'Blocked by RLS (0 rows updated)'
    });
  }

  await client.end();
}

run().catch(console.error);
