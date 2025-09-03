import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

const mockInvoices = [
  {
    id: 1,
    client: "Acme Corp - Service",
    completedTime: "2 hours ago",
    amount: 450.00,
  },
  {
    id: 2,
    client: "Tech Solutions - Installation",
    completedTime: "yesterday",
    amount: 2340.00,
  },
];

export default function InvoicingStatus() {
  const totalPending = mockInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <Card data-testid="card-invoicing-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ready to Invoice</CardTitle>
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockInvoices.map((invoice) => (
            <div 
              key={invoice.id} 
              className="flex items-center justify-between p-3 bg-blue-50 rounded-md"
              data-testid={`item-invoice-${invoice.id}`}
            >
              <div>
                <div className="text-sm font-medium text-foreground">{invoice.client}</div>
                <div className="text-xs text-muted-foreground">Completed {invoice.completedTime}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">
                  R{invoice.amount.toFixed(2)}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-primary hover:text-primary/80 h-auto p-0"
                  data-testid={`button-mark-invoiced-${invoice.id}`}
                >
                  Mark Invoiced
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Pending:</span>
            <span className="font-medium text-foreground" data-testid="text-total-pending">
              R{totalPending.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
