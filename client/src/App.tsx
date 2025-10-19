import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Services from "@/pages/Services";
import Inventory from "@/pages/Inventory";
import Teams from "@/pages/Teams";
import Reports from "@/pages/Reports";
import Warehouse from "@/pages/Warehouse";
import Users from "@/pages/Users";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Login} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/clients" component={Clients} />
          <Route path="/services" component={Services} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/teams" component={Teams} />
          <Route path="/warehouse" component={Warehouse} />
          <Route path="/reports" component={Reports} />
          <Route path="/users" component={Users} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
