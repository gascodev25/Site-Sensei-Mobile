import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupLocalAuth, hashPassword } from "./localAuth";
import { 
  insertClientSchema, 
  insertEquipmentSchema, 
  insertConsumableSchema, 
  insertServiceSchema, 
  insertTeamMemberSchema, 
  insertServiceTeamSchema,
  insertEquipmentTemplateSchema,
  insertTemplateConsumableSchema,
  serviceCompletionSchema,
  insertUserSchema,
  insertFieldReportSchema,
} from "@shared/schema";
import { generateOccurrences } from "@shared/recurrence";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  await setupLocalAuth();

  // Bootstrap superuser endpoint (can be called multiple times to ensure Gavin's account)
  app.post('/api/auth/bootstrap', async (req, res) => {
    try {
      const email = "gavin@gasco.digital";
      
      // Check if Gavin already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // Update existing user to ensure superuser role and correct password
        const passwordHash = await hashPassword("ChangeMe123!");
        await storage.updateUser(existingUser.id, {
          firstName: "Gavin",
          lastName: "Green",
          roles: "superuser",
          passwordHash,
        });
        
        return res.status(200).json({ 
          message: "Superuser account updated successfully",
          email: email,
          temporaryPassword: "ChangeMe123!"
        });
      }

      // Create new superuser account
      const passwordHash = await hashPassword("ChangeMe123!");
      const superuser = await storage.createPasswordUser({
        email: email,
        passwordHash,
        firstName: "Gavin",
        lastName: "Green",
        roles: "superuser",
      });

      res.status(201).json({ 
        message: "Superuser account created successfully",
        email: superuser.email,
        temporaryPassword: "ChangeMe123!"
      });
    } catch (error) {
      console.error("Error bootstrapping superuser:", error);
      res.status(500).json({ message: "Failed to bootstrap system" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as any;
      // For local auth users, req.user is already the User object
      // For OAuth users, we need to get it from claims
      if (user.claims) {
        const userId = user.claims.sub;
        const dbUser = await storage.getUser(userId);
        res.json(dbUser);
      } else {
        // Local auth user
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
          linkedTeamId: user.linkedTeamId ?? null,
        });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper to get user with roles from database
  const getUserWithRoles = async (req: any) => {
    const currentUser = req.user as any;
    if (currentUser.claims) {
      // OAuth user - fetch from database to get roles
      const dbUser = await storage.getUser(currentUser.claims.sub);
      return dbUser;
    }
    // Local user - already has all data
    return currentUser;
  };

  // User Management routes (superuser and manager only)
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || 'user';

      // Only superuser and manager can list users
      if (!userRoles.includes('superuser') && !userRoles.includes('manager')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const users = await storage.getAllUsers();
      // Don't send password hashes to frontend
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles,
        createdAt: u.createdAt,
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || 'user';

      // Only superuser and manager can create users
      if (!userRoles.includes('superuser') && !userRoles.includes('manager')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userData = insertUserSchema.parse(req.body);

      if (!userData.password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Hash the password
      const passwordHash = await hashPassword(userData.password);

      const newUser = await storage.createPasswordUser({
        email: userData.email,
        passwordHash,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        roles: userData.roles || 'user',
      });

      res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        roles: newUser.roles,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || 'user';

      // Only superuser and manager can update users
      if (!userRoles.includes('superuser') && !userRoles.includes('manager')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.id;
      const updateData = insertUserSchema.partial().parse(req.body);

      const rawBody = req.body as any;
      const updates: any = {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        roles: updateData.roles,
      };

      // Allow managers/superusers to assign a user to a team (for mobile app field users)
      if (rawBody.linkedTeamId !== undefined) {
        updates.linkedTeamId = rawBody.linkedTeamId === null ? null : parseInt(rawBody.linkedTeamId);
      }

      // If password is being changed, hash it
      if (updateData.password) {
        updates.passwordHash = await hashPassword(updateData.password);
      }

      const updatedUser = await storage.updateUser(userId, updates);

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        roles: updatedUser.roles,
        linkedTeamId: updatedUser.linkedTeamId ?? null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || 'user';
      const currentUserId = user?.id;

      // Only superuser can delete users
      if (!userRoles.includes('superuser')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userId = req.params.id;

      // Prevent deleting yourself
      if (userId === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
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

  app.get('/api/geocode/search', isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 3) {
        return res.json([]);
      }

      const params = new URLSearchParams({
        format: 'json',
        q: query,
        countrycodes: 'za',
        addressdetails: '1',
        limit: '5',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'ACGWorksApp/1.0',
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim responded with ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Geocode search error:", error);
      res.status(500).json({ message: "Address search failed" });
    }
  });

  app.get('/api/dashboard/missed-services', isAuthenticated, async (req, res) => {
    try {
      const servicesList = await storage.getServices();
      const now = new Date();
      
      // Helper to convert UTC date to SAST date string (YYYY-MM-DD)
      const toSASTDateString = (date: Date): string => {
        // SAST is UTC+2, so add 2 hours to get the correct local date
        const sastDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
        return sastDate.toISOString().substring(0, 10);
      };
      
      // Get services that could have missed occurrences
      const eligibleServices = servicesList.filter(s => 
        s.status !== 'completed' && s.installationDate && new Date(s.installationDate) <= now
      );
      
      // Calculate missed occurrences for each service
      const missedOccurrences: Array<{service: any, missedDate: string}> = [];
      
      for (const service of eligibleServices) {
        const installDate = new Date(service.installationDate!);
        const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;
        const completedDates = (service.completedDates || []) as string[];
        const excludedDates = (service.excludedDates || []) as string[];
        
        // For non-recurring services
        if (!recurrencePattern || !recurrencePattern.interval) {
          missedOccurrences.push({ service, missedDate: toSASTDateString(installDate) });
          continue;
        }
        
        const endDate = recurrencePattern.end_date ? new Date(recurrencePattern.end_date) : null;
        
        const completedSet = new Set(completedDates.map(d => d.substring(0, 10)));
        
        const occurrences = generateOccurrences(installDate, recurrencePattern.interval, {
          rangeEnd: now,
          endDate,
          excludedDates,
        });
        
        for (const occDate of occurrences) {
          const dateStr = toSASTDateString(occDate);
          if (!completedSet.has(dateStr)) {
            missedOccurrences.push({ service, missedDate: dateStr });
          }
        }
      }
      
      // Sort by missed date descending (most recent first)
      missedOccurrences.sort((a, b) => b.missedDate.localeCompare(a.missedDate));
      
      res.json(missedOccurrences);
    } catch (error) {
      console.error("Error fetching missed services:", error);
      res.status(500).json({ message: "Failed to fetch missed services" });
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
      const { status, withClientInfo } = req.query;
      let equipment;

      if (withClientInfo === 'true') {
        equipment = await storage.getEquipmentWithClientInfo();
        if (status && typeof status === 'string') {
          equipment = equipment.filter(e => e.status === status);
        }
      } else if (status && typeof status === 'string') {
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

  app.get('/api/services/ready-for-invoicing', isAuthenticated, async (req, res) => {
    try {
      const services = await storage.getServicesReadyForInvoicing();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services ready for invoicing:", error);
      res.status(500).json({ message: "Failed to fetch services ready for invoicing" });
    }
  });

  app.get('/api/services/completed', isAuthenticated, async (req, res) => {
    try {
      const interval = req.query.interval as string | undefined;
      const completedServices = await storage.getCompletedServices(interval);
      res.json(completedServices);
    } catch (error) {
      console.error("Error fetching completed services:", error);
      res.status(500).json({ message: "Failed to fetch completed services" });
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

  app.patch('/api/services/:id/mark-invoiced', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!id || id <= 0) {
        return res.status(400).json({ message: "Invalid service ID" });
      }

      const user = await getUserWithRoles(req);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const occurrenceDate = req.body?.occurrenceDate as string | undefined;

      const service = await storage.getService(id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const isRecurring = !!(
        service.recurrencePattern &&
        typeof service.recurrencePattern === 'object' &&
        'interval' in (service.recurrencePattern as object)
      );

      if (isRecurring) {
        const completedDates = (service.completedDates as string[] | null) || [];
        if (occurrenceDate && !completedDates.includes(occurrenceDate)) {
          return res.status(400).json({ message: "Occurrence date not found in completed dates" });
        }
        if (!occurrenceDate && completedDates.length === 0) {
          return res.status(400).json({ message: "No completed occurrences to invoice" });
        }
      } else if (service.status !== 'completed') {
        return res.status(400).json({ message: "Only completed services can be invoiced" });
      }

      const updated = await storage.markServiceInvoiced(id, user.id, occurrenceDate);

      await storage.createAuditLog({
        userId: user.id,
        action: 'mark_invoiced',
        entityType: 'service',
        entityId: id,
        metadata: { invoicedBy: user.id },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error marking service as invoiced:", error);
      res.status(500).json({ message: "Failed to mark service as invoiced" });
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

      const existingServiceWithStock = await storage.getServiceWithStockItems(id);
      const oldEquipmentIds = (existingServiceWithStock?.equipmentItems || []).map((item: any) => item.id);
      const newEquipmentIds = ((serviceData as any).equipmentItems || []).map((item: any) => item.id);

      const service = await storage.updateService(id, serviceData);

      if ((serviceData as any).equipmentItems !== undefined) {
        const removedEquipmentIds = oldEquipmentIds.filter((eqId: number) => !newEquipmentIds.includes(eqId));
        for (const equipmentId of removedEquipmentIds) {
          await storage.updateEquipment(equipmentId, {
            status: 'in_warehouse',
            installedAtClientId: null,
            dateInstalled: null
          });
        }

        const addedEquipmentIds = newEquipmentIds.filter((eqId: number) => !oldEquipmentIds.includes(eqId));
        for (const equipmentId of addedEquipmentIds) {
          await storage.updateEquipment(equipmentId, {
            status: 'in_field',
            installedAtClientId: service.clientId,
            dateInstalled: new Date()
          });
        }
      }

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
      const user = await getUserWithRoles(req);
      if (!user || !user.roles) {
        return res.status(403).json({ message: "User not found or no roles assigned" });
      }

      const hasRole = (role: string) => user.roles?.split(",").includes(role);
      const canMarkComplete = hasRole("superuser") || hasRole("ops_manager") || hasRole("team_member");

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
      const completionDate = validationResult.data.completionDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

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

      // Initialize update data
      const updateData: any = {};

      // Step 1: Determine if we're converting installation to contract
      let willBeRecurring = false;

      if (existingService.type === 'installation' && convertToContract) {
        // Convert to service contract
        updateData.type = 'service_contract';
        updateData.contractLengthMonths = contractLengthMonths || 12;

        // Set recurrence pattern if service interval provided
        if (serviceInterval) {
          const endDate = new Date(existingService.installationDate || new Date());
          endDate.setMonth(endDate.getMonth() + (contractLengthMonths || 12));

          updateData.recurrencePattern = {
            interval: serviceInterval,
            end_date: endDate.toISOString().split('T')[0]
          };

          willBeRecurring = true;
        }
      }

      // Steps 2-3: Update service status via shared helper (same logic used by /api/field-reports)
      // updateData already contains Step 1 conversion fields if applicable

      // Step 4: Handle equipment status changes
      // Only process equipment status changes if equipment items are provided
      if (equipmentItems && equipmentItems.length > 0) {
        // Get current equipment items for this service
        const currentServiceWithStock = await storage.getServiceWithStockItems(id);
        const currentEquipmentIds = (currentServiceWithStock?.equipmentItems || []).map((item: any) => item.id);
        const newEquipmentIds = equipmentItems.map(item => item.id);

        // Equipment being removed from service (was in service, now not) - return to warehouse
        const removedEquipmentIds = currentEquipmentIds.filter((eqId: number) => !newEquipmentIds.includes(eqId));
        for (const equipmentId of removedEquipmentIds) {
          await storage.updateEquipment(equipmentId, {
            status: 'in_warehouse',
            installedAtClientId: null,
            dateInstalled: null
          });
        }

        // For installations and first-time service contracts, mark ALL equipment as in_field
        // For subsequent recurring service completions, equipment should already be in_field
        if (existingService.type === 'installation' || (existingService.type === 'service_contract' && !currentEquipmentIds.length)) {
          // Installation or initial service contract setup: Update all equipment to in_field
          for (const equipmentId of newEquipmentIds) {
            await storage.updateEquipment(equipmentId, {
              status: 'in_field',
              installedAtClientId: existingService.clientId,
              dateInstalled: new Date()
            });
          }
        } else {
          // Recurring service: Only update newly added equipment to in_field
          const addedEquipmentIds = newEquipmentIds.filter(eqId => !currentEquipmentIds.includes(eqId));
          for (const equipmentId of addedEquipmentIds) {
            await storage.updateEquipment(equipmentId, {
              status: 'in_field',
              installedAtClientId: existingService.clientId,
              dateInstalled: new Date()
            });
          }
        }
      }

      // Step 5: Add equipment and consumable items if provided
      if (equipmentItems && equipmentItems.length > 0) {
        updateData.equipmentItems = equipmentItems;
      }
      if (consumableItems && consumableItems.length > 0) {
        updateData.consumableItems = consumableItems;
      }

      // Steps 2-3 + service update: use shared helper so logic is identical to field reports
      const service = await coreUpdateServiceStatus(
        existingService,
        completionDate,
        updateData,
        willBeRecurring
      );

      // Step 6: Deduct consumable stock via shared helper (same logic as field reports)
      await coreDeductConsumableStock(id, consumableItems || []);

      // Audit log
      await storage.createAuditLog({
        userId: user.id,
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

  // Split recurring service endpoint
  app.post('/api/services/:id/split', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { splitDate, newInterval, newEquipmentItems, newConsumableItems } = req.body;

      if (!splitDate || !newInterval) {
        return res.status(400).json({ message: "Split date and new interval are required" });
      }

      // Get the original service
      const originalService = await storage.getService(id);
      if (!originalService) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Verify it's a recurring service
      const recurrencePattern = originalService.recurrencePattern as { interval?: string; end_date?: string } | null;
      if (!recurrencePattern || !recurrencePattern.interval) {
        return res.status(400).json({ message: "Can only split recurring services" });
      }

      // Get original service's stock items (equipment and consumables)
      const originalServiceWithStock = await storage.getServiceWithStockItems(id);

      // Determine which equipment and consumables to use for new service
      // Use new items if provided, otherwise copy from original
      const equipmentItems = newEquipmentItems || 
        (originalServiceWithStock?.equipmentItems?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity
        })) || []);

      const consumableItems = newConsumableItems || 
        (originalServiceWithStock?.consumableItems?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity
        })) || []);

      // Update original service to end one day before split date
      const splitDateObj = new Date(splitDate);
      const endDateObj = new Date(splitDateObj);
      endDateObj.setDate(endDateObj.getDate() - 1);

      await storage.updateService(id, {
        recurrencePattern: {
          ...recurrencePattern,
          end_date: endDateObj.toISOString().split('T')[0]
        }
      });

      // Handle equipment status changes if equipment was modified
      if (newEquipmentItems) {
        const originalEquipmentIds = (originalServiceWithStock?.equipmentItems || []).map((item: any) => item.id);
        const newEquipmentIds = newEquipmentItems.map((item: any) => item.id);

        // Equipment being removed (was in original service, not in new service) - return to warehouse
        const removedEquipmentIds = originalEquipmentIds.filter((eqId: number) => !newEquipmentIds.includes(eqId));
        for (const equipmentId of removedEquipmentIds) {
          await storage.updateEquipment(equipmentId, {
            status: 'in_warehouse',
            installedAtClientId: null,
            dateInstalled: null
          });
        }

        // Equipment being added (not in original service, in new service) - mark as in_field
        const addedEquipmentIds = newEquipmentIds.filter((eqId: number) => !originalEquipmentIds.includes(eqId));
        for (const equipmentId of addedEquipmentIds) {
          await storage.updateEquipment(equipmentId, {
            status: 'in_field',
            installedAtClientId: originalService.clientId,
            dateInstalled: new Date()
          });
        }
      }

      // Create new service from split date with new interval and stock items
      const newServiceData: any = {
        clientId: originalService.clientId,
        type: originalService.type,
        installationDate: new Date(splitDate),
        teamId: originalService.teamId,
        status: 'scheduled',
        recurrencePattern: {
          interval: newInterval,
          end_date: recurrencePattern.end_date // Use original end date
        },
        contractLengthMonths: originalService.contractLengthMonths,
        servicePriority: originalService.servicePriority,
        estimatedDuration: originalService.estimatedDuration,
        originalServiceId: id,
        splitFromDate: splitDate,
        completedDates: [], // New series starts fresh
        excludedDates: [],
        equipmentItems,
        consumableItems
      };

      const newService = await storage.createService(newServiceData);

      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'split',
        entityType: 'service',
        entityId: id,
        metadata: {
          splitDate,
          oldInterval: recurrencePattern.interval,
          newInterval,
          newServiceId: newService.id,
          equipmentItemsChanged: !!newEquipmentItems,
          consumableItemsChanged: !!newConsumableItems,
          equipmentCount: equipmentItems.length,
          consumableCount: consumableItems.length
        }
      });

      res.json({ originalService: await storage.getService(id), newService });
    } catch (error) {
      console.error("Error splitting service:", error);
      res.status(500).json({ message: "Failed to split service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get service with stock items before deletion
      const service = await storage.getServiceWithStockItems(id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      console.log(`[DELETE SERVICE] Service ${id} has ${service.equipmentItems?.length || 0} equipment items`);

      // Revert all equipment assigned to this service back to warehouse
      if (service.equipmentItems && service.equipmentItems.length > 0) {
        for (const item of service.equipmentItems) {
          console.log(`[DELETE SERVICE] Reverting equipment ${item.id} (${item.equipment?.name}) to warehouse`);
          await storage.updateEquipment(item.id, {
            status: 'in_warehouse',
            installedAtClientId: null,
            dateInstalled: null
          });
        }
      }

      // Now delete the service
      await storage.deleteService(id);

      // Audit log
      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'delete',
        entityType: 'service',
        entityId: id,
        metadata: {
          equipmentReverted: service.equipmentItems?.length || 0
        }
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

  app.get('/api/team-assignments', isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getTeamAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching team assignments:", error);
      res.status(500).json({ message: "Failed to fetch team assignments" });
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

  // Bulk upload routes
  app.post('/api/bulk-upload/clients', isAuthenticated, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ message: "Data must be an array" });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      console.log('Processing bulk upload for clients, data:', JSON.stringify(data, null, 2));

      for (let index = 0; index < data.length; index++) {
        const row = data[index];
        try {
          console.log(`Processing row ${index + 1}:`, row);

          // Validate required fields first
          if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
            throw new Error('Name is required and cannot be empty');
          }

          if (!row.addressText || typeof row.addressText !== 'string' || row.addressText.trim() === '') {
            throw new Error('Address is required and cannot be empty');
          }

          // Transform CSV row to match schema - handle both camelCase and snake_case
          const clientData = {
            name: row.name.trim(),
            addressText: row.addressText.trim(),
            latitude: "0", // Will be updated by geocoding if needed
            longitude: "0",
            city: row.city && typeof row.city === 'string' ? row.city.trim() : null,
            contactPerson: row.contactPerson && typeof row.contactPerson === 'string' ? row.contactPerson.trim() : null,
            phone: row.phone && typeof row.phone === 'string' ? row.phone.trim() : null,
          };

          console.log(`Transformed data for row ${index + 1}:`, clientData);

          const validatedData = insertClientSchema.parse(clientData);
          const createdClient = await storage.createClient(validatedData);
          console.log(`Successfully created client ${index + 1}:`, createdClient.id);
          successCount++;

          // Audit log for each client
          await storage.createAuditLog({
            userId: req.user?.claims?.sub,
            action: 'bulk_create',
            entityType: 'client',
            entityId: createdClient.id,
            metadata: { bulkUpload: true, clientName: row.name }
          });
        } catch (error: any) {
          console.error(`Error processing row ${index + 1}:`, error);
          errorCount++;
          errors.push({ 
            row: index + 1, 
            error: error.message || 'Unknown error',
            data: row 
          });
        }
      }

      console.log(`Bulk upload completed: ${successCount} successful, ${errorCount} errors`);

      res.json({
        success: successCount,
        errors: errorCount,
        total: data.length,
        errorDetails: errors
      });
    } catch (error) {
      console.error("Error in bulk client upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  app.post('/api/bulk-upload/equipment', isAuthenticated, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ message: "Data must be an array" });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      for (let index = 0; index < data.length; index++) {
        const row = data[index];
        try {
          // Transform CSV row to match schema - handle both camelCase and snake_case
          const equipmentData = {
            name: row.name,
            stockCode: row.stockCode || row.stock_code,
            price: row.price ? parseFloat(row.price).toString() : null,
            status: row.status || "in_warehouse",
            barcode: row.barcode || null,
            qrCode: row.qrCode || row.qr_code || null,
          };

          const validatedData = insertEquipmentSchema.parse(equipmentData);
          await storage.createEquipment(validatedData);
          successCount++;

          // Audit log for each equipment
          await storage.createAuditLog({
            userId: req.user?.claims?.sub,
            action: 'bulk_create',
            entityType: 'equipment',
            entityId: null,
            metadata: { bulkUpload: true, equipmentName: row.name }
          });
        } catch (error: any) {
          errorCount++;
          errors.push({ row: index + 1, error: error.message });
        }
      }

      res.json({
        success: successCount,
        errors: errorCount,
        total: data.length,
        errorDetails: errors
      });
    } catch (error) {
      console.error("Error in bulk equipment upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  app.post('/api/bulk-upload/consumables', isAuthenticated, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ message: "Data must be an array" });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      for (let index = 0; index < data.length; index++) {
        const row = data[index];
        try {
          // Transform CSV row to match schema - handle both camelCase and snake_case
          const consumableData = {
            name: row.name,
            stockCode: row.stockCode || row.stock_code,
            price: row.price ? parseFloat(row.price).toString() : null,
            minStockLevel: row.minStockLevel ? parseInt(row.minStockLevel) : (row.min_stock_level ? parseInt(row.min_stock_level) : 0),
            currentStock: row.currentStock ? parseInt(row.currentStock) : (row.current_stock ? parseInt(row.current_stock) : 0),
            barcode: row.barcode || null,
            qrCode: row.qrCode || row.qr_code || null,
          };

          const validatedData = insertConsumableSchema.parse(consumableData);
          await storage.createConsumable(validatedData);
          successCount++;

          // Audit log for each consumable
          await storage.createAuditLog({
            userId: req.user?.claims?.sub,
            action: 'bulk_create',
            entityType: 'consumable',
            entityId: null,
            metadata: { bulkUpload: true, consumableName: row.name }
          });
        } catch (error: any) {
          errorCount++;
          errors.push({ row: index + 1, error: error.message });
        }
      }

      res.json({
        success: successCount,
        errors: errorCount,
        total: data.length,
        errorDetails: errors
      });
    } catch (error) {
      console.error("Error in bulk consumables upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  // Warehouse routes
  app.get('/api/warehouse/equipment-status', isAuthenticated, async (req, res) => {
    try {
      const status = await storage.getEquipmentStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching equipment status:", error);
      res.status(500).json({ message: "Failed to fetch equipment status" });
    }
  });

  app.get('/api/warehouse/equipment-inventory', isAuthenticated, async (req, res) => {
    try {
      const inventory = await storage.getEquipmentInventorySummary();
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching equipment inventory:", error);
      res.status(500).json({ message: "Failed to fetch equipment inventory" });
    }
  });

  app.get('/api/warehouse/consumables', isAuthenticated, async (req, res) => {
    try {
      const consumables = await storage.getConsumablesWithStockInfo();
      res.json(consumables);
    } catch (error) {
      console.error("Error fetching consumables:", error);
      res.status(500).json({ message: "Failed to fetch consumables" });
    }
  });

  // Get weekly stock forecast
  app.get('/api/warehouse/weekly-forecast', async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const forecast = await storage.getWeeklyStockForecast(startDate, teamId);
      res.json(forecast);
    } catch (error) {
      console.error('Error fetching weekly forecast:', error);
      res.status(500).json({ message: 'Failed to fetch weekly forecast' });
    }
  });

  app.get('/api/warehouse/daily-forecast', async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const forecast = await storage.getDailyStockForecast(startDate, teamId);
      res.json(forecast);
    } catch (error) {
      console.error('Error fetching daily forecast:', error);
      res.status(500).json({ message: 'Failed to fetch daily forecast' });
    }
  });

  app.post('/api/warehouse/return-stock/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.returnStockItem(id);

      await storage.createAuditLog({
        userId: req.user?.claims?.sub,
        action: 'return_stock',
        entityType: 'service_stock_issued',
        entityId: id,
        metadata: { returnedAt: new Date() }
      });

      res.json(result);
    } catch (error) {
      console.error("Error returning stock:", error);
      res.status(500).json({ message: "Failed to return stock" });
    }
  });

  // ── Shared service completion helpers ────────────────────────────────────
  // These functions are called by BOTH /api/services/:id/complete (web)
  // AND /api/field-reports (mobile) to ensure identical completion semantics.

  /**
   * Applies the core service status update for a single occurrence.
   * Called as Steps 2-3 in /api/services/:id/complete and from field reports.
   *
   * @param existingService - The service object (already fetched)
   * @param completionDate  - YYYY-MM-DD string for the occurrence being completed
   * @param additionalUpdateData - Optional extra fields to merge (e.g. from step 1 conversions)
   * @param willBeRecurring - True when an installation is being converted to a contract
   */
  async function coreUpdateServiceStatus(
    existingService: any,
    completionDate: string,
    additionalUpdateData: Record<string, any> = {},
    willBeRecurring = false
  ): Promise<any> {
    const updateData: any = { ...additionalUpdateData };

    const currentlyRecurring =
      existingService.recurrencePattern &&
      typeof existingService.recurrencePattern === 'object' &&
      existingService.recurrencePattern !== null &&
      'interval' in existingService.recurrencePattern;

    const isRecurringService = currentlyRecurring || willBeRecurring;

    if (isRecurringService) {
      const currentCompletedDates = (existingService.completedDates as string[]) || [];
      updateData.completedDates = currentCompletedDates.includes(completionDate)
        ? currentCompletedDates
        : [...currentCompletedDates, completionDate];
      updateData.status = 'scheduled';
    } else {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    return await storage.updateService(existingService.id, updateData);
  }

  /**
   * Deducts consumable stock based on items used.
   * If consumableItems is empty, falls back to the service's pre-assigned consumables.
   * Called as Step 6 in /api/services/:id/complete and from field reports.
   *
   * @param serviceId       - ID of the service (used for pre-assignment fallback)
   * @param consumableItems - Explicit quantities to deduct; falls back to pre-assigned if empty
   */
  async function coreDeductConsumableStock(
    serviceId: number,
    consumableItems: { id: number; quantity: number }[]
  ): Promise<void> {
    let itemsToDeduct: { id: number; quantity: number }[] = [];

    if (consumableItems.length > 0) {
      itemsToDeduct = consumableItems;
    } else {
      const serviceWithStock = await storage.getServiceWithStockItems(serviceId);
      if (serviceWithStock?.consumableItems?.length > 0) {
        itemsToDeduct = serviceWithStock.consumableItems.map((item: any) => ({
          id: item.id,
          quantity: item.quantity || 1,
        }));
      }
    }

    if (itemsToDeduct.length === 0) return;

    const allConsumables = await storage.getConsumables();
    const consumableMap = new Map(allConsumables.map(c => [c.id, c]));

    for (const item of itemsToDeduct) {
      const consumable = consumableMap.get(item.id);
      if (consumable) {
        const newStock = Math.max(0, (consumable.currentStock || 0) - item.quantity);
        await storage.updateConsumable(item.id, { currentStock: newStock });
      }
    }
  }

  /**
   * Reconciles consumable stock delta when a field report is updated.
   * Only applies the difference (newActualQty - prevActualQty) to stock,
   * preventing double-deduction on resubmission.
   */
  async function reconcileConsumableStockDelta(
    actualConsumables: { id: number; actualQty: number }[],
    previousConsumables: { id: number; actualQty: number }[]
  ): Promise<void> {
    if (actualConsumables.length === 0) return;

    const allConsumables = await storage.getConsumables();
    const consumableMap = new Map(allConsumables.map(c => [c.id, c]));
    const prevMap = new Map(previousConsumables.map(c => [c.id, c.actualQty]));

    for (const item of actualConsumables) {
      if (item.actualQty < 0) continue;
      const consumable = consumableMap.get(item.id);
      if (!consumable) continue;

      const prevQty = prevMap.get(item.id) ?? 0;
      const delta = item.actualQty - prevQty;

      if (delta !== 0) {
        const newStock = Math.max(0, (consumable.currentStock || 0) - delta);
        await storage.updateConsumable(item.id, { currentStock: newStock });
      }
    }
  }

  // ── Mobile API routes ────────────────────────────────────────────────────

  /**
   * GET /api/mobile/services
   * Returns services for a team, filtered by date range.
   *
   * Authorization:
   *   - Managers / superusers may pass any teamId.
   *   - Users with team_member role may only request their own linkedTeamId.
   *
   * Query params:
   *   - teamId: number (required)
   *   - range: 'today' | 'week' | 'month' (default: 'today')
   */
  app.get('/api/mobile/services', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || '';

      const requestedTeamId = parseInt(req.query.teamId as string);
      if (!requestedTeamId || isNaN(requestedTeamId)) {
        return res.status(400).json({ message: "teamId query parameter is required" });
      }

      const isManager = userRoles.includes('superuser') || userRoles.includes('manager');

      if (!isManager) {
        // Non-managers may only access their own linked team
        const linkedTeamId = user?.linkedTeamId ?? null;
        if (!linkedTeamId) {
          return res.status(403).json({ message: "No team assigned to this user. Contact a manager." });
        }
        if (linkedTeamId !== requestedTeamId) {
          return res.status(403).json({ message: "Access denied: you may only view your own team's services." });
        }
      }

      const rawRange = req.query.range as string;
      const range: 'today' | 'week' | 'month' =
        rawRange === 'week' ? 'week' :
        rawRange === 'month' ? 'month' :
        'today';

      const mobileServices = await storage.getMobileServices(requestedTeamId, range);
      res.json(mobileServices);
    } catch (error) {
      console.error("Error fetching mobile services:", error);
      res.status(500).json({ message: "Failed to fetch mobile services" });
    }
  });

  /**
   * GET /api/field-reports/batch
   * Returns hasAdjustments flags for multiple services in a single request.
   * Query param: serviceIds — comma-separated list of service IDs.
   * Returns: Array of { serviceId, hasAdjustments, completionDate }
   */
  app.get('/api/field-reports/batch', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || '';
      const isManager = userRoles.includes('superuser') || userRoles.includes('manager');
      if (!isManager) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const raw = req.query.serviceIds as string | undefined;
      if (!raw || !raw.trim()) {
        return res.json([]);
      }
      const serviceIds = raw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (serviceIds.length === 0) {
        return res.json([]);
      }
      const results = await storage.getFieldReportOccurrenceFlags(serviceIds);
      res.json(results);
    } catch (error) {
      console.error("Error fetching field report batch flags:", error);
      res.status(500).json({ message: "Failed to fetch field report flags" });
    }
  });

  /**
   * POST /api/field-reports
   * Creates or updates a field report for a service occurrence.
   *
   * Authorization: managers/superusers can submit for any service.
   * Team members can only submit for services belonging to their linkedTeamId.
   *
   * Stock deduction is idempotent:
   *   - On first submission: calls coreDeductConsumableStock (same as web completion route)
   *     and calls coreUpdateServiceStatus (same as web completion route).
   *   - On resubmission: calls reconcileConsumableStockDelta to apply only the difference.
   *
   * Body: serviceId, completionDate, teamMemberId?, actualConsumables,
   *       teamSignature, clientSignature, photos, notes?
   */
  app.post('/api/field-reports', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || '';
      const isManager = userRoles.includes('superuser') || userRoles.includes('manager');

      // Validate request body
      const fieldReportBodySchema = z.object({
        serviceId: z.coerce.number().int().positive(),
        completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "completionDate must be YYYY-MM-DD"),
        teamMemberId: z.coerce.number().int().positive().optional().nullable(),
        actualConsumables: z.array(z.object({
          id: z.coerce.number().int().positive(),
          name: z.string(),
          plannedQty: z.coerce.number().int().min(0),
          actualQty: z.coerce.number().int().min(0),
        })).optional().default([]),
        teamSignature: z.string().optional().nullable(),
        clientSignature: z.string().optional().nullable(),
        photos: z.array(z.object({
          dataUrl: z.string(),
          comment: z.string().default(''),
          timestamp: z.string(),
        })).optional().default([]),
        notes: z.string().optional().nullable(),
      });

      const parseResult = fieldReportBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation error", errors: parseResult.error.errors });
      }
      const body = parseResult.data;

      // Verify the service exists
      const service = await storage.getService(body.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Object-level authorization: team members may only submit reports for their team's services
      if (!isManager) {
        const linkedTeamId = user?.linkedTeamId ?? null;
        if (!linkedTeamId) {
          return res.status(403).json({ message: "No team assigned to this user. Contact a manager." });
        }
        if (service.teamId !== linkedTeamId) {
          return res.status(403).json({ message: "Access denied: you may only submit reports for your team's services." });
        }
      }

      const actualConsumables = body.actualConsumables || [];
      const hasAdjustments = actualConsumables.some(c => c.actualQty !== c.plannedQty);

      // Check if a field report already exists for this service + date
      const existing = await storage.getFieldReport(body.serviceId, body.completionDate);

      let fieldReport;
      if (existing) {
        // UPDATE: apply stock delta vs previous submission (idempotent, no double-deduction)
        const prevConsumables = (existing.actualConsumables || []) as { id: number; actualQty: number }[];
        await reconcileConsumableStockDelta(
          actualConsumables.map(c => ({ id: c.id, actualQty: c.actualQty })),
          prevConsumables
        );

        fieldReport = await storage.updateFieldReport(existing.id, {
          teamMemberId: body.teamMemberId ?? null,
          actualConsumables,
          teamSignature: body.teamSignature ?? null,
          clientSignature: body.clientSignature ?? null,
          photos: body.photos || [],
          hasAdjustments,
          notes: body.notes ?? null,
        });
      } else {
        // CREATE: first submission
        // Step A — create the report record first (stockDeducted=true to mark intent)
        fieldReport = await storage.createFieldReport({
          serviceId: body.serviceId,
          completionDate: body.completionDate,
          teamMemberId: body.teamMemberId ?? null,
          actualConsumables,
          teamSignature: body.teamSignature ?? null,
          clientSignature: body.clientSignature ?? null,
          photos: body.photos || [],
          hasAdjustments,
          stockDeducted: true,
          notes: body.notes ?? null,
        });

        // Step B — deduct consumable stock via shared helper (same as Step 6 in web completion)
        await coreDeductConsumableStock(
          body.serviceId,
          actualConsumables.map(c => ({ id: c.id, quantity: c.actualQty }))
        );

        // Step C — update service status via shared helper (same as Steps 2-3 in web completion)
        await coreUpdateServiceStatus(service, body.completionDate);
      }

      // Audit log
      await storage.createAuditLog({
        userId: user?.id,
        action: existing ? 'field_report_updated' : 'field_report_submitted',
        entityType: 'field_report',
        entityId: fieldReport.id,
        metadata: {
          serviceId: body.serviceId,
          completionDate: body.completionDate,
          hasAdjustments,
          consumableCount: actualConsumables.length,
          photoCount: (body.photos || []).length,
        }
      });

      res.status(existing ? 200 : 201).json(fieldReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error submitting field report:", error);
      res.status(500).json({ message: "Failed to submit field report" });
    }
  });

  /**
   * GET /api/field-reports/:serviceId
   * Retrieves a field report for a given service.
   * Query param: date (YYYY-MM-DD) — if provided, looks up that specific occurrence.
   * Without a date, returns the most recent report for that service.
   *
   * Authorization: managers/superusers may access any service's reports.
   * Team members may only access reports for their team's services.
   */
  app.get('/api/field-reports/:serviceId', isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithRoles(req);
      const userRoles = user?.roles || '';
      const isManager = userRoles.includes('superuser') || userRoles.includes('manager');

      const serviceId = parseInt(req.params.serviceId);
      if (isNaN(serviceId)) {
        return res.status(400).json({ message: "Invalid serviceId" });
      }

      // Object-level authorization
      if (!isManager) {
        const linkedTeamId = user?.linkedTeamId ?? null;
        if (!linkedTeamId) {
          return res.status(403).json({ message: "No team assigned to this user. Contact a manager." });
        }
        const service = await storage.getService(serviceId);
        if (!service || service.teamId !== linkedTeamId) {
          return res.status(403).json({ message: "Access denied: you may only view reports for your team's services." });
        }
      }

      const date = req.query.date as string | undefined;

      if (date) {
        const report = await storage.getFieldReport(serviceId, date);
        if (!report) {
          return res.status(404).json({ message: "Field report not found" });
        }
        return res.json(report);
      }

      // Without a date, return the latest report for this service
      const report = await storage.getLatestFieldReport(serviceId);
      if (!report) {
        return res.status(404).json({ message: "No field reports found for this service" });
      }
      res.json(report);
    } catch (error) {
      console.error("Error fetching field report:", error);
      res.status(500).json({ message: "Failed to fetch field report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}