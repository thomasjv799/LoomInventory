# Inventory Studio documentation

Start with the dashboard guide for day-to-day use, then the metric definitions when interpreting a number. The remaining documents describe the handoff to the backend milestone.

| Document                                                  | Purpose                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Dashboard guide](dashboard-guide.md)                     | Eight sections, filters, drawers, exports and settings                          |
| [Metric definitions](metrics.md)                          | Formulas, denominators, time windows and evidence limitations                   |
| [Data dictionary and import](data-dictionary.md)          | Fixture files, normalized tables, units, provenance and import order            |
| [Database design](database-design.md)                     | Relationships, stock accounting, constraints and production additions           |
| [API contract](api-design.md)                             | Proposed FastAPI endpoints, payload conventions, permissions and error handling |
| [Code architecture](code-architecture.md)                 | File map, runtime data flow, state and provider transition                      |
| [Backend roadmap](backend-roadmap.md)                     | Implementation sequence and acceptance gates                                    |
| [OpenAPI 3.1 contract](api/openapi.json)                  | Machine-readable proposed API; no server implementation yet                     |
| [PostgreSQL reference draft](database/postgres-draft.sql) | Reviewable DDL, not a deployed migration                                        |
| [QA record](QA.md)                                        | Existing prototype checks and limits                                            |
| [Screenshot gallery](screenshots/index.html)              | UI review images; filenames include viewport widths                             |

**Status: 6 October 2026.** The frontend is implemented. Business data and forecasts are simulated. Normalized exports are checked using a local relational database. PostgreSQL deployment, authentication and the API remain proposed work. The Loom imagery and explicitly referenced festival dates are external references, not endorsements or evidence of access to The Loom's business systems.
