/**
 * Registra en la consola (Logs de Vercel) cada intento de envío
 * @param to destinatario
 * @param status estado del envío ("OK", "FALLIDO", "ERROR")
 * @param transactionId id único de la transacción
 * @param errorMsg mensaje de error opcional
 */
export function logNotification(
  to: string,
  status: string,
  transactionId: string,
  errorMsg: string = ""
) {
  const timestamp = new Date().toISOString();
  
  // Construimos el mensaje
  const logMessage = `[${timestamp}] | TxID: ${transactionId} | To: ${to} | Estado: ${status}${errorMsg ? " | Error: " + errorMsg : ""}`;

  // En Vercel, usar console.error hace que el log salga en ROJO (útil para alertas)
  // y console.log sale normal.
  if (status === "ERROR" || status === "FALLIDO" || errorMsg) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}