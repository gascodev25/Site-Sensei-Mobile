import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertServiceSchema, type Service, type InsertService, type Client, type ServiceTeam, type Equipment, type Consumable } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Repeat, Package, Wrench, CheckCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ServiceFormProps {
  service?: Service;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
}

const serviceTypes = [
  { value: "installation", label: "Installation" },
  { value: "service_contract", label: "Service Contract" },
];

const servicePriorities = [
  { value: "Routine", label: "Routine" },
  { value: "Urgent", label: "Urgent" },
  { value: "Emergency", label: "Emergency" },
];

const recurrenceIntervals = [
  { value: "7d", label: "Weekly (7 days)" },
  { value: "14d", label: "Bi-weekly (14 days)" },
  { value: "30d", label: "Monthly (30 days)" },
  { value: "60d", label: "Bi-monthly (60 days)" },
  { value: "90d", label: "Quarterly (90 days)" },
  { value: "180d", label: "Semi-annually (180 days)" },
  { value: "once", label: "Once-off" },
];

// Helper function to generate service occurrence dates
function generateServiceOccurrences(
  installationDate: string | Date,
  recurrencePattern: { interval: string; end_date?: string | null } | null,
  contractLengthMonths?: number,
  completedDates: string[] = [],
  excludedDates: string[] = []
): { date: Date; status: 'scheduled' | 'completed' | 'missed' }[] {
  if (!recurrencePattern || recurrencePattern.interval === 'once') {
    return [];
  }

  const startDate = new Date(installationDate);
  const intervalDays = parseInt(recurrencePattern.interval.replace('d', ''));
  const endDate = contractLengthMonths 
    ? new Date(startDate.getTime() + (contractLengthMonths * 30 * 24 * 60 * 60 * 1000))
    : new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // Default 1 year if no contract length

  const occurrences: { date: Date; status: 'scheduled' | 'completed' | 'missed' }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    if (!excludedDates.includes(dateStr)) {
      let status: 'scheduled' | 'completed' | 'missed' = 'scheduled';
      
      if (completedDates.includes(dateStr)) {
        status = 'completed';
      } else if (currentDate < today) {
        status = 'missed';
      }
      
      occurrences.push({
        date: new Date(currentDate),
        status
      });
    }
    
    currentDate = addDays(currentDate, intervalDays);
  }

  return occurrences;
}

