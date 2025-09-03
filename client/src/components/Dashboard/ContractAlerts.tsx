import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const mockContracts = [
  {
    id: 1,
    client: "Global Industries",
    expiryDays: 5,
    severity: "critical" as const,
  },
  {
    id: 2,
    client: "Retail Group Pty",
    expiryDays: 23,
    severity: "warning" as const,
  },
  {
    id: 3,
    client: "Manufacturing Co",
    expiryDays: 28,
    severity: "warning" as const,
  },
];

export default function ContractAlerts() {
  const getAlertStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          dot: "bg-red-500",
          text: "text-red-600",
        };
      default:
        return {
          bg: "bg-amber-50",
          border: "border-amber-200", 
          dot: "bg-amber-500",
          text: "text-amber-600",
        };
    }
  };

  const getActionLabel = (severity: string) => {
    return severity === "critical" ? "Renew" : "Review";
  };

  return (
    <Card data-testid="card-contract-alerts">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Contract Alerts</CardTitle>
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockContracts.map((contract) => {
            const alertStyle = getAlertStyle(contract.severity);
            return (
              <div 
                key={contract.id} 
                className={`flex items-center space-x-3 p-3 rounded-md ${alertStyle.bg} ${alertStyle.border} border`}
                data-testid={`item-contract-${contract.id}`}
              >
                <div className={`w-2 h-2 ${alertStyle.dot} rounded-full`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{contract.client}</div>
                  <div className={`text-xs ${alertStyle.text}`}>
                    Expires in {contract.expiryDays} days
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-primary hover:text-primary/80"
                  data-testid={`button-${getActionLabel(contract.severity).toLowerCase()}-${contract.id}`}
                >
                  {getActionLabel(contract.severity)}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
