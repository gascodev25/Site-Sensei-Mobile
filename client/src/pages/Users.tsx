
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Layout/Header";
import { DataTable } from "@/components/Tables/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Users, Shield, Edit2, UserPlus } from "lucide-react";
import { canCreateUser } from "@/lib/permissions";
import type { User } from "@shared/schema";

const AVAILABLE_ROLES = [
  { value: "super_user", label: "Super User", description: "Full system access" },
  { value: "general_manager", label: "General Manager", description: "High-level management access" },
  { value: "ops_manager", label: "Operations Manager", description: "Operational management access" },
  { value: "admin", label: "Administrator", description: "Administrative access" },
  { value: "warehouse_clerk", label: "Warehouse Clerk", description: "Inventory management access" },
  { value: "team_member", label: "Team Member", description: "Basic field access" },
];

interface UserWithDetails extends User {
  rolesList: string[];
}

export default function UsersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Check permissions
  const hasUserManagementPermission = user && canCreateUser(user);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: hasUserManagementPermission,
  });

  const updateUserRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roles: roles.join(",") }),
      });
      if (!response.ok) throw new Error("Failed to update user roles");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User roles updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!hasUserManagementPermission) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Denied</h3>
              <p className="text-muted-foreground text-center">
                You don't have permission to manage users. Only Super Users and General Managers can access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const transformedUsers: UserWithDetails[] = users.map((user: User) => ({
    ...user,
    rolesList: user.roles ? user.roles.split(",").filter(Boolean) : ["team_member"],
  }));

  const columns = [
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }: { row: { original: UserWithDetails } }) => (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {row.original.firstName?.[0] || row.original.email?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
          <div>
            <div className="font-medium">
              {row.original.firstName && row.original.lastName
                ? `${row.original.firstName} ${row.original.lastName}`
                : row.original.email
              }
            </div>
            {row.original.firstName && (
              <div className="text-sm text-muted-foreground">{row.original.email}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "roles",
      header: "Roles",
      cell: ({ row }: { row: { original: UserWithDetails } }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.rolesList.map((role) => {
            const roleInfo = AVAILABLE_ROLES.find(r => r.value === role);
            return (
              <Badge
                key={role}
                variant={role === "super_user" ? "destructive" : role === "general_manager" ? "default" : "secondary"}
                className="text-xs"
              >
                {roleInfo?.label || role}
              </Badge>
            );
          })}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }: { row: { original: UserWithDetails } }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: UserWithDetails } }) => (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingUser(row.original);
                setSelectedRoles(row.original.rolesList);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">User</Label>
                <div className="mt-1 text-sm text-muted-foreground">
                  {editingUser?.firstName && editingUser?.lastName
                    ? `${editingUser.firstName} ${editingUser.lastName}`
                    : editingUser?.email
                  }
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Roles</Label>
                <div className="space-y-2">
                  {AVAILABLE_ROLES.map((role) => (
                    <div key={role.value} className="flex items-start space-x-2">
                      <Checkbox
                        id={role.value}
                        checked={selectedRoles.includes(role.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role.value]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role.value));
                          }
                        }}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={role.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {role.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingUser(null);
                    setSelectedRoles([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingUser && selectedRoles.length > 0) {
                      updateUserRolesMutation.mutate({
                        userId: editingUser.id,
                        roles: selectedRoles,
                      });
                    }
                  }}
                  disabled={selectedRoles.length === 0 || updateUserRolesMutation.isPending}
                >
                  {updateUserRolesMutation.isPending ? "Updating..." : "Update Roles"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage user roles and permissions across the system
            </p>
          </div>
        </div>

        {/* Role Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {AVAILABLE_ROLES.slice(0, 3).map((role) => {
            const userCount = transformedUsers.filter(u => u.rolesList.includes(role.value)).length;
            return (
              <Card key={role.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {role.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userCount}</div>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage user roles and permissions. Changes are logged for audit purposes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={transformedUsers}
              searchable={true}
              searchPlaceholder="Search users..."
              loading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
