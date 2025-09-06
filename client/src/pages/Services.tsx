import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import ServiceForm from "@/components/Forms/ServiceForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, Calendar, Clock, User, MapPin, List } from "lucide-react";
import type { ServiceWithDetails } from "@shared/schema";
import ServiceCalendar from "@/components/ServiceCalendar";
import RecurringServiceMoveDialog from "@/components/Dialogs/RecurringServiceMoveDialog";
import ServiceCompletionDialog from "@/components/Dialogs/ServiceCompletionDialog";

export default function Services() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const [preSelectedDate, setPreSelectedDate] = useState<Date | null>(null);
  const [recurringMoveDialog, setRecurringMoveDialog] = useState<{
    open: boolean;
    service: ServiceWithDetails | null;
    originalDate: Date | null;
    newDate: Date | null;
  }>({
    open: false,
    service: null,
    originalDate: null,
    newDate: null,
  });
  const [completionDialog, setCompletionDialog] = useState<{
    open: boolean;
    service: ServiceWithDetails | null;
  }>({
    open: false,
    service: null,
  });
  const { toast } = useToast();

  // Get team background color
  const getTeamBackgroundColor = (teamName?: string) => {
    if (!teamName) return "";
    const teamColors = {
      "Hygiene": "bg-blue-50 border-blue-200",
      "Deep Clean": "bg-green-50 border-green-200", 
      "Pest Control": "bg-orange-50 border-orange-200",
    };
    return teamColors[teamName as keyof typeof teamColors] || "";
  };

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
      await apiRequest("PUT", `/api/services/${serviceId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.refetchQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
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

  const createIndividualServiceMutation = useMutation({
    mutationFn: async (serviceData: Partial<ServiceWithDetails>) => {
      return await apiRequest("POST", "/api/services", serviceData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.refetchQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: "Individual service created successfully",
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

  const completeServiceMutation = useMutation({
    mutationFn: async ({ serviceId, data }: { serviceId: number; data: any }) => {
      return await apiRequest("POST", `/api/services/${serviceId}/complete`, data);
    },
    onSuccess: async () => {
      // Clear all related caches
      queryClient.removeQueries({ queryKey: ["/api/services"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard/metrics"] });
      
      // Small delay to ensure server has processed the update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force fresh fetch of services data
      await queryClient.fetchQuery({ 
        queryKey: ["/api/services"],
        staleTime: 0,
        gcTime: 0
      });
      
      // Force refetch dashboard metrics
      await queryClient.fetchQuery({ 
        queryKey: ["/api/dashboard/metrics"],
        staleTime: 0,
        gcTime: 0
      });
      
      setCompletionDialog({ open: false, service: null });
      setEditingService(null);
      toast({
        title: "Success",
        description: "Service completed successfully",
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

  const handleServiceComplete = (service: ServiceWithDetails) => {
    if (service.type === 'installation') {
      // For installations, show completion dialog to update equipment/consumables
      setCompletionDialog({ open: true, service });
    } else {
      // For regular services, just mark as completed
      completeServiceMutation.mutate({
        serviceId: service.id,
        data: {}
      });
    }
  };

  const handleServiceMove = (serviceId: number, newDate: Date, draggedFromDate?: Date) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    // Check if this is a recurring service
    const isRecurring = service.recurrencePattern && 
      service.recurrencePattern !== null && 
      typeof service.recurrencePattern === 'object' &&
      (service.recurrencePattern as any).interval;

    if (isRecurring && draggedFromDate) {
      // Show dialog for recurring service
      setRecurringMoveDialog({
        open: true,
        service,
        originalDate: draggedFromDate,
        newDate,
      });
    } else {
      // Handle non-recurring service or direct move
      updateServiceMutation.mutate({ 
        serviceId, 
        data: { installationDate: newDate }
      });
    }
  };

  const handleDateClick = (date: Date) => {
    setPreSelectedDate(date);
    setIsCreateOpen(true);
  };

  const handleMoveThisOnly = async () => {
    const { service, originalDate, newDate } = recurringMoveDialog;
    if (!service || !newDate || !originalDate) return;

    // Create a new individual service for this specific date
    const individualServiceData = {
      clientId: service.clientId,
      type: service.type,
      installationDate: newDate,
      teamId: service.teamId,
      status: service.status,
      servicePriority: service.servicePriority,
      estimatedDuration: service.estimatedDuration,
      // Remove recurrence pattern - this is a one-time service
      recurrencePattern: null,
      contractLengthMonths: null,
    };

    // Add the original date to the recurring service's excluded dates
    const currentExcludedDates = (service.excludedDates as string[]) || [];
    const originalDateString = originalDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const updatedExcludedDates = [...currentExcludedDates, originalDateString];

    try {
      // Create individual service and update original service to exclude the moved date
      await Promise.all([
        createIndividualServiceMutation.mutateAsync(individualServiceData),
        updateServiceMutation.mutateAsync({
          serviceId: service.id,
          data: { excludedDates: updatedExcludedDates }
        })
      ]);
    } catch (error) {
      console.error('Error in handleMoveThisOnly:', error);
    }
    
    setRecurringMoveDialog({ open: false, service: null, originalDate: null, newDate: null });
  };

  const handleMoveAllFuture = () => {
    const { service, newDate } = recurringMoveDialog;
    if (!service || !newDate) return;

    // Update the base service's installation date
    updateServiceMutation.mutate({
      serviceId: service.id,
      data: { installationDate: newDate }
    });
    setRecurringMoveDialog({ open: false, service: null, originalDate: null, newDate: null });
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

  

  // Get effective status for a service on a specific date (for recurring services)
  const getEffectiveStatus = (service: ServiceWithDetails, checkDate?: Date) => {
    const isRecurring = service.recurrencePattern && 
      service.recurrencePattern !== null && 
      typeof service.recurrencePattern === 'object' &&
      (service.recurrencePattern as any).interval;

    const isServiceContract = service.type === 'service_contract';

    if (!isRecurring && !isServiceContract) {
      return service.status;
    }

    // For recurring services or service contracts, check if the installation date (or provided date) is completed
    const dateToCheck = checkDate || (service.installationDate ? new Date(service.installationDate) : new Date());
    const dateString = dateToCheck.toISOString().split('T')[0]; // YYYY-MM-DD format
    const completedDates = (service.completedDates as string[]) || [];
    const isDateCompleted = completedDates.includes(dateString);
    
    if (isDateCompleted) {
      return 'completed';
    }
    
    // Check if the date is in the past to mark as missed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const serviceDate = new Date(dateToCheck);
    serviceDate.setHours(0, 0, 0, 0);
    
    if (serviceDate < today) {
      return 'missed';
    }
    
    return 'scheduled';
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
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setPreSelectedDate(null);
            }
          }}>
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
                initialDate={preSelectedDate}
                onSuccess={() => {
                  setIsCreateOpen(false);
                  setEditingService(null);
                  setPreSelectedDate(null);
                }}
                onCancel={() => {
                  setIsCreateOpen(false);
                  setEditingService(null);
                  setPreSelectedDate(null);
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
                        {services.filter(s => getEffectiveStatus(s) === 'completed').length}
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
                        {services.filter(s => getEffectiveStatus(s) === 'scheduled').length}
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
                        {services.filter(s => getEffectiveStatus(s) === 'missed').length}
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
                  <Card key={service.id} className={`hover:shadow-md transition-shadow ${getTeamBackgroundColor(service.team?.name)}`} data-testid={`card-service-${service.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{service.client?.name || 'Unknown Client'}</CardTitle>
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
              onDateClick={handleDateClick}
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
                onComplete={() => handleServiceComplete(editingService)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Recurring Service Move Dialog */}
        <RecurringServiceMoveDialog
          open={recurringMoveDialog.open}
          onOpenChange={(open) => 
            !open && setRecurringMoveDialog({ open: false, service: null, originalDate: null, newDate: null })
          }
          service={recurringMoveDialog.service}
          originalDate={recurringMoveDialog.originalDate}
          newDate={recurringMoveDialog.newDate}
          onMoveThisOnly={handleMoveThisOnly}
          onMoveAllFuture={handleMoveAllFuture}
        />

        {/* Service Completion Dialog */}
        <ServiceCompletionDialog
          open={completionDialog.open}
          onOpenChange={(open) => 
            !open && setCompletionDialog({ open: false, service: null })
          }
          service={completionDialog.service}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/services"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
            setEditingService(null);
          }}
        />
      </div>
    </div>
  );
}