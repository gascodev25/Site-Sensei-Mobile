import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle, TrendingUp, Download, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Layout/Header";

export default function Warehouse() {
  const { toast } = useToast();

  // Fetch equipment status
  const { data: equipmentStatus, isLoading: isLoadingEquipment } = useQuery<{ status: string; count: number }[]>({
    queryKey: ['/api/warehouse/equipment-status'],
  });

  // Fetch all equipment items
  const { data: equipmentItems, isLoading: isLoadingEquipmentItems } = useQuery<any[]>({
    queryKey: ['/api/equipment'],
  });

  // Fetch consumables
  const { data: consumables, isLoading: isLoadingConsumables } = useQuery<any[]>({
    queryKey: ['/api/warehouse/consumables'],
  });

  // Fetch weekly forecast
  const { data: weeklyForecast, isLoading: isLoadingForecast } = useQuery<any[]>({
    queryKey: ['/api/warehouse/weekly-forecast'],
  });

  // Return stock mutation
  const returnStockMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/warehouse/return-stock/${id}`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/warehouse/equipment-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/warehouse/consumables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/warehouse/weekly-forecast'] });
      toast({
        title: "Stock returned",
        description: "Stock item has been marked as returned",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to return stock item",
        variant: "destructive",
      });
    },
  });

  // Calculate totals for equipment
  const equipmentTotals = {
    total: equipmentStatus?.reduce((sum, item) => sum + item.count, 0) || 0,
    inWarehouse: equipmentStatus?.find(item => item.status === 'in_warehouse')?.count || 0,
    inField: equipmentStatus?.find(item => item.status === 'in_field')?.count || 0,
    issued: equipmentStatus?.find(item => item.status === 'issued')?.count || 0,
  };

  // Calculate low stock items
  const lowStockItems = consumables?.filter(c => (c.currentStock || 0) < (c.minStockLevel || 0)) || [];

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <>
      <Header />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Warehouse Stock Control</h1>
          <p className="text-muted-foreground">Track equipment, consumables, and forecast stock requirements</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-equipment-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-equipment-total">{equipmentTotals.total}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-equipment-warehouse">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Warehouse</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-equipment-warehouse">{equipmentTotals.inWarehouse}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-equipment-field">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Field</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-equipment-field">{equipmentTotals.inField}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-low-stock">{lowStockItems.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment</TabsTrigger>
          <TabsTrigger value="consumables" data-testid="tab-consumables">Consumables</TabsTrigger>
          <TabsTrigger value="forecast" data-testid="tab-forecast">Weekly Forecast</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
        </TabsList>

        {/* Equipment Tab */}
        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Inventory</CardTitle>
              <CardDescription>View all equipment items by status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEquipmentItems ? (
                <div className="text-center py-8">Loading equipment...</div>
              ) : (
                <div className="space-y-6">
                  {['in_warehouse', 'in_field', 'issued'].map((status) => {
                    const items = equipmentItems?.filter(item => item.status === status) || [];
                    if (items.length === 0) return null;
                    
                    return (
                      <div key={status} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold capitalize">
                            {status.replace('_', ' ')}
                          </h3>
                          <Badge variant="outline">
                            {items.length} items
                          </Badge>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Stock Code</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Price (R)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((equipment) => (
                              <TableRow key={equipment.id} data-testid={`row-equipment-${equipment.id}`}>
                                <TableCell className="font-medium">{equipment.name}</TableCell>
                                <TableCell>{equipment.stockCode}</TableCell>
                                <TableCell>
                                  <Badge variant={
                                    status === 'in_warehouse' ? 'secondary' : 
                                    status === 'in_field' ? 'default' : 
                                    'outline'
                                  }>
                                    {status.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>R {parseFloat(equipment.price || '0').toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consumables Tab */}
        <TabsContent value="consumables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consumables Stock Levels</CardTitle>
              <CardDescription>Monitor current stock and minimum levels</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingConsumables ? (
                <div className="text-center py-8">Loading consumables...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Stock Code</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Price (R)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumables?.map((consumable) => {
                      const isLow = (consumable.currentStock || 0) < (consumable.minStockLevel || 0);
                      return (
                        <TableRow key={consumable.id} data-testid={`row-consumable-${consumable.id}`}>
                          <TableCell className="font-medium">{consumable.name}</TableCell>
                          <TableCell>{consumable.stockCode}</TableCell>
                          <TableCell data-testid={`text-stock-${consumable.id}`}>{consumable.currentStock || 0}</TableCell>
                          <TableCell>{consumable.minStockLevel || 0}</TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge variant="destructive" data-testid={`badge-low-${consumable.id}`}>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="secondary" data-testid={`badge-ok-${consumable.id}`}>OK</Badge>
                            )}
                          </TableCell>
                          <TableCell>R {parseFloat(consumable.price || '0').toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>4-Week Stock Forecast</CardTitle>
              <CardDescription>Consumables required for upcoming scheduled services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingForecast ? (
                <div className="text-center py-8">Loading forecast...</div>
              ) : weeklyForecast && weeklyForecast.length > 0 ? (
                weeklyForecast.map((week) => (
                  <div key={week.week} className="space-y-2" data-testid={`forecast-${week.week}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {week.week} ({week.weekStart} to {week.weekEnd})
                      </h3>
                      <Badge variant="outline">
                        {week.consumables.length} items needed
                      </Badge>
                    </div>
                    
                    {week.consumables.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Consumable</TableHead>
                            <TableHead>Stock Code</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead>Deficit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {week.consumables.map((item) => (
                            <TableRow key={item.id} data-testid={`forecast-item-${week.week}-${item.id}`}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.stockCode}</TableCell>
                              <TableCell data-testid={`text-required-${week.week}-${item.id}`}>{item.requiredQuantity}</TableCell>
                              <TableCell>{item.currentStock}</TableCell>
                              <TableCell>
                                {item.deficit > 0 ? (
                                  <Badge variant="destructive">{item.deficit} short</Badge>
                                ) : (
                                  <Badge variant="secondary">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No services scheduled for this week</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No forecast data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Reports</CardTitle>
              <CardDescription>Download warehouse data for reporting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Button
                  onClick={() => {
                    const data = consumables?.map(c => ({
                      name: c.name,
                      stockCode: c.stockCode,
                      currentStock: c.currentStock || 0,
                      minStockLevel: c.minStockLevel || 0,
                      price: c.price || 0,
                    }));
                    exportToCSV(data || [], 'warehouse_stock.csv');
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-export-stock"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Warehouse Stock
                </Button>

                <Button
                  onClick={() => {
                    const data = weeklyForecast?.flatMap(week => 
                      week.consumables.map((c: any) => ({
                        week: week.week,
                        weekStart: week.weekStart,
                        consumable: c.name,
                        stockCode: c.stockCode,
                        required: c.requiredQuantity,
                        currentStock: c.currentStock,
                        deficit: c.deficit,
                      }))
                    );
                    exportToCSV(data || [], 'consumables_forecast.csv');
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-export-forecast"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Export Forecast
                </Button>

                <Button
                  onClick={() => {
                    const data = lowStockItems?.map(c => ({
                      name: c.name,
                      stockCode: c.stockCode,
                      currentStock: c.currentStock || 0,
                      minStockLevel: c.minStockLevel || 0,
                      shortage: (c.minStockLevel || 0) - (c.currentStock || 0),
                    }));
                    exportToCSV(data || [], 'low_stock_items.csv');
                  }}
                  variant="outline"
                  className="w-full"
                  data-testid="button-export-low-stock"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Export Low Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
