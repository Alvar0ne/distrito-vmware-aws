# Despliegue AWS - Distrito Miami

## Recursos necesarios

1. PostgreSQL administrado o instalado en el servidor.
2. Bucket S3 privado para imagenes de productos.
3. Servicio para ejecutar el contenedor (`Dockerfile`).
4. Dominio con HTTPS.

## Variables de produccion

Usar `.env.production.example` como referencia. Las claves reales no deben guardarse en Git.

## Orden de migracion

```bash
npm run images:migrate-s3
npm run db:migrate-local
npm run deploy:check
npm run build
```

## Comprobacion de salud

AWS debe consultar:

```text
/api/health
```

Debe responder HTTP 200 y `status: ok`. Si PostgreSQL falla, respondera HTTP 503.

## Flujo final

1. Publicar la aplicacion con variables de produccion.
2. Confirmar que `/api/health` responde correctamente.
3. Probar catalogo, checkout y panel admin.
4. Configurar `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS.
5. Realizar un pago controlado y comprobar la confirmacion automatica de Flow.
