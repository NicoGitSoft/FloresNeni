# Neni — AI Development Workflow & Master Checklist

**Branch de integración:** `v2`  
**Objetivo:** mantener un flujo de desarrollo reproducible, auditable y rápido para humanos + agentes de IA.  
**Estado:** documento vivo. Actualizar cuando cambie el flujo, la arquitectura o las reglas de trabajo.

---

## 1. Roles

### Nico
- Define prioridades de producto y negocio.
- Aprueba cambios sensibles.
- Revisa experiencia visual y comportamiento esperado.
- No necesita copiar código entre ChatGPT y VS Code salvo casos excepcionales.

### ChatGPT
- Arquitectura y planificación.
- Revisión integral del repositorio vía GitHub.
- Revisión de commits, PRs y diffs ya publicados.
- Puede crear ramas, archivos, commits y PRs cuando corresponda.
- **No puede ver cambios no commiteados dentro de un Codespace local**.
  Para revisar antes del commit, debe recibir el `git diff` o el cambio debe publicarse en una rama/PR.

### Copilot local — `neni-commerce-engineer`
- Trabaja dentro del Codespace/VS Code.
- Puede inspeccionar, editar y ejecutar comandos sobre el working tree.
- Debe seguir `AGENTS.md`, `.github/copilot-instructions.md`,
  `docs/NENI_PRODUCTION_LOGIC.md` y este documento.
- Para tareas importantes: **editar y validar primero; NO hacer commit automáticamente** salvo que se pida explícitamente.

### Copilot Cloud Agent
- Para trabajos largos, paralelos y autocontenidos.
- Debe trabajar en rama/PR independiente.
- Nunca reemplaza CI ni revisión humana en pagos, inventario, reservas,
  migraciones, seguridad o reglas de negocio.

### GitHub Actions
- Juez determinista de build, types, lint y tests.
- Un agente no puede declarar una tarea “lista” si CI falla.

---

## 2. Flujo normal de trabajo

Para una tarea sustancial:

1. Partir desde `v2` actualizado.
2. Crear rama:
   ```bash
   git switch v2
   git pull --ff-only
   git switch -c feature/<nombre>
   ```
3. Seleccionar el agente local `neni-commerce-engineer`.
4. Pedirle inspeccionar primero y **no commitear**.
5. El agente implementa y ejecuta los checks aplicables.
6. Revisar working tree:
   ```bash
   git status
   git diff --check
   git diff
   ```
7. Si se quiere revisión de ChatGPT **antes del commit**:
   ```bash
   git diff > /tmp/neni-review.diff
   cat /tmp/neni-review.diff
   ```
   Compartir el diff en el chat.
8. Corregir lo observado.
9. Ejecutar:
   ```bash
   pnpm neni:check
   ```
10. Commit:
    ```bash
    git add -A
    git commit -m "<tipo>: <descripción>"
    ```
11. Push:
    ```bash
    git push -u origin HEAD
    ```
12. Abrir PR hacia `v2`.
13. CI + revisión de diff.
14. Merge sólo cuando esté verde y aprobado.

### Regla corta

```text
inspeccionar
→ editar
→ ejecutar
→ revisar diff
→ validar
→ commit
→ PR
→ CI
→ merge
```

---

## 3. Prompt base para el agente local

Usar como plantilla:

```text
Trabaja como neni-commerce-engineer.

Objetivo:
<describir la tarea>

Antes de editar:
1. Lee AGENTS.md, .github/copilot-instructions.md,
   docs/NENI_PRODUCTION_LOGIC.md,
   docs/IMPLEMENTATION_ROADMAP.md y
   docs/AI_DEVELOPMENT_WORKFLOW.md.
2. Inspecciona la implementación existente y reutiliza primitivas nativas de Medusa.
3. Propón brevemente el slice que vas a implementar.

Luego:
- implementa el slice completo;
- ejecuta los checks más estrechos y confiables;
- actualiza documentación/roadmap cuando corresponda;
- deja el repo buildable;
- NO hagas commit ni push;
- al terminar muestra:
  - archivos modificados,
  - comandos ejecutados,
  - resultados,
  - riesgos o pendientes.
```

