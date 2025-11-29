import { Router, Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { Types } from "mongoose";
import { UserModel, UserDoc } from "../../models/User";

const router = Router();


// 🧹 Normalizar email
function normalizeEmail(email?: string): string {
  return (email ?? "").trim().toLowerCase();
}

// 🔍 Obtener contraseña de forma segura sin any
function resolvePassword(body: Record<string, unknown>): string | undefined {
  const keys = ["password", "correoElectronico", "contraseña", "contrase\u00f1a"];
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

// 🏡 Ruta de información del módulo
router.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "📦 Módulo Teamsys",
    version: "1.0.0",
    endpoints: {
      exists: "/api/teamsys/exists?email=correo",
      registrarUsuario: "/api/teamsys/usuario",
      login: "/api/teamsys/auth/login",
    },
  });
});

// 📌 Verificar si un usuario existe por correo
router.get("/exists", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.query.email as string);
    if (!email) return res.json({ exists: false });

    const existing = await UserModel.findOne({ correo: new RegExp(`^${email}$`, "i") }).lean();
    res.json({ exists: Boolean(existing) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al verificar correo" });
  }
});

// ✨ Registrar usuario (Google o Manual)
router.post("/usuario", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<UserDoc>;

    const nombre = body.nombre?.trim();
    const correo = normalizeEmail(body.correo);
    const fotoPerfil = body.fotoPerfil;
    const terminos = Boolean(body.terminosYCondiciones);
    const rol = body.rol ?? "requester";

    const password = resolvePassword(req.body);

    const rawCi = String(body.ci ?? "").trim();
    const ci = rawCi || `auto-${new Types.ObjectId().toString()}`;

    if (!nombre || !correo || !fotoPerfil) {
      return res.status(400).json({
        success: false,
        message: "Nombre, correo y fotoPerfil son obligatorios",
      });
    }

    const exists = await UserModel.findOne({ correo }).lean();
    if (exists) {
      return res.status(409).json({ success: false, message: "El correo ya se encuentra registrado" });
    }

    const user = await UserModel.create({
      ...body,
      nombre,
      correo,
      ci,
      terminosYCondiciones: terminos,
      password,
    });

    res.status(201).json({
      success: true,
      data: { id: user._id, nombre: user.nombre, correo: user.correo, rol },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al registrar usuario" });
  }
});

// 🔐 Login
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(
      req.body?.correoElectronico ||
      req.body?.correo ||
      req.body?.email
    );

    const password = resolvePassword(req.body);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Correo y contraseña son obligatorios" });
    }

    const user = await UserModel.findOne({ correo: new RegExp(`^${email}$`, "i") })
      .select("+password +contraseña +contrase\u00f1a")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const storedPassword =
      (user as Record<string, string>).password ??
      (user as Record<string, string>).contraseña ??
      (user as Record<string, string>)["contrase\u00f1a"];

    if (storedPassword && storedPassword !== password) {
      return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }

    const secret: Secret = process.env.JWT_SECRET || "servineoapptest123";
    const token = jwt.sign({ sub: String((user as any)._id), rol: (user as any).rol }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
    } as SignOptions);

    delete (user as any).password;

    res.json({
      success: true,
      token,
      user: {
        id: (user as any)._id,
        nombre: (user as any).nombre,
        correo: (user as any).correo,
        rol: (user as any).rol ?? "requester",
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Error al iniciar sesión" });
  }
});

export default router;
