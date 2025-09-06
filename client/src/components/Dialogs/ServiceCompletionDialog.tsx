import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Package, Wrench, Calendar } from "lucide-react";
import type { ServiceWithDetails, Equipment, Consumable } from "@shared/schema";

interface ServiceCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceWithDetails | null;
  onComplete: () => void;
  completionDate?: Date; // Optional specific date for completion
}

interface CompletionFormData {
  equipmentItems: { id: number; quantity: number }[];
  consumableItems: { id: number; quantity: number }[];
  convertToContract: boolean;
  serviceInterval: string;
  contractLengthMonths: number;
}

export default function ServiceCompletionDialog({
  open,
  onOpenChange,
  service,
  onComplete,
  completionDate,
}: ServiceCompletionDialogProps) {
  const { toast } = useToast();
  
  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: consumables = [] } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });

  const form = useForm<CompletionFormData>({
    defaultValues: {
      equipmentItems: [],
      consumableItems: [],
      convertToContract: false,
      serviceInterval: "30d",
      contractLengthMonths: 12,
    },
  });

  // Reset form when service changes
  useEffect(() => {
    if (service) {
      form.reset({
        equipmentItems: service.equipmentItems || [],
        consumableItems: service.consumableItems || [],
        convertToContract: service.type === 'installation',
        serviceInterval: "30d",
        contractLengthMonths: 12,
      });
    }
  }, [service, form]);

  const completeServiceMutation = useMutation({
    mutationFn: async (data: CompletionFormData) => {
      return await apiRequest("POST", `/api/services/${service?.id}/complete`, {
        equipmentItems: data.equipmentItems,
        consumableItems: data.consumableItems,
        convertToContract: data.convertToContract,
        serviceInterval: data.serviceInterval,
        contractLengthMonths: data.contractLengthMonths,
        completionDate: completionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: service?.type === 'installation' 
          ? "Installation completed and converted to service contract"
          : "Service completed successfully",
      });
      onComplete();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompletionFormData) => {
    completeServiceMutation.mutate(data);
  };

  if (!service) return null;

  const isInstallation = service.type === 'installation';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Complete {isInstallation ? 'Installation' : 'Service'}
          </DialogTitle>
          <DialogDescription>
            {isInstallation 
              ? "Update the final equipment and consumable quantities used during installation."
              : "Mark this service as completed."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {isInstallation && (
              <>
                {/* Equipment Section */}
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Equipment Used</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Update the final quantities of equipment used in this installation
                  </p>
                  
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
                                    <Badge variant="outline" className="text-xs">
                                      Stock: {item.stockQuantity || 0}
                                    </Badge>
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
                      </FormItem>
                    )}
                  />
                </div>

                {/* Consumables Section */}
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Consumables Used</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Update the final quantities of consumables used in this installation
                  </p>
                  
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
                                    <p className="text-sm text-muted-foreground">R{item.unitCost}</p>
                                    <Badge variant="outline" className="text-xs">
                                      Stock: {item.stockQuantity || 0}
                                    </Badge>
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
                      </FormItem>
                    )}
                  />
                </div>

                {/* Conversion Option */}
                <div className="space-y-4 border-t border-border pt-4">
                  <FormField
                    control={form.control}
                    name="convertToContract"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-convert-to-contract"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Convert to Service Contract
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            This will change the service type from Installation to Service Contract
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Service Contract Settings */}
                  {form.watch("convertToContract") && (
                    <div className="space-y-4 ml-6 pl-4 border-l-2 border-muted">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">Service Contract Settings</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Service Interval */}
                        <FormField
                          control={form.control}
                          name="serviceInterval"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Interval</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-service-interval">
                                    <SelectValue placeholder="Select interval" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="7d">Weekly (7 days)</SelectItem>
                                  <SelectItem value="14d">Bi-weekly (14 days)</SelectItem>
                                  <SelectItem value="30d">Monthly (30 days)</SelectItem>
                                  <SelectItem value="60d">Bi-monthly (60 days)</SelectItem>
                                  <SelectItem value="90d">Quarterly (90 days)</SelectItem>
                                  <SelectItem value="180d">Semi-annually (180 days)</SelectItem>
                                  <SelectItem value="365d">Annually (365 days)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        {/* Contract Length */}
                        <FormField
                          control={form.control}
                          name="contractLengthMonths"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contract Length (Months)</FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-contract-length">
                                    <SelectValue placeholder="Select length" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="3">3 months</SelectItem>
                                  <SelectItem value="6">6 months</SelectItem>
                                  <SelectItem value="12">12 months</SelectItem>
                                  <SelectItem value="24">24 months</SelectItem>
                                  <SelectItem value="36">36 months</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={completeServiceMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={completeServiceMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-confirm-complete"
              >
                {completeServiceMutation.isPending ? "Completing..." : `Complete ${isInstallation ? 'Installation' : 'Service'}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}