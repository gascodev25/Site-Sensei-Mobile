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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, sql, desc, asc, ilike, lt, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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
    
    return results.map(row => ({
      ...row.service,
      client: row.client,
      team: row.team
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
    const [updatedService] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
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

  // Dashboard metrics
  async getDashboardMetrics() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      servicesTodayResult,
      missedServicesResult,
      lowStockResult,
      equipmentInFieldResult,
      activeContractsResult,
      completedThisMonthResult,
      totalThisMonthResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(and(
          gte(services.installationDate, startOfDay),
          lt(services.installationDate, endOfDay)
        )),
      db.select({ count: sql<number>`count(*)` }).from(services)
        .where(eq(services.status, "missed")),
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
      missedServices: missedServicesResult[0].count,
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

    return {
      ...service,
      equipmentItems: equipmentAssignments.map(row => ({
        id: row.equipment.id,
        quantity: row.stockItem.quantity,
        equipment: row.equipment,
      })),
      consumableItems: consumableAssignments.map(row => ({
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
}

export const storage = new DatabaseStorage();
