import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, MapPin, Calendar, Barcode, QrCode } from "lucide-react";
import type { Equipment, Consumable } from "@shared/schema";

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("equipment");
  const [isCreateEquipmentOpen, setIsCreateEquipmentOpen] = useState(false);
  const [isCreateConsumableOpen, setIsCreateConsumableOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
  const { toast } = useToast();

  // Equipment queries
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: consumables = [], isLoading: consumablesLoading } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });

  const { data: lowStockConsumables = [] } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables", { lowStock: "true" }],
  });

  // Equipment mutations
  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      await apiRequest("DELETE", `/api/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Equipment deleted successfully",
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

  // Consumables mutations
  const deleteConsumableMutation = useMutation({
    mutationFn: async (consumableId: number) => {
      await apiRequest("DELETE", `/api/consumables/${consumableId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({
        title: "Success",
        description: "Consumable deleted successfully",
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

  const handleDeleteEquipment = (equipmentItem: Equipment) => {
    if (confirm(`Are you sure you want to delete ${equipmentItem.name}?`)) {
      deleteEquipmentMutation.mutate(equipmentItem.id);
    }
  };

  const handleDeleteConsumable = (consumableItem: Consumable) => {
    if (confirm(`Are you sure you want to delete ${consumableItem.name}?`)) {
      deleteConsumableMutation.mutate(consumableItem.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      in_warehouse: "bg-blue-100 text-blue-800",
      in_field: "bg-green-100 text-green-800",
      issued: "bg-yellow-100 text-yellow-800",
      maintenance: "bg-orange-100 text-orange-800",
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStockBadge = (currentStock: number, minStock: number) => {
    if (currentStock <= 0) {
      return <Badge className="bg-red-100 text-red-800">OUT OF STOCK</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge className="bg-orange-100 text-orange-800">LOW STOCK</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">IN STOCK</Badge>;
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "Not set";
    return `R${parseFloat(price).toFixed(2)}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not set";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short', 
      year: 'numeric'
    });
  };

  const filteredEquipment = equipment.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.status && item.status.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredConsumables = consumables.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.stockCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (equipmentLoading || consumablesLoading) {
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
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Equipment</p>
                  <p className="text-2xl font-bold text-blue-600">{equipment.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Field</p>
                  <p className="text-2xl font-bold text-green-600">
                    {equipment.filter(e => e.status === 'in_field').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Consumables</p>
                  <p className="text-2xl font-bold text-purple-600">{consumables.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                  <p className="text-2xl font-bold text-red-600">{lowStockConsumables.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search inventory items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-inventory"
          />
        </div>

        {/* Inventory Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="consumables">Consumables</TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              {activeTab === "equipment" && (
                <Dialog open={isCreateEquipmentOpen} onOpenChange={setIsCreateEquipmentOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-equipment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add New Equipment</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 text-center text-muted-foreground">
                      Equipment form coming soon...
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              {activeTab === "consumables" && (
                <Dialog open={isCreateConsumableOpen} onOpenChange={setIsCreateConsumableOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-consumable">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Consumable
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add New Consumable</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 text-center text-muted-foreground">
                      Consumable form coming soon...
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Equipment Tab */}
          <TabsContent value="equipment">
            {filteredEquipment.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No equipment found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first equipment item"}
                    </p>
                    <Button onClick={() => setIsCreateEquipmentOpen(true)} data-testid="button-add-first-equipment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEquipment.map((equipmentItem) => (
                  <Card key={equipmentItem.id} className="hover:shadow-md transition-shadow" data-testid={`card-equipment-${equipmentItem.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{equipmentItem.name}</CardTitle>
                            {getStatusBadge(equipmentItem.status || 'in_warehouse')}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mb-1">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span>Code: {equipmentItem.stockCode}</span>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Package className="h-3 w-3 mr-1" />
                            <span>Price: {formatPrice(equipmentItem.price)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingEquipment(equipmentItem)}
                                data-testid={`button-edit-equipment-${equipmentItem.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Edit Equipment</DialogTitle>
                              </DialogHeader>
                              <div className="p-4 text-center text-muted-foreground">
                                Equipment editing form coming soon...
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteEquipment(equipmentItem)}
                            disabled={deleteEquipmentMutation.isPending}
                            data-testid={`button-delete-equipment-${equipmentItem.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {equipmentItem.dateInstalled && (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span className="font-medium">Installed:</span> 
                            <span className="ml-1">{formatDate(equipmentItem.dateInstalled)}</span>
                          </div>
                        )}
                        {equipmentItem.installedAtClientId && (
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="font-medium">Location:</span> 
                            <span className="ml-1">Client #{equipmentItem.installedAtClientId}</span>
                          </div>
                        )}
                        {equipmentItem.barcode && (
                          <div className="flex items-center">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span className="font-medium">Barcode:</span> 
                            <span className="ml-1 font-mono text-xs">{equipmentItem.barcode}</span>
                          </div>
                        )}
                        {equipmentItem.qrCode && (
                          <div className="flex items-center">
                            <QrCode className="h-3 w-3 mr-1" />
                            <span className="font-medium">QR Code:</span> 
                            <span className="ml-1 font-mono text-xs">{equipmentItem.qrCode}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Consumables Tab */}
          <TabsContent value="consumables">
            {filteredConsumables.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No consumables found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first consumable item"}
                    </p>
                    <Button onClick={() => setIsCreateConsumableOpen(true)} data-testid="button-add-first-consumable">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Consumable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredConsumables.map((consumableItem) => (
                  <Card key={consumableItem.id} className="hover:shadow-md transition-shadow" data-testid={`card-consumable-${consumableItem.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{consumableItem.name}</CardTitle>
                            {getStockBadge(consumableItem.currentStock || 0, consumableItem.minStockLevel || 0)}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mb-1">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span>Code: {consumableItem.stockCode}</span>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Package className="h-3 w-3 mr-1" />
                            <span>Price: {formatPrice(consumableItem.price)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingConsumable(consumableItem)}
                                data-testid={`button-edit-consumable-${consumableItem.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Edit Consumable</DialogTitle>
                              </DialogHeader>
                              <div className="p-4 text-center text-muted-foreground">
                                Consumable editing form coming soon...
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteConsumable(consumableItem)}
                            disabled={deleteConsumableMutation.isPending}
                            data-testid={`button-delete-consumable-${consumableItem.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Current Stock:</span> {consumableItem.currentStock || 0} units
                        </div>
                        <div>
                          <span className="font-medium">Min Stock Level:</span> {consumableItem.minStockLevel || 0} units
                        </div>
                        {consumableItem.barcode && (
                          <div className="flex items-center">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span className="font-medium">Barcode:</span> 
                            <span className="ml-1 font-mono text-xs">{consumableItem.barcode}</span>
                          </div>
                        )}
                        {consumableItem.qrCode && (
                          <div className="flex items-center">
                            <QrCode className="h-3 w-3 mr-1" />
                            <span className="font-medium">QR Code:</span> 
                            <span className="ml-1 font-mono text-xs">{consumableItem.qrCode}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Added: {formatDate(consumableItem.createdAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}