---

# MASTER CHECKLIST

## Fase 0 — Baseline del proyecto

- [x] Repositorio `NicoGitSoft/FloresNeni`.
- [x] Rama activa de desarrollo `v2`.
- [x] `main` se conserva como legacy/referencia.
- [x] Backend Medusa 2.x.
- [x] Storefront Astro + React.
- [x] PostgreSQL.
- [x] Redis de desarrollo.
- [x] Reglas comerciales en `docs/NENI_PRODUCTION_LOGIC.md`.
- [x] Roadmap en `docs/IMPLEMENTATION_ROADMAP.md`.
- [x] `AGENTS.md`.
- [x] `apps/backend/AGENTS.md`.
- [x] `.github/copilot-instructions.md`.
- [x] `.github/agents/neni-commerce-engineer.agent.md`.
- [x] El agente `neni-commerce-engineer` aparece en VS Code.
- [x] `pnpm neni:setup` levanta PostgreSQL/Redis y aplica migraciones.
- [ ] Baseline completamente verde con `pnpm neni:check`.

---

## Fase 1 — Codespace reproducible

- [x] Corregir Node del Codespace: el repo exige >=22.22.0.
- [x] Fijar Node 22.22.0 en `.devcontainer/devcontainer.json`.
- [x] pnpm fijado en 10.34.6.
- [ ] Rebuild del dev container.
- [ ] Verificar Docker-in-Docker.
- [ ] Verificar PostgreSQL.
- [ ] Verificar Redis.
- [x] `pnpm neni:setup` aplica migraciones y luego el bootstrap idempotente sin borrar datos.
- [ ] Objetivo de arranque:
  ```bash
  pnpm neni:setup
  pnpm neni:dev
  ```
- [ ] Evaluar comando único de arranque después de estabilizar.

---

## Fase 2 — Bootstrap real de Neni

- [x] Eliminar el seed demo del ciclo de migraciones de esquema.
- [x] Crear/reutilizar región Chile / CLP.
- [x] Crear/reutilizar Sales Channel `Neni Web`.
- [x] Crear/reutilizar Stock Location `Taller Neni`.
- [x] Crear/reutilizar fulfillment base de desarrollo.
- [x] Crear/reutilizar Publishable API Key y vincularla al canal.
- [x] Escribir `PUBLIC_MEDUSA_PUBLISHABLE_KEY` en `apps/storefront/.env`.
- [x] Sembrar los 11 productos reales de Neni y vincularlos al canal.
- [x] Hacer idempotente el bootstrap Neni.
- [x] Añadir `pnpm neni:bootstrap`.
- [ ] Limpiar una DB de desarrollo antigua que aún contenga datos demo; requiere aprobación explícita porque borra datos.
- [ ] No usar borrado de DB como flujo normal.

---

## Fase 3 — Plataforma de agentes

- [x] Agente personalizado `neni-commerce-engineer`.
- [x] Instrucciones de repositorio para agentes.
- [ ] Confirmar herramientas/permisos útiles del agente local.
- [ ] Mantener guardrails: no `main`, no secretos, no destrucción de DB.
- [ ] Agente local no commitea por defecto.
- [ ] Añadir agentes especializados sólo cuando exista una necesidad real.
- [ ] Evaluar MCP sólo si reduce trabajo concreto.
- [ ] Mantener este documento como fuente viva del flujo de IA.

---

## Fase 4 — CI

- [x] Crear `.github/workflows/ci.yml`.
- [x] Trigger en PR hacia `v2`.
- [x] Node 22.22.0.
- [x] pnpm 10.34.6.
- [x] `pnpm install --frozen-lockfile`.
- [x] `git diff --check`.
- [x] Storefront TypeScript.
- [x] Storefront build.
- [x] Backend build.
- [ ] Unit tests relevantes.
- [ ] Integration tests posteriores con PostgreSQL/Redis.
- [x] Hacer que CI y `pnpm neni:check` compartan la misma verdad.
- [ ] Añadir dependency scanning / CodeQL cuando el baseline esté estable.

