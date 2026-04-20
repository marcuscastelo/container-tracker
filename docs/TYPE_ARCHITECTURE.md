# Arquitetura de Tipos e Camadas — Container Tracker (Guia Definitivo)

> **Objetivo**: este documento consolida decisões e linguagem de arquitetura para evitar explosão de schemas/tipos, banir duck typing, e padronizar separação entre **Domain / Application / Infrastructure / Interface(HTTP) / UI** no Container Tracker.

---

## 1) Problema que estamos resolvendo

código estava ficando insustentável por:

* múltiplos schemas (banco, DTO, UI, parciais)
* `Partial<>`, `Omit<>`, `Pick<>` espalhados
* duck typing implícito e objetos “parecidos”
* risco de esquecer props no caminho (mapas e spreads ad hoc)

**Meta**: ter modelo previsível onde **cada fronteira muda tipo**, com contratos explícitos, mapeamento centralizado e validações bem definidas.

---

## 2) Camadas e responsabilidades

### 2.1 Visão geral (do backend ao frontend)

```
DB Row
  ↓ (infra mapper)
Domain Entity/Aggregate
  ↓ (application)
Use Case Result
  ↓ (interface/http mapper)
HTTP Response DTO (JSON)
  ↓ (ui mapper)
ViewModel
```

### 2.2 O que pertence a cada camada

* **Domain**: regras puras, entidades, aggregates, value objects, invariantes.
* **Application**: orquestração (use cases), comandos, resultados, contratos de repository.
* **Infrastructure**: detalhes técnicos (DB/Supabase, APIs externas, email, logging), implementação de repositories.
* **Interface (HTTP)**: controllers, schemas Zod de request, mappers HTTP, response models, tratamento de erro HTTP.
* **UI**: componentes, view models, mapeamento de DTO → VM, form validation de UX, composição timeline-first da tela de shipment.

---

## 3) Vocabulário definitivo de tipos

Evite nomes genéricos (“Input”, “DTO”) sem qualificador. Use termos que indiquem **camada** e **direção**.

### 3.1 Tipos principais

|Termo|Camada|que é|Exemplo|
| ------------------------------- | ------------------- | --------------------------------------------- | ------------------------ |
|**Row**|Infra|espelho do banco|`ContainerRow`|
|**Entity**|Domain|objeto de negócio com identidade|`ContainerEntity`|
|**Aggregate**|Domain|entidade raiz que garante invariantes|`ProcessAggregate`|
|**Command**|Application|intenção do usuário para use case|`CreateContainerCommand`|
|**Result**|Application|retorno do use case (não HTTP)|`CreateContainerResult`|
|**Record** (Persistence Record)|Application ↔ Infra|contrato do repository p/ persistir/consultar|`InsertContainerRecord`|
|**Request DTO**|Interface/HTTP|body/query params validados (Zod)|`CreateProcessRequest`|
|**Response DTO**|Interface/HTTP|shape serializável retornado|`ProcessResponse`|
|**ViewModel (VM)**|UI|dados prontos p/ renderizar|`ProcessListItemVM`|

> **Regra Absoluta**: **Command não entra na infra** e **Row não sobe para application/UI**.

---

## 4) “Front vs Back” e o que é “cross”

* **Row** é sempre **backend** (infra).
* **Command / Result / Record / Entity / Aggregate** são **backend**.
* **Request/Response DTO** são **cross-boundary** (fronteira HTTP).
* **ViewModel** é **frontend**.

### 4.1 Entidade/Aggregate deve ser “cross”?

**Não.** Entity/Aggregate são modelos de consistência e regras. frontend consome **DTO** e produz **ViewModel**.

### 4.2 Validar no front e no back

Sim, mas com distinção:

* **Validação de UX (frontend)**: sintaxe, formato, required, feedback imediato.
* **Validação de Consistência (backend)**: regras dependentes de estado global/banco, concorrência, invariantes.

|Tipo de regra|Front|Back|
| -------------------------------------------- | ----- | ---- |
|Formato/sintaxe (regex, length)|✅|✅|
|Normalização (trim/upper)|✅|✅|
|Dependente de banco (unicidade, ownership)|❌|✅|
|Invariantes do agregado (não remover último)|❌|✅|

**Como compartilhar sem acoplar**: compartilhar **funções puras de validação/normalização** (ex: `validateContainerNumber`) — não Entities/Aggregates.

---

## 5) Banindo duck typing

### 5.1 Regras

* Nada de aceitar “qualquer objeto com campos” (duck typing implícito).
* Evitar `Partial<Entity>` e `Omit<Entity, ...>` como modelos de escrita.
* Evitar `as SomeType` fora de funções `toX()`/brand controladas.

### 5.2 Branding / Value Objects

Use branded types e funções `toX()`:

* `ContainerId`, `ProcessId`, `ContainerNumber`, `CarrierCode` etc.

