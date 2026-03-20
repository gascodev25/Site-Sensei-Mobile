import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit, Trash2, Users, User, Phone, Briefcase } from "lucide-react";
import type { TeamMember, ServiceTeam, InsertTeamMember, InsertServiceTeam } from "@shared/schema";
import { z } from "zod";

interface TeamWithMembers extends ServiceTeam {
  members?: TeamMember[];
  memberCount?: number;
}

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("teams");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ServiceTeam | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [assigningTeam, setAssigningTeam] = useState<ServiceTeam | null>(null);
  const { toast } = useToast();

  // Data queries
  const { data: teams = [], isLoading: teamsLoading } = useQuery<ServiceTeam[]>({
    queryKey: ["/api/service-teams"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/team-assignments"],
  });

  // Form schemas
  const teamFormSchema = z.object({
    name: z.string().min(1, "Team name is required"),
  });

  const memberFormSchema = z.object({
    name: z.string().min(1, "Member name is required"),
    phone: z.string().optional(),
    skill: z.string().optional(),
  });

  // Forms
  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "" },
  });

  const memberForm = useForm<z.infer<typeof memberFormSchema>>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { name: "", phone: "", skill: "" },
  });

  // Mutations for teams
  const createTeamMutation = useMutation({
    mutationFn: async (data: z.infer<typeof teamFormSchema>) => {
      return await apiRequest("POST", "/api/service-teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-teams"] });
      toast({ title: "Success", description: "Team created successfully" });
      teamForm.reset();
      setIsCreateTeamOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof teamFormSchema> }) => {
      return await apiRequest("PUT", `/api/service-teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-teams"] });
      toast({ title: "Success", description: "Team updated successfully" });
      teamForm.reset();
      setEditingTeam(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      await apiRequest("DELETE", `/api/service-teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-teams"] });
      toast({ title: "Success", description: "Team deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutations for members
  const createMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof memberFormSchema>) => {
      return await apiRequest("POST", "/api/team-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Success", description: "Team member created successfully" });
      memberForm.reset();
      setIsCreateMemberOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof memberFormSchema> }) => {
      return await apiRequest("PUT", `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Success", description: "Team member updated successfully" });
      memberForm.reset();
      setEditingMember(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      await apiRequest("DELETE", `/api/team-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Success", description: "Team member deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Team assignment mutation
  const updateTeamAssignmentsMutation = useMutation({
    mutationFn: async ({ teamId, memberIds }: { teamId: number; memberIds: number[] }) => {
      return await apiRequest("PUT", `/api/service-teams/${teamId}/assignments`, { memberIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-assignments"] });
      toast({ title: "Success", description: "Team assignments updated successfully" });
      setAssigningTeam(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Helper functions
  const handleEditTeam = (team: ServiceTeam) => {
    setEditingTeam(team);
    teamForm.reset({ name: team.name });
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    memberForm.reset({
      name: member.name,
      phone: member.phone || "",
      skill: member.skill || "none",
    });
  };

  const handleDeleteTeam = (team: ServiceTeam) => {
    if (confirm(`Are you sure you want to delete team "${team.name}"?`)) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  const handleDeleteMember = (member: TeamMember) => {
    if (confirm(`Are you sure you want to delete team member "${member.name}"?`)) {
      deleteMemberMutation.mutate(member.id);
    }
  };

  const getSkillBadge = (skill: string | null) => {
    if (!skill || skill === "none") return null;
    const skillColors = {
      "Hygiene": "bg-blue-100 text-blue-800",
      "Deep Clean": "bg-green-100 text-green-800", 
      "Pest Control": "bg-orange-100 text-orange-800",
    };
    return (
      <Badge className={skillColors[skill as keyof typeof skillColors] || "bg-gray-100 text-gray-800"}>
        {skill}
      </Badge>
    );
  };

  const getTeamMemberCount = (teamId: number) => {
    return assignments.filter((a: any) => a.teamId === teamId).length;
  };

  const getTeamMembers = (teamId: number) => {
    const teamAssignments = assignments.filter((a: any) => a.teamId === teamId);
    return members.filter(member => 
      teamAssignments.some((a: any) => a.memberId === member.id)
    );
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.phone && member.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (member.skill && member.skill.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (teamsLoading || membersLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-32 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("total-teams")}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Teams</p>
                  <p className="text-2xl font-bold text-blue-600">{teams.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("team-members")}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                  <p className="text-2xl font-bold text-green-600">{members.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("active-assignments")}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Briefcase className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Assignments</p>
                  <p className="text-2xl font-bold text-purple-600">{assignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stat tile modal */}
        <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {activeModal === "total-teams" && "All Service Teams"}
                {activeModal === "team-members" && "All Team Members"}
                {activeModal === "active-assignments" && "Active Assignments"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 overflow-y-auto flex-1">
              {activeModal === "total-teams" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Name</TableHead>
                      <TableHead>Members</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} className="hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors">
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell>{assignments.filter((a: any) => a.teamId === team.id).length} member(s)</TableCell>
                      </TableRow>
                    ))}
                    {teams.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">No teams found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {activeModal === "team-members" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Skill</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id} className="hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors">
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{m.phone || '-'}</TableCell>
                        <TableCell>{m.skill || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No members found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {activeModal === "active-assignments" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Member</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(assignments as any[]).map((a, idx) => {
                      const team = teams.find(t => t.id === a.teamId);
                      const member = members.find(m => m.id === a.memberId);
                      return (
                        <TableRow key={idx} className="hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors">
                          <TableCell className="font-medium">{team?.name || '-'}</TableCell>
                          <TableCell>{member?.name || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {assignments.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">No assignments found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search teams and members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-teams"
          />
        </div>

        {/* Teams and Members Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="teams">Service Teams</TabsTrigger>
              <TabsTrigger value="members">Team Members</TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              {activeTab === "teams" && (
                <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-team">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Service Team</DialogTitle>
                    </DialogHeader>
                    <Form {...teamForm}>
                      <form onSubmit={teamForm.handleSubmit((data) => createTeamMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={teamForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter team name" {...field} data-testid="input-team-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createTeamMutation.isPending}>
                            {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
              
              {activeTab === "members" && (
                <Dialog open={isCreateMemberOpen} onOpenChange={setIsCreateMemberOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-member">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Team Member</DialogTitle>
                    </DialogHeader>
                    <Form {...memberForm}>
                      <form onSubmit={memberForm.handleSubmit((data) => createMemberMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={memberForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Member Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter member name" {...field} data-testid="input-member-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={memberForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter phone number" {...field} data-testid="input-member-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={memberForm.control}
                          name="skill"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Skill/Specialty</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-member-skill">
                                    <SelectValue placeholder="Select skill" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No specific skill</SelectItem>
                                  <SelectItem value="Hygiene">Hygiene</SelectItem>
                                  <SelectItem value="Deep Clean">Deep Clean</SelectItem>
                                  <SelectItem value="Pest Control">Pest Control</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsCreateMemberOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createMemberMutation.isPending}>
                            {createMemberMutation.isPending ? "Creating..." : "Create Member"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Service Teams Tab */}
          <TabsContent value="teams">
            {filteredTeams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No service teams found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by creating your first service team"}
                    </p>
                    <Button onClick={() => setIsCreateTeamOpen(true)} data-testid="button-add-first-team">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Service Team
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeams.map((team) => {
                  const teamMembers = getTeamMembers(team.id);
                  return (
                    <Card key={team.id} className="hover:shadow-md transition-shadow" data-testid={`card-team-${team.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">{team.name}</CardTitle>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Users className="h-3 w-3 mr-1" />
                              <span>{getTeamMemberCount(team.id)} members</span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssigningTeam(team)}
                              data-testid={`button-assign-team-${team.id}`}
                            >
                              <User className="h-4 w-4" />
                            </Button>
                            <Dialog open={editingTeam?.id === team.id} onOpenChange={(open) => !open && setEditingTeam(null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTeam(team)}
                                  data-testid={`button-edit-team-${team.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Edit Service Team</DialogTitle>
                                </DialogHeader>
                                <Form {...teamForm}>
                                  <form onSubmit={teamForm.handleSubmit((data) => updateTeamMutation.mutate({ id: team.id, data }))} className="space-y-4">
                                    <FormField
                                      control={teamForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Team Name *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter team name" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="flex justify-end space-x-2 pt-4">
                                      <Button type="button" variant="outline" onClick={() => setEditingTeam(null)}>
                                        Cancel
                                      </Button>
                                      <Button type="submit" disabled={updateTeamMutation.isPending}>
                                        {updateTeamMutation.isPending ? "Updating..." : "Update Team"}
                                      </Button>
                                    </div>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTeam(team)}
                              disabled={deleteTeamMutation.isPending}
                              data-testid={`button-delete-team-${team.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {teamMembers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Team Members:</p>
                            <div className="space-y-1">
                              {teamMembers.slice(0, 3).map((member) => (
                                <div key={member.id} className="flex items-center justify-between text-xs">
                                  <span>{member.name}</span>
                                  {member.skill && getSkillBadge(member.skill)}
                                </div>
                              ))}
                              {teamMembers.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{teamMembers.length - 3} more members
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Team Members Tab */}
          <TabsContent value="members">
            {filteredMembers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No team members found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first team member"}
                    </p>
                    <Button onClick={() => setIsCreateMemberOpen(true)} data-testid="button-add-first-member">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Team Member
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMembers.map((member) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow" data-testid={`card-member-${member.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{member.name}</CardTitle>
                          {member.phone && (
                            <div className="flex items-center text-sm text-muted-foreground mb-1">
                              <Phone className="h-3 w-3 mr-1" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                          {member.skill && (
                            <div className="mt-2">
                              {getSkillBadge(member.skill)}
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Dialog open={editingMember?.id === member.id} onOpenChange={(open) => !open && setEditingMember(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMember(member)}
                                data-testid={`button-edit-member-${member.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Edit Team Member</DialogTitle>
                              </DialogHeader>
                              <Form {...memberForm}>
                                <form onSubmit={memberForm.handleSubmit((data) => updateMemberMutation.mutate({ id: member.id, data }))} className="space-y-4">
                                  <FormField
                                    control={memberForm.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Member Name *</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Enter member name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={memberForm.control}
                                    name="phone"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Enter phone number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={memberForm.control}
                                    name="skill"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Skill/Specialty</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select skill" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="none">No specific skill</SelectItem>
                                            <SelectItem value="Hygiene">Hygiene</SelectItem>
                                            <SelectItem value="Deep Clean">Deep Clean</SelectItem>
                                            <SelectItem value="Pest Control">Pest Control</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                                      Cancel
                                    </Button>
                                    <Button type="submit" disabled={updateMemberMutation.isPending}>
                                      {updateMemberMutation.isPending ? "Updating..." : "Update Member"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMember(member)}
                            disabled={deleteMemberMutation.isPending}
                            data-testid={`button-delete-member-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Team Assignment Dialog */}
        {assigningTeam && (
          <Dialog open={true} onOpenChange={() => setAssigningTeam(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Members to {assigningTeam.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select team members to assign to this service team:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((member) => {
                    const isAssigned = assignments.some((a: any) => 
                      a.teamId === assigningTeam.id && a.memberId === member.id
                    );
                    return (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`member-${member.id}`}
                          checked={isAssigned}
                          onCheckedChange={(checked) => {
                            const currentAssignments = assignments
                              .filter((a: any) => a.teamId === assigningTeam.id)
                              .map((a: any) => a.memberId);
                            
                            const newAssignments = checked
                              ? [...currentAssignments, member.id]
                              : currentAssignments.filter((id: number) => id !== member.id);
                            
                            updateTeamAssignmentsMutation.mutate({
                              teamId: assigningTeam.id,
                              memberIds: newAssignments
                            });
                          }}
                        />
                        <label htmlFor={`member-${member.id}`} className="text-sm font-medium">
                          {member.name}
                          {member.skill && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({member.skill})
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setAssigningTeam(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}