export default function ServiceForm({ service, onSuccess, onCancel, onDelete, onComplete }: ServiceFormProps) {
  const { toast } = useToast();
  const isEditing = !!service;
  
  // Completion state
  const [selectedCompletionDate, setSelectedCompletionDate] = useState<Date | null>(null);
  const [completionEquipment, setCompletionEquipment] = useState<{ id: number; quantity: number }[]>([]);
  const [completionConsumables, setCompletionConsumables] = useState<{ id: number; quantity: number }[]>([]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: teams = [] } = useQuery<ServiceTeam[]>({
    queryKey: ["/api/service-teams"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: consumables = [] } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });

  // Fetch service with stock items when editing
  const { data: serviceWithStock } = useQuery<any>({
    queryKey: ["/api/services", service?.id],
    enabled: isEditing && !!service?.id,
  });

  const form = useForm<InsertService>({
    resolver: zodResolver(insertServiceSchema),
    defaultValues: {
      clientId: service?.clientId || 0,
      type: service?.type || "installation",
      installationDate: service?.installationDate ? new Date(service.installationDate) : undefined,
      teamId: service?.teamId || 0,
      status: service?.status || "scheduled",
      servicePriority: service?.servicePriority || "Routine",
      estimatedDuration: service?.estimatedDuration || 60,
      contractLengthMonths: service?.contractLengthMonths || undefined,
      recurrencePattern: service?.recurrencePattern || null,
      equipmentItems: [],
      consumableItems: [],
    },
  });

  const watchType = form.watch("type");
  const watchInstallationDate = form.watch("installationDate");

  // Update form with loaded equipment and consumables when editing
  useEffect(() => {
    if (serviceWithStock && isEditing) {
      // Set equipment items (only id and quantity for form validation)
      if (serviceWithStock.equipmentItems) {
        const equipmentFormData = serviceWithStock.equipmentItems.map((item: any) => ({
          id: item.id,
          quantity: item.quantity
        }));
        form.setValue("equipmentItems", equipmentFormData);
        
        // Pre-populate completion equipment from service template
        setCompletionEquipment(equipmentFormData);
      }
      
      // Set consumable items (only id and quantity for form validation)
      if (serviceWithStock.consumableItems) {
        const consumableFormData = serviceWithStock.consumableItems.map((item: any) => ({
          id: item.id,
          quantity: Math.max(1, item.quantity || 1) // Ensure minimum quantity of 1
        }));
        form.setValue("consumableItems", consumableFormData);
        
        // Pre-populate completion consumables from service template
        setCompletionConsumables(consumableFormData);
      }
    }
  }, [serviceWithStock, isEditing, form]);

  const createServiceMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      // Format the data properly
      const formattedData = {
        ...data,
        installationDate: data.installationDate ? data.installationDate : null,
        recurrencePattern: data.recurrencePattern || null,
      };

      if (isEditing) {
        return await apiRequest("PUT", `/api/services/${service.id}`, formattedData);
      } else {
        return await apiRequest("POST", "/api/services", formattedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: `Service ${isEditing ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertService) => {
    createServiceMutation.mutate(data);
  };

  // Completion mutation for service contract occurrences
  const completeOccurrenceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompletionDate || !service) {
        throw new Error("Completion date and service are required");
      }

      const completionData = {
        completionDate: selectedCompletionDate.toISOString().split('T')[0],
        equipmentItems: completionEquipment,
        consumableItems: completionConsumables,
      };

      return await apiRequest("POST", `/api/services/${service.id}/complete`, completionData);
    },
    onSuccess: (updatedService) => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services", service?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      
      // Update service template with new items if any were added
      if (completionEquipment.length > 0 || completionConsumables.length > 0) {
        const newEquipmentItems = completionEquipment.filter(item => 
          !form.getValues('equipmentItems')?.some(existing => existing.id === item.id)
        );
        const newConsumableItems = completionConsumables.filter(item => 
          !form.getValues('consumableItems')?.some(existing => existing.id === item.id)
        );

        if (newEquipmentItems.length > 0 || newConsumableItems.length > 0) {
          // Update the service template
          const updatedEquipment = [...(form.getValues('equipmentItems') || []), ...newEquipmentItems];
          const updatedConsumables = [...(form.getValues('consumableItems') || []), ...newConsumableItems];
          
          form.setValue('equipmentItems', updatedEquipment);
          form.setValue('consumableItems', updatedConsumables);
        }
      }

      toast({
        title: "Success",
        description: `Service occurrence completed for ${selectedCompletionDate ? format(selectedCompletionDate, "PPP") : "selected date"}`,
      });
      
      // Reset completion form
      setSelectedCompletionDate(null);
      setCompletionEquipment(serviceWithStock?.equipmentItems?.map((item: any) => ({
        id: item.id,
        quantity: item.quantity
      })) || []);
      setCompletionConsumables(serviceWithStock?.consumableItems?.map((item: any) => ({
        id: item.id,
        quantity: Math.max(1, item.quantity || 1)
      })) || []);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleConvertToServiceContract = () => {
    if (watchType === "installation") {
      form.setValue("type", "service_contract");
      form.setValue("contractLengthMonths", 12);
      form.setValue("recurrencePattern", { interval: "30d", end_date: null });
    } else {
      form.setValue("type", "installation");
      form.setValue("contractLengthMonths", undefined);
      form.setValue("recurrencePattern", null);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                <FormControl>
                  <Select 
                    value={field.value?.toString()} 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type *</FormLabel>
                <FormControl>
                  <div className="flex items-center space-x-2">
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleConvertToServiceContract}
                      data-testid="button-convert-service"
                    >
                      <Repeat className="h-4 w-4" />
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="installationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Installation Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-installation-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value || undefined}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Team</FormLabel>
                <FormControl>
                  <Select 
                    value={field.value?.toString()} 
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                  >
                    <SelectTrigger data-testid="select-team">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="servicePriority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicePriorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimatedDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="60"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    data-testid="input-duration"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {watchType === "service_contract" && (
          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="text-lg font-medium">Service Contract Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contractLengthMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Length (months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="12"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-contract-length"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrencePattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurrence</FormLabel>
                    <FormControl>
                      <Select 
                        value={(field.value as { interval: string; end_date?: string | null } | null)?.interval || ""}
                        onValueChange={(value) => {
                          if (value === "once") {
                            field.onChange(null);
                          } else {
                            field.onChange({ 
                              interval: value, 
                              end_date: null 
                            });
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-recurrence">
                          <SelectValue placeholder="Select recurrence" />
                        </SelectTrigger>
                        <SelectContent>
                          {recurrenceIntervals.map((interval) => (
                            <SelectItem key={interval.value} value={interval.value}>
                              {interval.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Equipment Selection */}
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center space-x-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Required Equipment</h3>
          </div>
          <p className="text-sm text-muted-foreground">Select equipment needed for this service</p>
          
          <FormField
            control={form.control}
            name="equipmentItems"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {equipment.map((item) => {
                      const isSelected = field.value?.some(eq => eq.id === item.id) || false;
                      const selectedItem = field.value?.find(eq => eq.id === item.id);
                      
                      return (
                        <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), { id: item.id, quantity: 1 }]);
                              } else {
                                field.onChange(field.value?.filter(eq => eq.id !== item.id) || []);
                              }
                            }}
                            data-testid={`checkbox-equipment-${item.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.stockCode}</p>
                          </div>
                          {isSelected && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">Qty:</span>
                              <Input
                                type="number"
                                min="1"
                                value={selectedItem?.quantity || 1}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 1;
                                  field.onChange(
                                    field.value?.map(eq => 
                                      eq.id === item.id ? { ...eq, quantity: newQty } : eq
                                    ) || []
                                  );
                                }}
                                className="w-20"
                                data-testid={`input-equipment-quantity-${item.id}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Consumables Selection */}
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Required Consumables</h3>
          </div>
          <p className="text-sm text-muted-foreground">Select consumables needed for this service</p>
          
          <FormField
            control={form.control}
            name="consumableItems"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {consumables.map((item) => {
                      const isSelected = field.value?.some(con => con.id === item.id) || false;
                      const selectedItem = field.value?.find(con => con.id === item.id);
                      
                      return (
                        <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), { id: item.id, quantity: 1 }]);
                              } else {
                                field.onChange(field.value?.filter(con => con.id !== item.id) || []);
                              }
                            }}
                            data-testid={`checkbox-consumable-${item.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.stockCode}</p>
                          </div>
                          {isSelected && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">Qty:</span>
                              <Input
                                type="number"
                                min="1"
                                value={selectedItem?.quantity || 1}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value) || 1;
                                  field.onChange(
                                    field.value?.map(con => 
                                      con.id === item.id ? { ...con, quantity: newQty } : con
                                    ) || []
                                  );
                                }}
                                className="w-20"
                                data-testid={`input-consumable-quantity-${item.id}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Service Contract Occurrence Completion */}
        {isEditing && service?.type === 'service_contract' && service.recurrencePattern && (
          <div className="space-y-4 border-t border-border pt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Complete Service Occurrence</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  if (!service.installationDate) return null;
                  const occurrences = generateServiceOccurrences(
                    service.installationDate,
                    service.recurrencePattern as { interval: string; end_date?: string | null } | null,
                    service.contractLengthMonths || undefined,
                    (service as any).completedDates || [],
                    (service as any).excludedDates || []
                  );
                  
                  const availableOccurrences = occurrences.filter(occ => occ.status !== 'completed');
                  
                  return (
                    <>
                      {/* Completion History */}
                      {occurrences.filter(occ => occ.status === 'completed').length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-medium mb-2">Completed Services:</h4>
                          <div className="flex flex-wrap gap-2">
                            {occurrences
                              .filter(occ => occ.status === 'completed')
                              .map((occ, idx) => (
                                <Badge key={idx} className="bg-green-100 text-green-800">
                                  {format(occ.date, "MMM dd, yyyy")}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Date Selection */}
                      <div>
                        <h4 className="font-medium mb-2">Select Date to Complete:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {availableOccurrences.slice(0, 12).map((occ, idx) => {
                            const isSelected = selectedCompletionDate && 
                              selectedCompletionDate.toISOString().split('T')[0] === occ.date.toISOString().split('T')[0];
                            
                            return (
                              <Button
                                key={idx}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedCompletionDate(occ.date)}
                                className={cn(
                                  occ.status === 'missed' && "border-red-300 text-red-600",
                                  occ.status === 'scheduled' && "border-blue-300 text-blue-600",
                                  isSelected && "bg-blue-600 text-white"
                                )}
                                data-testid={`button-select-completion-date-${idx}`}
                              >
                                <div className="text-center">
                                  <div className="text-xs">{format(occ.date, "MMM dd")}</div>
                                  <div className="text-xs capitalize">{occ.status}</div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                        {availableOccurrences.length > 12 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Showing next 12 available dates
                          </p>
                        )}
                      </div>
                      
                      {selectedCompletionDate && (
                        <div className="space-y-4 border-t pt-4">
                          <h4 className="font-medium">
                            Equipment & Consumables for {format(selectedCompletionDate, "PPP")}
                          </h4>
                          
                          {/* Completion Equipment */}
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium flex items-center">
                              <Wrench className="h-4 w-4 mr-2" />
                              Equipment
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {equipment.map((item) => {
                                const isSelected = completionEquipment.some(eq => eq.id === item.id);
                                const selectedItem = completionEquipment.find(eq => eq.id === item.id);
                                
                                return (
                                  <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setCompletionEquipment([...completionEquipment, { id: item.id, quantity: 1 }]);
                                        } else {
                                          setCompletionEquipment(completionEquipment.filter(eq => eq.id !== item.id));
                                        }
                                      }}
                                      data-testid={`checkbox-completion-equipment-${item.id}`}
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.stockCode}</p>
                                    </div>
                                    {isSelected && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs">Qty:</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={selectedItem?.quantity || 1}
                                          onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 1;
                                            setCompletionEquipment(
                                              completionEquipment.map(eq => 
                                                eq.id === item.id ? { ...eq, quantity: newQty } : eq
                                              )
                                            );
                                          }}
                                          className="w-16 h-8 text-xs"
                                          data-testid={`input-completion-equipment-quantity-${item.id}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Completion Consumables */}
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium flex items-center">
                              <Package className="h-4 w-4 mr-2" />
                              Consumables
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {consumables.map((item) => {
                                const isSelected = completionConsumables.some(con => con.id === item.id);
                                const selectedItem = completionConsumables.find(con => con.id === item.id);
                                
                                return (
                                  <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setCompletionConsumables([...completionConsumables, { id: item.id, quantity: 1 }]);
                                        } else {
                                          setCompletionConsumables(completionConsumables.filter(con => con.id !== item.id));
                                        }
                                      }}
                                      data-testid={`checkbox-completion-consumable-${item.id}`}
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.stockCode}</p>
                                    </div>
                                    {isSelected && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs">Qty:</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={selectedItem?.quantity || 1}
                                          onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 1;
                                            setCompletionConsumables(
                                              completionConsumables.map(con => 
                                                con.id === item.id ? { ...con, quantity: newQty } : con
                                              )
                                            );
                                          }}
                                          className="w-16 h-8 text-xs"
                                          data-testid={`input-completion-consumable-quantity-${item.id}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Complete Occurrence Button */}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              onClick={() => completeOccurrenceMutation.mutate()}
                              disabled={completeOccurrenceMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              data-testid="button-complete-occurrence"
                            >
                              {completeOccurrenceMutation.isPending ? "Completing..." : "Complete Service"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })() as React.ReactNode}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createServiceMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={createServiceMutation.isPending}
              data-testid="button-delete"
            >
              Delete
            </Button>
          )}
          {isEditing && onComplete && service?.status !== 'completed' && (
            <Button
              type="button"
              variant="default"
              onClick={onComplete}
              disabled={createServiceMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-complete"
            >
              Complete
            </Button>
          )}
          <Button
            type="submit"
            disabled={createServiceMutation.isPending}
            data-testid="button-submit"
          >
            {createServiceMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