Ou marker interno `__type` (opcional), mas essencial é **não permitir criação ad hoc**.

### 5.3 Factories

Entities devem ser criadas por **factory**:

* `createContainerEntity(props)`
* `createProcessEntity(props)`

Sem literais soltos.

---

## 6) Mappers: onde vivem e o que recebem

### 6.1 Infra persistence mappers

* Ficam em: `modules/<mod>/infrastructure/persistence/*.mappers.ts`
* São **único lugar** onde snake_case e nomes de colunas existem.

Recebem/retornam:

* `Row → Entity`
* `Record → Insert/Update Row`

**Nunca**:

* `Command → Row`

### 6.2 UI mappers

* Ficam em: `modules/<mod>/ui/*.ui-mapper.ts`

* Convertem:

* `Response DTO → ViewModel`

**Nunca** recebem Entity/Row.

Para shipment/process view:

* VMs de timeline devem consumir blocos operacionais já derivados em read model/DTO.
* UI mapper não pode introduzir derivação semântica (ex.: detectar transshipment, reconciliar ACTUAL/EXPECTED).

### 6.3 HTTP mappers

* Ficam em: `modules/<mod>/interface/http/*.http.mappers.ts`

* Convertem:

* `Request DTO → Command`

* `Entity/Result → Response DTO`

---

## 7) Repository: contrato e tipagem

### 7.1 Por que não usar `{ success: true | false }`

`success unions` poluem Application e replicam padrão de HTTP.

**Decisão**: repository **lança exceção** (ex: `InfrastructureError`) em caso de falha.

### 7.2 O que repository recebe e retorna

* Recebe: **Records** (contratos de persistência)
* Retorna: **Entity** (ou tipos de leitura específicos)
* Erros: **throw**

Exemplo:

* `insert(record: InsertContainerRecord): Promise<ContainerEntity>`
* `existsMany(numbers: string[]): Promise<Map<string, boolean>>`
* `delete(id: string): Promise<void>`

### 7.3 existsMany vs findByNumbers

* `existsMany`: intenção de **validação**. Retorna `Map<string, boolean>`. Leve.
* `findByNumbers`: intenção de **carregar dados**. Retorna `ContainerEntity[]`. Mais pesado.

---

## 8) Organização de pastas (módulo)

### 8.1 Template do módulo `container` (pós-refatoração)

```
src/modules/container
├── application
│   ├── container.facade.ts
│   ├── container.repository.ts
│   └── usecases
│       ├── check-container-existence.usecase.ts
│       ├── create-container.usecase.ts
│       ├── create-many-containers.usecase.ts
│       ├── delete-container.usecase.ts
│       ├── find-containers-by-number.usecase.ts
│       └── reconcile-containers.usecase.ts
├── domain
│   ├── container.entity.ts
│   ├── container.status.ts
│   ├── container.types.ts
│   └── container.validation.ts
├── infrastructure
│   ├── bootstrap
│   │   └── container.bootstrap.ts
│   ├── external
│   └── persistence
│       ├── container.row.ts
│       ├── container.persistence.mappers.ts
│       └── container.repository.supabase.ts
├── interface
│   └── http
│       ├── container.controller.ts
│       ├── container.schemas.ts
│       ├── container.http.mappers.ts
│       └── container.responses.ts
└── ui
    ├── container.ui-mapper.ts
    └── container.vm.ts
```

### 8.2 Facade

* Vive em `application/container.facade.ts`
* **Só compõe** use cases. Sem regra.
* Retorna objeto com métodos (`createContainer`, `reconcileForProcess`, etc.).

### 8.3 Bootstrap

* Vive em `infrastructure/bootstrap/*`
* Faz wiring: `facade + repo impl`.
* É **composition root** do módulo.

---

## 9) Infra transversal (cross-module)

Criar `src/infrastructure/` para concerns compartilhados:

```
src/infrastructure
├── http
│   ├── http-response.ts
│   └── error-mapper.ts
├── database
│   └── supabase.client.ts
├── logging
│   └── logger.ts
└── observability
    └── sentry.ts
```

* `jsonResponse()` deve morar aqui.
* mapeamento de erro para HTTP (`mapErrorToResponse`) deve morar aqui.
* logging/observability devem morar aqui.

---

## 10) SolidStart: routes, controllers e separação

### 10.1 Não colocar lógica na rota

rota SolidStart (`src/routes/api/...`) deve ser adapter fino:

* chama controller
* retorna response

Sem:

* map de entidades
* chamadas diretas ao repo
* schemas Zod inline

### 10.2 Controller HTTP

Controller:

* valida request (Zod)
* mapeia request → command
* chama facade
* mapeia result/entity → response DTO
* trata erro via infraestrutura transversal

---

## 11) Process: domínio a partir do schema antigo

schema antigo (Zod) era **modelo de transporte**, não domínio.

No domínio:

