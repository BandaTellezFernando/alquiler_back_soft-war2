/** * Logger extendido: Adaptado para Vercel (Serverless)
 * Escribe en stdout/stderr para que Vercel capture los logs automáticamente.
 */
export function logSystem(
    level: "INFO" | "WARN" | "ERROR",
    message: string,
    context: Record<string, any> = {}
) {
    // Creamos el objeto del log con timestamp
    const entry = { ts: new Date().toISOString(), level, message, ...context };
    
    // Convertimos a string para que sea legible en los logs de Vercel
    // Si prefieres ver el objeto expandible en local, puedes quitar el JSON.stringify
    const logOutput = JSON.stringify(entry);

    // En Vercel, console.error y console.warn se marcan con colores
    // y se pueden filtrar fácilmente en el panel de Logs.
    if (level === "ERROR") {
        console.error(logOutput);
    } else if (level === "WARN") {
        console.warn(logOutput);
    } else {
        console.log(logOutput);
    }
}