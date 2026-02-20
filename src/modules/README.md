# src/modules — Visão Geral de Módulos (técnico)

Este diretório reúne os bounded contexts do sistema. Cada submódulo implementa uma parte do domínio com a separação de camadas definida em `docs/TYPE_ARCHITECTURE.md` (Domain / Application / Infrastructure / Interface / UI).

Regras e responsabilidades macro

- Cada módulo é um bounded context (ex.: `container`, `process`, `tracking`, `dashboard`).
- Domínio (folder `domain/`) contém regras puras, entidades, value objects e invariantes.
- Application (folder `application/`) orquestra casos de uso; aceita Commands e retorna Results.
- Infrastructure (folder `infrastructure/`) implementa adaptadores (DB, Supabase, providers) e mappers de persistência.
- Interface (quando presente) contém controllers/adapters HTTP (Zod schemas, mappers Request↔Command, Response DTOs).
- UI (quando presente) contém view models e mapeadores para a camada de apresentação.

Dependências permitidas entre módulos

- Módulos podem depender de outros módulos apenas via contratos públicos (por exemplo: tipos de DTO em `shared/api-schemas` ou funções de apresentação exportadas).
- É proibido um módulo acessar diretamente a `infrastructure/` de outro módulo (ex.: não importar repositório Supabase de outro módulo).
- Concerns transversais (logger, http helpers, supabase client, tipos DB) vivem em `src/infrastructure` ou `src/shared` e devem ser usados como adaptadores, não como lugar de lógica de domínio.

Estrutura recomendada (presente em vários módulos deste repositório)

- domain/
- application/
- infrastructure/
- interface/ (opcional)
- ui/ (opcional)
- README.md

Onde procurar orientação e convenções

- Regras de tipagem e mappers: `docs/TYPE_ARCHITECTURE.md`
- Pipeline de tracking e conceitos centrais: `docs/master-consolidated-0209.md` e `docs/roadmap-consolidated-0209.md`

Boas práticas rápidas

- Repositórios lançam exceções em erro (não retornam `{ success: boolean }`).
- Não usar `any` nem `as` (exceto `as const`). Use guards / Zod quando lidar com dados externos.
- UI nunca deriva regras de domínio (por exemplo: status deve ser derivado pelo módulo `tracking` / domain code).
