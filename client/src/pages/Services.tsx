import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import ServiceForm from "@/components/Forms/ServiceForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, Calendar, Clock, User, MapPin, List } from "lucide-react";
import type { ServiceWithDetails } from "@shared/schema";
import ServiceCalendar from "@/components/ServiceCalendar";

export default function Services() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const { toast } = useToast();

  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      await apiRequest("DELETE", `/api/services/${serviceId}`);
    },
    onSuccess: () => {
      // Force refetch all service-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.refetchQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ serviceId, data }: { serviceId: number; data: Partial<ServiceWithDetails> }) => {
      await apiRequest("PATCH", `/api/services/${serviceId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Success",
        description: "Service rescheduled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (service: ServiceWithDetails) => {
    if (confirm(`Are you sure you want to delete this service for ${service.client?.name}?`)) {
      deleteServiceMutation.mutate(service.id);
    }
  };

  const handleServiceClick = (service: ServiceWithDetails) => {
    setEditingService(service);
  };

  const handleServiceMove = (serviceId: number, newDate: Date) => {
    updateServiceMutation.mutate({ 
      serviceId, 
      data: { installationDate: newDate.toISOString() }
    });
  };

  // Client-side filtering like Clients and Inventory pages
  const filteredServices = services.filter(service => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (service.client?.name.toLowerCase().includes(searchLower)) ||
      (service.client?.addressText?.toLowerCase().includes(searchLower)) ||
      (service.type?.toLowerCase().includes(searchLower)) ||
      (service.status?.toLowerCase().includes(searchLower)) ||
      (service.servicePriority?.toLowerCase().includes(searchLower)) ||
      (service.team?.name.toLowerCase().includes(searchLower)) ||
      (service.client?.contactPerson?.toLowerCase().includes(searchLower))
    );
  });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      scheduled: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800", 
      missed: "bg-red-100 text-red-800",
      in_progress: "bg-yellow-100 text-yellow-800"
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "Not scheduled";
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg"></div>
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
          <h1 className="text-3xl font-bold text-foreground">Services Management</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-service">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Service</DialogTitle>
              </DialogHeader>
              <ServiceForm
                onSuccess={() => {
                  setIsCreateOpen(false);
                  setEditingService(null);
                }}
                onCancel={() => {
                  setIsCreateOpen(false);
                  setEditingService(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-8">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List View
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendar View
              </TabsTrigger>
            </TabsList>

            {/* Search - show on list view only */}
            {activeTab === "list" && (
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search services by client, status, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-services"
                />
              </div>
            )}
          </div>

          {/* List View Tab Content */}
          <TabsContent value="list" className="space-y-8">
            {/* Service Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Today's Services</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {services.filter(s => s.installationDate && 
                          new Date(s.installationDate).toDateString() === new Date().toDateString()
                        ).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {services.filter(s => s.status === 'completed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {services.filter(s => s.status === 'scheduled').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Missed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {services.filter(s => s.status === 'missed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Services Grid */}
            {filteredServices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No services found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by scheduling your first service"}
                    </p>
                    <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-first-service">
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Service
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServices.map((service: ServiceWithDetails) => (
                  <Card key={service.id} className="hover:shadow-md transition-shadow" data-testid={`card-service-${service.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{service.client?.name || 'Unknown Client'}</CardTitle>
                            {getStatusBadge(service.status || 'scheduled')}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mb-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span>{service.client?.city || 'Location not specified'}</span>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{formatDate(service.installationDate)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingService(service)}
                            data-testid={`button-edit-${service.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(service)}
                            disabled={deleteServiceMutation.isPending}
                            data-testid={`button-delete-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Type:</span> {service.type?.replace('_', ' ') || 'Not specified'}
                        </div>
                        {service.team && (
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            <span className="font-medium">Team:</span> 
                            <span className="ml-1">{service.team.name}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Priority:</span> {service.servicePriority || 'Routine'}
                        </div>
                        {service.estimatedDuration && (
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            <span className="font-medium">Duration:</span> 
                            <span className="ml-1">{service.estimatedDuration} minutes</span>
                          </div>
                        )}
                        {service.contractLengthMonths && (
                          <div>
                            <span className="font-medium">Contract:</span> {service.contractLengthMonths} months
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Calendar View Tab Content */}
          <TabsContent value="calendar" className="space-y-6">
            <ServiceCalendar
              services={services}
              onServiceClick={handleServiceClick}
              onServiceMove={handleServiceMove}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Service Dialog */}
        <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            {editingService && (
              <ServiceForm
                service={editingService}
                onSuccess={() => {
                  setEditingService(null);
                  setIsCreateOpen(false);
                }}
                onCancel={() => {
                  setEditingService(null);
                  setIsCreateOpen(false);
                }}
                onDelete={() => handleDelete(editingService)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}