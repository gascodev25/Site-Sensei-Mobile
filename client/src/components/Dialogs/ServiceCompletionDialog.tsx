import { useState } from "react";
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
import { Check, Package, Wrench } from "lucide-react";
import type { ServiceWithDetails, Equipment, Consumable } from "@shared/schema";

interface ServiceCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceWithDetails | null;
  onComplete: () => void;
}

interface CompletionFormData {
  equipmentItems: { id: number; quantity: number }[];
  consumableItems: { id: number; quantity: number }[];
  convertToContract: boolean;
}

export default function ServiceCompletionDialog({
  open,
  onOpenChange,
  service,
  onComplete,
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
      equipmentItems: service?.equipmentItems || [],
      consumableItems: service?.consumableItems || [],
      convertToContract: service?.type === 'installation',
    },
  });

  const completeServiceMutation = useMutation({
    mutationFn: async (data: CompletionFormData) => {
      return await apiRequest("POST", `/api/services/${service?.id}/complete`, {
        equipmentItems: data.equipmentItems,
        consumableItems: data.consumableItems,
        convertToContract: data.convertToContract,
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