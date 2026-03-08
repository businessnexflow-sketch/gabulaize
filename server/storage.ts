import { db } from "./db";
import { users, products, dealers, type User, type InsertUser, type Product, type InsertProduct } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDealerIdByKey(key: string): Promise<number | undefined>;
  
  // Product management
  getProducts(dealerId: number): Promise<Product[]>;
  getProduct(dealerId: number, id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(dealerId: number, id: number, product: Partial<Product>): Promise<Product>;
  deleteProduct(dealerId: number, id: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getDealerIdByKey(key: string): Promise<number | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.key, key));
    return dealer?.id;
  }

  // Product implementation
  async getProducts(dealerId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.dealerId, dealerId));
  }

  async getProduct(dealerId: number, id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.dealerId, dealerId), eq(products.id, id)));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(dealerId: number, id: number, update: Partial<Product>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set(update)
      .where(and(eq(products.dealerId, dealerId), eq(products.id, id)))
      .returning();
    if (!product) throw new Error("Product not found");
    return product;
  }

  async deleteProduct(dealerId: number, id: number): Promise<void> {
    await db.delete(products).where(and(eq(products.dealerId, dealerId), eq(products.id, id)));
  }
}

let _storage: DatabaseStorage | undefined;
export function getStorage(): DatabaseStorage {
  if (!_storage) _storage = new DatabaseStorage();
  return _storage;
}