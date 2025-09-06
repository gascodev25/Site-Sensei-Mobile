export type Role = 
  | "super_user" 
  | "general_manager" 
  | "ops_manager" 
  | "admin" 
  | "warehouse_clerk" 
  | "team_member";

export interface User {
  roles: string;
}

export function hasRole(user: User, role: Role): boolean {
  return user.roles.split(",").includes(role);
}

export function canCreateUser(user: User): boolean {
  return hasRole(user, "super_user") || hasRole(user, "general_manager");
}

export function canEditStock(user: User): boolean {
  return hasRole(user, "warehouse_clerk") || 
         hasRole(user, "ops_manager") || 
         hasRole(user, "super_user");
}

export function canMarkComplete(user: User): boolean {
  return hasRole(user, "ops_manager") || hasRole(user, "team_member");
}

export function canManageClients(user: User): boolean {
  return hasRole(user, "admin") || 
         hasRole(user, "ops_manager") || 
         hasRole(user, "super_user");
}

export function canViewReports(user: User): boolean {
  return hasRole(user, "ops_manager") || 
         hasRole(user, "general_manager") || 
         hasRole(user, "super_user");
}

export function canManageTeams(user: User): boolean {
  return hasRole(user, "ops_manager") || 
         hasRole(user, "general_manager") || 
         hasRole(user, "super_user");
}
