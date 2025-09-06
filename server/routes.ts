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
  insertLocationSchema,
  insertStockMovementSchema
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

  // Warehouse Location routes
  app.get('/api/locations', isAuthenticated, async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get('/api/locations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const location = await storage.getLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  app.post('/api/locations', isAuthenticated, async (req, res) => {
    try {
      const locationData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(locationData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'location',
        entityId: location.id,
        metadata: { locationName: location.name, type: location.type }
      });
      
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put('/api/locations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const locationData = insertLocationSchema.partial().parse(req.body);
      const location = await storage.updateLocation(id, locationData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'location',
        entityId: location.id,
        metadata: { locationName: location.name, type: location.type }
      });
      
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete('/api/locations/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLocation(id);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'location',
        entityId: id,
        metadata: {}
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Stock Movement routes
  app.post('/api/stock-movements', isAuthenticated, async (req, res) => {
    try {
      const movementData = insertStockMovementSchema.parse({
        ...req.body,
        movedBy: req.user?.claims?.sub
      });
      const movement = await storage.createStockMovement(movementData);
      res.status(201).json(movement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating stock movement:", error);
      res.status(500).json({ message: "Failed to create stock movement" });
    }
  });

  app.get('/api/stock-movements', isAuthenticated, async (req, res) => {
    try {
      const movements = await storage.getStockMovements();
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  app.get('/api/stock-movements/item/:itemType/:itemId', isAuthenticated, async (req, res) => {
    try {
      const { itemType, itemId } = req.params;
      const movements = await storage.getStockMovementsByItem(itemType, parseInt(itemId));
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements by item:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  app.get('/api/stock-movements/location/:locationId', isAuthenticated, async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const movements = await storage.getStockMovementsByLocation(locationId);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements by location:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // Stock Balance queries
  app.get('/api/stock/consumable/:consumableId/location/:locationId', isAuthenticated, async (req, res) => {
    try {
      const { consumableId, locationId } = req.params;
      const quantity = await storage.getConsumableStockByLocation(parseInt(consumableId), parseInt(locationId));
      res.json({ consumableId: parseInt(consumableId), locationId: parseInt(locationId), quantity });
    } catch (error) {
      console.error("Error fetching consumable stock by location:", error);
      res.status(500).json({ message: "Failed to fetch stock balance" });
    }
  });

  app.get('/api/stock/consumable/:consumableId/all-locations', isAuthenticated, async (req, res) => {
    try {
      const consumableId = parseInt(req.params.consumableId);
      const stockByLocation = await storage.getAllConsumableStock(consumableId);
      res.json(stockByLocation);
    } catch (error) {
      console.error("Error fetching consumable stock by all locations:", error);
      res.status(500).json({ message: "Failed to fetch stock distribution" });
    }
  });

  app.get('/api/stock/equipment/:equipmentId/location', isAuthenticated, async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const location = await storage.getEquipmentLocation(equipmentId);
      res.json(location);
    } catch (error) {
      console.error("Error fetching equipment location:", error);
      res.status(500).json({ message: "Failed to fetch equipment location" });
    }
  });

  // Stock Summary routes (warehouse vs field stock levels)
  app.get('/api/stock/summary/warehouse-vs-field', isAuthenticated, async (req, res) => {
    try {
      const locations = await storage.getLocations();
      const consumables = await storage.getConsumables();
      
      const stockSummary = {
        warehouse: { consumables: [] as any[], equipment: [] as any[] },
        field: { consumables: [] as any[], equipment: [] as any[] }
      };
      
      // Get consumable stock by location type
      for (const consumable of consumables) {
        let warehouseTotal = 0;
        let fieldTotal = 0;
        
        for (const location of locations) {
          const quantity = await storage.getConsumableStockByLocation(consumable.id, location.id);
          if (location.type === 'warehouse') {
            warehouseTotal += quantity;
          } else if (location.type === 'service_team') {
            fieldTotal += quantity;
          }
        }
        
        if (warehouseTotal > 0 || fieldTotal > 0) {
          stockSummary.warehouse.consumables.push({
            ...consumable,
            quantity: warehouseTotal
          });
          stockSummary.field.consumables.push({
            ...consumable,
            quantity: fieldTotal
          });
        }
      }
      
      res.json(stockSummary);
    } catch (error) {
      console.error("Error fetching warehouse vs field stock summary:", error);
      res.status(500).json({ message: "Failed to fetch stock summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
