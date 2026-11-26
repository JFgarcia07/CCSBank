-- Catálogo de bonus y fines por clase (tabla nueva, no toca datos existentes).
CREATE TABLE "ConceptoNomina" (
    "id" TEXT NOT NULL,
    "gradoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptoNomina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConceptoNomina_gradoId_idx" ON "ConceptoNomina"("gradoId");

CREATE UNIQUE INDEX "ConceptoNomina_gradoId_tipo_nombre_key" ON "ConceptoNomina"("gradoId", "tipo", "nombre");

ALTER TABLE "ConceptoNomina" ADD CONSTRAINT "ConceptoNomina_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
