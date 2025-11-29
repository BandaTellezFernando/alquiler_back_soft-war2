import mongoose, { Schema, Document } from "mongoose";
import { env } from "../config/env";

export interface UserLocation {
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  provincia?: string;
  lat?: number;
  lng?: number;
}

export interface UserDoc extends Document {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  correo?: string;
  correoElectronico?: string; // alias
  ci?: string;
  password?: string;
  fotoPerfil?: string; // URL/base64 (HEAD usaba Buffer, pero front suele usar string)
  ubicacion?: UserLocation;
  terminosYCondiciones?: boolean;
  rol?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

const usersDbName = env.MONGODB_USERS_DB;
const baseConnection = mongoose.connection;
const usersConnection = usersDbName
  ? baseConnection.useDb(usersDbName, { useCache: true })
  : baseConnection;

const UserSchema = new Schema<UserDoc>(
  {
    nombre: { type: String, trim: true },
    apellido: { type: String, trim: true },
    telefono: { type: String, trim: true },

    // Campo principal de correo, con alias para mantener compatibilidad con "correoElectronico"
    correo: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      required: [true, "El correo electrónico es requerido"],
      alias: "correoElectronico",
    },

    ci: { type: String, trim: true },

    password: {
      type: String,
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
    },

    fotoPerfil: { type: String, trim: true },

    ubicacion: {
      direccion: { type: String, trim: true },
      ciudad: { type: String, trim: true },
      departamento: { type: String, trim: true },
      provincia: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
    },

    terminosYCondiciones: {
      type: Boolean,
      required: [true, "Debes aceptar los términos y condiciones"],
    },

    rol: { type: String, trim: true },
  },
  {
    collection: "users",
    timestamps: true,
    strict: false,
  }
);

// Índices: CI y correo
UserSchema.index({ ci: 1 }, { unique: true, sparse: true });
UserSchema.index({ correo: 1 }, { unique: true, sparse: true });

export const UserModel =
  usersConnection.models.User ??
  usersConnection.model<UserDoc>("User", UserSchema);

export default UserModel;
