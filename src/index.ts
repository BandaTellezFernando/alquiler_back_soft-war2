// ============================================
// IMPORTS BASE
// ============================================
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import mongoose from "mongoose";

// ============================================
// CONFIG .ENV
// ============================================
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ============================================
// BASE DE DATOS
// ============================================
import connectDB from "./config/database";

connectDB().catch((err) => {
  console.error("Error al conectar con la base de datos:", err.message);
});

// ============================================
// MODELOS Y DATA (HEAD)
// ============================================
import UbicacionEstaticaModel from "./models/ubicacion.model";
import Fixer from "./models/Fixer";
import { ubicacionesDefinidas } from "./data/ubicacionesData";
import { fixersDefinidos } from "./data/fixersData";

// ============================================
// MIDDLEWARES GLOBALES (NOTIFICACIONES)
// ============================================
import { requestLogger } from "./modules/notification_Gmail/middlewares/request.middleware";
import { notFoundHandler } from "./modules/notification_Gmail/middlewares/notFound.middleware";
import { globalErrorHandler } from "./modules/notification_Gmail/middlewares/error.middleware";

// ============================================
// UTILIDADES
// ============================================
import { logSystem } from "./modules/notification_Gmail/utils/loggerExtended";

// ============================================
// RUTAS DE NOTIFICACIONES
// ============================================
import gmailRoutes from "./modules/notification_Gmail/routes/notification.routes";
import gmailCentralRouter from "./modules/notification_Gmail/routes/central.router";
import whatsappRoutes from "./modules/notification_WhatsApp/routes/notification.routes";
import whatsappCentralRouter from "./modules/notification_WhatsApp/routes/central.router";

// ============================================
// RUTAS GENERALES
// ============================================
import citaRoutes from "./routes/cita.routes";
import ciudadRoutes from "./routes/ciudad.routes";
import clienteRoutes from "./routes/cliente.routes";
import especialidadRoutes from "./routes/especialidad.routes";
import fixerRoutes from "./routes/fixer.routes";
import historialRoutes from "./routes/historial.routes";
import horarioDisponibleRoutes from "./routes/horario_disponible.routes";
import notificacionGmailRoutes from "./routes/notificacionGmail.routes";
import notificacionWhatsAppRoutes from "./routes/notificacionWhatsApp.routes";
import magiclinkRoutes from "./routes/magiclink.routes";
import provinciaRoutes from "./routes/provincia.routes";
import servicioRoutes from "./routes/servicio.routes";
import sessionRoutes from "./routes/session.routes";
import trabajoRoutes from "./routes/trabajo.routes";
import userRoutes from "./routes/user.routes";
import userAuthRoutes from "./routes/userAuth.routes";
import walletRoutes from "./routes/wallet.routes";

// ============================================
// RUTAS DEL EQUIPO (OFERTAS / FIXERS / CATEGORIES / TEAMSYS)
// ============================================
import offersRouter from "./routes/offers";
import fixerModule from "./modules/fixer";
import categoriesModule from "./modules/categories";
import teamsysModule from "./modules/teamsys";

// ============================================
// RUTAS EXTRA (HEAD)
// ============================================
import ubicacionRoutes from "./routes/ubicacion.routes";
//import availabilityRoutes from "./modules/DevCode/routes/availability.routes";

// ============================================
// APP SETUP
// ============================================
const app = express();

// Confía en el proxy (útil para proxies / load balancers)
app.set("trust proxy", 1);

// CORS
const corsOrigins = [
  ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
  ...(process.env.CORS_ORIGIN ?? "").split(","),
  ...(process.env.CORS_ORIGINS ?? "").split(","),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

// Parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(helmet());
app.use(requestLogger);

// ============================================
// RUTA PÚBLICA RAÍZ
// ============================================
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "API Backend Servineo",
    status: "OK",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    modules: {
      notifications: {
        gmail: ["/api/gmail-notifications", "/gmail-notifications"],
        whatsapp: ["/api/whatsapp-notifications", "/whatsapp-notifications"],
      },
      general: [
        "/api/cita",
        "/api/ciudad",
        "/api/cliente",
        "/api/especialidad",
        "/api/fixer",
        "/api/historial",
        "/api/horario-disponible",
        "/api/magiclink",
        "/api/notificacion-gmail",
        "/api/notificacion-whatsapp",
        "/api/provincia",
        "/api/servicio",
        "/api/session",
        "/api/trabajo",
        "/api/user",
        "/api/auth",
        "/api/wallet",
      ],
      teamScrumPiones: [
        "/api/offers",
        "/api/fixers",
        "/api/categories",
        "/api/teamsys",
      ],
      geolocation: [
        "/api/geolocation/nearby-fixers",
        "/api/geolocation/nearby-ubicaciones",
      ],
      ubicaciones: [
        "/api/ubicaciones",
        "/api/ubicaciones/cargar-definidas",
        "/api/fixers/cargar-definidos",
      ],
      devcode: ["/api/devcode/*"],
    },
  });
});

