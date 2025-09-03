import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  serial,
  text,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table (required for Replit Auth + extended for app roles)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  roles: text("roles").default("team_member"), // comma-separated roles
  roleAssignmentSource: varchar("role_assignment_source").default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  addressText: varchar("address_text", { length: 500 }).notNull(),
  latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  city: varchar("city", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("South Africa"),
  contactPerson: varchar("contact_person", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  stockCode: varchar("stock_code", { length: 50 }).notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }),
  dateInstalled: timestamp("date_installed"),
  installedAtClientId: integer("installed_at_client_id").references(() => clients.id),
  status: varchar("status", { length: 20 }).default("in_warehouse"), // 'in_warehouse', 'in_field', 'issued'
  barcode: varchar("barcode", { length: 50 }).unique(),
  qrCode: varchar("qr_code", { length: 50 }).unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Consumables
export const consumables = pgTable("consumables", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  stockCode: varchar("stock_code", { length: 50 }).notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }),
  minStockLevel: integer("min_stock_level").default(0),
  currentStock: integer("current_stock").default(0),
  barcode: varchar("barcode", { length: 50 }).unique(),
  qrCode: varchar("qr_code", { length: 50 }).unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Equipment-Consumable Link
export const equipmentConsumables = pgTable("equipment_consumables", {
  equipmentId: integer("equipment_id").references(() => equipment.id).notNull(),
  consumableId: integer("consumable_id").references(() => consumables.id).notNull(),
});

// Team Members
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  skill: varchar("skill", { length: 50 }), // 'Hygiene', 'Deep Clean', 'Pest Control'
  createdAt: timestamp("created_at").defaultNow(),
});

// Service Teams
export const serviceTeams = pgTable("service_teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team Assignments
export const teamAssignments = pgTable("team_assignments", {
  teamId: integer("team_id").references(() => serviceTeams.id).notNull(),
  memberId: integer("member_id").references(() => teamMembers.id).notNull(),
});

// Services
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  type: varchar("type", { length: 20 }).default("installation"), // 'installation', 'service_contract'
  installationDate: timestamp("installation_date"),
  teamId: integer("team_id").references(() => serviceTeams.id),
  status: varchar("status", { length: 20 }).default("scheduled"), // 'scheduled', 'completed', 'missed'
  recurrencePattern: jsonb("recurrence_pattern"), // { interval: '30d', end_date: '2026-01-01' }
  contractLengthMonths: integer("contract_length_months"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  markedForInvoicing: boolean("marked_for_invoicing").default(false),
  invoicedStatus: varchar("invoiced_status", { length: 20 }).default("not_ready"), // 'not_ready', 'ready', 'invoiced'
  invoicedBy: varchar("invoiced_by").references(() => users.id),
  lastInvoiceSync: timestamp("last_invoice_sync"),
  servicePriority: varchar("service_priority", { length: 20 }).default("Routine"),
  estimatedDuration: integer("estimated_duration").default(60),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  clientSignatureUrl: varchar("client_signature_url", { length: 500 }),
  signedBy: varchar("signed_by", { length: 100 }),
  locationVerified: boolean("location_verified").default(false),
});

// Service-Stock Assignment
export const serviceStockIssued = pgTable("service_stock_issued", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  equipmentId: integer("equipment_id").references(() => equipment.id),
  consumableId: integer("consumable_id").references(() => consumables.id),
  quantity: integer("quantity").default(1),
  returned: boolean("returned").default(false),
  returnedAt: timestamp("returned_at"),
});

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

// Role Changes (V3-ready)
export const roleChanges = pgTable("role_changes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  oldRoles: text("old_roles"),
  newRoles: text("new_roles"),
  changedBy: varchar("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow(),
  reason: text("reason"),
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  services: many(services),
  equipmentInstalled: many(equipment),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  installedAtClient: one(clients, {
    fields: [equipment.installedAtClientId],
    references: [clients.id],
  }),
  equipmentConsumables: many(equipmentConsumables),
  serviceStockIssued: many(serviceStockIssued),
}));

export const consumablesRelations = relations(consumables, ({ many }) => ({
  equipmentConsumables: many(equipmentConsumables),
  serviceStockIssued: many(serviceStockIssued),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  client: one(clients, {
    fields: [services.clientId],
    references: [clients.id],
  }),
  team: one(serviceTeams, {
    fields: [services.teamId],
    references: [serviceTeams.id],
  }),
  serviceStockIssued: many(serviceStockIssued),
}));

export const serviceTeamsRelations = relations(serviceTeams, ({ many }) => ({
  services: many(services),
  teamAssignments: many(teamAssignments),
}));

export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  teamAssignments: many(teamAssignments),
}));

// Insert Schemas
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
});

export const insertConsumableSchema = createInsertSchema(consumables).omit({
  id: true,
  createdAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
});

export const insertServiceTeamSchema = createInsertSchema(serviceTeams).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Consumable = typeof consumables.$inferSelect;
export type InsertConsumable = z.infer<typeof insertConsumableSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type ServiceWithDetails = Service & {
  client?: Client;
  team?: ServiceTeam;
};
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type ServiceTeam = typeof serviceTeams.$inferSelect;
export type InsertServiceTeam = z.infer<typeof insertServiceTeamSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
