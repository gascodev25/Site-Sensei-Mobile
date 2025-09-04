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
  insertServiceTeamSchema 
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

  app.post('/api/equipment', isAuthenticated, async (req, res) => {
    try {
      const equipmentData = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(equipmentData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'create',
        entityType: 'equipment',
        entityId: equipment.id,
        metadata: { equipmentName: equipment.name, stockCode: equipment.stockCode }
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
      const equipmentData = insertEquipmentSchema.partial().parse(req.body);
      const equipment = await storage.updateEquipment(id, equipmentData);
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'update',
        entityType: 'equipment',
        entityId: equipment.id,
        metadata: { equipmentName: equipment.name, stockCode: equipment.stockCode }
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

  const httpServer = createServer(app);
  return httpServer;
}
