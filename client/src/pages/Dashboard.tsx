import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import KPICard from "@/components/Dashboard/KPICard";
import ServicesOverview from "@/components/Dashboard/ServicesOverview";
import RecentServices from "@/components/Dashboard/RecentServices";
import StockLevels from "@/components/Dashboard/StockLevels";
import TeamStatus from "@/components/Dashboard/TeamStatus";
import InvoicingStatus from "@/components/Dashboard/InvoicingStatus";
import ContractAlerts from "@/components/Dashboard/ContractAlerts";
import ServiceForm from "@/components/Forms/ServiceForm";
import { Button } from "@/components/ui/button";
import { Plus, Download, Calendar, Package, AlertCircle, CheckCircle, File, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
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

  const { data: metrics, isLoading: metricsLoading, error } = useQuery<any>({
    queryKey: ["/api/dashboard/metrics"],
    enabled: isAuthenticated,
  });

  const { data: servicesToday } = useQuery<any[]>({
    queryKey: ["/api/services"],
    enabled: activeModal === "services-today",
  });

  const { data: missedServices } = useQuery<any[]>({
    queryKey: ["/api/dashboard/missed-services"],
    enabled: activeModal === "missed-services" && isAuthenticated,
  });

  const { data: lowStock } = useQuery<any[]>({
    queryKey: ["/api/inventory"],
    enabled: activeModal === "low-stock",
  });

  const { data: expiringContracts } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: activeModal === "expiring-contracts",
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
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-schedule-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Service
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Service</DialogTitle>
                </DialogHeader>
                <ServiceForm
                  onSuccess={() => setIsCreateOpen(false)}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
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
            onClick={() => setActiveModal("services-today")}
            data-testid="kpi-services-today"
          />
          
          <KPICard
            title="Missed Services"
            value={metrics?.missedServices || 0}
            icon={AlertCircle}
            status="destructive"
            label="Requires attention"
            onClick={() => setActiveModal("missed-services")}
            data-testid="kpi-missed-services"
          />
          
          <KPICard
            title="Low Stock Items"
            value={metrics?.lowStockItems || 0}
            icon={Package}
            status="warning"
            label="Reorder required"
            onClick={() => setActiveModal("low-stock")}
            data-testid="kpi-low-stock"
          />
          
          <KPICard
            title="Expiring Contracts"
            value={metrics?.expiringContracts || 0}
            icon={File}
            label="Next 30 days"
            onClick={() => setActiveModal("expiring-contracts")}
            data-testid="kpi-expiring-contracts"
          />
        </div>

        <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {activeModal === "services-today" && "Services Today"}
                {activeModal === "missed-services" && "Missed Services"}
                {activeModal === "low-stock" && "Low Stock Items"}
                {activeModal === "expiring-contracts" && "Expiring Contracts"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 overflow-x-auto overflow-y-auto flex-1">
              {activeModal === "services-today" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicesToday?.filter(s => {
                      if (!s.scheduledDate) return false;
                      try {
                        const date = new Date(s.scheduledDate);
                        return !isNaN(date.getTime()) && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      } catch (e) {
                        return false;
                      }
                    }).map((s: any) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedService(s)}>
                        <TableCell className="font-medium">{s.clientName}</TableCell>
                        <TableCell>{s.type}</TableCell>
                        <TableCell>{format(new Date(s.scheduledDate), 'HH:mm')}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                        <TableCell><ExternalLink className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                    {(!servicesToday || servicesToday.length === 0) && (
                      <TableRow><TableCell colSpan={4} className="text-center py-4">No services scheduled for today</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {activeModal === "missed-services" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Missed Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missedServices?.filter(item => {
                      if (!item.missedDate) return false;
                      const date = new Date(item.missedDate);
                      return !isNaN(date.getTime());
                    }).map((item: any, index: number) => (
                      <TableRow key={`${item.service?.id}-${item.missedDate}-${index}`} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => item.service && setSelectedService(item.service)}>
                        <TableCell className="font-medium">{item.service?.client?.name || 'Unknown'}</TableCell>
                        <TableCell>{item.service?.type || 'Unknown'}</TableCell>
                        <TableCell>{format(new Date(item.missedDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-destructive">Missed</TableCell>
                        <TableCell><ExternalLink className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                    {(!missedServices || missedServices.length === 0) && (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No missed services recorded</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {activeModal === "low-stock" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min Threshold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock?.filter(i => i.currentStock <= i.minThreshold).map((i: any) => (
                      <TableRow key={i.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{i.category}</TableCell>
                        <TableCell className="text-destructive font-bold">{i.currentStock}</TableCell>
                        <TableCell>{i.minThreshold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {activeModal === "expiring-contracts" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Contract End Date</TableHead>
                      <TableHead>Monthly Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringContracts?.filter(c => {
                      if (!c.contractEndDate) return false;
                      const end = new Date(c.contractEndDate);
                      const now = new Date();
                      const thirtyDays = new Date();
                      thirtyDays.setDate(now.getDate() + 30);
                      return end >= now && end <= thirtyDays;
                    }).map((c: any) => (
                      <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{format(new Date(c.contractEndDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell>R{c.monthlyValue?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedService} onOpenChange={(open) => { if (!open) setSelectedService(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            {selectedService && (
              <ServiceForm
                service={selectedService}
                onSuccess={() => {
                  setSelectedService(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/services"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/missed-services"] });
                }}
                onCancel={() => setSelectedService(null)}
              />
            )}
          </DialogContent>
        </Dialog>

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
