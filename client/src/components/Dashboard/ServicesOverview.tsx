import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ServicesOverview() {
  const chartData = [
    { day: "Mon", height: 120, count: 8 },
    { day: "Tue", height: 80, count: 5 },
    { day: "Wed", height: 160, count: 12 },
    { day: "Thu", height: 200, count: 15 },
    { day: "Fri", height: 100, count: 7 },
  ];

  return (
    <Card data-testid="card-services-overview">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Services Overview</CardTitle>
          <div className="flex space-x-2">
            <Button size="sm" variant="default" data-testid="button-filter-today">
              Today
            </Button>
            <Button size="sm" variant="ghost" data-testid="button-filter-week">
              Week
            </Button>
            <Button size="sm" variant="ghost" data-testid="button-filter-month">
              Month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart Area */}
        <div className="h-64 flex items-end justify-center space-x-4 mb-4" data-testid="chart-services">
          {chartData.map((item, index) => (
            <div key={item.day} className="flex flex-col items-center">
              <div 
                className={`w-12 mb-2 ${index === 3 ? 'bg-blue-600' : 'bg-blue-500'}`}
                style={{ height: `${item.height}px` }}
                data-testid={`bar-${item.day.toLowerCase()}`}
              ></div>
              <span className={`text-xs ${index === 3 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {item.day}
              </span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-muted-foreground">Missed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
