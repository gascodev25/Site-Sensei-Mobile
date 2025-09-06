import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "clients" | "equipment" | "consumables";
  onSuccess?: () => void;
}

interface ParseResult {
  data: any[];
  errors: Papa.ParseError[];
  meta: Papa.ParseMeta;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function BulkUploadDialog({ 
  open, 
  onOpenChange, 
  entityType,
  onSuccess
}: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    errors: number;
    total: number;
  } | null>(null);
  const { toast } = useToast();

  // Define required fields for each entity type
  const requiredFields = {
    clients: ["name", "address_text"],
    equipment: ["name", "stock_code"],
    consumables: ["name", "stock_code"]
  };

  // Define CSV templates
  const csvTemplates = {
    clients: [
      "name,address_text,city,contact_person,phone",
      "ABC Company,\"123 Main St, Johannesburg\",Johannesburg,John Smith,+27123456789",
      "XYZ Corp,\"456 Oak Ave, Cape Town\",Cape Town,Jane Doe,+27987654321"
    ].join("\n"),
    equipment: [
      "name,stock_code,price,status,barcode",
      "Hygiene Station,HST001,2500,in_warehouse,123456789",
      "Soap Dispenser,SD001,150,in_warehouse,987654321"
    ].join("\n"),
    consumables: [
      "name,stock_code,price,current_stock,min_stock_level,barcode",
      "Foam Soap 700ml,FS001,45,100,20,111222333",
      "Paper Towels,PT001,25,50,10,444555666"
    ].join("\n")
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];
    if (!csvFile) return;

    if (!csvFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    setFile(csvFile);
    setParseResult(null);
    setValidationErrors([]);
    setUploadResult(null);

    // Parse CSV
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParseResult(result);
        validateData(result.data);
      },
      error: (error) => {
        toast({
          title: "Parse Error",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  }, [entityType, toast]);

  const validateData = (data: any[]) => {
    const errors: ValidationError[] = [];
    const required = requiredFields[entityType];

    data.forEach((row, index) => {
      // Check required fields
      required.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push({
            row: index + 1,
            field,
            message: `${field.replace(/_/g, ' ')} is required`
          });
        }
      });

      // Additional validations based on entity type
      if (entityType === "clients") {
        if (row.phone && !/^\+?[\d\s\-()]+$/.test(row.phone)) {
          errors.push({
            row: index + 1,
            field: 'phone',
            message: 'Invalid phone number format'
          });
        }
      }

      if (entityType === "equipment" || entityType === "consumables") {
        if (row.price && row.price !== '' && isNaN(parseFloat(row.price))) {
          errors.push({
            row: index + 1,
            field: 'price',
            message: 'Price must be a valid number'
          });
        }
      }

      if (entityType === "consumables") {
        if (row.current_stock && row.current_stock !== '' && isNaN(parseInt(row.current_stock))) {
          errors.push({
            row: index + 1,
            field: 'current_stock',
            message: 'Current stock must be a valid number'
          });
        }
        if (row.min_stock_level && row.min_stock_level !== '' && isNaN(parseInt(row.min_stock_level))) {
          errors.push({
            row: index + 1,
            field: 'min_stock_level',
            message: 'Min stock level must be a valid number'
          });
        }
      }
    });

    setValidationErrors(errors);
  };

  const handleUpload = async () => {
    if (!parseResult || validationErrors.length > 0) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const response = await apiRequest("POST", `/api/bulk-upload/${entityType}`, {
        data: parseResult.data
      });

      const result = await response.json();
      setUploadResult(result);
      
      toast({
        title: "Upload completed",
        description: `Successfully processed ${result.success} out of ${result.total} records`,
      });

      if (result.success > 0 && onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = csvTemplates[entityType];
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_template.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetDialog = () => {
    setFile(null);
    setParseResult(null);
    setValidationErrors([]);
    setUploadResult(null);
    setIsProcessing(false);
    setProgress(0);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const entityDisplayName = {
    clients: "Clients",
    equipment: "Equipment",
    consumables: "Consumables"
  }[entityType];

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload {entityDisplayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Download the CSV template to see the required format for your {entityDisplayName.toLowerCase()} data.
              </p>
              <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download {entityDisplayName} Template
              </Button>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p>Drop the CSV file here...</p>
                ) : (
                  <div>
                    <p className="text-lg mb-2">Drag & drop your CSV file here</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to select</p>
                    <Button variant="outline">Select File</Button>
                  </div>
                )}
              </div>

              {file && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {parseResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {validationErrors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="outline" className="text-green-600">
                    {parseResult.data.length} rows found
                  </Badge>
                  {validationErrors.length > 0 && (
                    <Badge variant="destructive">
                      {validationErrors.length} errors
                    </Badge>
                  )}
                </div>

                {validationErrors.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded text-sm">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div>
                          <span className="font-medium">Row {error.row}:</span> {error.message}
                        </div>
                      </div>
                    ))}
                    {validationErrors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {validationErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Processing...</span>
                      <span className="text-sm text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Upload Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{uploadResult.success}</p>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{uploadResult.errors}</p>
                    <p className="text-sm text-muted-foreground">Errors</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{uploadResult.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            {parseResult && !uploadResult && (
              <Button
                onClick={handleUpload}
                disabled={validationErrors.length > 0 || isProcessing}
                data-testid="button-upload"
              >
                {isProcessing ? "Processing..." : `Upload ${parseResult.data.length} Records`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}