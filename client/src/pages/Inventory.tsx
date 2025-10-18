import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, MapPin, Calendar as CalendarIcon, Barcode, QrCode, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Equipment, Consumable, Client, InsertEquipment, InsertConsumable } from "@shared/schema";
import { z } from "zod";
import BulkUploadDialog from "@/components/Dialogs/BulkUploadDialog";

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("equipment");
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState("all");
  const [isCreateEquipmentOpen, setIsCreateEquipmentOpen] = useState(false);
  const [isCreateConsumableOpen, setIsCreateConsumableOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const { toast } = useToast();

  // Equipment queries
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: consumables = [], isLoading: consumablesLoading } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables"],
  });

  const { data: equipmentTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/equipment-templates"],
  });

  const { data: lowStockConsumables = [] } = useQuery<Consumable[]>({
    queryKey: ["/api/consumables", { lowStock: "true" }],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Equipment form schema
  const equipmentFormSchema = z.object({
    name: z.string().min(1, "Equipment name is required"),
    stockCode: z.string().min(1, "Stock code is required"),
    price: z.string().optional(),
    status: z.string().default("in_warehouse"),
    barcode: z.string().optional(),
    qrCode: z.string().optional(),
    templateId: z.string().optional(),
    consumableIds: z.array(z.number()).optional(),
  });

  // Consumable form schema
  const consumableFormSchema = z.object({
    name: z.string().min(1, "Consumable name is required"),
    stockCode: z.string().min(1, "Stock code is required"),
    price: z.string().optional(),
    minStockLevel: z.string().optional(),
    currentStock: z.string().optional(),
    barcode: z.string().optional(),
    qrCode: z.string().optional(),
  });

  // Template form schema
  const templateFormSchema = z.object({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    consumableIds: z.array(z.number()).min(1, "At least one consumable must be selected"),
  });

  // Equipment form
  const equipmentForm = useForm<z.infer<typeof equipmentFormSchema>>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: "",
      stockCode: "",
      price: "",
      status: "in_warehouse",
      barcode: "",
      qrCode: "",
      templateId: "",
      consumableIds: [],
    },
  });

  // Watch template selection for auto-population
  const selectedTemplate = equipmentForm.watch('templateId');

  // Auto-populate consumables when template is selected
  useEffect(() => {
    if (selectedTemplate && selectedTemplate !== 'custom') {
      const fetchTemplateConsumables = async () => {
        try {
          const response = await apiRequest('GET', `/api/equipment-templates/${selectedTemplate}/consumables`);
          const data = await response.json();
          const consumableIds = data.map((tc: any) => tc.consumable.id);
          equipmentForm.setValue('consumableIds', consumableIds);
        } catch (error) {
          console.error('Failed to fetch template consumables:', error);
        }
      };
      
      fetchTemplateConsumables();
    } else if (selectedTemplate === 'custom') {
      // Clear consumables when custom is selected
      equipmentForm.setValue('consumableIds', []);
    }
  }, [selectedTemplate]);

  // Template form
  const templateForm = useForm<z.infer<typeof templateFormSchema>>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      consumableIds: [],
    },
  });

  // Consumable form
  const consumableForm = useForm<z.infer<typeof consumableFormSchema>>({
    resolver: zodResolver(consumableFormSchema),
    defaultValues: {
      name: "",
      stockCode: "",
      price: "",
      minStockLevel: "0",
      currentStock: "0",
      barcode: "",
      qrCode: "",
    },
  });

  // Equipment mutations
  const createEquipmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof equipmentFormSchema>) => {
      const formattedData = {
        name: data.name,
        stockCode: data.stockCode,
        price: data.price || null,
        dateInstalled: null,
        installedAtClientId: null,
        status: data.status,
        barcode: data.barcode || null,
        qrCode: data.qrCode || null,
        consumableIds: data.consumableIds || [],
      };
      return await apiRequest("POST", "/api/equipment", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Equipment created successfully",
      });
      equipmentForm.reset();
      setIsCreateEquipmentOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof equipmentFormSchema> }) => {
      const formattedData = {
        name: data.name,
        stockCode: data.stockCode,
        price: data.price || null,
        status: data.status,
        barcode: data.barcode || null,
        qrCode: data.qrCode || null,
        templateId: data.templateId && data.templateId !== "custom" ? parseInt(data.templateId) : null,
        consumableIds: data.consumableIds || [],
      };
      return await apiRequest("PUT", `/api/equipment/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Equipment updated successfully",
      });
      equipmentForm.reset();
      setEditingEquipment(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      await apiRequest("DELETE", `/api/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Equipment deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Consumables mutations
  const createConsumableMutation = useMutation({
    mutationFn: async (data: z.infer<typeof consumableFormSchema>) => {
      const formattedData: InsertConsumable = {
        name: data.name,
        stockCode: data.stockCode,
        price: data.price || null,
        minStockLevel: data.minStockLevel ? parseInt(data.minStockLevel) : 0,
        currentStock: data.currentStock ? parseInt(data.currentStock) : 0,
        barcode: data.barcode || null,
        qrCode: data.qrCode || null,
      };
      return await apiRequest("POST", "/api/consumables", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/consumables"] });
      toast({
        title: "Success",
        description: "Consumable created successfully",
      });
      consumableForm.reset();
      setIsCreateConsumableOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateConsumableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof consumableFormSchema> }) => {
      const formattedData: Partial<InsertConsumable> = {
        name: data.name,
        stockCode: data.stockCode,
        price: data.price || null,
        minStockLevel: data.minStockLevel ? parseInt(data.minStockLevel) : 0,
        currentStock: data.currentStock ? parseInt(data.currentStock) : 0,
        barcode: data.barcode || null,
        qrCode: data.qrCode || null,
      };
      return await apiRequest("PUT", `/api/consumables/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/consumables"] });
      toast({
        title: "Success",
        description: "Consumable updated successfully",
      });
      consumableForm.reset();
      setEditingConsumable(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (consumableId: number) => {
      await apiRequest("DELETE", `/api/consumables/${consumableId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/consumables"] });
      toast({
        title: "Success",
        description: "Consumable deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof templateFormSchema>) => {
      const formattedData = {
        name: data.name,
        description: data.description || null,
        consumableIds: data.consumableIds,
      };
      return await apiRequest("POST", "/api/equipment-templates", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-templates"] });
      toast({
        title: "Success",
        description: "Template created successfully",
      });
      templateForm.reset();
      setIsCreateTemplateOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof templateFormSchema> }) => {
      const formattedData = {
        name: data.name,
        description: data.description || null,
        consumableIds: data.consumableIds,
      };
      return await apiRequest("PUT", `/api/equipment-templates/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-templates"] });
      toast({
        title: "Success",
        description: "Template updated successfully",
      });
      templateForm.reset();
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      await apiRequest("DELETE", `/api/equipment-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-templates"] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    
    // Fetch template with consumables to populate form correctly
    const fetchTemplateWithConsumables = async () => {
      try {
        const response = await apiRequest('GET', `/api/equipment-templates/${template.id}/consumables`);
        const data = await response.json();
        const consumableIds = data.map((tc: any) => tc.consumable.id);
        
        templateForm.reset({
          name: template.name,
          description: template.description || "",
          consumableIds: consumableIds,
        });
      } catch (error) {
        templateForm.reset({
          name: template.name,
          description: template.description || "",
          consumableIds: [],
        });
      }
    };
    
    fetchTemplateWithConsumables();
  };

  const handleDeleteTemplate = (template: any) => {
    if (confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleEditEquipment = (equipmentItem: Equipment) => {
    setEditingEquipment(equipmentItem);
    
    // First get equipment with consumables to populate form correctly
    const fetchEquipmentWithConsumables = async () => {
      try {
        const response = await apiRequest('GET', `/api/equipment/${equipmentItem.id}/consumables`);
        const data = await response.json();
        const consumableIds = data.map((ec: any) => ec.consumable.id);
        
        equipmentForm.reset({
          name: equipmentItem.name,
          stockCode: equipmentItem.stockCode,
          price: equipmentItem.price || "",
          status: equipmentItem.status || "in_warehouse",
          barcode: equipmentItem.barcode || "",
          qrCode: equipmentItem.qrCode || "",
          templateId: equipmentItem.templateId ? equipmentItem.templateId.toString() : "custom",
          consumableIds: consumableIds,
        });
      } catch (error) {
        // Fallback to basic equipment data
        equipmentForm.reset({
          name: equipmentItem.name,
          stockCode: equipmentItem.stockCode,
          price: equipmentItem.price || "",
          status: equipmentItem.status || "in_warehouse",
          barcode: equipmentItem.barcode || "",
          qrCode: equipmentItem.qrCode || "",
          templateId: equipmentItem.templateId ? equipmentItem.templateId.toString() : "custom",
          consumableIds: [],
        });
      }
    };
    
    fetchEquipmentWithConsumables();
  };

  const handleDeleteEquipment = (equipmentItem: Equipment) => {
    if (confirm(`Are you sure you want to delete ${equipmentItem.name}?`)) {
      deleteEquipmentMutation.mutate(equipmentItem.id);
    }
  };

  const handleEditConsumable = (consumableItem: Consumable) => {
    setEditingConsumable(consumableItem);
    consumableForm.reset({
      name: consumableItem.name,
      stockCode: consumableItem.stockCode,
      price: consumableItem.price || "",
      minStockLevel: consumableItem.minStockLevel?.toString() || "0",
      currentStock: consumableItem.currentStock?.toString() || "0",
      barcode: consumableItem.barcode || "",
      qrCode: consumableItem.qrCode || "",
    });
  };

  const handleDeleteConsumable = (consumableItem: Consumable) => {
    if (confirm(`Are you sure you want to delete ${consumableItem.name}?`)) {
      deleteConsumableMutation.mutate(consumableItem.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      in_warehouse: "bg-blue-100 text-blue-800",
      in_field: "bg-green-100 text-green-800",
      issued: "bg-yellow-100 text-yellow-800",
      maintenance: "bg-orange-100 text-orange-800",
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStockBadge = (currentStock: number, minStock: number) => {
    if (currentStock <= 0) {
      return <Badge className="bg-red-100 text-red-800">OUT OF STOCK</Badge>;
    } else if (currentStock <= minStock) {
      return <Badge className="bg-orange-100 text-orange-800">LOW STOCK</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">IN STOCK</Badge>;
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "Not set";
    return `R${parseFloat(price).toFixed(2)}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not set";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short', 
      year: 'numeric'
    });
  };

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.status && item.status.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = equipmentStatusFilter === "all" || 
      (equipmentStatusFilter === "in_warehouse" && item.status === "in_warehouse") ||
      (equipmentStatusFilter === "in_field" && item.status === "in_field");
    
    return matchesSearch && matchesStatus;
  });

  const filteredConsumables = consumables.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.stockCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (equipmentLoading || consumablesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg"></div>
              ))}
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
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Equipment</p>
                  <p className="text-2xl font-bold text-blue-600">{equipment.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Field</p>
                  <p className="text-2xl font-bold text-green-600">
                    {equipment.filter(e => e.status === 'in_field').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Consumables</p>
                  <p className="text-2xl font-bold text-purple-600">{consumables.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                  <p className="text-2xl font-bold text-red-600">{lowStockConsumables.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search inventory items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-inventory"
          />
        </div>

        {/* Inventory Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          setIsBulkUploadOpen(false); // Close bulk upload dialog when switching tabs
        }} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-fit grid-cols-3">
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="consumables">Consumables</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              {activeTab !== "templates" && (
                <Button 
                  variant="outline" 
                  onClick={() => setIsBulkUploadOpen(true)}
                  data-testid="button-bulk-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Upload
                </Button>
              )}
              
              {activeTab === "equipment" && (
                <Dialog open={isCreateEquipmentOpen} onOpenChange={setIsCreateEquipmentOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-equipment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Equipment</DialogTitle>
                    </DialogHeader>
                    <Form {...equipmentForm}>
                      <form onSubmit={equipmentForm.handleSubmit((data) => createEquipmentMutation.mutate(data))} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={equipmentForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Equipment Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter equipment name" {...field} data-testid="input-equipment-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={equipmentForm.control}
                            name="stockCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock Code *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter stock code" {...field} data-testid="input-equipment-stock-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={equipmentForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (R)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    {...field} 
                                    data-testid="input-equipment-price" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={equipmentForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-equipment-status">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="in_warehouse">In Warehouse</SelectItem>
                                    <SelectItem value="in_field">In Field</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={equipmentForm.control}
                            name="barcode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Barcode</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter barcode" {...field} data-testid="input-equipment-barcode" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={equipmentForm.control}
                            name="qrCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>QR Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter QR code" {...field} data-testid="input-equipment-qr-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Template Selection */}
                        <FormField
                          control={equipmentForm.control}
                          name="templateId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Equipment Template</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} data-testid="select-equipment-template">
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a template or select custom" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="custom">Custom (No Template)</SelectItem>
                                  {equipmentTemplates.map((template: any) => (
                                    <SelectItem key={template.id} value={template.id.toString()}>
                                      {template.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {selectedTemplate && selectedTemplate !== 'custom' 
                                  ? 'Template will auto-select common consumables. You can modify them below.'
                                  : 'Select consumables manually below.'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Consumables Multi-Select */}
                        <FormField
                          control={equipmentForm.control}
                          name="consumableIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Required Consumables</FormLabel>
                              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                                {consumables.length === 0 ? (
                                  <p className="text-muted-foreground text-sm">No consumables available</p>
                                ) : (
                                  <div className="space-y-2">
                                    {consumables.map((consumable) => (
                                      <label key={consumable.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                                        <input
                                          type="checkbox"
                                          checked={field.value?.includes(consumable.id) || false}
                                          onChange={(e) => {
                                            const currentIds = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...currentIds, consumable.id]);
                                            } else {
                                              field.onChange(currentIds.filter(id => id !== consumable.id));
                                            }
                                          }}
                                          className="rounded border-gray-300"
                                          data-testid={`checkbox-consumable-${consumable.id}`}
                                        />
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">{consumable.name}</p>
                                          <p className="text-xs text-muted-foreground">{consumable.stockCode}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <FormDescription>
                                Select the consumables required for servicing this equipment.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsCreateEquipmentOpen(false)}
                            data-testid="button-cancel-equipment"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createEquipmentMutation.isPending}
                            data-testid="button-save-equipment"
                          >
                            {createEquipmentMutation.isPending ? "Creating..." : "Create Equipment"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
              
              {activeTab === "consumables" && (
                <Dialog open={isCreateConsumableOpen} onOpenChange={setIsCreateConsumableOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-consumable">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Consumable
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Consumable</DialogTitle>
                    </DialogHeader>
                    <Form {...consumableForm}>
                      <form onSubmit={consumableForm.handleSubmit((data) => createConsumableMutation.mutate(data))} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={consumableForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Consumable Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter consumable name" {...field} data-testid="input-consumable-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={consumableForm.control}
                            name="stockCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock Code *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter stock code" {...field} data-testid="input-consumable-stock-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={consumableForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (R)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    {...field} 
                                    data-testid="input-consumable-price" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={consumableForm.control}
                            name="currentStock"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Stock</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0" 
                                    {...field} 
                                    data-testid="input-consumable-current-stock" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={consumableForm.control}
                            name="minStockLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Min Stock Level</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0" 
                                    {...field} 
                                    data-testid="input-consumable-min-stock" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={consumableForm.control}
                            name="barcode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Barcode</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter barcode" {...field} data-testid="input-consumable-barcode" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={consumableForm.control}
                            name="qrCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>QR Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter QR code" {...field} data-testid="input-consumable-qr-code" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsCreateConsumableOpen(false)}
                            data-testid="button-cancel-consumable"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createConsumableMutation.isPending}
                            data-testid="button-save-consumable"
                          >
                            {createConsumableMutation.isPending ? "Creating..." : "Create Consumable"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}

              {activeTab === "templates" && (
                <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-template">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Equipment Template</DialogTitle>
                    </DialogHeader>
                    <Form {...templateForm}>
                      <form onSubmit={templateForm.handleSubmit((data) => createTemplateMutation.mutate(data))} className="space-y-6">
                        <FormField
                          control={templateForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Hygiene Station Standard" {...field} data-testid="input-template-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={templateForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Brief description of this template" {...field} data-testid="input-template-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Consumables Multi-Select */}
                        <FormField
                          control={templateForm.control}
                          name="consumableIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Consumables *</FormLabel>
                              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                                {consumables.length === 0 ? (
                                  <p className="text-muted-foreground text-sm">No consumables available</p>
                                ) : (
                                  <div className="space-y-2">
                                    {consumables.map((consumable) => (
                                      <label key={consumable.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                                        <input
                                          type="checkbox"
                                          checked={field.value?.includes(consumable.id) || false}
                                          onChange={(e) => {
                                            const currentIds = field.value || [];
                                            if (e.target.checked) {
                                              field.onChange([...currentIds, consumable.id]);
                                            } else {
                                              field.onChange(currentIds.filter(id => id !== consumable.id));
                                            }
                                          }}
                                          className="rounded border-gray-300"
                                          data-testid={`checkbox-template-consumable-${consumable.id}`}
                                        />
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">{consumable.name}</p>
                                          <p className="text-xs text-muted-foreground">{consumable.stockCode}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <FormDescription>
                                Select the consumables that are typically needed for this equipment type.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsCreateTemplateOpen(false)}
                            data-testid="button-cancel-template"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createTemplateMutation.isPending}
                            data-testid="button-save-template"
                          >
                            {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Equipment Tab */}
          <TabsContent value="equipment">
            {/* Equipment Status Filter */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Filter by Status:</label>
                <Select value={equipmentStatusFilter} onValueChange={setEquipmentStatusFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-equipment-status-filter">
                    <SelectValue placeholder="All Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    <SelectItem value="in_warehouse">In Warehouse</SelectItem>
                    <SelectItem value="in_field">In Field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {filteredEquipment.length} of {equipment.length} items
              </div>
            </div>
            
            {filteredEquipment.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No equipment found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first equipment item"}
                    </p>
                    <Button onClick={() => setIsCreateEquipmentOpen(true)} data-testid="button-add-first-equipment">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Equipment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEquipment.map((equipmentItem) => (
                  <Card key={equipmentItem.id} className="hover:shadow-md transition-shadow" data-testid={`card-equipment-${equipmentItem.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{equipmentItem.name}</CardTitle>
                            {getStatusBadge(equipmentItem.status || 'in_warehouse')}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mb-1">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span>Code: {equipmentItem.stockCode}</span>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Package className="h-3 w-3 mr-1" />
                            <span>Price: {formatPrice(equipmentItem.price)}</span>
                          </div>
                          {equipmentItem.status === 'in_field' && equipmentItem.installedAtClientId && (
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span>Client: {clients.find(c => c.id === equipmentItem.installedAtClientId)?.name || 'Unknown'}</span>
                            </div>
                          )}
                          {equipmentItem.templateId && (
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                Template: {equipmentTemplates.find(t => t.id === equipmentItem.templateId)?.name || 'Unknown'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Dialog open={editingEquipment?.id === equipmentItem.id} onOpenChange={(open) => !open && setEditingEquipment(null)}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditEquipment(equipmentItem)}
                                data-testid={`button-edit-equipment-${equipmentItem.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Equipment</DialogTitle>
                              </DialogHeader>
                              <Form {...equipmentForm}>
                                <form onSubmit={equipmentForm.handleSubmit((data) => updateEquipmentMutation.mutate({ id: equipmentItem.id, data }))} className="space-y-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={equipmentForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Equipment Name *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter equipment name" {...field} data-testid="input-edit-equipment-name" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={equipmentForm.control}
                                      name="stockCode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Stock Code *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter stock code" {...field} data-testid="input-edit-equipment-stock-code" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={equipmentForm.control}
                                      name="price"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Price (R)</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01" 
                                              placeholder="0.00" 
                                              {...field} 
                                              data-testid="input-edit-equipment-price" 
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={equipmentForm.control}
                                      name="status"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Status</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value} data-testid="select-edit-equipment-status">
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="in_warehouse">In Warehouse</SelectItem>
                                              <SelectItem value="in_field">In Field</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={equipmentForm.control}
                                      name="barcode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Barcode</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter barcode" {...field} data-testid="input-edit-equipment-barcode" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={equipmentForm.control}
                                      name="qrCode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>QR Code</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter QR code" {...field} data-testid="input-edit-equipment-qr-code" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  {/* Template Selection */}
                                  <FormField
                                    control={equipmentForm.control}
                                    name="templateId"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Equipment Template</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-edit-equipment-template">
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Choose a template or select custom" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="custom">Custom (No Template)</SelectItem>
                                            {equipmentTemplates.map((template: any) => (
                                              <SelectItem key={template.id} value={template.id.toString()}>
                                                {template.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormDescription>
                                          {selectedTemplate && selectedTemplate !== 'custom' 
                                            ? 'Template will auto-select common consumables. You can modify them below.'
                                            : 'Select consumables manually below.'}
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Consumables Multi-Select */}
                                  <FormField
                                    control={equipmentForm.control}
                                    name="consumableIds"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Required Consumables</FormLabel>
                                        <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                                          {consumables.length === 0 ? (
                                            <p className="text-muted-foreground text-sm">No consumables available</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {consumables.map((consumable) => (
                                                <label key={consumable.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                                                  <input
                                                    type="checkbox"
                                                    checked={field.value?.includes(consumable.id) || false}
                                                    onChange={(e) => {
                                                      const currentIds = field.value || [];
                                                      if (e.target.checked) {
                                                        field.onChange([...currentIds, consumable.id]);
                                                      } else {
                                                        field.onChange(currentIds.filter(id => id !== consumable.id));
                                                      }
                                                    }}
                                                    className="rounded border-gray-300"
                                                    data-testid={`checkbox-edit-consumable-${consumable.id}`}
                                                  />
                                                  <div className="flex-1">
                                                    <p className="font-medium text-sm">{consumable.name}</p>
                                                    <p className="text-xs text-muted-foreground">{consumable.stockCode}</p>
                                                  </div>
                                                </label>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <FormDescription>
                                          Select the consumables required for servicing this equipment.
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      onClick={() => setEditingEquipment(null)}
                                      data-testid="button-cancel-edit-equipment"
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      type="submit" 
                                      disabled={updateEquipmentMutation.isPending}
                                      data-testid="button-save-edit-equipment"
                                    >
                                      {updateEquipmentMutation.isPending ? "Updating..." : "Update Equipment"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteEquipment(equipmentItem)}
                            disabled={deleteEquipmentMutation.isPending}
                            data-testid={`button-delete-equipment-${equipmentItem.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {equipmentItem.dateInstalled && (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span className="font-medium">Installed:</span> 
                            <span className="ml-1">{formatDate(equipmentItem.dateInstalled)}</span>
                          </div>
                        )}
                        {equipmentItem.installedAtClientId && (
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="font-medium">Location:</span> 
                            <span className="ml-1">Client #{equipmentItem.installedAtClientId}</span>
                          </div>
                        )}
                        {equipmentItem.barcode && (
                          <div className="flex items-center">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span className="font-medium">Barcode:</span> 
                            <span className="ml-1 font-mono text-xs">{equipmentItem.barcode}</span>
                          </div>
                        )}
                        {equipmentItem.qrCode && (
                          <div className="flex items-center">
                            <QrCode className="h-3 w-3 mr-1" />
                            <span className="font-medium">QR Code:</span> 
                            <span className="ml-1 font-mono text-xs">{equipmentItem.qrCode}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Consumables Tab */}
          <TabsContent value="consumables">
            {filteredConsumables.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No consumables found</h3>
                    <p className="mb-4">
                      {searchQuery ? "Try adjusting your search criteria" : "Get started by adding your first consumable item"}
                    </p>
                    <Button onClick={() => setIsCreateConsumableOpen(true)} data-testid="button-add-first-consumable">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Consumable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredConsumables.map((consumableItem) => (
                  <Card key={consumableItem.id} className="hover:shadow-md transition-shadow" data-testid={`card-consumable-${consumableItem.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CardTitle className="text-lg">{consumableItem.name}</CardTitle>
                            {getStockBadge(consumableItem.currentStock || 0, consumableItem.minStockLevel || 0)}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground mb-1">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span>Code: {consumableItem.stockCode}</span>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Package className="h-3 w-3 mr-1" />
                            <span>Price: {formatPrice(consumableItem.price)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Dialog open={editingConsumable?.id === consumableItem.id} onOpenChange={(open) => !open && setEditingConsumable(null)}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditConsumable(consumableItem)}
                                data-testid={`button-edit-consumable-${consumableItem.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Consumable</DialogTitle>
                              </DialogHeader>
                              <Form {...consumableForm}>
                                <form onSubmit={consumableForm.handleSubmit((data) => updateConsumableMutation.mutate({ id: consumableItem.id, data }))} className="space-y-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={consumableForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Consumable Name *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter consumable name" {...field} data-testid="input-edit-consumable-name" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={consumableForm.control}
                                      name="stockCode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Stock Code *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter stock code" {...field} data-testid="input-edit-consumable-stock-code" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                      control={consumableForm.control}
                                      name="price"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Price (R)</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              step="0.01" 
                                              placeholder="0.00" 
                                              {...field} 
                                              data-testid="input-edit-consumable-price" 
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={consumableForm.control}
                                      name="currentStock"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Current Stock</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              placeholder="0" 
                                              {...field} 
                                              data-testid="input-edit-consumable-current-stock" 
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={consumableForm.control}
                                      name="minStockLevel"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Min Stock Level</FormLabel>
                                          <FormControl>
                                            <Input 
                                              type="number" 
                                              placeholder="0" 
                                              {...field} 
                                              data-testid="input-edit-consumable-min-stock" 
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                      control={consumableForm.control}
                                      name="barcode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Barcode</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter barcode" {...field} data-testid="input-edit-consumable-barcode" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={consumableForm.control}
                                      name="qrCode"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>QR Code</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Enter QR code" {...field} data-testid="input-edit-consumable-qr-code" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      onClick={() => setEditingConsumable(null)}
                                      data-testid="button-cancel-edit-consumable"
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      type="submit" 
                                      disabled={updateConsumableMutation.isPending}
                                      data-testid="button-save-edit-consumable"
                                    >
                                      {updateConsumableMutation.isPending ? "Updating..." : "Update Consumable"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteConsumable(consumableItem)}
                            disabled={deleteConsumableMutation.isPending}
                            data-testid={`button-delete-consumable-${consumableItem.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Current Stock:</span> {consumableItem.currentStock || 0} units
                        </div>
                        <div>
                          <span className="font-medium">Min Stock Level:</span> {consumableItem.minStockLevel || 0} units
                        </div>
                        {consumableItem.barcode && (
                          <div className="flex items-center">
                            <Barcode className="h-3 w-3 mr-1" />
                            <span className="font-medium">Barcode:</span> 
                            <span className="ml-1 font-mono text-xs">{consumableItem.barcode}</span>
                          </div>
                        )}
                        {consumableItem.qrCode && (
                          <div className="flex items-center">
                            <QrCode className="h-3 w-3 mr-1" />
                            <span className="font-medium">QR Code:</span> 
                            <span className="ml-1 font-mono text-xs">{consumableItem.qrCode}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Added: {formatDate(consumableItem.createdAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            {equipmentTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No templates found</h3>
                    <p className="mb-4">
                      Create templates to quickly set up equipment with standard consumables
                    </p>
                    <Button onClick={() => setIsCreateTemplateOpen(true)} data-testid="button-add-first-template">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {equipmentTemplates.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow" data-testid={`card-template-${template.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Dialog open={editingTemplate?.id === template.id} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditTemplate(template)}
                                data-testid={`button-edit-template-${template.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Edit Template</DialogTitle>
                              </DialogHeader>
                              <Form {...templateForm}>
                                <form onSubmit={templateForm.handleSubmit((data) => updateTemplateMutation.mutate({ id: template.id, data }))} className="space-y-6">
                                  <FormField
                                    control={templateForm.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Template Name *</FormLabel>
                                        <FormControl>
                                          <Input placeholder="e.g., Hygiene Station Standard" {...field} data-testid="input-edit-template-name" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={templateForm.control}
                                    name="description"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Brief description of this template" {...field} data-testid="input-edit-template-description" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Consumables Multi-Select */}
                                  <FormField
                                    control={templateForm.control}
                                    name="consumableIds"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Template Consumables *</FormLabel>
                                        <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                                          {consumables.length === 0 ? (
                                            <p className="text-muted-foreground text-sm">No consumables available</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {consumables.map((consumable) => (
                                                <label key={consumable.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                                                  <input
                                                    type="checkbox"
                                                    checked={field.value?.includes(consumable.id) || false}
                                                    onChange={(e) => {
                                                      const currentIds = field.value || [];
                                                      if (e.target.checked) {
                                                        field.onChange([...currentIds, consumable.id]);
                                                      } else {
                                                        field.onChange(currentIds.filter(id => id !== consumable.id));
                                                      }
                                                    }}
                                                    className="rounded border-gray-300"
                                                    data-testid={`checkbox-edit-template-consumable-${consumable.id}`}
                                                  />
                                                  <div className="flex-1">
                                                    <p className="font-medium text-sm">{consumable.name}</p>
                                                    <p className="text-xs text-muted-foreground">{consumable.stockCode}</p>
                                                  </div>
                                                </label>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <FormDescription>
                                          Select the consumables that are typically needed for this equipment type.
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      onClick={() => setEditingTemplate(null)}
                                      data-testid="button-cancel-edit-template"
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      type="submit" 
                                      disabled={updateTemplateMutation.isPending}
                                      data-testid="button-save-edit-template"
                                    >
                                      {updateTemplateMutation.isPending ? "Updating..." : "Update Template"}
                                    </Button>
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteTemplate(template)}
                            disabled={deleteTemplateMutation.isPending}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Created:</span> {formatDate(template.createdAt)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Bulk Upload Dialog */}
        <BulkUploadDialog
          open={isBulkUploadOpen}
          onOpenChange={setIsBulkUploadOpen}
          entityType={activeTab as "clients" | "equipment" | "consumables"}
          onSuccess={() => {
            // Refresh the appropriate data based on active tab
            if (activeTab === "equipment") {
              queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
            } else if (activeTab === "consumables") {
              queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
            }
            toast({
              title: "Bulk Upload Complete",
              description: "Your data has been uploaded successfully",
            });
          }}
        />
      </div>
    </div>
  );
}