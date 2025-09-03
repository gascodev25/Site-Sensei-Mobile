import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warehouse, SprayCan, Filter, Soup } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function StockLevels() {
  const { data: lowStockItems = [], isLoading } = useQuery({
    queryKey: ["/api/consumables", { lowStock: true }],
  });

  const mockItems = [
    {
      id: 1,
      name: "Sanitizer SprayCan",
      stockCode: "SAN-001",
      currentStock: 5,
      minStockLevel: 10,
      icon: SprayCan,
      color: "amber",
    },
    {
      id: 2,
      name: "HEPA Filters",
      stockCode: "FIL-003",
      currentStock: 2,
      minStockLevel: 8,
      icon: Filter,
      color: "red",
    },
    {
      id: 3,
      name: "Hand Soap",
      stockCode: "SOA-002",
      currentStock: 24,
      minStockLevel: 15,
      icon: Soup,
      color: "green",
    },
  ];

  const getStockColor = (color: string) => {
    switch (color) {
      case "red":
        return { bg: "bg-red-100", text: "text-red-600" };
      case "amber":
        return { bg: "bg-amber-100", text: "text-amber-600" };
      default:
        return { bg: "bg-green-100", text: "text-green-600" };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-stock-levels">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stock Levels</CardTitle>
          <Warehouse className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockItems.map((item) => {
            const stockColor = getStockColor(item.color);
            return (
              <div 
                key={item.id} 
                className="flex items-center justify-between"
                data-testid={`item-stock-${item.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${stockColor.bg} rounded flex items-center justify-center`}>
                    <item.icon className={`${stockColor.text} text-xs`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">Stock Code: {item.stockCode}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${stockColor.text}`}>
                    {item.currentStock} units
                  </div>
                  <div className="text-xs text-muted-foreground">Min: {item.minStockLevel}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-sm text-primary hover:text-primary/80 font-medium"
          data-testid="button-view-inventory"
        >
          View Full Inventory
        </Button>
      </CardContent>
    </Card>
  );
}
