import Header from "@/components/Layout/Header";
import { Card, CardContent } from "@/components/ui/card";

export default function Reports() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Reports</h1>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center">
              <h3 className="text-lg font-medium mb-2">Reporting & Analytics</h3>
              <p className="mb-4">Comprehensive reporting features coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
