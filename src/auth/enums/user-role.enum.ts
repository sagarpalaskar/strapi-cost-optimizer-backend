/**
 * User Role Enum
 * Defines the available user roles in the system
 */
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  AUTHOR = 'author',
  VIEWER = 'viewer',
}

/**
 * Array of all valid role values
 */
export const USER_ROLES = Object.values(UserRole);

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.EDITOR]: 'Editor',
    [UserRole.AUTHOR]: 'Author',
    [UserRole.VIEWER]: 'Viewer',
  };
  return roleMap[role?.toLowerCase()] || role || 'Viewer';
}

