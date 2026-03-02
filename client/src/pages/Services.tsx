import { useState } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, subMonths, addMonths, subWeeks, addWeeks, subDays, addDays, format, isWithinInterval, parseISO } from "date-fns";
import { generateOccurrences } from "@shared/recurrence";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Calendar, Clock, User, MapPin, List, Wrench, Package, Repeat, ChevronDown, CheckCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import type { ServiceWithDetails, ServiceTeam } from "@shared/schema";
import ServiceCalendar from "@/components/ServiceCalendar";
import RecurringServiceMoveDialog from "@/components/Dialogs/RecurringServiceMoveDialog";
import ServiceCompletionDialog from "@/components/Dialogs/ServiceCompletionDialog";

export default function Services() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("list");
  const [listDateView, setListDateView] = useState<'month' | 'week' | 'day'>('month');
  const [listCurrentDate, setListCurrentDate] = useState(new Date());
  const [calendarPopoverOpen, setCalendarPopoverOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const [preSelectedDate, setPreSelectedDate] = useState<Date | null>(null);
  const [selectedServiceDate, setSelectedServiceDate] = useState<Date | null>(null); // Track which date was clicked
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
    completionDate?: Date;
  }>({
    open: false,
    service: null,
    completionDate: undefined,
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

  const { data: teams = [] } = useQuery<ServiceTeam[]>({
    queryKey: ["/api/service-teams"],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.refetchQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/equipment-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/weekly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
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

  const handleServiceClick = (service: ServiceWithDetails, clickedDate?: Date) => {
    setEditingService(service);
    setSelectedServiceDate(clickedDate || null); // Store the clicked date
  };

  const handleServiceComplete = (service: ServiceWithDetails, dateOverride?: Date) => {
    // Use explicit date override, selected calendar date, or today
    const completionDate = dateOverride || selectedServiceDate || new Date();
    
    // Format date in local timezone to avoid timezone conversion issues
    const year = completionDate.getFullYear();
    const month = String(completionDate.getMonth() + 1).padStart(2, '0');
    const day = String(completionDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    if (service.type === 'installation') {
      // For installations, show completion dialog to update equipment/consumables
      setCompletionDialog({ open: true, service, completionDate });
    } else {
      // For all other services (recurring and non-recurring), use the completion endpoint
      completeServiceMutation.mutate({
        serviceId: service.id,
        data: { 
          completionDate: dateString 
        }
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

  // List view date navigation
  const navigateListPrevious = () => {
    if (listDateView === 'month') setListCurrentDate(d => subMonths(d, 1));
    else if (listDateView === 'week') setListCurrentDate(d => subWeeks(d, 1));
    else setListCurrentDate(d => subDays(d, 1));
  };

  const navigateListNext = () => {
    if (listDateView === 'month') setListCurrentDate(d => addMonths(d, 1));
    else if (listDateView === 'week') setListCurrentDate(d => addWeeks(d, 1));
    else setListCurrentDate(d => addDays(d, 1));
  };

  const getListDateRange = () => {
    if (listDateView === 'month') return {
      start: startOfWeek(startOfMonth(listCurrentDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(listCurrentDate), { weekStartsOn: 1 }),
    };
    if (listDateView === 'week') return { start: startOfWeek(listCurrentDate, { weekStartsOn: 1 }), end: endOfWeek(listCurrentDate, { weekStartsOn: 1 }) };
    return { start: startOfDay(listCurrentDate), end: endOfDay(listCurrentDate) };
  };

  const getListPeriodLabel = () => {
    if (listDateView === 'month') return format(listCurrentDate, 'MMMM yyyy');
    if (listDateView === 'week') {
      const start = startOfWeek(listCurrentDate);
      const end = endOfWeek(listCurrentDate);
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(listCurrentDate, 'MMMM d, yyyy');
  };

  // Client-side filtering like Clients and Inventory pages
  const filteredServices = services.filter(service => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      (service.client?.name.toLowerCase().includes(searchLower)) ||
      (service.client?.addressText?.toLowerCase().includes(searchLower)) ||
      (service.type?.toLowerCase().includes(searchLower)) ||
      (service.status?.toLowerCase().includes(searchLower)) ||
      (service.servicePriority?.toLowerCase().includes(searchLower)) ||
      (service.team?.name.toLowerCase().includes(searchLower)) ||
      (service.client?.contactPerson?.toLowerCase().includes(searchLower))
    );
    
    const matchesTeam = selectedTeamId === "all" || service.teamId?.toString() === selectedTeamId;

    const dateRange = getListDateRange();
    const serviceDate = service.installationDate
      ? (typeof service.installationDate === 'string' ? parseISO(service.installationDate) : service.installationDate)
      : null;

    let matchesDateRange = false;
    if (serviceDate) {
      const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;
      if (recurrencePattern && recurrencePattern.interval) {
        const excludedDates = (service.excludedDates as string[]) || [];
        const recurrenceEnd = recurrencePattern.end_date ? parseISO(recurrencePattern.end_date) : null;
        const occurrences = generateOccurrences(serviceDate, recurrencePattern.interval, {
          rangeStart: dateRange.start,
          rangeEnd: dateRange.end,
          endDate: recurrenceEnd,
          excludedDates,
        });
        matchesDateRange = occurrences.length > 0;
      } else {
        matchesDateRange = isWithinInterval(serviceDate, { start: dateRange.start, end: dateRange.end });
      }
    }

    return matchesSearch && matchesTeam && matchesDateRange;
  });

  const getStatusBadge = (service: ServiceWithDetails) => {
    let status = service.status || 'scheduled';
    
    // For recurring services, check if today's date is in completedDates
    const isRecurring = service.recurrencePattern && 
                       typeof service.recurrencePattern === 'object' && 
                       service.recurrencePattern !== null &&
                       'interval' in service.recurrencePattern;
    
    if (isRecurring && service.completedDates && Array.isArray(service.completedDates)) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const serviceDate = service.installationDate ? new Date(service.installationDate).toISOString().split('T')[0] : null;
      
      // Check if the service date or today is in completed dates
      if (service.completedDates.includes(today) || (serviceDate && service.completedDates.includes(serviceDate))) {
        status = 'completed';
      }
    }
    
    const statusColors = {
      scheduled: "bg-amber-100 border-amber-400 text-amber-800",
      completed: "bg-green-100 border-green-400 text-green-800", 
      missed: "bg-red-100 border-red-400 text-red-800",
      in_progress: "bg-blue-100 border-blue-400 text-blue-800"
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 border-gray-400 text-gray-800"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const isServiceCompleted = (service: ServiceWithDetails): boolean => {
    const isRecurring = service.recurrencePattern &&
      typeof service.recurrencePattern === 'object' &&
      service.recurrencePattern !== null &&
      'interval' in service.recurrencePattern;

    if (isRecurring && service.completedDates && Array.isArray(service.completedDates)) {
      const today = new Date().toISOString().split('T')[0];
      const serviceDate = service.installationDate
        ? new Date(service.installationDate).toISOString().split('T')[0]
        : null;
      return service.completedDates.includes(today) ||
        (serviceDate ? service.completedDates.includes(serviceDate) : false);
    }

    return service.status === 'completed';
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

            {/* Search and Filters - show on list view only */}
            {activeTab === "list" && (
              <div className="flex items-center gap-4">
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-team-filter">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
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

                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    variant={listDateView === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setListDateView('month')}
                  >
                    Month
                  </Button>
                  <Button
                    variant={listDateView === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none border-x"
                    onClick={() => setListDateView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={listDateView === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setListDateView('day')}
                  >
                    Day
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* List View Tab Content */}
          <TabsContent value="list" className="space-y-8">
            {/* Date Navigation */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={navigateListPrevious} className="h-8 w-8">
                {"<"}
              </Button>

              <Popover open={calendarPopoverOpen} onOpenChange={setCalendarPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-semibold text-base min-w-[180px] justify-center gap-1"
                  >
                    {getListPeriodLabel()}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={listCurrentDate}
                    onSelect={(date) => {
                      if (date) {
                        setListCurrentDate(date);
                        setListDateView('day');
                        setCalendarPopoverOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="icon" onClick={navigateListNext} className="h-8 w-8">
                {">"}
              </Button>
            </div>

            {/* Service Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {listDateView === 'day' ? "Today's Services" : listDateView === 'week' ? "This Week's Services" : "This Month's Services"}
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {filteredServices.length}
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
                        {filteredServices.filter(s => s.status === 'completed').length}
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
                        {filteredServices.filter(s => s.status === 'scheduled').length}
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
                        {filteredServices.filter(s => s.status === 'missed').length}
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
                  <Card
                    key={service.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700 ${getTeamBackgroundColor(service.team?.name)}`}
                    data-testid={`card-service-${service.id}`}
                    onClick={() => {
                      setSelectedServiceDate(null);
                      setEditingService(service);
                    }}
                  >
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
                            className={isServiceCompleted(service)
                              ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                              : "text-black hover:text-gray-700 hover:bg-gray-100"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isServiceCompleted(service)) {
                                handleServiceComplete(service);
                              }
                            }}
                            disabled={completeServiceMutation.isPending}
                            title={isServiceCompleted(service) ? "Completed" : "Mark as complete"}
                            data-testid={`button-complete-${service.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedServiceDate(null);
                              setEditingService(service);
                            }}
                            data-testid={`button-edit-${service.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(service);
                            }}
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
                        {(service.recurrencePattern as any)?.interval && (
                          <div className="flex items-center">
                            <Repeat className="h-3 w-3 mr-1" />
                            <span className="font-medium">Frequency:</span>
                            <span className="ml-1">
                              {(() => {
                                const interval = (service.recurrencePattern as any).interval;
                                const labels: Record<string, string> = { '7d': 'Weekly', '14d': 'Bi-weekly', '30d': 'Monthly', '60d': 'Bi-monthly', '90d': 'Quarterly', '180d': 'Semi-annually' };
                                return labels[interval] || `Every ${interval}`;
                              })()}
                            </span>
                          </div>
                        )}
                        {(service as any).stockSummary?.equipmentNames?.length > 0 && (
                          <div className="flex items-start mt-1">
                            <Wrench className="h-3 w-3 mr-1 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">Equipment:</span>
                              <span className="ml-1 text-muted-foreground">
                                {(service as any).stockSummary.equipmentNames.slice(0, 3).join(', ')}
                                {(service as any).stockSummary.equipmentNames.length > 3 && ` +${(service as any).stockSummary.equipmentNames.length - 3} more`}
                              </span>
                            </div>
                          </div>
                        )}
                        {(service as any).stockSummary?.consumableNames?.length > 0 && (
                          <div className="flex items-start mt-1">
                            <Package className="h-3 w-3 mr-1 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-medium">Consumables:</span>
                              <span className="ml-1 text-muted-foreground">
                                {(service as any).stockSummary.consumableNames.slice(0, 3).join(', ')}
                                {(service as any).stockSummary.consumableNames.length > 3 && ` +${(service as any).stockSummary.consumableNames.length - 3} more`}
                              </span>
                            </div>
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
              onComplete={(service, date) => handleServiceComplete(service, date)}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Service Dialog */}
        <Dialog open={!!editingService} onOpenChange={(open) => {
          if (!open) {
            setEditingService(null);
            setSelectedServiceDate(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            {editingService && (
              <ServiceForm
                service={editingService}
                initialDate={selectedServiceDate}
                onSuccess={() => {
                  setEditingService(null);
                  setSelectedServiceDate(null);
                  setIsCreateOpen(false);
                }}
                onCancel={() => {
                  setEditingService(null);
                  setSelectedServiceDate(null);
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
            !open && setCompletionDialog({ open: false, service: null, completionDate: undefined })
          }
          service={completionDialog.service}
          completionDate={completionDialog.completionDate}
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