* evitar `optional + nullable` simultâneo
* normalizar para: `valor | null` (sem undefined)
* criar value objects para campos centrais

Exemplo de evolução:

* `reference?: string | null` (DTO) → `ProcessReference | null` (domain)
* `created_at: Date` (DTO) → `createdAt: Date` (domain)

E relacionamento com containers:

* **não é banco que define** se `Process` “tem containers” no domínio
* quem define é presença de invariantes (ex: não remover último container)

---

## 12) Aggregate vs Read Model (para performance e semântica)

### 12.1 Aggregate

* existe para consistência/invariantes
* pode ser “pesado” (carregar filhos) quando necessário

### 12.2 Read Models / Projections

* existem para performance e UX
* listagens e dashboards **não** devem carregar aggregates completos

Exemplos:

* `ProcessListItemProjection`
* `ProcessOperationalState`

**Não criar “terceira entidade viva (X)” como Aggregate** só para leitura — isso deve ser projection/read model.

---

## 13) Checklist de anti-patterns banidos

* `Partial<Entity>` como input de update
* `Omit<Entity, ...>` e `Pick<>` como modelo de escrita
* UI importando `infrastructure/`
* Controller chamando repository diretamente
* Mapper de infra recebendo `Command`
* Repository retornando `{ success: boolean }`
* snake_case vazando para fora da infra
* usar spread (`{...row}`) entre camadas

---

## 14) Regras práticas de evolução

1. **Cada fronteira muda tipo**.
2. **Entidade/Aggregate é backend-only**.
3. Front valida UX (formato), back valida verdade (consistência).
4. método no repository deve existir por **intenção**, não por “CRUD genérico”.
5. Mappers são centralizados e pequenos.

---

## 15) Próximos passos recomendados

1. Aplicar mesma refatoração do `container` ao `process`:

   * domain com value objects + entity/aggregate
   * repository contract (throw)
   * infra persistence mappers (Record↔Row)
   * interface/http com schemas/mappers/controllers

2. Extrair helpers transversais:

   * `jsonResponse`, `error-mapper`, `logger`

3. Padronizar responses do `/api/processes`:

   * mover mapping para `process.interface/http`
   * remover chamadas diretas ao repo no handler

---

## 16) Glossário rápido

* **Entity**: identidade + regras locais.
* **Aggregate**: entidade raiz que garante invariantes transacionais.
* **Command**: intenção para modificar estado (entrada de use case).
* **Result**: retorno do use case (não HTTP).
* **Record**: contrato do repository (persistência).
* **Row**: shape do banco.
* **Request/Response DTO**: shapes HTTP.
* **ViewModel**: shape de UI.
* **Projection/Read Model**: modelo de leitura otimizado (não domínio).

---

## 17) DTO Scope and Naming Rule

DTO é contrato de fronteira HTTP, não contrato interno.

Regras:

* Sufixo `DTO` deve ficar em `interface/http` e `shared/api-schemas`.
* Application/Domain/UI devem usar `Result`, `Projection`, `ReadModel`, `VM` conforme camada.
* `snake_case` em tipos internos só é permitido em mappers de persistência e mappers de fronteira HTTP.

Pipeline obrigatório:

`Row -> Entity/Aggregate -> Result -> Response DTO -> ViewModel`

Violação comum:

* usar Response DTO como contrato interno entre application e UI.

Correção:

* criar tipo interno dedicado (por exemplo `TrackingObservationProjection`) e mapear explicitamente na fronteira.

---

## 18) ViewModel vs UI State vs UI Service

* **ViewModel**: dados renderizáveis, sem comportamento.
* **UI State**: estado de interação (ordenação, filtros, seleção, paginação).
* **UI Service/Utility**: comportamento puro sobre VM (`sort`, `filter`, `group`, `compare`).
* **UI Mapper**: transformação de Response DTO para VM.

Para shipment/process screen:

* layout canônico: timeline-first (coluna principal) + sidebar de metadados de suporte.
* cronologia é artefato primário; cards de suporte não devem interromper fluxo cronológico.
* agrupamentos operacionais da timeline devem ser preservados quando presentes no contrato de leitura.

---

## 19) Naming Rules

* `*.vm.ts` -> shape/type only
* `*.ui-mapper.ts` -> DTO -> VM mapper only
* `*.service.ts` -> behavior
* `*.utils.ts` -> helper puro pequeno
* `*.readmodel.ts` -> projeção backend

---

## 20) LLM Anti-Patterns

LLMs must NOT:

* colocar lógica em arquivos `*.vm.ts`
* derivar status/timeline/alerts na UI
* transformar DTO HTTP em contrato interno de aplicação
* simplificar semântica de séries ACTUAL/EXPECTED
* achatar timeline operacional agrupada em lista genérica quando read model já fornece blocos semânticos
* esconder conflitos de ACTUAL ou incerteza operacional
* mover regra de domínio para capability
* criar shared kernel implícito
