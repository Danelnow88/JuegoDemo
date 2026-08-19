// ===== NÚCLEO: namespace global compartido entre los módulos del juego =====
// Se carga PRIMERO. Aquí vivirá (en fases posteriores) el estado mutable compartido,
// y los módulos exponen en él sus datos y funciones públicas.
window.NV = window.NV || {};
