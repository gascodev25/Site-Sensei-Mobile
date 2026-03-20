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
  passwordHash: varchar("password_hash"), // bcrypt hash for local auth, null for OAuth users
  roles: text("roles").default("team_member"), // comma-separated roles
  linkedTeamId: integer("linked_team_id"), // optional FK to service_teams (for mobile field users)
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
  minStockLevel: integer("min_stock_level").default(0),
  currentStock: integer("current_stock").default(0),
  dateInstalled: timestamp("date_installed"),
  installedAtClientId: integer("installed_at_client_id").references(() => clients.id),
  templateId: integer("template_id").references(() => equipmentTemplates.id),
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

// Equipment Templates
export const equipmentTemplates = pgTable("equipment_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Template Consumables (many-to-many)
export const templateConsumables = pgTable("template_consumables", {
  templateId: integer("template_id").references(() => equipmentTemplates.id).notNull(),
  consumableId: integer("consumable_id").references(() => consumables.id).notNull(),
  recommendedQuantity: integer("recommended_quantity").default(1),
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
  originalServiceId: integer("original_service_id").references(() => services.id), // For tracking split series
  splitFromDate: varchar("split_from_date", { length: 20 }), // ISO date string when this service was split from parent
  excludedDates: jsonb("excluded_dates").$type<string[]>().default([]), // Array of ISO date strings to skip
  completedDates: jsonb("completed_dates").$type<string[]>().default([]), // Array of ISO date strings for completed occurrences
  invoicedDates: jsonb("invoiced_dates").$type<string[]>().default([]), // Array of ISO date strings for invoiced occurrences (recurring services)
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

// Field Reports (submitted by mobile app after on-site service completion)
export const fieldReports = pgTable("field_reports", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  completionDate: varchar("completion_date", { length: 20 }).notNull(), // YYYY-MM-DD
  teamMemberId: integer("team_member_id").references(() => teamMembers.id),
  actualConsumables: jsonb("actual_consumables").$type<{
    id: number;
    name: string;
    plannedQty: number;
    actualQty: number;
  }[]>().default([]),
  teamSignature: text("team_signature"),   // base64 data URL
  clientSignature: text("client_signature"), // base64 data URL
  photos: jsonb("photos").$type<{
    dataUrl: string;
    comment: string;
    timestamp: string;
  }[]>().default([]),
  hasAdjustments: boolean("has_adjustments").default(false),
  stockDeducted: boolean("stock_deducted").default(false), // Tracks whether consumable stock has been deducted
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  templateConsumables: many(templateConsumables),
}));

export const equipmentTemplatesRelations = relations(equipmentTemplates, ({ many }) => ({
  templateConsumables: many(templateConsumables),
}));

export const templateConsumablesRelations = relations(templateConsumables, ({ one }) => ({
  template: one(equipmentTemplates, {
    fields: [templateConsumables.templateId],
    references: [equipmentTemplates.id],
  }),
  consumable: one(consumables, {
    fields: [templateConsumables.consumableId],
    references: [consumables.id],
  }),
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
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true, // Never accept passwordHash directly, use plain password
}).extend({
  password: z.string().min(12, "Password must be at least 12 characters").optional(),
  email: z.string().email("Invalid email address"),
});

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
  completedAt: true,
  lastInvoiceSync: true,
  checkInTime: true,
  checkOutTime: true,
}).extend({
  installationDate: z.coerce.date().optional().nullable(),
  excludedDates: z.array(z.string()).optional(), // Array of ISO date strings
  equipmentItems: z.array(z.object({
    id: z.number(),
    quantity: z.number().min(1)
  })).optional(),
  consumableItems: z.array(z.object({
    id: z.number(),
    quantity: z.number().min(1)
  })).optional(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
});

export const insertServiceTeamSchema = createInsertSchema(serviceTeams).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentTemplateSchema = createInsertSchema(equipmentTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateConsumableSchema = createInsertSchema(templateConsumables);

export const insertFieldReportSchema = createInsertSchema(fieldReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Service Completion Schema
export const serviceCompletionSchema = z.object({
  equipmentItems: z.array(z.object({
    id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive()
  })).optional(),
  consumableItems: z.array(z.object({
    id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive()
  })).optional(),
  convertToContract: z.boolean().optional(),
  serviceInterval: z.string().optional(),
  contractLengthMonths: z.coerce.number().int().positive().optional(),
  completionDate: z.string().optional() // YYYY-MM-DD format for specific occurrence completion
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
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

// Equipment Templates Types
export type EquipmentTemplate = typeof equipmentTemplates.$inferSelect;
export type InsertEquipmentTemplate = z.infer<typeof insertEquipmentTemplateSchema>;
export type TemplateConsumable = typeof templateConsumables.$inferSelect;
export type InsertTemplateConsumable = z.infer<typeof insertTemplateConsumableSchema>;

export type EquipmentTemplateWithConsumables = EquipmentTemplate & {
  templateConsumables?: (TemplateConsumable & { consumable: Consumable })[];
};

export type EquipmentWithConsumables = Equipment & {
  equipmentConsumables?: (typeof equipmentConsumables.$inferSelect & { consumable: Consumable })[];
};
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type ServiceTeam = typeof serviceTeams.$inferSelect;
export type InsertServiceTeam = z.infer<typeof insertServiceTeamSchema>;
export type ServiceCompletion = z.infer<typeof serviceCompletionSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type FieldReport = typeof fieldReports.$inferSelect;
export type InsertFieldReport = z.infer<typeof insertFieldReportSchema>;
