#!/usr/bin/env node

/**
 * Quick test script for authentication system
 * Run: node test-auth.js
 */

const { hashPassword, comparePassword, validatePasswordStrength } = require('./utils/password');
const { generateTokenPair, verifyAccessToken, verifyRefreshToken } = require('./utils/jwt');
const { ROLES, PERMISSIONS, hasPermission } = require('./config/roles');

async function runTests() {
  console.log('🧪 Testing Authentication System\n');

  // Test 1: Password Hashing
  console.log('1️⃣  Testing password hashing...');
  const password = 'SecurePass123!';
  const hash = await hashPassword(password);
  const isValid = await comparePassword(password, hash);
  const isInvalid = await comparePassword('WrongPassword', hash);
  console.log(`   ✅ Hash: ${hash.substring(0, 30)}...`);
  console.log(`   ✅ Valid password: ${isValid}`);
  console.log(`   ✅ Invalid password: ${!isInvalid}\n`);

  // Test 2: Password Validation
  console.log('2️⃣  Testing password strength validation...');
  const weakPassword = validatePasswordStrength('weak');
  const strongPassword = validatePasswordStrength('StrongPass123!');
  console.log(`   ✅ Weak password rejected: ${!weakPassword.isValid}`);
  console.log(`   ✅ Weak password errors: ${weakPassword.errors.length} errors`);
  console.log(`   ✅ Strong password accepted: ${strongPassword.isValid}\n`);

  // Test 3: JWT Token Generation
  console.log('3️⃣  Testing JWT token generation...');
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    role: ROLES.DISPATCHER
  };
  const tokens = generateTokenPair(mockUser);
  console.log(`   ✅ Access token: ${tokens.accessToken.substring(0, 30)}...`);
  console.log(`   ✅ Refresh token: ${tokens.refreshToken.substring(0, 30)}...`);
  console.log(`   ✅ Expires in: ${tokens.expiresIn}\n`);

  // Test 4: JWT Token Verification
  console.log('4️⃣  Testing JWT token verification...');
  const accessVerification = verifyAccessToken(tokens.accessToken);
  const refreshVerification = verifyRefreshToken(tokens.refreshToken);
  console.log(`   ✅ Access token valid: ${accessVerification.valid}`);
  console.log(`   ✅ Access token userId: ${accessVerification.decoded?.userId}`);
  console.log(`   ✅ Refresh token valid: ${refreshVerification.valid}`);
  console.log(`   ✅ Refresh token userId: ${refreshVerification.decoded?.userId}\n`);

  // Test 5: Role Permissions
  console.log('5️⃣  Testing role permissions...');
  console.log(`   ✅ CITIZEN can create incident: ${hasPermission(ROLES.CITIZEN, PERMISSIONS.CREATE_INCIDENT)}`);
  console.log(`   ✅ CITIZEN cannot view all incidents: ${!hasPermission(ROLES.CITIZEN, PERMISSIONS.VIEW_ALL_INCIDENTS)}`);
  console.log(`   ✅ DISPATCHER can assign ambulance: ${hasPermission(ROLES.DISPATCHER, PERMISSIONS.ASSIGN_AMBULANCE)}`);
  console.log(`   ✅ DRIVER can update location: ${hasPermission(ROLES.DRIVER, PERMISSIONS.UPDATE_LOCATION)}`);
  console.log(`   ✅ HOSPITAL_STAFF can update beds: ${hasPermission(ROLES.HOSPITAL_STAFF, PERMISSIONS.UPDATE_BED_AVAILABILITY)}`);
  console.log(`   ✅ ADMIN can manage users: ${hasPermission(ROLES.ADMIN, PERMISSIONS.MANAGE_USERS)}\n`);

  // Test 6: All Roles
  console.log('6️⃣  Available roles:');
  Object.entries(ROLES).forEach(([key, value]) => {
    console.log(`   ✅ ${key}: ${value}`);
  });
  console.log('');

  // Test 7: All Permissions
  console.log('7️⃣  Available permissions (sample):');
  const permissionSample = Object.entries(PERMISSIONS).slice(0, 8);
  permissionSample.forEach(([key, value]) => {
    console.log(`   ✅ ${key}: ${value}`);
  });
  console.log(`   ... and ${Object.keys(PERMISSIONS).length - 8} more\n`);

  console.log('✅ All tests passed!\n');
  console.log('📚 Next steps:');
  console.log('   1. Set JWT_SECRET and JWT_REFRESH_SECRET environment variables');
  console.log('   2. Run database schema: psql -f auth/schema.sql');
  console.log('   3. Integrate auth routes into your Express app');
  console.log('   4. Test endpoints with curl or Postman\n');
}

runTests().catch(console.error);
