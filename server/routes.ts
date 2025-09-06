import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertClientSchema, 
  insertEquipmentSchema, 
  insertConsumableSchema, 
  insertServiceSchema, 
  insertTeamMemberSchema, 
  insertServiceTeamSchema,
  insertEquipmentTemplateSchema,
  insertTemplateConsumableSchema,
  serviceCompletionSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/metrics', isAuthenticated, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Client routes
  app.get('/api/clients', isAuthenticated, async (req, res) => {
    try {
      const { search } = req.query;
      let clients;
      if (search && typeof search === 'string') {
        clients = await storage.searchClients(search);
      } else {
        clients = await storage.getClients();
      }
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get('/api/clients/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post('/api/clients', isAuthenticated, async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'client',
        entityId: client.id,
        metadata: { clientName: client.name }
      });
      
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put('/api/clients/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, clientData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'client',
        entityId: client.id,
        metadata: { changes: clientData }
      });
      
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete('/api/clients/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClient(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'client',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Equipment routes
  app.get('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      let equipment;
      if (status && typeof status === 'string') {
        equipment = await storage.getEquipmentByStatus(status);
      } else {
        equipment = await storage.getEquipment();
      }
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  app.get('/api/equipment/:id/consumables', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const equipment = await storage.getEquipmentWithConsumables(id);
      res.json(equipment?.equipmentConsumables || []);
    } catch (error) {
      console.error("Error fetching equipment consumables:", error);
      res.status(500).json({ message: "Failed to fetch equipment consumables" });
    }
  });

  app.post('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const { consumableIds, ...equipmentData } = req.body;
      const parsedEquipmentData = insertEquipmentSchema.parse(equipmentData);
      
      let equipment;
      if (consumableIds && consumableIds.length > 0) {
        equipment = await storage.createEquipmentWithConsumables(parsedEquipmentData, consumableIds);
      } else {
        equipment = await storage.createEquipment(parsedEquipmentData);
      }
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'equipment',
        entityId: equipment.id,
        metadata: { equipmentName: equipment.name, stockCode: equipment.stockCode, consumableIds: consumableIds || [] }
      });
      
      res.status(201).json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating equipment:", error);
      res.status(500).json({ message: "Failed to create equipment" });
    }
  });

  app.put('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { consumableIds, ...equipmentData } = req.body;
      const parsedEquipmentData = insertEquipmentSchema.partial().parse(equipmentData);
      
      const equipment = await storage.updateEquipment(id, parsedEquipmentData);
      
      // Update consumables if provided
      if (consumableIds !== undefined) {
        await storage.updateEquipmentConsumables(id, consumableIds);
      }
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'equipment',
        entityId: equipment.id,
        metadata: { equipmentName: equipment.name, stockCode: equipment.stockCode, consumableIds: consumableIds || [] }
      });
      
      res.json(equipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating equipment:", error);
      res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  app.delete('/api/equipment/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEquipment(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'equipment',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting equipment:", error);
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  // Equipment Templates routes
  app.get('/api/equipment-templates', isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getEquipmentTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching equipment templates:", error);
      res.status(500).json({ message: "Failed to fetch equipment templates" });
    }
  });

  app.get('/api/equipment-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getEquipmentTemplateWithConsumables(id);
      if (!template) {
        return res.status(404).json({ message: "Equipment template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching equipment template:", error);
      res.status(500).json({ message: "Failed to fetch equipment template" });
    }
  });

  app.post('/api/equipment-templates', isAuthenticated, async (req, res) => {
    try {
      const { consumableIds, ...templateData } = req.body;
      const parsedTemplateData = insertEquipmentTemplateSchema.parse({
        ...templateData,
        createdBy: req.user?.claims?.sub
      });
      
      const template = await storage.createEquipmentTemplate(parsedTemplateData, consumableIds || []);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'equipment_template',
        entityId: template.id,
        metadata: { templateName: template.name, consumableIds }
      });
      
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating equipment template:", error);
      res.status(500).json({ message: "Failed to create equipment template" });
    }
  });

  app.put('/api/equipment-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { consumableIds, ...templateData } = req.body;
      const parsedTemplateData = insertEquipmentTemplateSchema.partial().parse(templateData);
      
      const template = await storage.updateEquipmentTemplate(id, parsedTemplateData, consumableIds || []);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'equipment_template',
        entityId: template.id,
        metadata: { templateName: template.name, consumableIds }
      });
      
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating equipment template:", error);
      res.status(500).json({ message: "Failed to update equipment template" });
    }
  });

  app.get('/api/equipment-templates/:id/consumables', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getEquipmentTemplateWithConsumables(id);
      res.json(template?.templateConsumables || []);
    } catch (error) {
      console.error("Error fetching template consumables:", error);
      res.status(500).json({ message: "Failed to fetch template consumables" });
    }
  });

  app.delete('/api/equipment-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEquipmentTemplate(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'equipment_template',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting equipment template:", error);
      res.status(500).json({ message: "Failed to delete equipment template" });
    }
  });

  // Consumables routes
  app.get('/api/consumables', isAuthenticated, async (req, res) => {
    try {
      const { lowStock } = req.query;
      let consumables;
      if (lowStock === 'true') {
        consumables = await storage.getLowStockConsumables();
      } else {
        consumables = await storage.getConsumables();
      }
      res.json(consumables);
    } catch (error) {
      console.error("Error fetching consumables:", error);
      res.status(500).json({ message: "Failed to fetch consumables" });
    }
  });

  app.post('/api/consumables', isAuthenticated, async (req, res) => {
    try {
      const consumableData = insertConsumableSchema.parse(req.body);
      const consumable = await storage.createConsumable(consumableData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'consumable',
        entityId: consumable.id,
        metadata: { consumableName: consumable.name, stockCode: consumable.stockCode }
      });
      
      res.status(201).json(consumable);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating consumable:", error);
      res.status(500).json({ message: "Failed to create consumable" });
    }
  });

  app.put('/api/consumables/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const consumableData = insertConsumableSchema.partial().parse(req.body);
      const consumable = await storage.updateConsumable(id, consumableData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'consumable',
        entityId: consumable.id,
        metadata: { consumableName: consumable.name, stockCode: consumable.stockCode }
      });
      
      res.json(consumable);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating consumable:", error);
      res.status(500).json({ message: "Failed to update consumable" });
    }
  });

  app.delete('/api/consumables/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConsumable(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'consumable',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting consumable:", error);
      res.status(500).json({ message: "Failed to delete consumable" });
    }
  });

  // Services routes
  app.get('/api/services', isAuthenticated, async (req, res) => {
    try {
      const { status, date, search } = req.query;
      let services;
      
      if (search && typeof search === 'string') {
        services = await storage.searchServices(search);
      } else if (status && typeof status === 'string') {
        services = await storage.getServicesByStatus(status);
      } else if (date && typeof date === 'string') {
        services = await storage.getServicesForDate(new Date(date));
      } else {
        services = await storage.getServices();
      }
      
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.get('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const service = await storage.getServiceWithStockItems(id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.get('/api/services/ready-for-invoicing', isAuthenticated, async (req, res) => {
    try {
      const services = await storage.getServicesReadyForInvoicing();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services ready for invoicing:", error);
      res.status(500).json({ message: "Failed to fetch services ready for invoicing" });
    }
  });

  app.post('/api/services', isAuthenticated, async (req, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'service',
        entityId: service.id,
        metadata: { serviceType: service.type, clientId: service.clientId }
      });
      
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const serviceData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(id, serviceData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'service',
        entityId: service.id,
        metadata: { changes: serviceData }
      });
      
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  // Complete service endpoint
  app.post('/api/services/:id/complete', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate service ID
      if (!id || id <= 0) {
        return res.status(400).json({ message: "Invalid service ID" });
      }
      
      // Permission check: Only ops_manager or team_member can mark services as complete
      const user = await storage.getUser(req.user?.claims?.sub);
      if (!user || !user.roles) {
        return res.status(403).json({ message: "User not found or no roles assigned" });
      }
      
      const hasRole = (role: string) => user.roles?.split(",").includes(role);
      const canMarkComplete = hasRole("ops_manager") || hasRole("team_member");
      
      if (!canMarkComplete) {
        return res.status(403).json({ 
          message: "Unauthorized: Only operations managers and team members can complete services" 
        });
      }
      
      // Validate request body using safeParse
      const validationResult = serviceCompletionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationResult.error.errors 
        });
      }
      
      const { equipmentItems, consumableItems, convertToContract, serviceInterval, contractLengthMonths } = validationResult.data;
      
      // Get the specific date for this completion (from request body or current date)
      const completionDate = req.body.completionDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Validate equipment IDs exist in database
      if (equipmentItems && equipmentItems.length > 0) {
        const equipmentIds = equipmentItems.map(item => item.id);
        const existingEquipment = await storage.getEquipment();
        const existingEquipmentIds = existingEquipment.map(eq => eq.id);
        
        const invalidEquipmentIds = equipmentIds.filter(id => !existingEquipmentIds.includes(id));
        if (invalidEquipmentIds.length > 0) {
          return res.status(400).json({ 
            message: `Invalid equipment IDs: ${invalidEquipmentIds.join(', ')}. These equipment items do not exist.`
          });
        }
      }
      
      // Validate consumable IDs exist in database
      if (consumableItems && consumableItems.length > 0) {
        const consumableIds = consumableItems.map(item => item.id);
        const existingConsumables = await storage.getConsumables();
        const existingConsumableIds = existingConsumables.map(c => c.id);
        
        const invalidConsumableIds = consumableIds.filter(id => !existingConsumableIds.includes(id));
        if (invalidConsumableIds.length > 0) {
          return res.status(400).json({ 
            message: `Invalid consumable IDs: ${invalidConsumableIds.join(', ')}. These consumable items do not exist.`
          });
        }
      }
      
      // Get the existing service
      const existingService = await storage.getService(id);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      // Check if service is already completed (idempotent operation)
      if (existingService.status === 'completed') {
        return res.json(existingService);
      }

      // Prepare update data - handle recurring vs non-recurring services differently
      const updateData: any = {};
      const isRecurring = existingService.recurrencePattern && 
                         typeof existingService.recurrencePattern === 'object' && 
                         existingService.recurrencePattern !== null &&
                         'interval' in existingService.recurrencePattern;

      if (isRecurring) {
        // For recurring services: Add to completedDates but keep service status as scheduled
        const currentCompletedDates = (existingService.completedDates as string[]) || [];
        if (!currentCompletedDates.includes(completionDate)) {
          updateData.completedDates = [...currentCompletedDates, completionDate];
        }
        // Don't change the main service status for recurring services
      } else {
        // For non-recurring services: Mark as completed normally
        updateData.status = 'completed';
        updateData.completedAt = new Date();
      }

      // If it's an installation and conversion is requested
      if (existingService.type === 'installation' && convertToContract) {
        updateData.type = 'service_contract';
        updateData.contractLengthMonths = contractLengthMonths || 12;
        
        // Set recurrence pattern based on service interval
        if (serviceInterval) {
          const endDate = new Date(existingService.installationDate || new Date());
          endDate.setMonth(endDate.getMonth() + (contractLengthMonths || 12));
          
          updateData.recurrencePattern = {
            interval: serviceInterval,
            end_date: endDate.toISOString().split('T')[0]
          };
          
          // Mark the installation date as completed in the new service contract
          const installationDateString = existingService.installationDate 
            ? new Date(existingService.installationDate).toISOString().split('T')[0]
            : completionDate;
          
          const currentCompletedDates = (existingService.completedDates as string[]) || [];
          if (!currentCompletedDates.includes(installationDateString)) {
            updateData.completedDates = [...currentCompletedDates, installationDateString];
          }
        }
      }

      // Update equipment and consumable items if provided
      // For service contracts: merge new items with existing template items
      // For installations/one-off services: replace items entirely
      if (equipmentItems) {
        if (existingService.type === 'service_contract' || updateData.type === 'service_contract') {
          // Get existing equipment items from service
          const existingServiceWithItems = await storage.getServiceWithStockItems(id);
          const existingEquipmentItems = existingServiceWithItems?.equipmentItems || [];
          
          // Create a map of existing items by ID for easy lookup
          const existingEquipmentMap = new Map(
            existingEquipmentItems.map((item: any) => [item.id, item])
          );
          
          // Merge new items with existing ones
          const mergedEquipmentItems = [...existingEquipmentItems];
          
          for (const newItem of equipmentItems) {
            const existingIndex = mergedEquipmentItems.findIndex((item: any) => item.id === newItem.id);
            if (existingIndex >= 0) {
              // Update existing item quantity (use the new quantity)
              mergedEquipmentItems[existingIndex] = newItem;
            } else {
              // Add new item to template
              mergedEquipmentItems.push(newItem);
            }
          }
          
          updateData.equipmentItems = mergedEquipmentItems;
        } else {
          updateData.equipmentItems = equipmentItems;
        }
      }
      
      if (consumableItems) {
        if (existingService.type === 'service_contract' || updateData.type === 'service_contract') {
          // Get existing consumable items from service
          const existingServiceWithItems = await storage.getServiceWithStockItems(id);
          const existingConsumableItems = existingServiceWithItems?.consumableItems || [];
          
          // Create a map of existing items by ID for easy lookup
          const existingConsumableMap = new Map(
            existingConsumableItems.map((item: any) => [item.id, item])
          );
          
          // Merge new items with existing ones
          const mergedConsumableItems = [...existingConsumableItems];
          
          for (const newItem of consumableItems) {
            const existingIndex = mergedConsumableItems.findIndex((item: any) => item.id === newItem.id);
            if (existingIndex >= 0) {
              // Update existing item quantity (use the new quantity)
              mergedConsumableItems[existingIndex] = newItem;
            } else {
              // Add new item to template
              mergedConsumableItems.push(newItem);
            }
          }
          
          updateData.consumableItems = mergedConsumableItems;
        } else {
          updateData.consumableItems = consumableItems;
        }
      }

      // Update the service
      const service = await storage.updateService(id, updateData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'complete',
        entityType: 'service',
        entityId: service.id,
        metadata: { 
          convertedToContract: convertToContract,
          equipmentItems: equipmentItems?.length || 0,
          consumableItems: consumableItems?.length || 0,
          serviceInterval: serviceInterval,
          contractLengthMonths: contractLengthMonths
        }
      });
      
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error completing service:", error);
      res.status(500).json({ message: "Failed to complete service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteService(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'service',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Team routes
  app.get('/api/team-members', isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.get('/api/service-teams', isAuthenticated, async (req, res) => {
    try {
      const teams = await storage.getServiceTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching service teams:", error);
      res.status(500).json({ message: "Failed to fetch service teams" });
    }
  });

  app.post('/api/team-members', isAuthenticated, async (req, res) => {
    try {
      const memberData = insertTeamMemberSchema.parse(req.body);
      // Convert "none" to null for skill field
      if (memberData.skill === "none") {
        memberData.skill = null;
      }
      const member = await storage.createTeamMember(memberData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'team_member',
        entityId: member.id,
        metadata: { memberName: member.name, skill: member.skill }
      });
      
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating team member:", error);
      res.status(500).json({ message: "Failed to create team member" });
    }
  });

  app.post('/api/service-teams', isAuthenticated, async (req, res) => {
    try {
      const teamData = insertServiceTeamSchema.parse(req.body);
      const team = await storage.createServiceTeam(teamData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'service_team',
        entityId: team.id,
        metadata: { teamName: team.name }
      });
      
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating service team:", error);
      res.status(500).json({ message: "Failed to create service team" });
    }
  });

  app.put('/api/team-members/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const memberData = insertTeamMemberSchema.partial().parse(req.body);
      // Convert "none" to null for skill field
      if (memberData.skill === "none") {
        memberData.skill = null;
      }
      const member = await storage.updateTeamMember(id, memberData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'team_member',
        entityId: member.id,
        metadata: { memberName: member.name, skill: member.skill }
      });
      
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating team member:", error);
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  app.delete('/api/team-members/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTeamMember(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'team_member',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team member:", error);
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  app.put('/api/service-teams/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const teamData = insertServiceTeamSchema.partial().parse(req.body);
      const team = await storage.updateServiceTeam(id, teamData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'service_team',
        entityId: team.id,
        metadata: { teamName: team.name }
      });
      
      res.json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating service team:", error);
      res.status(500).json({ message: "Failed to update service team" });
    }
  });

  app.delete('/api/service-teams/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteServiceTeam(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'service_team',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service team:", error);
      res.status(500).json({ message: "Failed to delete service team" });
    }
  });

  app.get('/api/team-assignments', isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getTeamAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching team assignments:", error);
      res.status(500).json({ message: "Failed to fetch team assignments" });
    }
  });

  app.put('/api/service-teams/:id/assignments', isAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { memberIds } = req.body;
      await storage.updateTeamAssignments(teamId, memberIds);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'team_assignment',
        entityId: teamId,
        metadata: { memberIds }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating team assignments:", error);
      res.status(500).json({ message: "Failed to update team assignments" });
    }
  });

  // Service Stock Assignment routes
  app.post('/api/service-stock', isAuthenticated, async (req, res) => {
    try {
      const { serviceId, equipmentId, consumableId, quantity } = req.body;
      
      const payload: any = {
        serviceId,
        quantity: quantity || 1,
      };
      
      if (equipmentId) {
        payload.equipmentId = equipmentId;
      }
      
      if (consumableId) {
        payload.consumableId = consumableId;
      }
      
      const assignment = await storage.createServiceStockAssignment(payload);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'service_stock',
        entityId: assignment.id,
        metadata: { serviceId, equipmentId, consumableId, quantity }
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating service stock assignment:", error);
      res.status(500).json({ message: "Failed to create service stock assignment" });
    }
  });

  app.get('/api/services/:id/stock', isAuthenticated, async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const assignments = await storage.getServiceStockAssignments(serviceId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching service stock assignments:", error);
      res.status(500).json({ message: "Failed to fetch service stock assignments" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
