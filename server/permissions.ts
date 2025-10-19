import type { User } from "@shared/schema";
import type { RequestHandler } from "express";

export type Role = "superuser" | "manager" | "user";

export interface PermissionCheck {
  canManageUsers: boolean;
  canCreateServices: boolean;
  canManageTeams: boolean;
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageClients: boolean;
}

export function getUserRoles(user: any): Role[] {
  const rolesString = user?.roles || user?.claims?.roles || 'user';
  return rolesString.split(',').map((r: string) => r.trim()) as Role[];
}

export function hasRole(user: any, role: Role): boolean {
  const roles = getUserRoles(user);
  return roles.includes(role);
}

export function hasAnyRole(user: any, allowedRoles: Role[]): boolean {
  const roles = getUserRoles(user);
  return allowedRoles.some(role => roles.includes(role));
}

export function getPermissions(user: any): PermissionCheck {
  const roles = getUserRoles(user);
  const isSuperuser = roles.includes('superuser');
  const isManager = roles.includes('manager');

  return {
    canManageUsers: isSuperuser || isManager,
    canCreateServices: true, // All users can create services
    canManageTeams: isSuperuser || isManager,
    canManageInventory: isSuperuser || isManager,
    canViewReports: true, // All users can view reports
    canManageClients: true, // All users can manage clients
  };
}

// Middleware to check if user has specific role
export function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user as any;
    if (!hasAnyRole(user, allowedRoles)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Middleware to check if user has permission for specific action
export function requirePermission(
  checkPermission: (permissions: PermissionCheck) => boolean
): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user as any;
    const permissions = getPermissions(user);

    if (!checkPermission(permissions)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}
