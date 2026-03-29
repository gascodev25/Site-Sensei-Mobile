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
import { CalendarIcon, Repeat, Package, Wrench, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import FieldReportPanel from "@/components/FieldReportPanel";

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
  { value: "once_off", label: "Once-Off" },
];

const servicePriorities = [
  { value: "Routine", label: "Routine" },
  { value: "Urgent", label: "Urgent" },
  { value: "Emergency", label: "Emergency" },
];

const serviceTags = [
  { value: "Hygiene", label: "Hygiene" },
  { value: "Pest Control", label: "Pest Control" },
  { value: "Deep Clean", label: "Deep Clean" },
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
      serviceTag: service?.serviceTag || undefined,
      estimatedDuration: service?.estimatedDuration || 60,
      contractLengthMonths: service?.contractLengthMonths || undefined,
      recurrencePattern: service?.recurrencePattern || null,
      equipmentItems: [],
      consumableItems: [],
    },
  });

  const watchType = form.watch("type");
  const watchInstallationDate = form.watch("installationDate");

  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [consumableSearch, setConsumableSearch] = useState("");

  const filteredEquipment = equipment.filter((item) =>
    equipmentSearch === "" ||
    item.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
    item.stockCode?.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const filteredConsumables = consumables.filter((item) =>
    consumableSearch === "" ||
    item.name.toLowerCase().includes(consumableSearch.toLowerCase()) ||
    item.stockCode?.toLowerCase().includes(consumableSearch.toLowerCase())
  );

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
    mutationFn: async ({ 
      serviceId, 
      splitDate, 
      newInterval, 
      newEquipmentItems, 
      newConsumableItems 
    }: { 
      serviceId: number; 
      splitDate: string; 
      newInterval: string;
      newEquipmentItems?: { id: number; quantity: number }[];
      newConsumableItems?: { id: number; quantity: number }[];
    }) => {
      return await apiRequest("POST", `/api/services/${serviceId}/split`, { 
        splitDate, 
        newInterval,
        newEquipmentItems,
        newConsumableItems
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/equipment-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/weekly-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Service series split successfully. Changes will apply from selected date forward.",
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
    if (isEditing && service && initialDate) {
      const originalPattern = service.recurrencePattern as { interval?: string } | null;
      const newPattern = data.recurrencePattern as { interval?: string } | null;
      
      const intervalChanged = originalPattern?.interval && 
          newPattern?.interval && 
          originalPattern.interval !== newPattern.interval;
      
      if (originalPattern?.interval && intervalChanged) {
        const shouldSplit = confirm(
          `You're changing the service interval from ${originalPattern.interval} to ${newPattern?.interval}.\n\n` +
          `Would you like to:\n` +
          `- YES: Apply changes from ${format(initialDate, 'PPP')} forward only (recommended)\n` +
          `- NO: Change for entire series (affects past dates)`
        );
        
        if (shouldSplit) {
          const year = initialDate.getFullYear();
          const month = String(initialDate.getMonth() + 1).padStart(2, '0');
          const day = String(initialDate.getDate()).padStart(2, '0');
          const splitDate = `${year}-${month}-${day}`;
          
          const originalEquipment = serviceWithStock?.equipmentItems?.map((item: any) => ({
            id: item.id,
            quantity: item.quantity
          })) || [];
          const originalConsumables = serviceWithStock?.consumableItems?.map((item: any) => ({
            id: item.id,
            quantity: item.quantity
          })) || [];
          const newEquipment = data.equipmentItems || [];
          const newConsumables = data.consumableItems || [];
          
          const equipmentChanged = JSON.stringify(
            [...originalEquipment].sort((a: any, b: any) => a.id - b.id)
          ) !== JSON.stringify(
            [...newEquipment].sort((a: any, b: any) => a.id - b.id)
          );
          const consumablesChanged = JSON.stringify(
            [...originalConsumables].sort((a: any, b: any) => a.id - b.id)
          ) !== JSON.stringify(
            [...newConsumables].sort((a: any, b: any) => a.id - b.id)
          );
          
          splitServiceMutation.mutate({
            serviceId: service.id,
            splitDate,
            newInterval: newPattern?.interval || originalPattern.interval,
            newEquipmentItems: equipmentChanged ? newEquipment : undefined,
            newConsumableItems: consumablesChanged ? newConsumables : undefined
          });
          return;
        }
      }
    }
    
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
    <div>
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
                      disabled={(date) => {
                        const day = date.getDay();
                        return date < new Date("1900-01-01") || day === 0 || day === 6;
                      }}
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

        <FormField
          control={form.control}
          name="serviceTag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tag</FormLabel>
              <FormControl>
                <Select value={field.value ?? "none"} onValueChange={(val) => field.onChange(val === "none" ? null : val)}>
                  <SelectTrigger data-testid="select-service-tag">
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tag</SelectItem>
                    {serviceTags.map((tag) => (
                      <SelectItem key={tag.value} value={tag.value}>
                        {tag.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search equipment by name or code..."
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
              className="pl-10"
              data-testid="input-equipment-search"
            />
          </div>

          <FormField
            control={form.control}
            name="equipmentItems"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {filteredEquipment.length === 0 && equipmentSearch && (
                      <p className="text-sm text-muted-foreground col-span-2 py-4 text-center">No equipment found matching "{equipmentSearch}"</p>
                    )}
                    {filteredEquipment.map((item) => {
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
                                value={field.value?.find(eq => eq.id === item.id)?.quantity || 1}
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search consumables by name or code..."
              value={consumableSearch}
              onChange={(e) => setConsumableSearch(e.target.value)}
              className="pl-10"
              data-testid="input-consumable-search"
            />
          </div>

          <FormField
            control={form.control}
            name="consumableItems"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {filteredConsumables.length === 0 && consumableSearch && (
                      <p className="text-sm text-muted-foreground col-span-2 py-4 text-center">No consumables found matching "{consumableSearch}"</p>
                    )}
                    {filteredConsumables.map((item) => {
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
                                value={field.value?.find(con => con.id === item.id)?.quantity || 1}
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

    {isEditing && service?.id && (
      <FieldReportPanel
        serviceId={service.id}
        occurrenceDate={initialDate ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}` : undefined}
      />
    )}
  </div>
  );
}