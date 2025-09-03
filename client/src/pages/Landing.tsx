import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Calendar, Package, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Warehouse & Service Management
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            Streamline your field service operations with comprehensive inventory tracking, 
            team scheduling, and client management in one powerful platform.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Client Management</CardTitle>
              <CardDescription>
                Manage client information with address autocomplete and location tracking
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Service Scheduling</CardTitle>
              <CardDescription>
                Schedule installations, recurring services, and track completion status
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Package className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Inventory Control</CardTitle>
              <CardDescription>
                Track equipment and consumables from warehouse to field with low stock alerts
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Organize service teams, assign skills, and track team performance
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Dashboard Preview */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Professional Dashboard</CardTitle>
            <CardDescription className="text-center">
              Get real-time insights into your operations with KPI cards, service overviews, and actionable alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-100 rounded-lg p-8 text-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-2xl font-bold text-primary">12</div>
                  <div className="text-sm text-slate-600">Services Today</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-2xl font-bold text-amber-600">3</div>
                  <div className="text-sm text-slate-600">Low Stock Items</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-2xl font-bold text-green-600">94%</div>
                  <div className="text-sm text-slate-600">Completion Rate</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-2xl font-bold text-slate-900">43</div>
                  <div className="text-sm text-slate-600">Active Contracts</div>
                </div>
              </div>
              <p className="text-slate-500">Dashboard preview - Sign in to access your data</p>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-slate-600 mb-8">
            Join teams already using our platform to streamline their field service management
          </p>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login-cta"
          >
            Sign In to Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