---

## Fase 5 — Cloud Agent readiness

- [ ] Crear `.github/workflows/copilot-setup-steps.yml`.
- [ ] Instalar Node/pnpm correctos.
- [ ] Instalar dependencias desde lockfile.
- [ ] Preparar servicios PostgreSQL/Redis cuando sean necesarios.
- [ ] No exponer secretos productivos.
- [ ] Validar el setup del Cloud Agent.
- [ ] Resolver estrategia de default branch: actualmente GitHub usa `main`,
      mientras el desarrollo activo vive en `v2`.
- [ ] No cambiar default branch hasta estabilizar la estrategia.

---

## Fase 6 — Higiene técnica inmediata

- [x] Corregir script raíz `storefront:dev` para `@neni/storefront`.
- [x] Corregir filtros de los comandos de desarrollo y bootstrap del workspace.
- [ ] Revisar compatibilidad de versiones React / overrides del workspace.
- [ ] Clasificar warnings Medusa en:
  - tolerables de desarrollo;
  - deuda;
  - bloqueantes.
- [ ] Decidir telemetría Medusa.
- [ ] Evitar mezcla entre seeds demo y Neni.
- [ ] `pnpm neni:check` completamente verde.

---

## Fase 7 — Política Git / PR

- [ ] `v2` como integración.
- [ ] Rama independiente para features sustanciales.
- [ ] Rama independiente para tareas delegadas a agentes.
- [ ] PR siempre hacia `v2`.
- [ ] PR debe indicar objetivo, archivos, validación, riesgos y pendientes.
- [ ] CI requerido.
- [ ] Revisión humana obligatoria para:
  - pagos;
  - inventario;
  - producción;
  - reservas/concurrencia;
  - migraciones;
  - seguridad.
- [ ] Proteger `v2` cuando CI ya sea confiable.

---

## Fase 8 — Definition of Done

Para una tarea sustancial:

- [ ] Código existente inspeccionado.
- [ ] Reglas Neni relevantes leídas.
- [ ] Primitivas Medusa reutilizadas antes de crear infraestructura propia.
- [ ] Slice completo.
- [ ] Tipado correcto.
- [ ] Build correcto.
- [ ] Tests relevantes.
- [ ] Migración si cambió modelo de datos.
- [ ] Failure paths considerados.
- [ ] Concurrencia/idempotencia donde corresponda.
- [ ] `git diff --check`.
- [ ] Roadmap/documentación actualizados.
- [ ] Sin secretos en Git.
- [ ] Repo buildable.
- [ ] PR coherente.

---

## Fase 9 — Storefront y checkout

- [x] Catálogo Medusa.
- [x] Store API.
- [x] 11 productos Neni definidos.
- [x] Carrito Medusa real.
- [x] Persistencia de cart ID.
- [ ] Cerrar cualquier pendiente de ficha de producto.
- [ ] Checkout base sin pagos:
  - [ ] nombre/contacto;
  - [ ] email;
  - [ ] teléfono;
  - [ ] dirección;
  - [ ] retiro/despacho;
  - [ ] fecha solicitada;
  - [ ] validación server-side.
- [ ] No integrar Webpay todavía.

---

## Fase 10 — Inventario y recetas

- [ ] Stock Location `Taller Neni`.
- [ ] Materias primas como inventory items.
- [ ] Stock físico.
- [ ] Reservado.
- [ ] Stock útil.
- [ ] Costos/proveedores.
- [ ] Recetas/BOM.
- [ ] Inventory Kits donde correspondan.
- [ ] Componentes obligatorios.
- [ ] Sustituciones.
- [ ] Merma.

---

## Fase 11 — Neni Production Module

