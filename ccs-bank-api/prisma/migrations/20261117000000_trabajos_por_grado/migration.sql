-- Los trabajos pertenecen a una clase (grado). La tabla estaba vacía al aplicar esta migración.
DROP INDEX "Trabajo_nombre_key";

ALTER TABLE "Trabajo" ADD COLUMN "gradoId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Trabajo_gradoId_nombre_key" ON "Trabajo"("gradoId", "nombre");

ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
