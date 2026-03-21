import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { Service } from "@shared/schema";

type ContractService = Service & { clientName: string };

export default function ContractAlerts() {
  const { data: allServices = [], isLoading } = useQuery<ContractService[]>({
    queryKey: ["/api/services"],
    staleTime: 0,
  });

  // Filter services that are contracts (type = 'service_contract') with less than 3 months (90 days) left
  const expiringContracts = allServices
    .filter(service => service.type === "service_contract" && service.contractLengthMonths)
    .map(service => {
      const createdDate = new Date(service.createdAt);
      const contractEndDate = new Date(createdDate);
      contractEndDate.setMonth(contractEndDate.getMonth() + service.contractLengthMonths!);
      
      const now = new Date();
      const daysUntilExpiry = Math.ceil((contractEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        ...service,
        contractEndDate,
        daysUntilExpiry,
      };
    })
    .filter(service => service.daysUntilExpiry <= 90 && service.daysUntilExpiry > 0) // Less than 3 months
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Sort by soonest expiry first

  const getAlertStyle = (daysLeft: number) => {
    if (daysLeft <= 30) {
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        dot: "bg-red-500",
        text: "text-red-600",
        severity: "critical",
      };
    }
    return {
      bg: "bg-amber-50",
      border: "border-amber-200",
      dot: "bg-amber-500",
      text: "text-amber-600",
      severity: "warning",
    };
  };

  const getActionLabel = (daysLeft: number) => {
    return daysLeft <= 30 ? "Renew" : "Review";
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
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading...</div>
          ) : expiringContracts.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No contracts expiring soon</div>
          ) : (
            expiringContracts.map((contract) => {
              const alertStyle = getAlertStyle(contract.daysUntilExpiry);
              return (
                <div 
                  key={contract.id} 
                  className={`flex items-center space-x-3 p-3 rounded-md ${alertStyle.bg} ${alertStyle.border} border`}
                  data-testid={`item-contract-${contract.id}`}
                >
                  <div className={`w-2 h-2 ${alertStyle.dot} rounded-full`}></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{contract.clientName}</div>
                    <div className={`text-xs ${alertStyle.text}`}>
                      Expires in {contract.daysUntilExpiry} days
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-primary hover:text-primary/80"
                    data-testid={`button-${getActionLabel(contract.daysUntilExpiry).toLowerCase()}-${contract.id}`}
                  >
                    {getActionLabel(contract.daysUntilExpiry)}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
