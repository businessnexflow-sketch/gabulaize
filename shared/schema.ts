import { pgTable, text, serial, boolean, jsonb, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const dealers = pgTable("dealers", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    dealerId: integer("dealer_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(), // stored in cents/base units
    category: text("category").notNull(),
    imageUrl: text("image_url"),
    stock: integer("stock").notNull().default(0),
    discountPrice: integer("discount_price"),
    discountPercentage: integer("discount_percentage"),
    discountExpiry: timestamp("discount_expiry"),
  },
  (table) => ({
    dealerNameUnique: uniqueIndex("products_dealer_id_name_unique").on(
      table.dealerId,
      table.name,
    ),
  }),
);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
