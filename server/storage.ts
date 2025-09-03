import {
  users,
  clients,
  equipment,
  consumables,
  services,
  teamMembers,
  serviceTeams,
  auditLog,
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
  type TeamMember,
  type InsertTeamMember,
  type ServiceTeam,
  type InsertServiceTeam,
  type AuditLogEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, ilike, lt, gte, lte } from "drizzle-orm";

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
  
  // Equipment operations
  getEquipment(): Promise<Equipment[]>;
  getEquipmentByStatus(status: string): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, equipment: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;
  
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
  createServiceTeam(team: InsertServiceTeam): Promise<ServiceTeam>;
  
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
      .where(ilike(clients.addressText, `%${query}%`))
      .orderBy(asc(clients.name));
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
    await db.delete(equipment).where(eq(equipment.id, id));
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

  // Services operations
  async getServices(): Promise<Service[]> {
    return await db.select().from(services).orderBy(desc(services.createdAt));
  }

  async getServicesForDate(date: Date): Promise<Service[]> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    return await db
      .select()
      .from(services)
      .where(
        and(
          gte(services.installationDate, startOfDay),
          lt(services.installationDate, endOfDay)
        )
      )
      .orderBy(asc(services.installationDate));
  }

  async getServicesByStatus(status: string): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.status, status))
      .orderBy(desc(services.installationDate));
  }

  async getServicesReadyForInvoicing(): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.invoicedStatus, "ready"))
      .orderBy(desc(services.completedAt));
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(serviceData).returning();
    return newService;
  }

  async updateService(id: number, serviceData: Partial<InsertService>): Promise<Service> {
    const [updatedService] = await db
      .update(services)
      .set(serviceData)
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Team operations
  async getTeamMembers(): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).orderBy(asc(teamMembers.name));
  }

  async getServiceTeams(): Promise<ServiceTeam[]> {
    return await db.select().from(serviceTeams).orderBy(asc(serviceTeams.name));
  }

  async createTeamMember(memberData: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db.insert(teamMembers).values(memberData).returning();
    return newMember;
  }

  async createServiceTeam(teamData: InsertServiceTeam): Promise<ServiceTeam> {
    const [newTeam] = await db.insert(serviceTeams).values(teamData).returning();
    return newTeam;
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

  // Audit logging
  async createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    await db.insert(auditLog).values(entry);
  }
}

export const storage = new DatabaseStorage();
