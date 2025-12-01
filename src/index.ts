// ============================================
// IMPORTS BASE
// ============================================
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import mongoose from "mongoose";

// ❌ ANTES: import UserModel from "./models/fixer.model";
// ✅ AHORA: usa el MISMO modelo que usan tus rutas /api/user y /api/auth
import UserModel from "./models/User"; // <-- AJUSTA el path si tu modelo se llama distinto

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
// NOTIFICACIONES MIDDLEWARE
// ============================================
import { requestLogger } from "./modules/notification_Gmail/middlewares/request.middleware";
import { notFoundHandler } from "./modules/notification_Gmail/middlewares/notFound.middleware";
import { globalErrorHandler } from "./modules/notification_Gmail/middlewares/error.middleware";

// ============================================
// UTILIDADES LOGGER
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
// RUTAS DEL EQUIPO
// ============================================
import offersRouter from "./routes/offers";
import fixerModule from "./modules/fixer";
import categoriesModule from "./modules/categories";
import teamsysModule from "./modules/teamsys";

// ============================================
// RUTAS EXTRA
// ============================================
import ubicacionRoutes from "./routes/ubicacion.routes";

// ============================================
// APP SETUP
// ============================================
const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(helmet());
app.use(requestLogger);

// ============================================
// RUTA HOME
// ============================================
app.get("/", (_req, res) => {
  res.json({ message: "API Backend Servineo", status: "OK" });
});

// ============================================
// ENDPOINTS SEED
// ============================================
app.post("/api/ubicaciones/cargar-definidas", async (_req, res) => {
  await UbicacionEstaticaModel.deleteMany({});
  const inserted = await UbicacionEstaticaModel.insertMany(ubicacionesDefinidas);
  res.json({ success: true, inserted: inserted.length });
});

app.post("/api/fixers/cargar-definidos", async (_req, res) => {
  await Fixer.deleteMany({});
  const inserted = await Fixer.insertMany(fixersDefinidos);
  res.json({ success: true, inserted: inserted.length });
});

// ============================================
// ENDPOINT PARA MAPA: FIXERS DESDE USERS (rol = "fixer")
// ============================================

app.get("/api/map-fixers", async (_req: Request, res: Response) => {
  try {
    // 👀 DEBUG 1: ver cuántos usuarios totales hay
    const allUsers: any[] = await UserModel.find().lean();
    console.log("👥 Total usuarios en la colección users:", allUsers.length);

    // 👀 DEBUG 2: filtrar por rol = "fixer"
    const users = allUsers.filter((u) => u.rol === "fixer");
    console.log("🛠️ Usuarios con rol 'fixer':", users.length);

    const fixers = users.map((u: any) => {
      const lat = u.ubicacion?.lat;
      const lng = u.ubicacion?.lng;

      // Si no hay coordenadas, un valor por defecto
      const location =
        typeof lat === "number" && typeof lng === "number"
          ? { lat, lng }
          : { lat: -17.3895, lng: -66.1568 };

      const fullName = `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();

      return {
        _id: String(u._id),
        fixerId: String(u._id),
        userId: String(u._id),
        name: fullName || "Fixer",
        photoUrl: u.fotoPerfil || "/imagenes_respaldo/perfil-default.jpg",
        whatsapp: u.telefono || "",
        location,
        categories: ["Servicios generales"],
        rating: 4.5,
        verified: true,
        termsAccepted: !!u.terminosYCondiciones,
        createdAt: u.createdAt?.toISOString?.() || "",
        updatedAt: u.updatedAt?.toISOString?.() || "",
      };
    });

    console.log("📍 Fixers construidos para el mapa:", fixers.length);

    res.json({
      success: true,
      data: fixers,
      count: fixers.length,
    });
  } catch (error) {
    console.error("Error /api/map-fixers:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener fixers para el mapa",
    });
  }
});

// ============================================
// RUTA RAW DEBUG
// ============================================
app.get("/api/fixers/raw", async (_req, res) => {
  const fixers = await Fixer.find();
  res.json({ success: true, data: fixers, count: fixers.length });
});

// ============================================
// RUTAS DE MÓDULOS
// ============================================
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

// Equipo SCRUM
app.use("/api/offers", offersRouter);
app.use("/api/categories", categoriesModule);
app.use("/api/fixers", fixerModule);
app.use("/api/teamsys", teamsysModule);

// Ubicaciones
app.use("/api/ubicaciones", ubicacionRoutes);

// ============================================
// ERRORES
// ============================================
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ============================================
// INICIO SERVIDOR
// ============================================
const PORT = Number(process.env.PORT ?? 5000);
app.listen(PORT, () => {
  logSystem("INFO", `Servidor en puerto ${PORT}`);
});