import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { canCreateUser, hasRole, type Role } from "@/lib/permissions";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit, Users as UsersIcon, User as UserIcon, Mail, Shield, Clock } from "lucide-react";
import type { User } from "@shared/schema";
import { z } from "zod";

interface UserWithDetails extends User {
  displayName?: string;
  roleList?: Role[];
}

const availableRoles: { value: Role; label: string; description: string }[] = [
  { value: "super_user", label: "Super User", description: "Full access to everything" },
  { value: "general_manager", label: "General Manager", description: "Full access, can create users" },
  { value: "ops_manager", label: "Operations Manager", description: "Manage services, teams, contracts" },
  { value: "admin", label: "Admin", description: "Manage clients, equipment, CSV uploads" },
  { value: "warehouse_clerk", label: "Warehouse Clerk", description: "View/adjust stock, return items" },
  { value: "team_member", label: "Team Member", description: "View services, mark complete, check-in/out" },
];

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Check if current user can manage users
  const canManageUsers = currentUser ? canCreateUser(currentUser) : false;

  // Redirect or show error if user doesn't have permission
  if (!canManageUsers) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Denied</h3>
              <p className="text-muted-foreground text-center">
                You don't have permission to manage users. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Data queries
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Transform users data
  const usersWithDetails: UserWithDetails[] = users.map(user => ({
    ...user,
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
    roleList: user.roles ? user.roles.split(',').filter(Boolean) as Role[] : ['team_member' as Role],
  }));

  // Filter users based on search
  const filteredUsers = usersWithDetails.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.roles?.toLowerCase().includes(searchLower)
    );
  });

  // Form schema for editing user roles
  const userRolesSchema = z.object({
    roles: z.array(z.string()).min(1, "User must have at least one role"),
  });

  // Form for editing user roles
  const userRolesForm = useForm<z.infer<typeof userRolesSchema>>({
    resolver: zodResolver(userRolesSchema),
    defaultValues: { roles: [] },
  });

  // Mutation for updating user roles
  const updateUserRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      return await apiRequest("PUT", `/api/users/${userId}/roles`, { roles: roles.join(',') });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User roles updated successfully" });
      setEditingUser(null);
      userRolesForm.reset();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handle edit user roles
  const handleEditUser = (user: UserWithDetails) => {
    setEditingUser(user);
    userRolesForm.reset({
      roles: user.roleList || ['team_member'],
    });
  };

  // Handle role update form submission
  const handleUpdateRoles = (data: z.infer<typeof userRolesSchema>) => {
    if (!editingUser) return;
    
    updateUserRolesMutation.mutate({
      userId: editingUser.id,
      roles: data.roles,
    });
  };

  // Get role badge color
  const getRoleBadgeColor = (role: Role) => {
    const colors = {
      super_user: "bg-purple-100 text-purple-800",
      general_manager: "bg-blue-100 text-blue-800",
      ops_manager: "bg-green-100 text-green-800",
      admin: "bg-orange-100 text-orange-800",
      warehouse_clerk: "bg-yellow-100 text-yellow-800",
      team_member: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage user accounts and role assignments for your organization.</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="input-search-users"
                />
              </div>
            </div>
          </div>

          <TabsContent value="users" className="space-y-6">
            {usersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No users found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "No users are currently registered"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="hover:shadow-md transition-shadow" data-testid={`card-user-${user.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center">
                            <UserIcon className="h-5 w-5 mr-2" />
                            {user.displayName}
                          </CardTitle>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            <span>{user.email || 'No email'}</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <span className="font-medium text-sm">Roles:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.roleList?.map((role) => (
                              <Badge
                                key={role}
                                className={getRoleBadgeColor(role)}
                                data-testid={`badge-role-${role}`}
                              >
                                {availableRoles.find(r => r.value === role)?.label || role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {user.createdAt && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit User Roles Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <Form {...userRolesForm}>
                <form onSubmit={userRolesForm.handleSubmit(handleUpdateRoles)} className="space-y-4">
                  <div className="mb-4">
                    <h4 className="font-medium">{editingUser.displayName}</h4>
                    <p className="text-sm text-muted-foreground">{editingUser.email}</p>
                  </div>
                  
                  <FormField
                    control={userRolesForm.control}
                    name="roles"
                    render={() => (
                      <FormItem>
                        <FormLabel>Roles</FormLabel>
                        <div className="space-y-3">
                          {availableRoles.map((role) => (
                            <FormField
                              key={role.value}
                              control={userRolesForm.control}
                              name="roles"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(role.value)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange([...field.value, role.value]);
                                        } else {
                                          field.onChange(field.value?.filter((value) => value !== role.value));
                                        }
                                      }}
                                      data-testid={`checkbox-role-${role.value}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      {role.label}
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">
                                      {role.description}
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateUserRolesMutation.isPending}
                      data-testid="button-save-user-roles"
                    >
                      {updateUserRolesMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}