// ============================================
// HEALTH CHECK (DETALLADO CON MONGOOSE)
// ============================================
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const dbState = mongoose.connection.readyState;
    const isConnected = dbState === 1;

    res.json({
      status: "healthy",
      database: isConnected ? "connected" : "disconnected",
      dbName: mongoose.connection.db?.databaseName,
      dbState,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error health check:", error);
    res.status(500).json({
      status: "unhealthy",
      database: "error",
      error: "Error checking database",
    });
  }
});

// ============================================
// ENDPOINTS SEED / UTILIDADES (HEAD)
// ============================================

// Cargar ubicaciones definidas
app.post("/api/ubicaciones/cargar-definidas", async (_req: Request, res: Response) => {
  try {
    console.log("🔄 Cargando datos a ubicaciones estáticas...");

    const deleteResult = await UbicacionEstaticaModel.deleteMany({});
    console.log(`🗑️ Eliminados: ${deleteResult.deletedCount} documentos`);

    const insertResult = await UbicacionEstaticaModel.insertMany(ubicacionesDefinidas);
    console.log(`✅ Insertados: ${insertResult.length} documentos`);

    const count = await UbicacionEstaticaModel.countDocuments();

    res.json({
      success: true,
      message: "Datos cargados en ubicaciones estáticas",
      deleted: deleteResult.deletedCount,
      inserted: insertResult.length,
      total: count,
    });
  } catch (error) {
    console.error("❌ Error cargando datos:", error);
    res.status(500).json({
      success: false,
      message: "No se pudo conectar a MongoDB",
    });
  }
});

// Cargar fixers definidos
app.post("/api/fixers/cargar-definidos", async (_req: Request, res: Response) => {
  try {
    console.log("🔄 Cargando fixers en MongoDB...");

    const deleteResult = await Fixer.deleteMany({});
    console.log(`🗑️ Eliminados: ${deleteResult.deletedCount} fixers`);

    const insertResult = await Fixer.insertMany(fixersDefinidos);
    console.log(`✅ Insertados: ${insertResult.length} fixers`);

    const count = await Fixer.countDocuments();

    res.json({
      success: true,
      message: "Fixers cargados en MongoDB",
      deleted: deleteResult.deletedCount,
      inserted: insertResult.length,
      total: count,
    });
  } catch (error) {
    console.error("❌ Error cargando fixers:", error);
    res.status(500).json({
      success: false,
      message: "No se pudieron cargar los fixers",
    });
  }
});

// (Opcional) GET de fixers "raw" para debug, sin chocar con /api/fixers del módulo
app.get("/api/fixers/raw", async (_req: Request, res: Response) => {
  try {
    const fixers = await Fixer.find().sort({ nombre: 1 });
    console.log(`🔧 Fixers encontrados en MongoDB: ${fixers.length}`);
    res.json({
      success: true,
      data: fixers,
      count: fixers.length,
    });
  } catch (error) {
    console.error("Error al obtener fixers:", error);
    res.status(500).json({
      success: false,
      message: "Error de base de datos",
    });
  }
});

// ============================================
// GEOLOCALIZACIÓN (HEAD)
// ============================================
class GeolocationService {
  static calculateDistance(
    loc1: { lat: number; lng: number },
    loc2: { lat: number; lng: number }
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(loc2.lat - loc1.lat);
    const dLng = this.deg2rad(loc2.lng - loc1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(loc1.lat)) *
        Math.cos(this.deg2rad(loc2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static findNearbyFixers(
    userLocation: { lat: number; lng: number },
    fixers: any[],
    maxDistanceKm: number = 5
  ) {
    return fixers.filter((fixer) => {
      const fixerLocation = {
        lat: fixer.posicion?.lat ?? fixer.lat ?? 0,
        lng: fixer.posicion?.lng ?? fixer.lng ?? 0,
      };
      const distance = this.calculateDistance(userLocation, fixerLocation);
      return distance <= maxDistanceKm;
    });
  }

  static findNearbyUbicaciones(
    userLocation: { lat: number; lng: number },
    ubicaciones: any[],
    maxDistanceKm: number = 2
  ) {
    return ubicaciones.filter((ubicacion) => {
      const ubicacionLocation = {
        lat: ubicacion.posicion?.lat ?? ubicacion.lat ?? 0,
        lng: ubicacion.posicion?.lng ?? ubicacion.lng ?? 0,
      };
      const distance = this.calculateDistance(userLocation, ubicacionLocation);
      return distance <= maxDistanceKm;
    });
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// GET fixers cercanos
app.get("/api/geolocation/nearby-fixers", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Se requieren coordenadas lat y lng",
      });
    }

    const userLocation = {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    };

    const allFixers = await Fixer.find();
    const nearbyFixers = GeolocationService.findNearbyFixers(
      userLocation,
      allFixers,
      parseFloat(String(radius))
    );

    console.log(
      `📍 Fixers cercanos encontrados: ${nearbyFixers.length} en radio de ${radius}km`
    );

    res.json({
      success: true,
      data: nearbyFixers,
      count: nearbyFixers.length,
      userLocation,
      searchRadius: radius,
    });
  } catch (error) {
    console.error("Error en geolocalización:", error);
    res.status(500).json({
      success: false,
      message: "Error al buscar fixers cercanos",
    });
  }
});

