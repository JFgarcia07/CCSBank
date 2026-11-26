-- Marca cuándo se pagó el salario de un reporte aprobado (evita pagar dos veces la misma semana).
ALTER TABLE "ReporteSemanal" ADD COLUMN "pagadoEn" TIMESTAMP(3);
