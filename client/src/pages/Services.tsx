import Header from "@/components/Layout/Header";
import { Card, CardContent } from "@/components/ui/card";

export default function Services() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Services</h1>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center">
              <h3 className="text-lg font-medium mb-2">Services Management</h3>
              <p className="mb-4">Service scheduling and management features coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
