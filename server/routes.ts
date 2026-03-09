import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { Blob } from "node:buffer";
import { getStorage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { mapN8nResultToIdData, stripDataUrlToBase64 } from "./id-extraction";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "admin-secret-key";
const ADMIN_EMAIL = "zurabbabulaidze@gmail.com";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync("iron123#", 10);

function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.admin_token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    if (decoded.email !== ADMIN_EMAIL) throw new Error();
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

async function resolveDealerId(req: Request, res: Response, storage: ReturnType<typeof getStorage>) {
  const dealerKeyRaw = req.query.dealer;
  const dealerKey = (Array.isArray(dealerKeyRaw) ? dealerKeyRaw[0] : dealerKeyRaw) as string | undefined;
  if (!dealerKey) {
    res.status(400).json({ message: "Missing dealer" });
    return undefined;
  }
  const dealerId = await storage.getDealerIdByKey(dealerKey);
  if (!dealerId) {
    res.status(404).json({ message: "Dealer not found" });
    return undefined;
  }
  return dealerId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const storage = getStorage();
  const demoUser = { id: 1, username: "demo@example.com" } as const;

  // Auth setup
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dealer-portal-secret",
      resave: false,
      saveUninitialized: false,
      store:
        process.env.NODE_ENV === "production"
          ? storage.sessionStore
          : new session.MemoryStore(),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      // Always allow the demo user in dev (and as a fallback when DB is down)
      if (username === demoUser.username && password === "Energo123#") {
        return done(null, demoUser);
      }

      try {
        const user = await storage.getUserByUsername(username);
        if (!user || user.password !== password) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, { id: user.id, username: user.username });
      } catch (e) {
        return done(null, false, {
          message:
            (e as Error)?.message ??
            "Login failed (database unavailable). Try the demo credentials.",
        });
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as any).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    if (id === demoUser.id) return done(null, demoUser);
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      return done(null, { id: user.id, username: user.username });
    } catch {
      return done(null, false);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: unknown, user: unknown, info?: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({
          message: info?.message ?? "Invalid username or password",
        });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.status(200).json(req.user);
  });

  app.post(api.vision.extractId.path, async (req, res) => {
    console.log("Extraction started...");
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const input = z
        .object({
          frontImage: z.string().optional(),
          backImage: z.string().optional(),
          idFront: z.string().optional(),
          idBack: z.string().optional(),
        })
        .parse(req.body);

      const frontImage = input.frontImage ?? input.idFront;
      const backImage = input.backImage ?? input.idBack;

      if (!frontImage || !backImage) {
        return res.status(400).json({
          message: "Both frontImage and backImage (or idFront/idBack) are required",
        });
      }

      const n8nUrl =
        "https://blablabla233.app.n8n.cloud/webhook-test/process-id-card";

      const formData = new FormData();

      const frontBase64 = stripDataUrlToBase64(frontImage);
      const backBase64 = stripDataUrlToBase64(backImage);

      const frontBuffer = Buffer.from(frontBase64, "base64");
      const backBuffer = Buffer.from(backBase64, "base64");

      formData.append('image0', new Blob([frontBuffer], { type: 'image/jpeg' }) as any, 'front.jpg');
      formData.append('image1', new Blob([backBuffer], { type: 'image/jpeg' }) as any, 'back.jpg');

      const n8nRes = await fetch(n8nUrl, {
        method: "POST",
        body: formData,
      });

      const responseText = await n8nRes.text();
      console.log("N8N Raw Response:", responseText);

      if (!n8nRes.ok) {
        throw new Error(`n8n workflow error (${n8nRes.status}): ${responseText}`);
      }

      let n8nResponse;
      try {
        n8nResponse = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Failed to parse n8n response as JSON: ${responseText}`);
      }
      console.log("N8N Response:", n8nResponse);

      const firstItem = Array.isArray(n8nResponse) ? n8nResponse[0] : n8nResponse;

      const extracted = mapN8nResultToIdData(firstItem ?? {});

      const allowedKeys = new Set([
        "firstName",
        "lastName",
        "personalId",
        "gender",
        "expiryDate",
      ]);

      const extraKeys =
        firstItem && typeof firstItem === "object" && !Array.isArray(firstItem)
          ? Object.keys(firstItem as any).filter((k) => !allowedKeys.has(k))
          : [];

      // If n8n returned an error/info payload instead of expected identity data, surface it as an error.
      if (!extracted.firstName || !extracted.lastName || !extracted.idNumber || extraKeys.length > 0) {
        const rawText =
          typeof firstItem === "string"
            ? firstItem
            : firstItem && typeof firstItem === "object"
              ? JSON.stringify(firstItem)
              : String(firstItem);
        return res.status(400).json({
          message: rawText,
        });
      }

      // Attempt to persist the extracted data, but never block the UI on failure.
      try {
        const storageAny = storage as any;
        if (typeof storageAny.createSubmission === "function") {
          await storageAny.createSubmission(extracted);
        }
      } catch (e) {
        console.warn("storage.createSubmission failed, returning data anyway:", e);
      }

      res.status(200).json(firstItem ?? {});
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Proxy the submission to n8n webhook
  app.post(api.submission.submit.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const input = api.submission.submit.input.parse(req.body);
      
      const n8nWebhookUrl = "https://tookaa.app.n8n.cloud/webhook-test/2e302645-bea1-48f0-b006-040595cf9580";
      
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error("Failed to submit to n8n");
      }

      res.status(200).json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Public Products Route
  app.get("/api/products", async (req, res) => {
    try {
      const dealerKeyRaw = req.query.dealer;
      const dealerKey = (Array.isArray(dealerKeyRaw) ? dealerKeyRaw[0] : dealerKeyRaw) as string | undefined;
      const dealerId = dealerKey ? await storage.getDealerIdByKey(dealerKey) : await storage.getDealerIdByKey("iron");
      if (!dealerId) return res.status(404).json({ message: "Dealer not found" });
      const products = await storage.getProducts(dealerId);
      res.json(products);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Admin Routes
  app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1d" });
      res.cookie("admin_token", token, { httpOnly: true });
      return res.json({ token });
    }
    res.status(401).json({ message: "Invalid credentials" });
  });

  app.get("/api/admin/products", authenticateAdmin, async (req, res) => {
    const dealerId = await resolveDealerId(req, res, storage);
    if (!dealerId) return;
    const products = await storage.getProducts(dealerId);
    res.json(products);
  });

  app.post("/api/admin/products", authenticateAdmin, async (req, res) => {
    try {
      console.log("Admin Add Product Request:", req.body);
      const dealerId = await resolveDealerId(req, res, storage);
      if (!dealerId) return;
      const productData = {
        ...req.body,
        dealerId,
        price: Number(req.body.price),
        stock: Number(req.body.stock),
      };
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (err) {
      console.error("Error adding product:", err);
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/admin/products/:id", authenticateAdmin, async (req, res) => {
    try {
      const dealerId = await resolveDealerId(req, res, storage);
      if (!dealerId) return;
      const id = Number(req.params.id);
      const existing = await storage.getProduct(dealerId, id);
      if (!existing) return res.status(404).json({ message: "Product not found" });

      const input = z
        .object({
          name: z.string().min(1).optional(),
          description: z.string().min(1).optional(),
          category: z.string().min(1).optional(),
          imageUrl: z.string().optional().nullable(),
          stock: z.coerce.number().int().optional(),
          price: z.coerce.number().int().optional(),
          discountPrice: z.coerce.number().int().optional().nullable(),
          discountPercentage: z.coerce.number().int().optional().nullable(),
          discountExpiry: z.coerce.string().optional().nullable(),
        })
        .parse(req.body);

      const update: any = { ...input };
      if (update.discountExpiry !== undefined) {
        update.discountExpiry = update.discountExpiry ? new Date(update.discountExpiry) : null;
      }

      const product = await storage.updateProduct(dealerId, id, update);
      return res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/admin/products/:id/price", authenticateAdmin, async (req, res) => {
    try {
      const dealerId = await resolveDealerId(req, res, storage);
      if (!dealerId) return;
      const id = Number(req.params.id);
      const existing = await storage.getProduct(dealerId, id);
      if (!existing) return res.status(404).json({ message: "Product not found" });
      const product = await storage.updateProduct(dealerId, id, { price: req.body.price });
      res.json(product);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/admin/products/:id/discount", authenticateAdmin, async (req, res) => {
    try {
      const dealerId = await resolveDealerId(req, res, storage);
      if (!dealerId) return;
      const id = Number(req.params.id);
      const existing = await storage.getProduct(dealerId, id);
      if (!existing) return res.status(404).json({ message: "Product not found" });
      const product = await storage.updateProduct(dealerId, id, {
        discountPrice: req.body.discountPrice,
        discountPercentage: req.body.discountPercentage,
        discountExpiry: req.body.discountExpiry ? new Date(req.body.discountExpiry) : null,
      });
      res.json(product);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/admin/products/:id", authenticateAdmin, async (req, res) => {
    const dealerId = await resolveDealerId(req, res, storage);
    if (!dealerId) return;
    const id = Number(req.params.id);
    const existing = await storage.getProduct(dealerId, id);
    if (!existing) return res.status(404).json({ message: "Product not found" });
    await storage.deleteProduct(dealerId, id);
    res.sendStatus(200);
  });

  app.post("/api/admin/products/copy", authenticateAdmin, async (req, res) => {
    try {
      const input = z
        .object({ from: z.string().min(1), to: z.string().min(1) })
        .parse(req.body);

      const fromId = await storage.getDealerIdByKey(input.from);
      const toId = await storage.getDealerIdByKey(input.to);
      if (!fromId) return res.status(404).json({ message: "Source dealer not found" });
      if (!toId) return res.status(404).json({ message: "Target dealer not found" });

      const products = await storage.getProducts(fromId);
      let copied = 0;
      let updated = 0;
      for (const p of products) {
        const existing = (await storage.getProducts(toId)).find((x) => x.name === p.name);
        if (!existing) {
          await storage.createProduct({
            dealerId: toId,
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category,
            imageUrl: p.imageUrl,
            stock: p.stock,
            discountPrice: p.discountPrice,
            discountPercentage: p.discountPercentage,
            discountExpiry: p.discountExpiry as any,
          } as any);
          copied++;
        } else {
          await storage.updateProduct(toId, existing.id, {
            description: p.description,
            price: p.price,
            category: p.category,
            imageUrl: p.imageUrl,
            stock: p.stock,
            discountPrice: p.discountPrice,
            discountPercentage: p.discountPercentage,
            discountExpiry: p.discountExpiry as any,
          } as any);
          updated++;
        }
      }

      return res.json({ success: true, copied, updated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: (err as Error).message });
    }
  });
  void (async () => {
    try {
      const demoUser = await storage.getUserByUsername("demo@example.com");
      if (!demoUser) {
        await storage.createUser({
          username: "demo@example.com",
          password: "Energo123#",
        });
      }
    } catch (e) {
      console.log("Error seeding demo user (tables might not exist yet):", e);
    }
  })();

  return httpServer;
}