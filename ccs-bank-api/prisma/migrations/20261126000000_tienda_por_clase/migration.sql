-- Los productos de la tienda pertenecen a una clase; las compras guardan cuándo se entregó el premio.
-- (Falla si ya hubiera productos sin clase: en ese caso hay que asignarlos antes.)
ALTER TABLE "Producto" ADD COLUMN "gradoId" TEXT NOT NULL;
ALTER TABLE "Compra" ADD COLUMN "entregadaEn" TIMESTAMP(3);

CREATE INDEX "Producto_gradoId_idx" ON "Producto"("gradoId");
CREATE UNIQUE INDEX "Producto_gradoId_nombre_key" ON "Producto"("gradoId", "nombre");

ALTER TABLE "Producto" ADD CONSTRAINT "Producto_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
