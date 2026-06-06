/**
 * Modo de ejecución de la app.
 *
 * La app es un único programa que, al arrancar, pregunta cómo entrar:
 *  - "admin": acceso completo (requiere clave).
 *  - "sololectura": consulta sin permisos de escritura.
 *
 * El modo se elige en caliente en cada arranque (ver LaunchGate), no al compilar.
 */
export type AppMode = "admin" | "sololectura";

/**
 * Clave de Administrador por defecto, usada mientras no haya una clave
 * guardada en la configuración del equipo.
 *
 * Nota: la seguridad aquí no es crítica (uso entre compañeros de trabajo);
 * sirve solo para separar el acceso de escritura del de consulta.
 */
export const DEFAULT_ADMIN_PASSWORD = "admin";
