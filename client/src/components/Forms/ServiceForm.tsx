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
import { CalendarIcon, Repeat, Package, Wrench } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface ServiceFormProps {
  service?: Service;
  initialDate?: Date | null;
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

export default function ServiceForm({ service, initialDate, onSuccess, onCancel, onDelete, onComplete }: ServiceFormProps) {
  const { toast } = useToast();
  const isEditing = !!service;

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
      installationDate: service?.installationDate ? new Date(service.installationDate) : initialDate || undefined,
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
      }

      // Set consumable items (only id and quantity for form validation)
      if (serviceWithStock.consumableItems) {
        const consumableFormData = serviceWithStock.consumableItems.map((item: any) => ({
          id: item.id,
          quantity: Math.max(1, item.quantity || 1) // Ensure minimum quantity of 1
        }));
        form.setValue("consumableItems", consumableFormData);
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

  const splitServiceMutation = useMutation({
    mutationFn: async ({ serviceId, splitDate, newInterval }: { serviceId: number; splitDate: string; newInterval: string }) => {
      return await apiRequest("POST", `/api/services/${serviceId}/split`, { splitDate, newInterval });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: "Service series split successfully. New interval will apply from selected date forward.",
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
    // Check if user is changing the interval of a recurring service
    if (isEditing && service) {
      const originalPattern = service.recurrencePattern as { interval?: string } | null;
      const newPattern = data.recurrencePattern as { interval?: string } | null;
      
      console.log('=== SERVICE FORM SUBMIT DEBUG ===');
      console.log('Is Editing:', isEditing);
      console.log('Original Interval:', originalPattern?.interval);
      console.log('New Interval:', newPattern?.interval);
      console.log('Initial Date:', initialDate);
      console.log('Interval Changed:', originalPattern?.interval !== newPattern?.interval);
      
      // If interval is changing and initialDate is set (from calendar click)
      if (originalPattern?.interval && 
          newPattern?.interval && 
          originalPattern.interval !== newPattern.interval &&
          initialDate) {
        
        console.log('Showing split confirmation dialog...');
        
        // Ask user if they want to split the series
        const shouldSplit = confirm(
          `You're changing the interval from ${originalPattern.interval} to ${newPattern.interval}.\n\n` +
          `Would you like to:\n` +
          `- YES: Apply new interval from ${format(initialDate, 'PPP')} forward only (recommended)\n` +
          `- NO: Change interval for entire series (affects past dates)`
        );
        
        if (shouldSplit) {
          console.log('User chose to split series');
          // Format the split date
          const year = initialDate.getFullYear();
          const month = String(initialDate.getMonth() + 1).padStart(2, '0');
          const day = String(initialDate.getDate()).padStart(2, '0');
          const splitDate = `${year}-${month}-${day}`;
          
          console.log('Split date:', splitDate);
          
          splitServiceMutation.mutate({
            serviceId: service.id,
            splitDate,
            newInterval: newPattern.interval
          });
          return;
        } else {
          console.log('User chose to update entire series');
        }
      }
    }
    
    // Normal create or update
    console.log('Performing normal update/create');
    createServiceMutation.mutate(data);
  };


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
                    value={field.value?.toString() ?? undefined} 
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
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
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
                      selected={field.value ?? undefined}
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
                    value={field.value?.toString() ?? undefined} 
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
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
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
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
                    value={field.value ?? 60}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
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
                        value={field.value ?? ''}
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
                    <FormLabel>Service Interval</FormLabel>
                    <FormControl>
                      <Select 
                        value={
                          field.value === null || field.value === undefined 
                            ? "once" 
                            : (field.value && typeof field.value === 'object' && 'interval' in field.value) 
                              ? (field.value as any).interval || "once" 
                              : "once"
                        }
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
                          <SelectValue placeholder="Select service interval" />
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
                      const selectedItem = field.value?.some(eq => eq.id === item.id);

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
                      const selectedItem = field.value?.some(con => con.id === item.id);

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
          {isEditing && onComplete && (
            <Button
              type="button"
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