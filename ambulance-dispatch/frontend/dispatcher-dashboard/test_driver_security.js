import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://djyephboyfoglucmcopn.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVwaGJveWZvZ2x1Y21jb3BuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODg2OTYsImV4cCI6MjEwMjQ2NDY5Nn0.5SL4QSdQ0LPCw4wCsiy2JxTlxtxpYhGq21tghdaNOuE';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWVwaGJveWZvZ2x1Y21jb3BuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg4ODY5NiwiZXhwIjoyMTAyNDY0Njk2fQ.94ziNvn8ab0mubXMPcMyahqWdi_BFNzziLRY2Y1rKp4';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const driverClient = createClient(supabaseUrl, anonKey);

async function runDriverSecurityTest() {
  console.log('======================================================================');
  console.log('TEST 5: REAL AUTHENTICATED DRIVER SESSION MUTATION REJECTION TEST');
  console.log('======================================================================');

  // 1. Sign in as real driver
  const { data: sessionData, error: authErr } = await driverClient.auth.signInWithPassword({
    email: 'driver.alpha1@cad.emergency.in',
    password: 'Emergency@123',
  });

  if (authErr) {
    console.error('Driver authentication failed:', authErr);
    return;
  }

  console.log('1. Logged in as real driver:', sessionData.user.email, '(ID:', sessionData.user.id, ')');

  // 2. Admin creates an incident assigned to AMB-001 (driver's vehicle)
  await adminSupabase.from('incidents').upsert({
    id: 'INC-SEC-TEST',
    incident_type: 'Cardiac Arrest',
    severity: 'CRITICAL',
    status: 'ASSIGNED',
    location_address: 'Palace Grounds, Jayamahal',
    location_lat: 12.9982,
    location_lng: 77.5921,
    assigned_ambulance_id: 'AMB-001',
  });
  console.log('2. Incident INC-SEC-TEST created and assigned to AMB-001');

  // 3. Driver attempts legal update: advance status to EN_ROUTE_TO_SCENE
  console.log('\n--- 3a. Driver performs legal update: status -> EN_ROUTE_TO_SCENE ---');
  const { data: legalData, error: legalErr } = await driverClient
    .from('incidents')
    .update({ status: 'EN_ROUTE_TO_SCENE' })
    .eq('id', 'INC-SEC-TEST')
    .select();

  console.log('Legal Update Result:', {
    success: !legalErr,
    updatedRows: legalData?.length || 0,
    newStatus: legalData?.[0]?.status,
    error: legalErr?.message
  });

  // 4. Driver attempts ILLEGAL update: tamper with protected column 'severity'
  console.log('\n--- 3b. Driver performs ILLEGAL update: modify protected column severity to LOW ---');
  const { data: illegalData, error: illegalErr } = await driverClient
    .from('incidents')
    .update({ severity: 'LOW' })
    .eq('id', 'INC-SEC-TEST')
    .select();

  console.log('Illegal Severity Update Result:', {
    blocked: !!illegalErr,
    errorMessage: illegalErr ? illegalErr.message : 'UNEXPECTED: Modification was allowed!',
    details: illegalErr?.details,
    hint: illegalErr?.hint,
    code: illegalErr?.code
  });

  // 5. Driver attempts ILLEGAL update: tamper with protected column 'location_address'
  console.log('\n--- 3c. Driver performs ILLEGAL update: modify protected column location_address ---');
  const { data: locData, error: locErr } = await driverClient
    .from('incidents')
    .update({ location_address: 'Tampered Location Road' })
    .eq('id', 'INC-SEC-TEST')
    .select();

  console.log('Illegal Location Update Result:', {
    blocked: !!locErr,
    errorMessage: locErr ? locErr.message : 'UNEXPECTED: Modification was allowed!',
  });

  // Cleanup
  await adminSupabase.from('incidents').delete().eq('id', 'INC-SEC-TEST');
  await adminSupabase.from('ambulances').update({ status: 'AVAILABLE', assigned_incident_id: null, destination: null }).eq('id', 'AMB-001');
  console.log('\n✅ Test complete and cleanup finished.');
}

runDriverSecurityTest().catch(console.error);