Ruta objetivo:

```text
apps/backend/src/modules/production/
```

- [ ] `ProductionSettings`.
- [ ] `ProductProductionProfile`.
- [ ] `ProductionCalendar`.
- [ ] `ProductionReservation`.
- [ ] `WasteLog`.
- [ ] `ProcurementPlan`.
- [ ] Capacidad en minutos.
- [ ] Cupo diario por producto.
- [ ] Cutoff normal 14:00.
- [ ] Ventana extendida hasta 18:00.
- [ ] No productivos / domingos.
- [ ] Abastecimiento futuro.
- [ ] Forward scheduling.
- [ ] Primera fecha factible.

---

## Fase 12 — Reservas y concurrencia

Antes de cobrar:

- [ ] Revalidar precio.
- [ ] Revalidar materiales.
- [ ] Revalidar capacidad.
- [ ] Revalidar cupo.
- [ ] Revalidar fecha.
- [ ] Reserva temporal de materiales.
- [ ] Reserva temporal de minutos.
- [ ] Reserva temporal de cupo.
- [ ] TTL/expiración.
- [ ] Liberación al abandonar.
- [ ] Redis locking.
- [ ] Idempotencia.

Invariante:

```text
precio + materiales + capacidad + cupo + fecha
```

debe ser válido server-side antes de cobrar.

---

## Fase 13 — Webpay

Sólo iniciar después de Fase 12.

- [ ] Payment Provider Medusa / Transbank.
- [ ] Creación server-side.
- [ ] Redirect.
- [ ] Commit/callback server-side.
- [ ] Verificación de token, monto y estado.
- [ ] Idempotencia.
- [ ] Convertir reserva en compromiso.
- [ ] Crear order.
- [ ] Cancelación.
- [ ] Timeout.
- [ ] Refund.
- [ ] Secretos externos al repositorio.

---

## Fase 14 — Admin Denise

Sección `Neni Producción`:

- [ ] Hoy.
- [ ] Pedidos.
- [ ] Calendario.
- [ ] Inventario.
- [ ] Recetas.
- [ ] Compras.
- [ ] Merma.
- [ ] Capacidad.
- [ ] Configuración.
- [ ] Cupos/horarios editables sin código.
- [ ] Faltantes automáticos.
- [ ] Lista de compras.
- [ ] Reportes de merma/costo.
- [ ] Preparar capacidad multi-florista.

---

## Fase 15 — Testing

- [ ] Unit tests para reglas puras.
- [ ] Integration tests Medusa.
- [ ] Tests de disponibilidad.
- [ ] Tests de concurrencia.
- [ ] Tests de checkout.
- [ ] E2E navegador.
- [ ] Mobile.
- [ ] Desktop.
- [ ] Browser automation donde aporte valor.
- [ ] Visual regression selectiva.

---

## Fase 16 — Producción

- [ ] Hosting storefront.
- [ ] Hosting backend.
- [ ] PostgreSQL administrado.
- [ ] Redis administrado.
- [ ] Object storage para media.
- [ ] CDN.
- [ ] Dominio.
- [ ] HTTPS.
- [ ] Dev / staging / prod.
- [ ] Secrets manager.
- [ ] Backups.
- [ ] Observabilidad.
- [ ] Alertas.
- [ ] Rate limiting.
- [ ] Anti-bot.
- [ ] Auditoría.
- [ ] Migraciones desplegables y reversibles.
- [ ] Continuidad operacional antes de ventas reales.

---

## 4. Prioridad inmediata — Developer Platform v1

Orden actual:

1. Codespace / Node correcto.
2. Bootstrap real de Neni.
3. Publishable API key automática.
4. Eliminar datos demo del bootstrap.
5. Corregir deuda técnica corta.
6. `pnpm neni:check` verde.
7. CI inicial.
8. Cloud Agent readiness.
9. Retomar Checkout base.

No integrar Webpay hasta que inventario, capacidad, fecha y reservas sean autoritativos server-side.
