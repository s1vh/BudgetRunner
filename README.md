# Budget Runner — Antigravity Documentation Pack

- `PRD.md`: alcance, requisitos funcionales, UX y criterios de aceptación.
- `DATABASE.md`: modelo PostgreSQL e invariantes.
- `API.md`: contrato REST.
- `GAME_SYSTEM.md`: reglas matemáticas de SynthCoins, Flux y Cyberdeck.
- `ROADMAP.md`: fases y backlog de implementación.
- `TEST_PLAN.md`: escenarios para Browser Agent.

Fuente visual: mockup de Stitch UI y `DESIGN.md` Ultrawave suministrados con el proyecto.

Orden recomendado de lectura: PRD → GAME_SYSTEM → DATABASE → API → ROADMAP → TEST_PLAN.

## Frontend ejecutable

El prototipo React + TypeScript + Tailwind se encuentra en `frontend/`. Utiliza datos internos mutables durante la sesión y una interfaz de repositorio preparada para sustituirse por la API REST.

```bash
cd frontend
npm install
npm run dev
```

Validación de producción:

```bash
npm run build
npm run lint
```

Consulta `frontend/README.md` para conocer la arquitectura, las rutas y el cambio entre mock y API.
