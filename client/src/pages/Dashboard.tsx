import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/Layout/Header";
import KPICard from "@/components/Dashboard/KPICard";
import ServicesOverview from "@/components/Dashboard/ServicesOverview";
import RecentServices from "@/components/Dashboard/RecentServices";
import StockLevels from "@/components/Dashboard/StockLevels";
import TeamStatus from "@/components/Dashboard/TeamStatus";
import InvoicingStatus from "@/components/Dashboard/InvoicingStatus";
import ContractAlerts from "@/components/Dashboard/ContractAlerts";
import { Button } from "@/components/ui/button";
import { Plus, Download, Calendar, Package, AlertCircle, CheckCircle, File } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: metrics, isLoading: metricsLoading, error } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    enabled: isAuthenticated,
  });

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (isLoading || metricsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="h-64 bg-muted rounded-lg"></div>
                <div className="h-96 bg-muted rounded-lg"></div>
              </div>
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg"></div>
                ))}
              </div>
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
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <div className="flex space-x-3">
            <Button data-testid="button-new-service">
              <Plus className="h-4 w-4 mr-2" />
              New Service
            </Button>
            <Button variant="outline" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Services Today"
            value={metrics?.servicesToday || 0}
            icon={Calendar}
            trend="+2"
            trendLabel="from yesterday"
            onClick={() => {}} // TODO: Navigate to services
            data-testid="kpi-services-today"
          />
          
          <KPICard
            title="Missed Services"
            value={metrics?.missedServices || 0}
            icon={AlertCircle}
            status="destructive"
            label="Requires attention"
            onClick={() => {}} // TODO: Navigate to missed services
            data-testid="kpi-missed-services"
          />
          
          <KPICard
            title="Low Stock Items"
            value={metrics?.lowStockItems || 0}
            icon={Package}
            status="warning"
            label="Reorder required"
            onClick={() => {}} // TODO: Navigate to inventory
            data-testid="kpi-low-stock"
          />
          
          <KPICard
            title="Expiring Contracts"
            value={metrics?.expiringContracts || 0}
            icon={File}
            label="Next 30 days"
            onClick={() => {}} // TODO: Navigate to contracts
            data-testid="kpi-expiring-contracts"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Dashboard Content */}
          <div className="lg:col-span-2 space-y-8">
            <ServicesOverview />
            <RecentServices />
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-6">
            <StockLevels />
            <TeamStatus />
            <InvoicingStatus />
            <ContractAlerts />
          </div>
        </div>

        {/* Bottom Summary Bar */}
        <div className="mt-12 bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div className="border-r border-border last:border-r-0 md:border-r md:last:border-r-0">
              <div className="text-2xl font-bold text-foreground" data-testid="text-equipment-in-field">
                {metrics?.equipmentInField || 0}
              </div>
              <div className="text-sm text-muted-foreground">Equipment in Field</div>
            </div>
            <div className="border-r border-border last:border-r-0 md:border-r md:last:border-r-0">
              <div className="text-2xl font-bold text-foreground" data-testid="text-active-contracts">
                {metrics?.activeContracts || 0}
              </div>
              <div className="text-sm text-muted-foreground">Active Contracts</div>
            </div>
            <div className="border-r border-border last:border-r-0 md:border-r md:last:border-r-0">
              <div className="text-2xl font-bold text-green-600" data-testid="text-completion-rate">
                {metrics?.completionRate || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Completion Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary" data-testid="text-monthly-revenue">
                R{(metrics?.monthlyRevenue || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Revenue This Month</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
