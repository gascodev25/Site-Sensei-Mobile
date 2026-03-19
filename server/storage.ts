import {
  users,
  clients,
  equipment,
  consumables,
  services,
  teamMembers,
  serviceTeams,
  teamAssignments,
  serviceStockIssued,
  auditLog,
  equipmentTemplates,
  templateConsumables,
  equipmentConsumables,
  fieldReports,
  type User,
  type UpsertUser,
  type Client,
  type InsertClient,
  type Equipment,
  type InsertEquipment,
  type Consumable,
  type InsertConsumable,
  type Service,
  type InsertService,
  type ServiceWithDetails,
  type TeamMember,
  type InsertTeamMember,
  type ServiceTeam,
  type InsertServiceTeam,
  type AuditLogEntry,
  type EquipmentTemplate,
  type InsertEquipmentTemplate,
  type EquipmentTemplateWithConsumables,
  type EquipmentWithConsumables,
  type FieldReport,
  type InsertFieldReport,
} from "@shared/schema";
import { generateOccurrences, isOccurrenceOnDay } from "@shared/recurrence";
import { db } from "./db";
import { eq, and, or, sql, desc, asc, ilike, lt, gte, lte, inArray, isNull, isNotNull, ne } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createPasswordUser(userData: { email: string; passwordHash: string; firstName: string; lastName: string; roles: string }): Promise<User>;
  updateUser(id: string, userData: Partial<{ firstName: string; lastName: string; roles: string; passwordHash: string; linkedTeamId: number | null }>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  searchClients(query: string): Promise<Client[]>;

  // Service operations
  getServices(): Promise<ServiceWithDetails[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  searchServices(query: string): Promise<ServiceWithDetails[]>;

  // Equipment operations
  getEquipment(): Promise<Equipment[]>;
  getEquipmentByStatus(status: string): Promise<Equipment[]>;
  getEquipmentWithClientInfo(): Promise<(Equipment & { client?: Client })[]>;
  getEquipmentWithConsumables(id: number): Promise<EquipmentWithConsumables | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;
  createEquipmentWithConsumables(equipment: InsertEquipment, consumableIds: number[]): Promise<Equipment>;
  updateEquipmentConsumables(equipmentId: number, consumableIds: number[]): Promise<void>;

  // Equipment Template operations
  getEquipmentTemplates(): Promise<EquipmentTemplate[]>;
  getEquipmentTemplateWithConsumables(id: number): Promise<EquipmentTemplateWithConsumables | undefined>;
  createEquipmentTemplate(template: InsertEquipmentTemplate, consumableIds: number[]): Promise<EquipmentTemplate>;
  updateEquipmentTemplate(id: number, template: Partial<InsertEquipmentTemplate>, consumableIds: number[]): Promise<EquipmentTemplate>;
  deleteEquipmentTemplate(id: number): Promise<void>;

  // Consumables operations
  getConsumables(): Promise<Consumable[]>;
  getLowStockConsumables(): Promise<Consumable[]>;
  createConsumable(consumable: InsertConsumable): Promise<Consumable>;
  updateConsumable(id: number, consumable: Partial<InsertConsumable>): Promise<Consumable>;
  deleteConsumable(id: number): Promise<void>;

  // Services operations
  getServices(): Promise<Service[]>;
  getServicesForDate(date: Date): Promise<Service[]>;
  getServicesByStatus(status: string): Promise<Service[]>;
  getServicesReadyForInvoicing(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;

  // Team operations
  getTeamMembers(): Promise<TeamMember[]>;
  getServiceTeams(): Promise<ServiceTeam[]>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: number, member: Partial<InsertTeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: number): Promise<void>;
  createServiceTeam(team: InsertServiceTeam): Promise<ServiceTeam>;
  updateServiceTeam(id: number, team: Partial<InsertServiceTeam>): Promise<ServiceTeam>;
  deleteServiceTeam(id: number): Promise<void>;
  getTeamAssignments(): Promise<{ teamId: number; memberId: number; }[]>;
  updateTeamAssignments(teamId: number, memberIds: number[]): Promise<void>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    servicesToday: number;
    missedServices: number;
    lowStockItems: number;
    expiringContracts: number;
    equipmentInField: number;
    activeContracts: number;
    completionRate: number;
    monthlyRevenue: number;
  }>;

  // Service stock assignment methods
  createServiceStockAssignment(assignment: any): Promise<any>;
  getServiceStockAssignments(serviceId: number): Promise<any[]>;

  // Audit logging
  createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;

  // Field Reports (mobile app)
  createFieldReport(report: InsertFieldReport): Promise<FieldReport>;
  updateFieldReport(id: number, report: Partial<InsertFieldReport>): Promise<FieldReport>;
  getFieldReport(serviceId: number, completionDate: string): Promise<FieldReport | undefined>;
  getLatestFieldReport(serviceId: number): Promise<FieldReport | undefined>;
  getFieldReportById(id: number): Promise<FieldReport | undefined>;
  getMobileServices(teamId: number, range: 'today' | 'week' | 'month'): Promise<any[]>;

  // Warehouse operations
  getEquipmentStatus(): Promise<{ status: string; count: number }[]>;
  getConsumablesWithStockInfo(): Promise<Consumable[]>;
  getWeeklyStockForecast(): Promise<{
    week: string;
    weekStart: string;
    weekEnd: string;
    consumables: {
      id: number;
      name: string;
      stockCode: string;
      requiredQuantity: number;
      currentStock: number;
      deficit: number;
    }[];
  }[]>;
  returnStockItem(id: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.email));
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const updateData: any = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      updatedAt: new Date(),
    };

    // Only update roles if provided (for OAuth superuser assignment)
    if (user.roles !== undefined) {
      updateData.roles = user.roles;
    }

    const [upsertedUser] = await db
      .insert(users)
      .values({
        id: user.id,
        ...updateData,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: updateData,
      })
      .returning();

    return upsertedUser;
  }

  async createPasswordUser(userData: { email: string; passwordHash: string; firstName: string; lastName: string; roles: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<{ firstName: string; lastName: string; roles: string; passwordHash: string; linkedTeamId: number | null }>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Client operations
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(asc(clients.name));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async searchClients(query: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(
        or(
          ilike(clients.name, `%${query}%`),
          ilike(clients.addressText, `%${query}%`),
          ilike(clients.city, `%${query}%`)
        )
      )
      .orderBy(asc(clients.name));
  }

  // Service operations
  async getServices(): Promise<ServiceWithDetails[]> {
    const results = await db
      .select({
        service: services,
        client: clients,
        team: serviceTeams,
      })
      .from(services)
      .leftJoin(clients, eq(services.clientId, clients.id))
      .leftJoin(serviceTeams, eq(services.teamId, serviceTeams.id))
      .orderBy(desc(services.installationDate));

    const serviceIds = results.map(r => r.service.id);

    let stockByService: Map<number, { equipmentNames: string[]; consumableNames: string[] }> = new Map();

    if (serviceIds.length > 0) {
      const equipmentRows = await db
        .select({
          serviceId: serviceStockIssued.serviceId,
          name: equipment.name,
          quantity: serviceStockIssued.quantity,
        })
        .from(serviceStockIssued)
        .innerJoin(equipment, eq(serviceStockIssued.equipmentId, equipment.id))
        .where(inArray(serviceStockIssued.serviceId, serviceIds));

      const consumableRows = await db
        .select({
          serviceId: serviceStockIssued.serviceId,
          name: consumables.name,
          quantity: serviceStockIssued.quantity,
        })
        .from(serviceStockIssued)
        .innerJoin(consumables, eq(serviceStockIssued.consumableId, consumables.id))
        .where(inArray(serviceStockIssued.serviceId, serviceIds));

      for (const row of equipmentRows) {
        if (!stockByService.has(row.serviceId)) {
          stockByService.set(row.serviceId, { equipmentNames: [], consumableNames: [] });
        }
        const entry = stockByService.get(row.serviceId)!;
        entry.equipmentNames.push(row.quantity > 1 ? `${row.name} ×${row.quantity}` : row.name);
      }

      for (const row of consumableRows) {
        if (!stockByService.has(row.serviceId)) {
          stockByService.set(row.serviceId, { equipmentNames: [], consumableNames: [] });
        }
        const entry = stockByService.get(row.serviceId)!;
        entry.consumableNames.push(row.quantity > 1 ? `${row.name} ×${row.quantity}` : row.name);
      }
    }

    return results.map(row => ({
      ...row.service,
      client: row.client,
      team: row.team,
      stockSummary: stockByService.get(row.service.id) || { equipmentNames: [], consumableNames: [] },
    }));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const { equipmentItems, consumableItems, ...serviceData } = service;

    const [newService] = await db.insert(services).values(serviceData).returning();

    // Create service stock associations
    if (equipmentItems && equipmentItems.length > 0) {
      const equipmentStockData = equipmentItems.map(item => ({
        serviceId: newService.id,
        equipmentId: item.id,
        quantity: item.quantity,
        returned: false,
      }));
      await db.insert(serviceStockIssued).values(equipmentStockData);
    }

    if (consumableItems && consumableItems.length > 0) {
      const consumableStockData = consumableItems.map(item => ({
        serviceId: newService.id,
        consumableId: item.id,
        quantity: item.quantity,
        returned: false,
      }));
      await db.insert(serviceStockIssued).values(consumableStockData);
    }

    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const { equipmentItems, consumableItems, ...serviceData } = service as any;

    const [updatedService] = await db
      .update(services)
      .set(serviceData)
      .where(eq(services.id, id))
      .returning();

    if (equipmentItems !== undefined) {
      const existingEquipment = await db.select().from(serviceStockIssued).where(
        and(
          eq(serviceStockIssued.serviceId, id),
          isNotNull(serviceStockIssued.equipmentId)
        )
      );
      const existingEquipmentMap = new Map(existingEquipment.map(e => [e.equipmentId, e]));
      const newEquipmentIds = new Set((equipmentItems || []).map((item: any) => item.id));

      for (const existing of existingEquipment) {
        if (!newEquipmentIds.has(existing.equipmentId)) {
          await db.delete(serviceStockIssued).where(eq(serviceStockIssued.id, existing.id));
        }
      }

      for (const item of (equipmentItems || [])) {
        const existing = existingEquipmentMap.get(item.id);
        if (existing) {
          await db.update(serviceStockIssued)
            .set({ quantity: item.quantity })
            .where(eq(serviceStockIssued.id, existing.id));
        } else {
          await db.insert(serviceStockIssued).values({
            serviceId: id,
            equipmentId: item.id,
            quantity: item.quantity,
            returned: false,
          });
        }
      }
    }

    if (consumableItems !== undefined) {
      const existingConsumables = await db.select().from(serviceStockIssued).where(
        and(
          eq(serviceStockIssued.serviceId, id),
          isNotNull(serviceStockIssued.consumableId)
        )
      );
      const existingConsumableMap = new Map(existingConsumables.map(c => [c.consumableId, c]));
      const newConsumableIds = new Set((consumableItems || []).map((item: any) => item.id));

      for (const existing of existingConsumables) {
        if (!newConsumableIds.has(existing.consumableId)) {
          await db.delete(serviceStockIssued).where(eq(serviceStockIssued.id, existing.id));
        }
      }

      for (const item of (consumableItems || [])) {
        const existing = existingConsumableMap.get(item.id);
        if (existing) {
          await db.update(serviceStockIssued)
            .set({ quantity: item.quantity })
            .where(eq(serviceStockIssued.id, existing.id));
        } else {
          await db.insert(serviceStockIssued).values({
            serviceId: id,
            consumableId: item.id,
            quantity: item.quantity,
            returned: false,
          });
        }
      }
    }

    return updatedService;
  }

  async deleteService(id: number): Promise<void> {
    // First delete related stock issued records
    await db.delete(serviceStockIssued).where(eq(serviceStockIssued.serviceId, id));

    // Then delete the service
    await db.delete(services).where(eq(services.id, id));
  }

  async searchServices(query: string): Promise<ServiceWithDetails[]> {
    const results = await db
      .select({
        service: services,
        client: clients,
        team: serviceTeams,
      })
      .from(services)
      .leftJoin(clients, eq(services.clientId, clients.id))
      .leftJoin(serviceTeams, eq(services.teamId, serviceTeams.id))
      .where(
        or(
          ilike(clients.name, `%${query}%`),
          ilike(services.type, `%${query}%`),
          ilike(services.status, `%${query}%`)
        )
      )
      .orderBy(desc(services.installationDate));

    return results.map(row => ({
      ...row.service,
      client: row.client,
      team: row.team
    }));
  }

  async getServicesByStatus(status: string): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.status, status))
      .orderBy(desc(services.installationDate));
  }

  async getServicesForDate(date: Date): Promise<Service[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(services)
      .where(
        and(
          gte(services.installationDate, startOfDay),
          lte(services.installationDate, endOfDay)
        )
      )
      .orderBy(asc(services.installationDate));
  }

  async getServicesReadyForInvoicing(): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.status, 'completed'),
          eq(services.markedForInvoicing, true),
          eq(services.invoicedStatus, 'ready')
        )
      )
      .orderBy(desc(services.completedAt));
  }

  // Equipment operations
  async getEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment).orderBy(asc(equipment.name));
  }

  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    return await db
      .select()
      .from(equipment)
      .where(eq(equipment.status, status))
      .orderBy(asc(equipment.name));
  }

  async getEquipmentWithClientInfo(): Promise<(Equipment & { client?: Client })[]> {
    const result = await db
      .select({
        equipment: equipment,
        client: clients,
      })
      .from(equipment)
      .leftJoin(clients, eq(equipment.installedAtClientId, clients.id))
      .orderBy(asc(equipment.name));

    return result.map(row => ({
      ...row.equipment,
      client: row.client || undefined,
    }));
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  async updateEquipment(id: number, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const [updatedEquipment] = await db
      .update(equipment)
      .set(equipmentData)
      .where(eq(equipment.id, id))
      .returning();
    return updatedEquipment;
  }

  async deleteEquipment(id: number): Promise<void> {
    // First delete equipment-consumables relationships
    await db.delete(equipmentConsumables).where(eq(equipmentConsumables.equipmentId, id));
    // Then delete the equipment
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async getEquipmentWithConsumables(id: number): Promise<EquipmentWithConsumables | undefined> {
    const [equipmentResult] = await db.select().from(equipment).where(eq(equipment.id, id));
    if (!equipmentResult) return undefined;

    const consumablesList = await db
      .select({
        equipmentConsumable: equipmentConsumables,
        consumable: consumables,
      })
      .from(equipmentConsumables)
      .innerJoin(consumables, eq(equipmentConsumables.consumableId, consumables.id))
      .where(eq(equipmentConsumables.equipmentId, id));

    return {
      ...equipmentResult,
      equipmentConsumables: consumablesList.map(row => ({
        ...row.equipmentConsumable,
        consumable: row.consumable,
      })),
    };
  }

  async createEquipmentWithConsumables(equipmentData: InsertEquipment, consumableIds: number[]): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();

    if (consumableIds.length > 0) {
      const equipmentConsumableData = consumableIds.map(consumableId => ({
        equipmentId: newEquipment.id,
        consumableId,
      }));
      await db.insert(equipmentConsumables).values(equipmentConsumableData);
    }

    return newEquipment;
  }

  async updateEquipmentConsumables(equipmentId: number, consumableIds: number[]): Promise<void> {
    // Delete existing relationships
    await db.delete(equipmentConsumables).where(eq(equipmentConsumables.equipmentId, equipmentId));

    // Insert new relationships
    if (consumableIds.length > 0) {
      const equipmentConsumableData = consumableIds.map(consumableId => ({
        equipmentId,
        consumableId,
      }));
      await db.insert(equipmentConsumables).values(equipmentConsumableData);
    }
  }

  // Equipment Template operations
  async getEquipmentTemplates(): Promise<EquipmentTemplate[]> {
    return await db.select().from(equipmentTemplates).orderBy(asc(equipmentTemplates.name));
  }

  async getEquipmentTemplateWithConsumables(id: number): Promise<EquipmentTemplateWithConsumables | undefined> {
    const [template] = await db.select().from(equipmentTemplates).where(eq(equipmentTemplates.id, id));
    if (!template) return undefined;

    const consumablesList = await db
      .select({
        templateConsumable: templateConsumables,
        consumable: consumables,
      })
      .from(templateConsumables)
      .innerJoin(consumables, eq(templateConsumables.consumableId, consumables.id))
      .where(eq(templateConsumables.templateId, id));

    return {
      ...template,
      templateConsumables: consumablesList.map(row => ({
        ...row.templateConsumable,
        consumable: row.consumable,
      })),
    };
  }

  async createEquipmentTemplate(templateData: InsertEquipmentTemplate, consumableIds: number[]): Promise<EquipmentTemplate> {
    const [newTemplate] = await db.insert(equipmentTemplates).values(templateData).returning();

    if (consumableIds.length > 0) {
      const templateConsumableData = consumableIds.map(consumableId => ({
        templateId: newTemplate.id,
        consumableId,
        recommendedQuantity: 1, // Default quantity
      }));
      await db.insert(templateConsumables).values(templateConsumableData);
    }

    return newTemplate;
  }

  async updateEquipmentTemplate(id: number, templateData: Partial<InsertEquipmentTemplate>, consumableIds: number[]): Promise<EquipmentTemplate> {
    const [updatedTemplate] = await db
      .update(equipmentTemplates)
      .set(templateData)
      .where(eq(equipmentTemplates.id, id))
      .returning();

    // Delete existing template-consumable associations
    await db.delete(templateConsumables).where(eq(templateConsumables.templateId, id));

    // Create new associations if consumableIds provided
    if (consumableIds.length > 0) {
      const templateConsumableData = consumableIds.map(consumableId => ({
        templateId: id,
        consumableId,
        recommendedQuantity: 1, // Default quantity
      }));
      await db.insert(templateConsumables).values(templateConsumableData);
    }

    return updatedTemplate;
  }

  async deleteEquipmentTemplate(id: number): Promise<void> {
    // First delete template-consumables relationships
    await db.delete(templateConsumables).where(eq(templateConsumables.templateId, id));
    // Then delete the template
    await db.delete(equipmentTemplates).where(eq(equipmentTemplates.id, id));
  }

  // Consumables operations
  async getConsumables(): Promise<Consumable[]> {
    return await db.select().from(consumables).orderBy(asc(consumables.name));
  }

  async getLowStockConsumables(): Promise<Consumable[]> {
    return await db
      .select()
      .from(consumables)
      .where(sql`${consumables.currentStock} < ${consumables.minStockLevel}`)
      .orderBy(asc(consumables.name));
  }

  async createConsumable(consumableData: InsertConsumable): Promise<Consumable> {
    const [newConsumable] = await db.insert(consumables).values(consumableData).returning();
    return newConsumable;
  }

  async updateConsumable(id: number, consumableData: Partial<InsertConsumable>): Promise<Consumable> {
    const [updatedConsumable] = await db
      .update(consumables)
      .set(consumableData)
      .where(eq(consumables.id, id))
      .returning();
    return updatedConsumable;
  }

  async deleteConsumable(id: number): Promise<void> {
    await db.delete(consumables).where(eq(consumables.id, id));
  }

  // Team operations
  async getTeamMembers(): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).orderBy(teamMembers.createdAt);
  }

  async getServiceTeams(): Promise<ServiceTeam[]> {
    return await db.select().from(serviceTeams).orderBy(serviceTeams.createdAt);
  }

  async createTeamMember(memberData: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db.insert(teamMembers).values(memberData).returning();
    return newMember;
  }

  async updateTeamMember(id: number, memberData: Partial<InsertTeamMember>): Promise<TeamMember> {
    const [member] = await db
      .update(teamMembers)
      .set(memberData)
      .where(eq(teamMembers.id, id))
      .returning();
    return member;
  }

  async deleteTeamMember(id: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  async createServiceTeam(teamData: InsertServiceTeam): Promise<ServiceTeam> {
    const [newTeam] = await db.insert(serviceTeams).values(teamData).returning();
    return newTeam;
  }

  async updateServiceTeam(id: number, teamData: Partial<InsertServiceTeam>): Promise<ServiceTeam> {
    const [team] = await db
      .update(serviceTeams)
      .set(teamData)
      .where(eq(serviceTeams.id, id))
      .returning();
    return team;
  }

  async deleteServiceTeam(id: number): Promise<void> {
    await db.delete(serviceTeams).where(eq(serviceTeams.id, id));
  }

  // Team assignment methods
  async getTeamAssignments(): Promise<{ teamId: number; memberId: number; }[]> {
    return await db.select().from(teamAssignments);
  }

  async updateTeamAssignments(teamId: number, memberIds: number[]): Promise<void> {
    // Remove existing assignments for this team
    await db.delete(teamAssignments).where(eq(teamAssignments.teamId, teamId));

    // Add new assignments
    if (memberIds.length > 0) {
      const assignments = memberIds.map(memberId => ({
        teamId,
        memberId
      }));
      await db.insert(teamAssignments).values(assignments);
    }
  }

  // Helper to convert UTC date to SAST date string (YYYY-MM-DD)
  private toSASTDateString(date: Date): string {
    // SAST is UTC+2, so add 2 hours to get the correct local date
    const sastDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
    return sastDate.toISOString().substring(0, 10);
  }

  // Helper to calculate missed recurring service occurrences
  private calculateMissedOccurrences(service: any, now: Date): number {
    const installDate = new Date(service.installationDate);
    const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;
    const completedDates = (service.completedDates || []) as string[];
    const excludedDates = (service.excludedDates || []) as string[];
    
    // For non-recurring services
    if (!recurrencePattern || !recurrencePattern.interval) {
      // If installation date is in the past and not completed, count as 1 missed
      if (installDate <= now && service.status !== 'completed') {
        return 1;
      }
      return 0;
    }
    
    if (!recurrencePattern.interval) {
      return installDate <= now && service.status !== 'completed' ? 1 : 0;
    }

    const endDate = recurrencePattern.end_date ? new Date(recurrencePattern.end_date) : null;
    const completedSet = new Set(completedDates.map(d => d.substring(0, 10)));

    const occurrences = generateOccurrences(installDate, recurrencePattern.interval, {
      rangeEnd: now,
      endDate,
      excludedDates,
    });

    let missedCount = 0;
    for (const occ of occurrences) {
      const dateStr = this.toSASTDateString(occ);
      if (!completedSet.has(dateStr)) {
        missedCount++;
      }
    }

    return missedCount;
  }

  // Dashboard metrics
  async getDashboardMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all services that could have missed occurrences
    const allServices = await db.select().from(services)
      .where(and(
        ne(services.status, "completed"),
        lte(services.installationDate, now)
      ));
    
    // Calculate total missed occurrences across all services
    let totalMissedOccurrences = 0;
    for (const service of allServices) {
      totalMissedOccurrences += this.calculateMissedOccurrences(service, now);
    }

    const [
      servicesTodayResult,
      lowStockResult,
      equipmentInFieldResult,
      activeContractsResult,
      completedThisMonthResult,
      totalThisMonthResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(and(
          gte(services.installationDate, todayStart),
          lt(services.installationDate, tomorrowStart)
        )),
      db.select({ count: sql<number>`count(*)` }).from(consumables)
        .where(sql`${consumables.currentStock} < ${consumables.minStockLevel}`),
      db.select({ count: sql<number>`count(*)` }).from(equipment)
        .where(eq(equipment.status, "in_field")),
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(eq(services.type, "service_contract")),
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(and(
          eq(services.status, "completed"),
          gte(services.completedAt, startOfMonth)
        )),
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(gte(services.installationDate, startOfMonth))
    ]);

    const completionRate = totalThisMonthResult[0].count > 0
      ? Math.round((completedThisMonthResult[0].count / totalThisMonthResult[0].count) * 100)
      : 0;

    return {
      servicesToday: servicesTodayResult[0].count,
      missedServices: totalMissedOccurrences,
      lowStockItems: lowStockResult[0].count,
      expiringContracts: 5, // TODO: Calculate based on contract end dates
      equipmentInField: equipmentInFieldResult[0].count,
      activeContracts: activeContractsResult[0].count,
      completionRate,
      monthlyRevenue: 24760, // TODO: Calculate from completed services
    };
  }

  // Service stock assignment methods
  async createServiceStockAssignment(assignmentData: any): Promise<any> {
    const [assignment] = await db.insert(serviceStockIssued).values(assignmentData).returning();
    return assignment;
  }

  async getServiceStockAssignments(serviceId: number): Promise<any[]> {
    return await db.select().from(serviceStockIssued).where(eq(serviceStockIssued.serviceId, serviceId));
  }

  async getServiceWithStockItems(id: number): Promise<any | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    if (!service) return undefined;

    // Get equipment assigned to this service
    const equipmentAssignments = await db
      .select({
        stockItem: serviceStockIssued,
        equipment: equipment,
      })
      .from(serviceStockIssued)
      .innerJoin(equipment, eq(serviceStockIssued.equipmentId, equipment.id))
      .where(eq(serviceStockIssued.serviceId, id));

    // Get consumables assigned to this service
    const consumableAssignments = await db
      .select({
        stockItem: serviceStockIssued,
        consumable: consumables,
      })
      .from(serviceStockIssued)
      .innerJoin(consumables, eq(serviceStockIssued.consumableId, consumables.id))
      .where(eq(serviceStockIssued.serviceId, id));

    // Get template consumables for each assigned equipment
    const templateIds = equipmentAssignments
      .map(item => item.equipment.templateId)
      .filter(templateId => templateId !== null);
    let templateConsumablesList: any[] = [];

    if (templateIds.length > 0) {
      // Get consumables linked to those templates
      templateConsumablesList = await db
        .select({
          templateConsumable: templateConsumables,
          consumable: consumables,
        })
        .from(templateConsumables)
        .innerJoin(consumables, eq(templateConsumables.consumableId, consumables.id))
        .where(inArray(templateConsumables.templateId, templateIds));
    }

    // Combine directly assigned consumables with template consumables
    const allConsumables = [...consumableAssignments];

    // Add template consumables that aren't already directly assigned
    templateConsumablesList.forEach(templateItem => {
      const alreadyAssigned = consumableAssignments.some(
        assigned => assigned.consumable.id === templateItem.consumable.id
      );

      if (!alreadyAssigned) {
        allConsumables.push({
          stockItem: {
            quantity: templateItem.templateConsumable.recommendedQuantity || 1,
            serviceId: id,
            consumableId: templateItem.consumable.id,
            equipmentId: null,
            returned: false
          },
          consumable: templateItem.consumable,
        });
      }
    });

    return {
      ...service,
      equipmentItems: equipmentAssignments.map(row => ({
        id: row.equipment.id,
        quantity: row.stockItem.quantity,
        equipment: row.equipment,
      })),
      consumableItems: allConsumables.map(row => ({
        id: row.consumable.id,
        quantity: row.stockItem.quantity,
        consumable: row.consumable,
      })),
    };
  }

  // Audit logging
  async createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    await db.insert(auditLog).values(entry);
  }

  // Warehouse operations
  async getEquipmentStatus(): Promise<{ status: string; count: number }[]> {
    const result = await db
      .select({
        status: equipment.status,
        count: sql<number>`count(*)::int`,
      })
      .from(equipment)
      .groupBy(equipment.status);

    return result.map(r => ({
      status: r.status || 'unknown',
      count: r.count
    }));
  }

  async getEquipmentInventorySummary(): Promise<{
    id: number;
    name: string;
    stockCode: string;
    currentStock: number;
    minStockLevel: number;
    inFieldCount: number;
    inWarehouseCount: number;
    price: string | null;
  }[]> {
    const allEquipment = await db
      .select()
      .from(equipment)
      .orderBy(asc(equipment.name));

    // Group by stockCode to aggregate stock levels
    const inventoryMap = new Map<string, {
      id: number;
      name: string;
      stockCode: string;
      currentStock: number;
      minStockLevel: number;
      inFieldCount: number;
      issuedCount: number;
      price: string | null;
    }>();

    for (const item of allEquipment) {
      const key = item.stockCode;

      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, {
          id: item.id,
          name: item.name,
          stockCode: item.stockCode,
          currentStock: 0,
          minStockLevel: 0,
          inFieldCount: 0,
          issuedCount: 0,
          price: item.price,
        });
      }

      const entry = inventoryMap.get(key)!;

      // Sum up total stock levels from all records with this stockCode
      entry.currentStock += (item.currentStock || 0);
      entry.minStockLevel += (item.minStockLevel || 0);

      // Count units by status
      if (item.status === 'in_field') {
        entry.inFieldCount++;
      } else if (item.status === 'issued') {
        entry.issuedCount++;
      }
    }

    // Calculate in warehouse and convert to array
    // In Warehouse = Total Stock - (In Field + Issued)
    return Array.from(inventoryMap.values()).map(item => ({
      ...item,
      inWarehouseCount: Math.max(0, item.currentStock - item.inFieldCount - item.issuedCount),
    }));
  }

  async getConsumablesWithStockInfo(): Promise<Consumable[]> {
    return await db.select().from(consumables).orderBy(asc(consumables.name));
  }

  async getWeeklyStockForecast(customStartDate?: string, teamId?: number): Promise<{
    week: string;
    weekStart: string;
    weekEnd: string;
    consumables: {
      id: number;
      name: string;
      stockCode: string;
      requiredQuantity: number;
      currentStock: number;
      deficit: number;
    }[];
  }[]> {
    const now = customStartDate ? new Date(customStartDate) : new Date();
    const weeks = [];

    // Calculate 4-week date range
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + (4 * 7));
    endDate.setHours(23, 59, 59, 999);

    // Batch fetch: Get services for the entire 4-week period
    // Only include 'scheduled' and 'missed' services
    // Filter by team if teamId provided
    const whereConditions = [
      gte(services.installationDate, startDate),
      lte(services.installationDate, endDate),
      or(
        eq(services.status, 'scheduled'),
        eq(services.status, 'missed')
      )
    ];

    if (teamId) {
      whereConditions.push(eq(services.teamId, teamId));
    }

    const allServices = await db
      .select()
      .from(services)
      .where(and(...whereConditions));

    if (allServices.length === 0) {
      // Return empty weeks if no services
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + (weekOffset * 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        weeks.push({
          week: `Week ${weekOffset + 1}`,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          consumables: [],
        });
      }
      return weeks;
    }

    const serviceIds = allServices.map(s => s.id);

    // Batch fetch: Get ALL direct consumables for these services
    const allDirectConsumables = await db
      .select({
        stockItem: serviceStockIssued,
        consumable: consumables,
      })
      .from(serviceStockIssued)
      .innerJoin(consumables, eq(serviceStockIssued.consumableId, consumables.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Batch fetch: Get ALL equipment for these services
    const allEquipmentItems = await db
      .select({
        stockItem: serviceStockIssued,
        equipment: equipment,
      })
      .from(serviceStockIssued)
      .innerJoin(equipment, eq(serviceStockIssued.equipmentId, equipment.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Get unique template IDs
    const templateIds = Array.from(new Set(
      allEquipmentItems
        .map(item => item.equipment.templateId)
        .filter(id => id !== null) as number[]
    ));

    // Batch fetch: Get ALL template consumables for these templates
    const allTemplateConsumables = templateIds.length > 0
      ? await db
          .select({
            templateId: templateConsumables.templateId,
            templateConsumable: templateConsumables,
            consumable: consumables,
          })
          .from(templateConsumables)
          .innerJoin(consumables, eq(templateConsumables.consumableId, consumables.id))
          .where(inArray(templateConsumables.templateId, templateIds))
      : [];

    // Build lookup maps for efficient in-memory aggregation
    const directConsumablesByService = new Map<number, typeof allDirectConsumables>();
    allDirectConsumables.forEach(item => {
      const serviceId = item.stockItem.serviceId;
      if (!directConsumablesByService.has(serviceId)) {
        directConsumablesByService.set(serviceId, []);
      }
      directConsumablesByService.get(serviceId)!.push(item);
    });

    const equipmentByService = new Map<number, typeof allEquipmentItems>();
    allEquipmentItems.forEach(item => {
      const serviceId = item.stockItem.serviceId;
      if (!equipmentByService.has(serviceId)) {
        equipmentByService.set(serviceId, []);
      }
      equipmentByService.get(serviceId)!.push(item);
    });

    const templateConsumablesByTemplate = new Map<number, typeof allTemplateConsumables>();
    allTemplateConsumables.forEach(item => {
      if (!templateConsumablesByTemplate.has(item.templateId)) {
        templateConsumablesByTemplate.set(item.templateId, []);
      }
      templateConsumablesByTemplate.get(item.templateId)!.push(item);
    });

    // Get all consumables for current stock lookup
    const allConsumablesMap = new Map<number, Consumable>();
    const allConsumablesList = await db.select().from(consumables);
    allConsumablesList.forEach(c => allConsumablesMap.set(c.id, c));

    // Generate 4 weeks of forecasts using in-memory aggregation
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + (weekOffset * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Filter services for this week from pre-fetched data
      const weekServices = allServices.filter(s => {
        const serviceDate = new Date(s.installationDate!);

        // For recurring services, we need to check if they have occurrences in this week
        const isRecurring = s.recurrencePattern &&
                           typeof s.recurrencePattern === 'object' &&
                           s.recurrencePattern !== null &&
                           'interval' in s.recurrencePattern;

        if (isRecurring) {
          const pattern = s.recurrencePattern as { interval: string; end_date?: string };
          const endDate = pattern.end_date ? new Date(pattern.end_date) : null;

          if (endDate && weekStart > endDate) return false;

          const completedDatesSet = new Set((s.completedDates as string[]) || []);
          const excludedDates = (s.excludedDates as string[]) || [];

          const weekOccurrences = generateOccurrences(serviceDate, pattern.interval, {
            rangeStart: weekStart,
            rangeEnd: weekEnd,
            endDate,
            excludedDates,
          });

          return weekOccurrences.some(d => {
            const dateStr = d.toISOString().split('T')[0];
            return !completedDatesSet.has(dateStr);
          });
        }

        // For non-recurring services, simple date check
        return serviceDate >= weekStart && serviceDate <= weekEnd;
      });

      // Calculate consumables needed for all services in this week (in-memory)
      const consumableRequirements = new Map<number, { consumable: Consumable; quantity: number }>();

      for (const service of weekServices) {
        // Add directly assigned consumables
        const directCons = directConsumablesByService.get(service.id) || [];
        for (const item of directCons) {
          const existing = consumableRequirements.get(item.consumable.id);
          if (existing) {
            existing.quantity += item.stockItem.quantity || 1;
          } else {
            consumableRequirements.set(item.consumable.id, {
              consumable: item.consumable,
              quantity: item.stockItem.quantity || 1,
            });
          }
        }

        // Add template consumables from equipment
        const equipItems = equipmentByService.get(service.id) || [];
        for (const equipItem of equipItems) {
          if (equipItem.equipment.templateId) {
            const templateCons = templateConsumablesByTemplate.get(equipItem.equipment.templateId) || [];
            for (const tc of templateCons) {
              const existing = consumableRequirements.get(tc.consumable.id);
              const qty = tc.templateConsumable.recommendedQuantity || 1;
              if (existing) {
                existing.quantity += qty;
              } else {
                consumableRequirements.set(tc.consumable.id, {
                  consumable: tc.consumable,
                  quantity: qty,
                });
              }
            }
          }
        }
      }

      // Format the week data
      const weekConsumables = Array.from(consumableRequirements.values()).map(item => ({
        id: item.consumable.id,
        name: item.consumable.name,
        stockCode: item.consumable.stockCode,
        requiredQuantity: item.quantity,
        currentStock: item.consumable.currentStock || 0,
        deficit: Math.max(0, item.quantity - (item.consumable.currentStock || 0)),
      }));

      weeks.push({
        week: `Week ${weekOffset + 1}`,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        consumables: weekConsumables,
      });
    }

    return weeks;
  }

  async getDailyStockForecast(customStartDate?: string, teamId?: number): Promise<{
    date: string;
    dayOfWeek: string;
    consumables: {
      id: number;
      name: string;
      stockCode: string;
      requiredQuantity: number;
      currentStock: number;
      deficit: number;
    }[];
  }[]> {
    const now = customStartDate ? new Date(customStartDate) : new Date();
    const days = [];

    // Calculate 28-day date range
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 28);
    endDate.setHours(23, 59, 59, 999);

    // Batch fetch: Get services that could have occurrences in the 28-day period
    // For recurring services, we need ALL active recurring services (not just those starting in our range)
    // For one-time services, we only need those scheduled within our range
    const whereConditions = [
      or(
        // One-time services scheduled in our date range
        and(
          isNull(services.recurrencePattern),
          gte(services.installationDate, startDate),
          lte(services.installationDate, endDate)
        ),
        // All recurring services that haven't ended yet
        and(
          isNotNull(services.recurrencePattern),
          lte(services.installationDate, endDate) // Started on or before our forecast end
        )
      ),
      or(
        eq(services.status, 'scheduled'),
        eq(services.status, 'missed')
      )
    ];

    if (teamId) {
      whereConditions.push(eq(services.teamId, teamId));
    }

    const allServices = await db
      .select()
      .from(services)
      .where(and(...whereConditions));

    if (allServices.length === 0) {
      // Return empty days if no services
      for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() + dayOffset);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        days.push({
          date: dayDate.toISOString().split('T')[0],
          dayOfWeek: dayNames[dayDate.getDay()],
          consumables: [],
        });
      }
      return days;
    }

    const serviceIds = allServices.map(s => s.id);

    // Batch fetch: Get ALL direct consumables for these services
    const allDirectConsumables = await db
      .select({
        stockItem: serviceStockIssued,
        consumable: consumables,
      })
      .from(serviceStockIssued)
      .innerJoin(consumables, eq(serviceStockIssued.consumableId, consumables.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Batch fetch: Get ALL equipment for these services
    const allEquipmentItems = await db
      .select({
        stockItem: serviceStockIssued,
        equipment: equipment,
      })
      .from(serviceStockIssued)
      .innerJoin(equipment, eq(serviceStockIssued.equipmentId, equipment.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Get unique template IDs
    const templateIds = Array.from(new Set(
      allEquipmentItems
        .map(item => item.equipment.templateId)
        .filter(id => id !== null) as number[]
    ));

    // Batch fetch: Get ALL template consumables
    const allTemplateConsumables = templateIds.length > 0
      ? await db
          .select({
            templateId: templateConsumables.templateId,
            templateConsumable: templateConsumables,
            consumable: consumables,
          })
          .from(templateConsumables)
          .innerJoin(consumables, eq(templateConsumables.consumableId, consumables.id))
          .where(inArray(templateConsumables.templateId, templateIds))
      : [];

    // Build lookup maps
    const directConsumablesByService = new Map<number, typeof allDirectConsumables>();
    allDirectConsumables.forEach(item => {
      const serviceId = item.stockItem.serviceId;
      if (!directConsumablesByService.has(serviceId)) {
        directConsumablesByService.set(serviceId, []);
      }
      directConsumablesByService.get(serviceId)!.push(item);
    });

    const equipmentByService = new Map<number, typeof allEquipmentItems>();
    allEquipmentItems.forEach(item => {
      const serviceId = item.stockItem.serviceId;
      if (!equipmentByService.has(serviceId)) {
        equipmentByService.set(serviceId, []);
      }
      equipmentByService.get(serviceId)!.push(item);
    });

    const templateConsumablesByTemplate = new Map<number, typeof allTemplateConsumables>();
    allTemplateConsumables.forEach(item => {
      if (!templateConsumablesByTemplate.has(item.templateId)) {
        templateConsumablesByTemplate.set(item.templateId, []);
      }
      templateConsumablesByTemplate.get(item.templateId)!.push(item);
    });

    const allConsumablesList = await db.select().from(consumables);
    const allConsumablesMap = new Map<number, Consumable>();
    allConsumablesList.forEach(c => allConsumablesMap.set(c.id, c));

    // South African timezone offset (SAST = UTC+2)
    const SAST_OFFSET_HOURS = 2;

    // Day names array for formatting
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Generate 28 days of forecasts
    for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + dayOffset);
      dayDate.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Filter services for this specific day
      const dayServices = allServices.filter(s => {
        const serviceDate = new Date(s.installationDate!);

        const isRecurring = s.recurrencePattern &&
                           typeof s.recurrencePattern === 'object' &&
                           s.recurrencePattern !== null &&
                           'interval' in s.recurrencePattern;

        if (isRecurring) {
          const pattern = s.recurrencePattern as { interval: string; end_date?: string };
          const endDate = pattern.end_date ? new Date(pattern.end_date) : null;

          if (endDate && dayDate > endDate) return false;

          const completedDatesArray = (s.completedDates as string[]) || [];
          const completedDatesSet = new Set(completedDatesArray);
          const dateStr = dayDate.toISOString().split('T')[0];

          if (completedDatesSet.has(dateStr)) return false;

          return isOccurrenceOnDay(serviceDate, pattern.interval, dayDate, endDate);
        }

        // For non-recurring services, check if service date falls on this specific day
        // Convert UTC time to SAST (UTC+2) to get the correct local date
        const serviceDateSAST = new Date(serviceDate.getTime() + (SAST_OFFSET_HOURS * 60 * 60 * 1000));
        const serviceLocalDate = serviceDateSAST.toISOString().split('T')[0];
        const dayLocalDate = dayDate.toISOString().split('T')[0];

        return serviceLocalDate === dayLocalDate;
      });

      // Calculate consumables needed for this specific day
      const consumableRequirements = new Map<number, { consumable: Consumable; quantity: number }>();

      for (const service of dayServices) {
        // Add directly assigned consumables
        const directCons = directConsumablesByService.get(service.id) || [];
        for (const item of directCons) {
          const existing = consumableRequirements.get(item.consumable.id);
          if (existing) {
            existing.quantity += item.stockItem.quantity || 1;
          } else {
            consumableRequirements.set(item.consumable.id, {
              consumable: item.consumable,
              quantity: item.stockItem.quantity || 1,
            });
          }
        }

        // Add template consumables from equipment
        const equipItems = equipmentByService.get(service.id) || [];
        for (const equipItem of equipItems) {
          if (equipItem.equipment.templateId) {
            const templateCons = templateConsumablesByTemplate.get(equipItem.equipment.templateId) || [];
            for (const tc of templateCons) {
              const existing = consumableRequirements.get(tc.consumable.id);
              const qty = tc.templateConsumable.recommendedQuantity || 1;
              if (existing) {
                existing.quantity += qty;
              } else {
                consumableRequirements.set(tc.consumable.id, {
                  consumable: tc.consumable,
                  quantity: qty,
                });
              }
            }
          }
        }
      }

      // Format the day data
      const dayConsumables = Array.from(consumableRequirements.values()).map(item => ({
        id: item.consumable.id,
        name: item.consumable.name,
        stockCode: item.consumable.stockCode,
        requiredQuantity: item.quantity,
        currentStock: item.consumable.currentStock || 0,
        deficit: Math.max(0, item.quantity - (item.consumable.currentStock || 0)),
      }));

      days.push({
        date: dayDate.toISOString().split('T')[0],
        dayOfWeek: dayNames[dayDate.getDay()],
        consumables: dayConsumables,
      });
    }

    return days;
  }

  async returnStockItem(id: number): Promise<any> {
    const [updated] = await db
      .update(serviceStockIssued)
      .set({
        returned: true,
        returnedAt: new Date()
      })
      .where(eq(serviceStockIssued.id, id))
      .returning();

    return updated;
  }

  // ── Field Report methods ──────────────────────────────────────────────────

  async createFieldReport(report: InsertFieldReport): Promise<FieldReport> {
    const [created] = await db.insert(fieldReports).values(report).returning();
    return created;
  }

  async updateFieldReport(id: number, report: Partial<InsertFieldReport>): Promise<FieldReport> {
    const [updated] = await db
      .update(fieldReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(fieldReports.id, id))
      .returning();
    return updated;
  }

  async getFieldReport(serviceId: number, completionDate: string): Promise<FieldReport | undefined> {
    const [report] = await db
      .select()
      .from(fieldReports)
      .where(
        and(
          eq(fieldReports.serviceId, serviceId),
          eq(fieldReports.completionDate, completionDate)
        )
      )
      .orderBy(desc(fieldReports.createdAt))
      .limit(1);
    return report;
  }

  async getLatestFieldReport(serviceId: number): Promise<FieldReport | undefined> {
    const [report] = await db
      .select()
      .from(fieldReports)
      .where(eq(fieldReports.serviceId, serviceId))
      .orderBy(desc(fieldReports.createdAt))
      .limit(1);
    return report;
  }

  async getFieldReportById(id: number): Promise<FieldReport | undefined> {
    const [report] = await db.select().from(fieldReports).where(eq(fieldReports.id, id));
    return report;
  }

  /**
   * Returns services assigned to a team, enriched with client info and
   * pre-assigned consumables/equipment, filtered by date range.
   *
   * Date ranges are rolling windows from today (not strict calendar boundaries):
   *   - 'today'  → current calendar day only (midnight–23:59:59)
   *   - 'week'   → today + next 7 days (rolling, not Mon–Sun calendar week)
   *   - 'month'  → today + next 30 days (rolling, not 1st–last of calendar month)
   *
   * Each service in the response includes:
   *   - occurrenceDatesInRange: all occurrence dates (YYYY-MM-DD) within the window
   *   - pendingOccurrenceDates: subset of occurrence dates not yet in completedDates
   * The mobile app should use pendingOccurrenceDates to build its work queue.
   */
  async getMobileServices(teamId: number, range: 'today' | 'week' | 'month'): Promise<any[]> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (range === 'today') {
      rangeStart = startOfToday;
      rangeEnd = new Date(startOfToday);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      rangeStart = startOfToday;
      rangeEnd = new Date(startOfToday);
      rangeEnd.setDate(rangeEnd.getDate() + 7);
    } else {
      rangeStart = startOfToday;
      rangeEnd = new Date(startOfToday);
      rangeEnd.setMonth(rangeEnd.getMonth() + 1);
    }

    // Fetch all services for this team
    const teamServices = await db
      .select({
        service: services,
        client: clients,
        team: serviceTeams,
      })
      .from(services)
      .innerJoin(clients, eq(services.clientId, clients.id))
      .leftJoin(serviceTeams, eq(services.teamId, serviceTeams.id))
      .where(eq(services.teamId, teamId))
      .orderBy(asc(services.installationDate));

    if (teamServices.length === 0) return [];

    // Filter by date range using recurrence logic.
    // For recurring services, compute which dates within the range have not yet been completed.
    // The mobile app should only show pending occurrences; completed ones get a `completedForDate` flag.
    const filteredServices: (typeof teamServices[number] & {
      pendingOccurrenceDates: string[];
      allOccurrenceDates: string[];
    })[] = [];

    const toDateString = (d: Date) => d.toISOString().substring(0, 10);

    for (const row of teamServices) {
      const svc = row.service;
      const installDate = svc.installationDate ? new Date(svc.installationDate) : null;
      if (!installDate) continue;

      const recurrencePattern = svc.recurrencePattern as { interval?: string; end_date?: string } | null;
      const excludedDates = (svc.excludedDates || []) as string[];
      const completedDates = new Set((svc.completedDates || []) as string[]);

      if (!recurrencePattern?.interval) {
        // One-off: include if install date is within range
        if (installDate >= rangeStart && installDate <= rangeEnd) {
          const dateStr = toDateString(installDate);
          filteredServices.push({
            ...row,
            allOccurrenceDates: [dateStr],
            pendingOccurrenceDates: completedDates.has(dateStr) ? [] : [dateStr],
          });
        }
      } else {
        // Recurring: include if any occurrence falls in range
        const endDate = recurrencePattern.end_date ? new Date(recurrencePattern.end_date) : undefined;
        const occurrences = generateOccurrences(installDate, recurrencePattern.interval, {
          rangeStart,
          rangeEnd,
          endDate,
          excludedDates,
        });
        if (occurrences.length > 0) {
          const allDates = occurrences.map(toDateString);
          const pendingDates = allDates.filter(d => !completedDates.has(d));
          filteredServices.push({
            ...row,
            allOccurrenceDates: allDates,
            pendingOccurrenceDates: pendingDates,
          });
        }
      }
    }

    if (filteredServices.length === 0) return [];

    const serviceIds = filteredServices.map(r => r.service.id);

    // Fetch pre-assigned consumables for each service
    const consumableRows = await db
      .select({
        serviceId: serviceStockIssued.serviceId,
        stockItemId: serviceStockIssued.id,
        consumableId: consumables.id,
        consumableName: consumables.name,
        stockCode: consumables.stockCode,
        quantity: serviceStockIssued.quantity,
      })
      .from(serviceStockIssued)
      .innerJoin(consumables, eq(serviceStockIssued.consumableId, consumables.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Fetch pre-assigned equipment for each service
    const equipmentRows = await db
      .select({
        serviceId: serviceStockIssued.serviceId,
        stockItemId: serviceStockIssued.id,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        stockCode: equipment.stockCode,
        quantity: serviceStockIssued.quantity,
      })
      .from(serviceStockIssued)
      .innerJoin(equipment, eq(serviceStockIssued.equipmentId, equipment.id))
      .where(inArray(serviceStockIssued.serviceId, serviceIds));

    // Build lookup maps
    const consumablesByService = new Map<number, typeof consumableRows>();
    for (const row of consumableRows) {
      if (!consumablesByService.has(row.serviceId)) consumablesByService.set(row.serviceId, []);
      consumablesByService.get(row.serviceId)!.push(row);
    }

    const equipmentByService = new Map<number, typeof equipmentRows>();
    for (const row of equipmentRows) {
      if (!equipmentByService.has(row.serviceId)) equipmentByService.set(row.serviceId, []);
      equipmentByService.get(row.serviceId)!.push(row);
    }

    return filteredServices.map(({ service: svc, client, team, pendingOccurrenceDates, allOccurrenceDates }) => ({
      id: svc.id,
      type: svc.type,
      status: svc.status,
      installationDate: svc.installationDate,
      recurrencePattern: svc.recurrencePattern,
      completedDates: svc.completedDates,
      excludedDates: svc.excludedDates,
      servicePriority: svc.servicePriority,
      estimatedDuration: svc.estimatedDuration,
      // Occurrence dates in the requested range (mobile app uses these to drive the work list)
      occurrenceDatesInRange: allOccurrenceDates,
      pendingOccurrenceDates, // Dates not yet completed — primary list for mobile work queue
      client: client ? {
        id: client.id,
        name: client.name,
        addressText: client.addressText,
        city: client.city,
        postcode: client.postcode,
        latitude: client.latitude,
        longitude: client.longitude,
        contactPerson: client.contactPerson,
        phone: client.phone,
      } : null,
      team: team ? { id: team.id, name: team.name } : null,
      consumables: (consumablesByService.get(svc.id) || []).map(c => ({
        stockItemId: c.stockItemId,
        id: c.consumableId,
        name: c.consumableName,
        stockCode: c.stockCode,
        plannedQty: c.quantity ?? 1,
      })),
      equipment: (equipmentByService.get(svc.id) || []).map(e => ({
        stockItemId: e.stockItemId,
        id: e.equipmentId,
        name: e.equipmentName,
        stockCode: e.stockCode,
        quantity: e.quantity ?? 1,
      })),
    }));
  }
}

export const storage = new DatabaseStorage();