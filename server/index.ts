import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import { resolve } from "node:path";
import multer from "multer";
import axios from "axios";
import { Blob } from "node:buffer";  // added to construct real Blob objects

dotenv.config({ path: resolve(process.cwd(), ".env") });

const app = express();
const httpServer = createServer(app);

const upload = multer({ storage: multer.memoryStorage() });

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Pensioner ID verification bridge: accepts a pensioner ID photo,
// forwards it to n8n, and validates the minimal required fields.
app.post(
  "/api/vision/verify-pensioner",
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as any;

      if (!file) {
        return res
          .status(400)
          .json({ message: "ფაილი ვერ მოიძებნა (პენსიონერის მოწმობა არ არის ატვირთული)." });
      }

      const n8nUrl =
        "https://blablabla233.app.n8n.cloud/webhook-test/process-document";

      const formData = new FormData();
      // wrap the raw buffer in a real Blob so form-data consumers see a proper Blob object
      const fileBlob = new Blob([file.buffer], { type: file.mimetype }) as any;
      formData.append(
        "image0",
        fileBlob,
        file.originalname || "pensioner-id.jpg",
      );

      // axios automatically sets a Content-Type including boundary when the
      // body is an instance of FormData. on Node we may need to copy headers
      // if the FormData implementation exposes them (e.g. form-data package).
      const headers: Record<string, string> = {};
      if (typeof (formData as any).getHeaders === "function") {
        Object.assign(headers, (formData as any).getHeaders());
      }

      const n8nRes = await axios.post(n8nUrl, formData, {
        headers,
        maxBodyLength: Infinity,
      });

      const idData = {
        firstName: req.body?.firstName,
        lastName: req.body?.lastName,
        personalId: req.body?.personalId,
        idNumber: req.body?.idNumber,
      };
      console.log("--- STORED ID DATA ---", idData);
      console.log("--- N8N DOCUMENT DATA ---", n8nRes.data);

      const data = n8nRes.data;
      const obj = Array.isArray(data) ? data[0] : data;

      if (
        !obj ||
        typeof obj.firstName !== "string" ||
        typeof obj.lastName !== "string" ||
        typeof obj.personalId !== "string"
      ) {
        return res
          .status(400)
          .json({ message: "პენსიონერის მოწმობის წაკითხვა ვერ მოხერხდა" });
      }

      return res.status(200).json(obj);
    } catch (err) {
      next(err);
    }
  },
);

// Social Extract verification bridge: accepts a social extract document,
// forwards it to n8n, and verifies the applicant is a family member.
app.post(
  "/api/vision/verify-social",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as any;

      if (!file) {
        return res
          .status(400)
          .json({ message: "ფაილი ვერ მოიძებნა (სოციალური ფენი არ არის ატვირთული)." });
      }

      const n8nUrl =
        "https://blablabla233.app.n8n.cloud/webhook-test/process-document";

      const formData = new FormData();
      // wrap the raw buffer in a real Blob so form-data consumers see a proper Blob object
      const fileBlob = new Blob([file.buffer], { type: file.mimetype }) as any;
      formData.append(
        "file",
        fileBlob,
        file.originalname || "social-extract.pdf",
      );

      // axios automatically sets a Content-Type including boundary when the
      // body is an instance of FormData. on Node we may need to copy headers
      // if the FormData implementation exposes them (e.g. form-data package).
      const headers: Record<string, string> = {};
      if (typeof (formData as any).getHeaders === "function") {
        Object.assign(headers, (formData as any).getHeaders());
      }

      const n8nRes = await axios.post(n8nUrl, formData, {
        headers,
        maxBodyLength: Infinity,
      });

      const idData = {
        firstName: req.body?.firstName,
        lastName: req.body?.lastName,
        personalId: req.body?.personalId,
        idNumber: req.body?.idNumber,
      };
      console.log("--- APPLICANT ID ---", idData.personalId);
      console.log("--- FAMILY MEMBERS FROM N8N (RAW) ---", n8nRes.data);

      // 1. Super-Flattening Logic
      let allObjects: any[] = [];
      // This helper function will find all objects inside any nested structure
      const flattenAnything = (obj: any) => {
        if (Array.isArray(obj)) {
          obj.forEach(item => flattenAnything(item));
        } else if (obj && typeof obj === 'object') {
          if (obj.personalId || obj.personalid || obj.firstName) {
            allObjects.push(obj);
          }
          Object.values(obj).forEach(val => flattenAnything(val));
        }
      };

      flattenAnything(n8nRes.data);

      console.log('--- STEP B: TOTAL OBJECTS FOUND ---', allObjects.length);

      // 2. Map and Clean
      const finalMembers = allObjects.map((m: any) => ({
        firstName: String(m.firstName || m.firstname || m.Firstname || '').trim(),
        lastName: String(m.lastName || m.lastname || m.Lastname || '').trim(),
        personalId: String(m.personalId || m.personalid || '').replace(/\s+/g, '')
      }));

      console.log('--- STEP C: FINAL CLEAN LIST ---', JSON.stringify(finalMembers, null, 2));

      // 3. Match Logic
      const applicantId = String(idData.personalId || '').replace(/\s+/g, '');
      const foundMember = finalMembers.find(m => m.personalId === applicantId);

      if (foundMember) {
        console.log('✅ MATCH SUCCESSFUL:', foundMember.firstName);
        return res.json({ success: true, data: foundMember });
      } else {
        console.log('❌ NO MATCH FOR ID:', applicantId);
        return res.status(404).json({ success: false, message: "ვერ მოიძებნა" });
      }
    } catch (err) {
      next(err);
    }
  },
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { ensureDbBasics } = await import("./db-init");
  // Retry DB bootstrap up to 3 times so transient Neon issues
  // don't immediately fail startup.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureDbBasics();
      break;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.warn(
        `[db] bootstrap attempt ${attempt} failed:`,
        msg,
      );
      if (attempt === 3) {
        console.warn(
          "[db] giving up on bootstrap after 3 attempts; continuing without DB bootstrap",
        );
        break;
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  const { registerRoutes } = await import("./routes");
  const { serveStatic } = await import("./static");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions: Parameters<typeof httpServer.listen>[0] = {
    port,
    host: "0.0.0.0",
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };

  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  //
  // In middleware mode, Vite's HMR may wait for the HTTP server
  // to be listening, so we start listening before setupVite.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
})();
