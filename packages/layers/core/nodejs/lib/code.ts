export enum CustomCode {
  // AUTH
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  // FILE
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_UPLOAD_COMPLETED = 'FILE_UPLOAD_COMPLETED',
  FILE_UPLOAD_ABORTED = 'FILE_UPLOAD_ABORTED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_CONTENT_NOT_FOUND = 'FILE_CONTENT_NOT_FOUND',
  FILE_CONTENT_DELETED = 'FILE_CONTENT_DELETED',
  FILE_NAME_INVALID = 'FILE_NAME_INVALID',
  FILE_RETRIEVED = 'FILE_RETRIEVED',
  FILE_CONFLICT_RETRIEVED = 'FILE_CONFLICT_RETRIEVED',
  FILE_CONFLICT_RESOLVED = 'FILE_CONFLICT_RESOLVED',
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  FILE_SIZE_INVALID = 'FILE_SIZE_INVALID',
  // HIERARCHY
  HIERARCHY_DUPLICATED = 'HIERARCHY_DUPLICATED',
  HIERARCHY_NOT_FOUND = 'HIERARCHY_NOT_FOUND',
  HIERARCHY_PARENT_NOT_FOUND = 'HIERARCHY_PARENT_NOT_FOUND',
  HIERARCHY_CREATED = 'HIERARCHY_CREATED',
  HIERARCHY_BATCH_CREATED = 'HIERARCHY_BATCH_CREATED',
  HIERARCHY_RENAMED = 'HIERARCHY_RENAMED',
  HIERARCHY_RETRIEVED = 'HIERARCHY_RETRIEVED',
  HIERARCHY_DELETED = 'HIERARCHY_DELETED',
  HIERARCHY_RECOVERED = 'HIERARCHY_RECOVERED',
  HIERARCHY_PERMANENTLY_DELETED = 'HIERARCHY_PERMANENTLY_DELETED',
  HIERARCHY_LIST_SHARED_RETRIEVED = 'HIERARCHY_LIST_SHARED_RETRIEVED',
  HIERARCHY_LIST_TRASHED_RETRIEVED = 'HIERARCHY_LIST_TRASHED_RETRIEVED',
  HIERARCHY_LIST_OWNER_RETRIEVED = 'HIERARCHY_LIST_OWNER_RETRIEVED',
  HIERARCHY_REQUIRES_SYNC = 'HIERARCHY_REQUIRES_SYNC',
  // USER
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_RECOVERED = 'USER_RECOVERED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ACTIVE = 'USER_ACTIVE',
  USER_RETRIEVED = 'USER_RETRIEVED',
  USER_PENDING_DELETION = 'USER_PENDING_DELETION',
  USER_HISTORY_RETRIEVED = 'USER_HISTORY_RETRIEVED',
  USER_MIGRATION_UPDATED = 'USER_MIGRATION_UPDATED',
  USER_PLAN_NOT_FOUND = 'USER_PLAN_NOT_FOUND',
  USER_PLAN_RETRIEVED = 'USER_PLAN_RETRIEVED',
  USER_PLAN_HISTORY_RETRIEVED = 'USER_PLAN_HISTORY_RETRIEVED',
  // PRESET
  PRESET_LIST_RETRIEVED = 'PRESET_LIST_RETRIEVED',
  PRESET_CREATE_FAILED = 'PRESET_CREATE_FAILED',
  // POLLING
  POLLING_SUCCESS = 'POLLING_SUCCESS',
  POLLING_FAILED = 'POLLING_FAILED',
  // PLAN
  PLAN_RETRIEVED = 'PLAN_RETRIEVED',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  PLANS_RETRIEVED = 'PLANS_RETRIEVED',
}