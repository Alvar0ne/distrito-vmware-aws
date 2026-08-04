# Distrito Miami App

Base inicial para migrar Distrito Miami desde Jumpseller a una tienda propia.

## Stack propuesto

- Next.js
- React
- TypeScript
- PostgreSQL en la siguiente fase
- Flow para pagos
- AWS Lightsail para el primer despliegue

## Comandos

```bash
npm install
npm run dev
```

Luego abrir:

```text
http://localhost:3000
```

Para crear tablas y migrar productos y pedidos actuales a PostgreSQL:

```bash
cp .env.example .env.local
npm run db:migrate-local
```

El modo local sigue usando los archivos JSON. En AWS se cambiara a:

```env
DATA_STORE=postgres
DATABASE_URL=postgres://usuario:clave@rds-endpoint:5432/distrito_miami
AWS_REGION=us-east-1
AWS_S3_BUCKET=nombre-del-bucket
IMAGE_STORE=s3
```

Para copiar las imagenes locales al bucket S3:

```bash
npm run images:migrate-s3
```

Este comando crea primero `data/products.imported.before-s3.json` como respaldo.

## Estructura

```text
app/
  page.tsx              Tienda publica
  admin/page.tsx        Panel admin inicial
  checkout/page.tsx     Resumen de checkout
  api/checkout          API inicial para crear orden y pago
  api/flow/confirmacion Callback inicial de Flow
  layout.tsx            Layout global
  globals.css           Estilos globales
components/
  ProductGrid.tsx       Catalogo y filtros
  CartDrawer.tsx        Carrito local
lib/
  catalog.ts            Catalogo conectado al JSON importado
  orders.ts             Validacion y armado de pedidos
  products.ts           Productos demo y tipos
  pricing.ts            Reglas de precio y descuento
  flow.ts               Adaptador preparado para Flow
data/
  products.imported.json Productos reales exportados desde Jumpseller
  import-summary.json    Resumen de importacion
db/
  schema.sql            Tablas PostgreSQL para catalogo y pedidos
scripts/
  seed-products.mjs     Carga productos importados en PostgreSQL
```

## Importacion actual

El archivo `data/products.imported.json` ya contiene la exportacion real de Jumpseller procesada:

- 96 productos.
- 187 filas originales contando variantes.
- 16 marcas.
- 42 productos destacados.
- Categorias: poleras, polerones, accesorios, conjuntos y chaquetas.
- Tallas detectadas: XS, S, M, L, XL y U para productos sin talla.

## Siguientes pasos

1. Revisar visualmente productos importados, imagenes y tallas.
2. Crear base PostgreSQL y configurar `DATABASE_URL`.
3. Ejecutar `npm run db:migrate-local` para conservar productos y pedidos.
4. Conectar Flow usando credenciales reales.
5. Persistir pedidos reales desde `app/api/checkout`.
6. Crear autenticacion para el panel admin.
7. Desplegar en AWS Lightsail.
