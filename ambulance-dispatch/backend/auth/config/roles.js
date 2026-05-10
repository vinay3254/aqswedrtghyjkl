const ROLES = {
  CITIZEN: 'CITIZEN',
  DISPATCHER: 'DISPATCHER',
  DRIVER: 'DRIVER',
  HOSPITAL_STAFF: 'HOSPITAL_STAFF',
  ADMIN: 'ADMIN'
};

const PERMISSIONS = {
  // Incident permissions
  CREATE_INCIDENT: 'create_incident',
  VIEW_OWN_INCIDENT: 'view_own_incident',
  VIEW_ALL_INCIDENTS: 'view_all_incidents',
  UPDATE_INCIDENT: 'update_incident',
  DELETE_INCIDENT: 'delete_incident',
  
  // Ambulance permissions
  VIEW_AMBULANCES: 'view_ambulances',
  ASSIGN_AMBULANCE: 'assign_ambulance',
  UPDATE_AMBULANCE_STATUS: 'update_ambulance_status',
  OVERRIDE_ASSIGNMENT: 'override_assignment',
  
  // Driver permissions
  VIEW_OWN_ASSIGNMENTS: 'view_own_assignments',
  UPDATE_LOCATION: 'update_location',
  UPDATE_DRIVER_STATUS: 'update_driver_status',
  
  // Hospital permissions
  VIEW_INCOMING_PATIENTS: 'view_incoming_patients',
  UPDATE_BED_AVAILABILITY: 'update_bed_availability',
  CONFIRM_ARRIVAL: 'confirm_arrival',
  
  // User management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  
  // System permissions
  VIEW_ANALYTICS: 'view_analytics',
  SYSTEM_CONFIG: 'system_config'
};

const ROLE_PERMISSIONS = {
  [ROLES.CITIZEN]: [
    PERMISSIONS.CREATE_INCIDENT,
    PERMISSIONS.VIEW_OWN_INCIDENT
  ],
  
  [ROLES.DISPATCHER]: [
    PERMISSIONS.VIEW_ALL_INCIDENTS,
    PERMISSIONS.UPDATE_INCIDENT,
    PERMISSIONS.VIEW_AMBULANCES,
    PERMISSIONS.ASSIGN_AMBULANCE,
    PERMISSIONS.OVERRIDE_ASSIGNMENT,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_INCOMING_PATIENTS
  ],
  
  [ROLES.DRIVER]: [
    PERMISSIONS.VIEW_OWN_ASSIGNMENTS,
    PERMISSIONS.UPDATE_LOCATION,
    PERMISSIONS.UPDATE_DRIVER_STATUS,
    PERMISSIONS.UPDATE_AMBULANCE_STATUS
  ],
  
  [ROLES.HOSPITAL_STAFF]: [
    PERMISSIONS.VIEW_INCOMING_PATIENTS,
    PERMISSIONS.UPDATE_BED_AVAILABILITY,
    PERMISSIONS.CONFIRM_ARRIVAL,
    PERMISSIONS.VIEW_AMBULANCES
  ],
  
  [ROLES.ADMIN]: Object.values(PERMISSIONS)
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.DISPATCHER]: 3,
  [ROLES.HOSPITAL_STAFF]: 2,
  [ROLES.DRIVER]: 1,
  [ROLES.CITIZEN]: 0
};

function hasPermission(role, permission) {
  if (!ROLE_PERMISSIONS[role]) {
    return false;
  }
  return ROLE_PERMISSIONS[role].includes(permission);
}

function hasAnyPermission(role, permissions) {
  return permissions.some(permission => hasPermission(role, permission));
}

function hasAllPermissions(role, permissions) {
  return permissions.every(permission => hasPermission(role, permission));
}

function isRoleHigherOrEqual(userRole, requiredRole) {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isRoleHigherOrEqual
};