// GET ubicaciones cercanas
app.get("/api/geolocation/nearby-ubicaciones", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 2 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Se requieren coordenadas lat y lng",
      });
    }

    const userLocation = {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    };

    const allUbicaciones = await UbicacionEstaticaModel.find();
    const nearbyUbicaciones = GeolocationService.findNearbyUbicaciones(
      userLocation,
      allUbicaciones,
      parseFloat(String(radius))
    );

    console.log(
      `📍 Ubicaciones cercanas encontradas: ${nearbyUbicaciones.length} en radio de ${radius}km`
    );

    res.json({
      success: true,
      data: nearbyUbicaciones,
      count: nearbyUbicaciones.length,
      userLocation,
      searchRadius: radius,
    });
  } catch (error) {
    console.error("Error en geolocalización:", error);
    res.status(500).json({
      success: false,
      message: "Error al buscar ubicaciones cercanas",
    });
  }
});

// ============================================
// RUTAS DE MÓDULOS (AMBOS MUNDOS)
// ============================================

// Notificaciones
app.use("/gmail-notifications", gmailRoutes);
app.use("/api/gmail-notifications", gmailCentralRouter);
app.use("/whatsapp-notifications", whatsappRoutes);
app.use("/api/whatsapp-notifications", whatsappCentralRouter);

// Generales
app.use("/api/cita", citaRoutes);
app.use("/api/ciudad", ciudadRoutes);
app.use("/api/cliente", clienteRoutes);
app.use("/api/especialidad", especialidadRoutes);
app.use("/api/fixer", fixerRoutes);
app.use("/api/historial", historialRoutes);
app.use("/api/horario-disponible", horarioDisponibleRoutes);
app.use("/api/notificacion-gmail", notificacionGmailRoutes);
app.use("/api/notificacion-whatsapp", notificacionWhatsAppRoutes);
app.use("/api/magiclink", magiclinkRoutes);
app.use("/api/provincia", provinciaRoutes);
app.use("/api/servicio", servicioRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/trabajo", trabajoRoutes);
app.use("/api/user", userRoutes);
app.use("/api/auth", userAuthRoutes);
app.use("/api/wallet", walletRoutes);

// Equipo
app.use("/api/offers", offersRouter);
app.use("/api/fixers", fixerModule);
app.use("/api/categories", categoriesModule);
app.use("/api/teamsys", teamsysModule);

// Módulo de ubicaciones (HEAD)
app.use("/api/ubicaciones", ubicacionRoutes);

// Módulo DevCode (HEAD)
//app.use("/api/devcode", availabilityRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ============================================
// SERVIDOR
// ============================================
const PORT = Number(process.env.PORT ?? 5000);

app.listen(PORT, () => {
  const baseUrl = `http://localhost:${PORT}`;
  logSystem("INFO", `Servidor corriendo en puerto ${PORT}`);
  logSystem("INFO", `Modo: ${process.env.NODE_ENV}`);
  logSystem("INFO", `URL base: ${baseUrl}`);
  logSystem("INFO", `Ejemplos:`);
  logSystem("INFO", `  GET  ${baseUrl}/api/health`);
  logSystem("INFO", `  GET  ${baseUrl}/api/ubicaciones`);
  logSystem("INFO", `  POST ${baseUrl}/api/ubicaciones/cargar-definidas`);
  logSystem("INFO", `  POST ${baseUrl}/api/fixers/cargar-definidos`);
  logSystem("INFO", `  GET  ${baseUrl}/api/geolocation/nearby-fixers?lat=X&lng=Y&radius=5`);
  logSystem("INFO", `  GET  ${baseUrl}/api/geolocation/nearby-ubicaciones?lat=X&lng=Y&radius=2`);
});
