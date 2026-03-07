# 🏰 THE BROKEN LAMP — Game Design Document

> Um RPG sandbox narrativo com NPCs autônomos, movidos por LLM local (LM Studio), onde cada personagem vive, trabalha, fofoca, luta, ama e trai — tudo com consequências reais para o mundo.

---

## 📋 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [O Jogador](#3-o-jogador)
4. [NPCs — Personagens do Mundo](#4-npcs--personagens-do-mundo)
5. [Rede de Afinidade entre NPCs](#5-rede-de-afinidade-entre-npcs)
6. [Sistema de Fofoca e Propagação de Informação](#6-sistema-de-fofoca-e-propagação-de-informação)
7. [Rotinas e Vida Autônoma dos NPCs](#7-rotinas-e-vida-autônoma-dos-npcs)
8. [Interações com o Jogador — Catálogo Completo](#8-interações-com-o-jogador--catálogo-completo)
9. [Reações do Mundo ao Jogador](#9-reações-do-mundo-ao-jogador)
10. [Sistema de Combate](#10-sistema-de-combate)
11. [Guerra e Facções](#11-guerra-e-facções)
12. [Economia e Comércio](#12-economia-e-comércio)
13. [Relacionamentos Profundos](#13-relacionamentos-profundos)
14. [Consequências e Cadeia de Reações](#14-consequências-e-cadeia-de-reações)
15. [Eventos Aleatórios e Emergentes](#15-eventos-aleatórios-e-emergentes)
16. [Engine — O que NÃO depende de LLM](#16-engine--o-que-não-depende-de-llm)
17. [LLM — O que SIM depende de Prompt](#17-llm--o-que-sim-depende-de-prompt)
18. [Mapa de Locais](#18-mapa-de-locais)
19. [Fluxo Técnico (Two-Pass)](#19-fluxo-técnico-two-pass)
20. [Roadmap e Prioridades](#20-roadmap-e-prioridades)

---

## 1. VISÃO GERAL

**The Broken Lamp** é um RPG sandbox narrativo estilo Stardew Valley, porém focado em interações sociais profundas com NPCs controlados por LLM. O jogador vive numa cidade medieval e pode:

- Conversar naturalmente com qualquer NPC (via LLM)
- Construir relacionamentos (amizade, romance, casamento)
- Destruir relacionamentos (trair, roubar, ameaçar, matar)
- Comercializar (comprar, vender, trabalhar)
- Explorar locais (taverna, mercado, porto, floresta, minas, castelo)
- Participar de guerras e combates
- Ser surpreendido por eventos aleatórios (roubos, rumores, confrontos)
- Ver o mundo reagir organicamente às suas ações

**Filosofia central:** O mundo existe com ou sem o jogador. NPCs têm rotinas, opiniões uns dos outros, e espalham informações entre si. As ações do jogador geram ondas de consequência que se propagam pela rede social da cidade.

---

## 2. ARQUITETURA DO SISTEMA

```
┌──────────────────────────────────────────────────────┐
│                     BROWSER UI                        │
│   Stats Panel  │  Chat Area  │  Engine Log / Map      │
└───────┬────────┴──────┬──────┴────────┬───────────────┘
        │               │               │
        ▼               ▼               ▼
┌──────────────────────────────────────────────────────┐
│                    chat.js                            │
│         Two-Pass LLM Flow (prompt → parse → react)   │
└───────┬──────────────────────────────┬───────────────┘
        │                              │
   ┌────▼────┐                   ┌─────▼─────┐
   │ LM Studio│                   │  engine.js │
   │  (LLM)  │                   │  (rules)   │
   └─────────┘                   └─────┬──────┘
                                       │
                    ┌──────────────┬────┴─────┬──────────────┐
                    ▼              ▼          ▼              ▼
               ┌────────┐   ┌─────────┐  ┌───────┐   ┌──────────┐
               │ npc.js  │   │ world.js│  │config │   │ parser.js│
               │profiles │   │ state   │  │tables │   │ XML parse│
               │memory   │   │ deeds   │  │prices │   └──────────┘
               │traits   │   │ time    │  │effects│
               │routines │   │ events  │  │prompts│
               └────────┘   └─────────┘  └───────┘
```

### Divisão de responsabilidades:

| Camada | O que faz | Depende de LLM? |
|--------|-----------|-----------------|
| **Engine** | Avaliar ações, calcular stats, aplicar efeitos, checar gold, resolver combate | ❌ Não |
| **Scheduler** | Rodar rotinas de NPC, avançar tempo, trigger de eventos | ❌ Não |
| **Gossip Network** | Propagar informação entre NPCs baseado em afinidade | ❌ Não |
| **Chat** | Conversar com NPC ativo, two-pass flow | ✅ Sim |
| **NPC Reactions** | NPC reagir ao que ouviu na fofoca, questionar jogador | ✅ Sim (texto) |
| **World Events** | Descrever textualmente o que aconteceu | ✅ Sim (opcional) |

---

## 3. O JOGADOR

### Stats do Jogador
| Stat | Min | Max | Descrição |
|------|-----|-----|-----------|
| `gold` | 0 | ∞ | Moeda universal |
| `health` | 0 | 100 | Vida (0 = game over) |
| `reputation` | -100 | +100 | Reputação global na cidade |

### Stats POR NPC (independentes)
Cada NPC tem seus próprios valores de relação com o jogador:
| Stat | Min | Max | Descrição |
|------|-----|-----|-----------|
| `friendship` | 0 | 100 | Amizade |
| `trust` | 0 | 100 | Confiança |
| `respect` | 0 | 100 | Respeito |

### Inventário
Lista de itens: poções, mapas, armas, chaves, receitas, presentes, comida.

### Deed History (Histórico de Ações)
Categorizado por tipo:
- **Negativo:** killed, harassed, stolen, vandalized, threatened, betrayed
- **Positivo:** helped, donated, rescued, healed, defended, forgave
- **Neutro:** lied, bribed, seduced, snitched, explored

---

## 4. NPCs — PERSONAGENS DO MUNDO

Cada NPC é definido por um **template** (estático) e um **estado vivo** (dinâmico).

### Template (imutável)
```
name, age, role, location
backstory (história pessoal)
personalityPrompt (como fala/age)
traits {
  loyalty      (0-100)  — lealdade após ganhar confiança
  aggression   (0-100)  — tendência a lutar/irritar
  greed        (0-100)  — desejo por ouro
  honesty      (0-100)  — quão honesto é
  romanticism  (0-100)  — abertura a romance
  bravery      (0-100)  — disposição a correr riscos
  suspicion    (0-100)  — desconfiança de estranhos
  betrayalChance (0-100) — chance de trair numa situação crítica
}
npcRelations { npcId → { attitude, note } }
inventory []
shopType
autonomousBehaviors []
schedule []  ← NOVO: rotina diária
```

### Estado Vivo (mutável)
```
stats { friendship, trust, respect }  — relação com o JOGADOR
gold                                  — dinheiro do NPC
flags {}                              — casado, seguindo, etc
memory []                             — últimas 30 interações
currentMood                           — humor atual
knownGossip []                        — fofocas que sabe
lastSeen { day, time, location }      — onde foi visto por último
needs { hunger, energy, social }      — necessidades básicas
```

### NPCs Planejados

| NPC | Role | Local | Personalidade |
|-----|------|-------|---------------|
| **Elara** | Tavern Owner | Taverna | Sarcástica, leal, protetora. Knows city gossip. |
| **Rodrik** | Merchant/Thief | Mercado | Smooth-talker, mentiroso, rouba por necessidade (família doente). |
| **Captain Voss** | Guard Captain | Castelo | Rígido, honrado, odeia criminosos. Pode recrutar para a guarda. |
| **Mira** | Healer/Herbalist | Floresta | Gentil, mística, sabe segredos antigos. Cura por preço justo. |
| **Old Barret** | Retired Miner | Minas | Rabugento, bêbado, mas tem mapas e conhecimento das minas. |
| **Lina** | Orphan/Pickpocket | Ruas | Criança de rua, esperta, pode ser adotada ou virar aprendiz. |
| **Father Aldric** | Priest | Castelo/Praça | Moralista, julga ações, pode absolver ou condenar. Rede de informação. |
| **Thessa** | Bard | Taverna/Mercado | Viajante, canta notícias, espalha fofocas. A "mídia" do jogo. |

---

## 5. REDE DE AFINIDADE ENTRE NPCs

Os NPCs têm relações entre si, independentes do jogador. Isso forma um **grafo social** que dita como informações (e fofocas) se propagam.

### Estrutura
```javascript
// Cada NPC tem um mapa de relações com OUTROS NPCs
npcRelations: {
  "elara":  { affinity: 65, attitude: "friendly", role: "client_friend" },
  "rodrik": { affinity: 15, attitude: "suspicious", role: "shady_customer" },
  "voss":   { affinity: 40, attitude: "neutral", role: "authority" },
  "mira":   { affinity: 80, attitude: "close_friend", role: "childhood_friend" },
}
```

### Escala de Afinidade (0–100)
| Range | Label | Comportamento |
|-------|-------|---------------|
| 0–10 | Inimigo | Não fala, pode atacar, espalha informação contra |
| 11–25 | Desconfiança | Interação mínima, fofoca negativa |
| 26–40 | Conhecido | Cumprimenta, conversa pouco |
| 41–60 | Colega | Conversa normal, compartilha info básica |
| 61–80 | Amigo | Confia, compartilha segredos, defende |
| 81–100 | Íntimo | Protege, arrisca a vida, dá cobertura, alerta de perigos |

### Como a Afinidade Muda
- **NPC vê o jogador fazer algo bom com seu amigo** → afinidade com jogador sobe
- **NPC ouve fofoca de que o jogador roubou** → afinidade cai baseado no honesty/morality do NPC
- **Jogador ajuda NPC** → afinidade do NPC com jogador sobe, e amigos próximos do NPC também ganham um boost menor
- **NPCs interagem entre si** → troca de informações, afinidades evoluem lentamente

---

## 6. SISTEMA DE FOFOCA E PROPAGAÇÃO DE INFORMAÇÃO

A fofoca é o mecanismo central de consequência social. Quando algo acontece, a informação não é instantânea — ela se espalha pela rede de afinidade.

### Tipos de Informação
| Tipo | Heat (calor) | Exemplos |
|------|-------------|----------|
| **Normal** | 1–3 | "O jogador comprou uma cerveja", "Fulano cumprimentou ciclano" |
| **Interessante** | 4–6 | "O jogador convidou Elara pra sair", "Houve uma briga no mercado" |
| **Quente** | 7–8 | "O jogador roubou do Rodrik", "Elara fechou a taverna cedo" |
| **Explosiva** | 9–10 | "O jogador matou alguém", "Casamento!", "Traição!" |

### Como a Fofoca Propaga

```
       Evento acontece (ex: jogador ameaça Elara)
                     │
                     ▼
        ┌────────────────────────┐
        │  Testemunhas diretas   │  ← NPCs presentes no local
        │  (sabem 100% do fato) │
        └───────────┬────────────┘
                    │
               TICK 1 (próximo período)
                    │
                    ▼
        ┌────────────────────────────────────────┐
        │  Amigos íntimos (affinity > 60)        │
        │  Recebem a fofoca com 90% de fidelidade│
        └───────────┬────────────────────────────┘
                    │
               TICK 2
                    │
                    ▼
        ┌────────────────────────────────────────┐
        │  Conhecido (affinity 30-60)            │
        │  Recebem com 60% fidelidade            │
        │  (detalhes podem mudar/exagerar)        │
        └───────────┬────────────────────────────┘
                    │
               TICK 3+  (se heat >= 7)
                    │
                    ▼
        ┌────────────────────────────────────────┐
        │  Toda a cidade sabe                    │
        │  (se heat >= 9: vira "notícia")        │
        │  Bardo canta sobre isso na taverna     │
        └────────────────────────────────────────┘
```

### Regras de Propagação

1. **Alcance base** = `heat × 2` NPCs por tick
2. **Fidelidade** = diminui 20% por salto (amigo→conhecido→desconhecido)
3. **Se heat ≥ 7** → atravessa a barreira de afinidade (atinge até quem não é próximo)
4. **Se heat ≥ 9** → vira notícia: todo NPC da cidade sabe em 2 ticks. O Bardo (Thessa) canta sobre o assunto. Padre Aldric comenta no sermão.
5. **Fofoca morre** após `heat × 2` ticks (vira "informação antiga")
6. **NPCs com alto honesty** passam a fofoca com mais fidelidade
7. **NPCs com baixo honesty** podem distorcer, exagerar ou inventar detalhes
8. **NPCs que não gostam do jogador** podem espalhar versões piores
9. **NPCs que gostam do jogador** podem suavizar ou omitir detalhes

### Estrutura de uma Fofoca
```javascript
{
  id: "gossip_001",
  originalEvent: "Player threatened Elara with a dagger",
  heat: 8,
  source: "elara",            // quem testemunhou
  currentVersion: "Player pulled a dagger on Elara at the tavern",
  fidelity: 1.0,              // 1.0 = original, 0.5 = distorcida
  knownBy: ["elara", "thessa"],
  spreadTick: 0,              // quantos ticks já se passaram
  tags: ["threatened", "violence"],
  expired: false,
}
```

### Efeitos da Fofoca nos NPCs
- NPC que **ouve** uma fofoca negativa sobre o jogador → diminui afinidade proporcionalmente
- NPC que **ouve** algo bom sobre o jogador → aumenta afinidade levemente
- NPC com **suspicion alto** vai acreditar mais facilmente em fofocas negativas
- NPC com **loyalty alto** ao jogador pode ignorar/descontar fofocas negativas
- A próxima conversa do NPC com o jogador pode **mencionar** a fofoca ("ouvi dizer que você...")

---

## 7. ROTINAS E VIDA AUTÔNOMA DOS NPCs

NPCs devem ter vida própria, mesmo sem interação com o jogador. Isso funciona inteiramente via engine (sem LLM).

### Períodos do Dia
| Período | Hora Aprox. | Duração do Tick |
|---------|-------------|-----------------|
| Dawn | 5h–7h | 1 tick |
| Morning | 7h–12h | 1 tick |
| Afternoon | 12h–17h | 1 tick |
| Evening | 17h–21h | 1 tick |
| Night | 21h–5h | 1 tick |

### Schedule (Rotina de cada NPC)
```javascript
// Exemplo: Elara
schedule: [
  { time: "dawn",      location: "tavern",  activity: "cleaning",    note: "Limpa o bar" },
  { time: "morning",   location: "market",  activity: "shopping",    note: "Compra ingredientes" },
  { time: "afternoon", location: "tavern",  activity: "cooking",     note: "Prepara comida" },
  { time: "evening",   location: "tavern",  activity: "working",     note: "Atende clientes" },
  { time: "night",     location: "tavern",  activity: "resting",     note: "Fecha e dorme no andar de cima" },
]

// Exemplo: Rodrik
schedule: [
  { time: "dawn",      location: "port",    activity: "scouting",    note: "Observa cargas chegando" },
  { time: "morning",   location: "market",  activity: "selling",     note: "Finge vender especiarias" },
  { time: "afternoon", location: "market",  activity: "pickpocket",  note: "Trabalha (rouba)" },
  { time: "evening",   location: "tavern",  activity: "drinking",    note: "Bebe e escuta fofocas" },
  { time: "night",     location: "port",    activity: "fencing",     note: "Vende itens roubados" },
]
```

### Necessidades dos NPCs (Needs)
Cada NPC tem necessidades que afetam comportamento:

| Need | Decai por | Efeito se baixo |
|------|-----------|-----------------|
| `hunger` | -5/tick | NPC compra comida, ou rouba se greed alto |
| `energy` | -10/tick | NPC vai descansar, fica irritado se acordado |
| `social` | -3/tick | NPC procura conversar, vai a locais sociais |
| `gold` | gasta | NPC trabalha mais, pode roubar, fica nervoso |

### Ações Autônomas (sem LLM)
Cada tick, o engine roda para cada NPC:

1. **Move** NPC para local da rotina
2. **Consome** necessidades (come se tem comida/gold, descansa se em casa)
3. **Trabalha** se na atividade de trabalho (ganha gold)
4. **Socializa** se em local social (troca fofocas com NPCs presentes)
5. **Trigger eventos** baseados em condições:
   - Rodrik rouba se hunger < 20 e greed > 60
   - Voss patrulha se reputation da cidade < -20
   - Mira coleta ervas se na floresta
   - Lina tenta roubar se gold < 5

---

## 8. INTERAÇÕES COM O JOGADOR — CATÁLOGO COMPLETO

### 🍺 Comércio
| Ação | Descrição | Requer |
|------|-----------|--------|
| `serve_drink` | Comprar bebida (beer, ale, wine, mead, water, special) | Gold |
| `cook_food` | Comprar comida (soup, cheese_bread, roast_meat, stew) | Gold |
| `give_item` | Comprar item (potion, map, dagger, key) | Gold + Trust |
| `sell_item` | Vender item do inventário | Item no inventário |
| `barter` | Trocar itens sem gold | Itens + Friendship |
| `hire_service` | Contratar serviço (cura, reparo, informação) | Gold + Trust |

### 🗣️ Social
| Ação | Descrição | Requer |
|------|-----------|--------|
| `invite_drink` | Convidar NPC pra beber | Friendship ≥ 15 |
| `invite_talk` | Convidar para conversar sobre um tema | Friendship ≥ 10 |
| `invite_adventure` | Convidar para uma aventura | Friendship 30 + Trust 20 |
| `invite_date` | Convidar para um encontro | Friendship 35 + Trust 20 |
| `give_gift` | Dar presente para o NPC | Qualquer item |
| `compliment` | Elogiar o NPC | Nada |
| `insult` | Insultar o NPC | Nada (mas tem consequências) |
| `threaten` | Ameaçar o NPC | Nada (consequências graves) |

### 🔍 Informação
| Ação | Descrição | Requer |
|------|-----------|--------|
| `share_rumor` | Pedir/compartilhar fofoca | Trust + Friendship |
| `share_secret` | Pedir segredo pessoal | Trust 35 + Friendship 30 |
| `ask_about_npc` | Perguntar sobre outro NPC | Friendship ≥ 15 |
| `ask_about_event` | Perguntar sobre evento recente | Trust ≥ 10 |
| `investigate` | Investigar algo específico | Trust ≥ 20 |

### ⚔️ Combate
| Ação | Descrição | Requer |
|------|-----------|--------|
| `start_fight` | Iniciar briga (bandits, monster, guard, arena) | Respect ≥ 10 |
| `duel` | Duelar com NPC específico | Ambos concordam |
| `defend` | Defender NPC de ataque | Estar presente + Bravery |
| `ambush` | Emboscar alguém | Nada (consequências extremas) |
| `surrender` | Se render em combate | Nada |
| `flee` | Fugir do combate | Nada (perde respect) |

### 🏰 Compromisso
| Ação | Descrição | Requer |
|------|-----------|--------|
| `follow_player` | NPC segue o jogador | Trust 25 + Friendship 30 |
| `become_apprentice` | Virar aprendiz de NPC | Respect 40 + Trust 35 |
| `teach_skill` | NPC ensina habilidade | Trust 50 + Friendship 40 |
| `move_in` | Morar junto | Trust 50 + Friendship 55 |
| `marry` | Casar | Friendship 80 + Trust 70 + Respect 50 |
| `adopt` | Adotar (criança NPC como Lina) | Trust 60 + Reputation ≥ 20 |
| `join_war` | Juntar-se a guerra/facção | Respect 40 + Trust 35 |

### 😈 Traição / Crime
| Ação | Descrição | Requer |
|------|-----------|--------|
| `steal_from` | Roubar de NPC | Nada (mas pode ser pego) |
| `betray` | Trair aliado (entregar segredo, sabotar) | Nada (consequências extremas) |
| `frame` | Incriminar NPC por algo | Nada (se descoberto: destruição) |
| `blackmail` | Chantagear com segredo | Saber um segredo |
| `poison` | Envenenar comida/bebida | Ter veneno + não ser visto |
| `murder` | Matar NPC | Nada (consequências permanentes) |

---

## 9. REAÇÕES DO MUNDO AO JOGADOR

O mundo reage organicamente baseado no **reputation score** e nos **deeds** do jogador. Isto é processado pelo engine, NÃO pela LLM.

### Reações por Nível de Reputação

#### 🦸 Hero (reputation ≥ 51)
- NPCs cumprimentam na rua espontaneamente
- Crianças correm em direção ao jogador, não pra longe
- Merchants dão desconto (10–20%)
- Guardas saúdam e ignoram pequenas infrações
- NPCs oferecem presentes, ajuda, informação grátis
- Possível ser convidado para audiência no castelo

#### 😊 Respected (21 a 50)
- NPCs são educados e prestativos
- Preços normais
- Guardas são amigáveis
- Alguns NPCs puxam conversa

#### 😐 Unknown / Decent (-5 a 20)
- Tratamento neutro
- NPCs respondem mas não iniciam conversa
- Preços normais
- Nenhuma reação especial

#### 🤨 Suspicious (-20 a -6)
- NPCs desconfiam, respostas curtas
- Alguns merchants aumentam preços (10%)
- Crianças hesitam perto do jogador
- Guardas ficam de olho
- NPCs param de conversar quando o jogador se aproxima

#### 😠 Troublemaker (-50 a -21)
- NPCs evitam o jogador
- Crianças fogem do jogador na rua
- Merchants cobram 30% mais ou se recusam a vender
- Guardas podem parar e questionar o jogador
- NPCs trancam portas quando o jogador se aproxima
- Possível ser banido de certos locais

#### 💀 Villain (reputation ≤ -51)
- NPCs que veem o jogador na rua podem:
  - Fugir gritando por ajuda
  - Confrontar o jogador (NPCs com bravery alto)
  - Atacar diretamente (guardas, NPCs com aggression alto)
- Crianças correm apavoradas
- Merchants se recusam a vender
- Guardas tentam prender ou matar
- Caçadores de recompensa podem aparecer
- O jogador é atacado on sight em certos locais
- NPCs que antes eram amigos ficam decepcionados e podem confrontar

### Reações por Deed Específico

| Deed | Reação Imediata | Reação a Longo Prazo |
|------|----------------|---------------------|
| **Matar** alguém | Pânico geral, guardas chamados | Cartaz de procurado, NPCs fogem |
| **Roubar** | Vítima grita, pode pegar em flagra | Merchants guardam itens | 
| **Ameaçar** | NPC reage com medo ou raiva (depende de bravery) | Evita o jogador, conta para amigos |
| **Trair** aliado | Aliado fica devastado, rompe relação | Todos próximos ficam sabendo |
| **Ajudar** alguém | NPC fica grato | Amigos do NPC ganham afinidade |
| **Salvar** vida | NPC fica eternamente grato | Vira notícia, reputation boost grande |
| **Doar** gold | NPC agradece | Se NPC fala, outros ouvem |

### Exemplo de Cadeia de Reação: Matar um cachorro

```
Ação: Jogador mata um cachorro de rua
                    │
    ┌───────────────┼────────────────────┐
    ▼               ▼                    ▼
 Deed: killed    Reputation: -15    Testemunhas veem
 (count: 1)                         (NPCs presentes)
    │                                    │
    │                               Fofoca se espalha
    │                               (heat: 6)
    │                                    │
    │                        ┌───────────┴───────────┐
    │                        ▼                       ▼
    │                  Amigos íntimos           Conhecidos
    │                  sabem em 1 tick          sabem em 2 ticks
    │
    ▼
 Próxima conversa com sua esposa (NPC):
 ┌──────────────────────────────────────────────┐
 │ "Ouvi dizer que você matou um cachorro na    │
 │  rua. Que tipo de pessoa faz isso?!"         │
 │  → friendship: -8, trust: -5                 │
 │  → mood: hostile                             │
 └──────────────────────────────────────────────┘
```

---

## 10. SISTEMA DE COMBATE

O combate é resolvido por um mix de engine (mecânica) e LLM (narração).

### Stats de Combate
Derivados dos stats existentes + equipamento:

| Stat | Base | Modificadores |
|------|------|---------------|
| `attack` | 10 | + arma equipada + bravery do aliado NPC |
| `defense` | 10 | + armadura + respect (moral) |
| `initiative` | 10 | + suspicion (alertness) |

### Fluxo de Combate
1. **Início** — jogador ou NPC inicia combate (engine registra)
2. **Rodadas** — cada rodada, jogador escolhe: atacar, defender, habilidade, fugir, renderizar, conversar
3. **Resolução** — engine rola dados + stats → resultado
4. **NPC aliado** — se NPC está seguindo o jogador, luta ao lado
   - Quem ele ataca depende do contexto que o jogador deu ao convidá-lo
   - Se friendship é alto, ele se arrisca mais
   - Se bravery é baixo, pode fugir no meio da luta
5. **Consequências** — vitória/derrota afetam stats, reputation, deeds
6. **É possível CONVERSAR no meio do combate** — jogador pode tentar razão ("espera, não precisa disso!")
   - Engine avalia a tentativa como um "social check" no meio do combate
   - Se o NPC inimigo tem suspicion baixo e o argumento é bom → pode parar a luta

### NPC como Aliado em Combate
Quando um NPC segue o jogador (`follow_player`), ele participa de combates automaticamente:
- **High loyalty/friendship** → fica até o fim, se arrisca
- **Low bravery** → pode fugir se health ficar baixo
- **High betrayalChance** → pode trocar de lado em combate difícil
- O NPC pode ser ferido ou morrer em combate (consequência permanente)

---

## 11. GUERRA E FACÇÕES

O sistema de guerra permite ao jogador se afiliar a facções e participar de conflitos maiores.

### Como funciona
1. **Jogador pede** `join_war` → engine avalia (precisa respect e trust altos)
2. **NPC aliado pode ir junto** → se `follow_player` ativo e friendship alto
3. **O conflito é agendado** — não é instantâneo:
   - Engine marca flag `atWar = true`, `warFaction = "resistance"`
   - Próximos ticks geram eventos de guerra (emboscadas, marchas, batalhas)
4. **Durante a guerra:**
   - NPC aliado luta ao lado
   - Motivação do NPC é baseada no `context` que levou ele a participar
   - NPC pode questionar ações do jogador durante a guerra ("era preciso queimar a vila?")
   - Memórias da guerra ficam registradas no NPC
5. **Após a guerra:**
   - Facção vencedora muda o mundo (novas leis, novos NPCs, preços diferentes)
   - NPCs que participaram ficam com PTSD/traumas (afetam personalidade)
   - Reputação muda drasticamente

### Facções Possíveis
| Facção | Líder | Localização | Objetivo |
|--------|-------|-------------|----------|
| The Crown | Rei / Captain Voss | Castelo | Manter ordem |
| The Resistance | Líder oculto | Porto/Minas | Derrubar o rei |
| Thieves Guild | ? | Porto (subterrâneo) | Lucro e sobrevivência |
| The Wilds | Mira? | Floresta | Proteger a natureza |

---

## 12. ECONOMIA E COMÉRCIO

### Preços Base
```
Drinks: beer(2), ale(2), wine(5), mead(4), water(0), special(10)
Food:   soup(3), cheese_bread(2), roast_meat(8), stew(5)
Items:  potion(15), map(10), dagger(20), key(25)
```

### Modificadores de Preço
| Condição | Modificador |
|----------|-------------|
| Reputation Hero | -10% a -20% |
| Reputation Villain | +30% ou recusa |
| NPC greed alto | +15% |
| NPC friendship alto | -10% |
| Compra em bulk | -5% por item extra |
| Item raro / escasso | +50% |
| Período night | +20% (perigo) |

### Renda dos NPCs
- **Elara** ganha gold ao vender drinks/food (quando NPCs ou jogador compram)
- **Rodrik** ganha gold furtando ou vendendo itens roubados
- **Mira** ganha gold vendendo poções e curas
- **NPCs gastam** gold em comida, moradia, necessidades

### Comércio entre NPCs (sem jogador)
NPCs transacionam entre si automaticamente:
- Elara compra ingredientes no mercado de manhã
- Rodrik bebe na taverna à noite (paga Elara)
- Mira compra ervas ou as coleta na floresta
- Dinheiro circula pela economia

---

## 13. RELACIONAMENTOS PROFUNDOS

### Tier de Relacionamento (por NPC)
| Friendship | Tier | Desbloqueia |
|------------|------|-------------|
| 0–10 | Stranger | Comprar/vender |
| 11–25 | Acquaintance | Conversar casual |
| 26–50 | Regular | Convidar drink/talk, pedir rumor |
| 51–75 | Friend | Convidar aventura, seguir, pedir segredos |
| 76–90 | Trusted Ally | Morar junto, ensinar skill, join war |
| 91–100 | Soulmate | Casar, adotar, lealdade absoluta |

### Romance
1. Começa com **invite_date** (req: friendship 35+)
2. Se date vai bem (ALLOWED) → flag `dating = true`
3. Vários dates bem-sucedidos → pode propor `move_in`
4. Morar junto + friendship 80+ → pode propor `marry`
5. Casado → NPC defende o jogador, está sempre ao lado, compartilha gold

### Traição
A traição pode acontecer em AMBAS as direções:

**Jogador trai NPC:**
- Namorar/casar com um NPC e flertar com outro
- NPC traído pode: confrontar, chorar, terminar, atacar, ou silenciosamente preparar vingança
- Se o NPC tem `loyalty alto` → dá segunda chance (com custo de trust enorme)
- Se tem `aggression alto` → ataca
- Se tem `betrayalChance alto` → trai de volta (vende segredos do jogador)

**NPC trai jogador:**
- NPCs com `betrayalChance` alto podem trair em situações críticas
- Rodrik (40% chance) pode roubar o jogador se friendship cair
- Condições: momento de pressão + betrayalChance roll
- O jogador pode **perdoar** (deed: forgave) → NPC pode se redimir

### Casamento em detalhe
- Cerimônia (Father Aldric) → vira notícia (heat 10)
- NPC cônjuge mora com jogador
- Ações do jogador afetam cônjuge diretamente:
  - Matar alguém → cônjuge questiona, pode pedir divórcio
  - Ser preso → cônjuge tenta resgatar (ou abandona se low loyalty)
  - Ficar ferido → cônjuge cuida
  - Dar presentes → cônjuge fica feliz

---

## 14. CONSEQUÊNCIAS E CADEIA DE REAÇÕES

Toda ação importante gera uma **cadeia de consequência** que se propaga pelo mundo.

### Anatomia de uma Consequência

```javascript
{
  trigger: "player_threatened_npc",       // o que aconteceu
  target: "elara",                         // quem foi afetado diretamente
  immediateEffects: {
    deed: "threatened",                    // registra no histórico
    reputation: -10,                       // reputação global
    targetRelation: { trust: -15, respect: -5, friendship: -10 },
    mood: "hostile",                       // NPC fica hostil
  },
  gossip: {
    heat: 7,                               // fofoca quente
    text: "Player threatened Elara at the tavern",
    fidelity: 1.0,
  },
  delayedEffects: [                        // acontecem nos próximos ticks
    {
      tick: 1,
      who: "voss",                         // Captain Voss (guarda)
      condition: "voss hears gossip",
      effect: "Voss starts looking for the player",
    },
    {
      tick: 2,
      who: "all_children",
      condition: "gossip reaches heat 7+",
      effect: "Children flee when they see the player",
    },
    {
      tick: 3,
      who: "mira",
      condition: "mira is friend of elara",
      effect: "Mira refuses to heal the player until they apologize",
    },
  ],
  contextInjection: {
    // Na próxima conversa com qualquer NPC que saiba:
    // O prompt vai incluir esta fofoca no contexto
    // O NPC pode trazer à tona naturalmente
    promptNote: "You heard that the player threatened Elara. React accordingly."
  }
}
```

### Consequências por Tipo de Ação

| Ação | Consequência Imediata | Consequência Via Fofoca | Consequência a Longo Prazo |
|------|----------------------|------------------------|---------------------------|
| **Ameaçar** | Trust -15, Respect -5 | NPCs próximos passam a evitar | Pode ser confrontado, banido |
| **Roubar** | Se pego: fight/arrest. Se não: guilt? | Merchant avisa outros | Preços sobem, itens escondem |
| **Matar** | Shock, testemunhas chamam guardas | Toda cidade sabe rápido | Caçadores de recompensa, banimento |
| **Ajudar** | Friendship +, Gratidão | Amigos do NPC ganham simpatia | Desconto, presentes, aliados |
| **Casar** | Notícia enorme (heat 10) | Todos celebram (ou invejam) | Cônjuge como aliado permanente |
| **Trair cônjuge** | Cônjuge devastado | Cidade toda julga | Filhos (se houver) podem odiar |
| **Salvar alguém** | Hero moment | Vira lenda local | Respect boost permanente |

### O Efeito "Parente Decepcionado"

Relações próximas (cônjuge, mestre, aprendiz, amigo íntimo) reagem de forma especial:

```
Jogador mata um cachorro na rua
         │
    ┌────┴──── Cônjuge (affinity 90+) ────────────────┐
    │  Próxima conversa:                                │
    │  "Eu ouvi o que você fez. Como pôde?"            │
    │  → friendship: -8                                 │
    │  → Se repete: "Estou pensando se te conheço..."  │
    │  → Se repete MUITO: "Quero o divórcio."          │
    └──────────────────────────────────────────────────┘
    
    ┌────┴──── Mestre (se apprentice) ────────────────┐
    │  "Um aprendiz meu fazendo isso? Vergonha."      │
    │  → respect: -10                                   │
    │  → Pode expulsar da aprendizagem                 │
    └──────────────────────────────────────────────────┘
    
    ┌────┴──── Criança adotada (Lina) ───────────────┐
    │  "Por que você é assim? Pensei que era bom..."  │
    │  → trust: -20                                    │
    │  → Pode fugir de casa                            │
    └──────────────────────────────────────────────────┘
```

---

## 15. EVENTOS ALEATÓRIOS E EMERGENTES

Eventos que acontecem sem o jogador fazer nada — o mundo vive.

### Eventos por Período do Dia

| Período | Eventos Possíveis |
|---------|-------------------|
| **Dawn** | Merchants abrem barracas, patrulha de guarda, Mira coleta ervas |
| **Morning** | Comércio ativo, crianças brincam, rumores na taverna |
| **Afternoon** | Trabalho pesado, minas ativas, treinamento de guardas |
| **Evening** | Taverna lota, bardo toca, fofocas fluem, roubos aumentam |
| **Night** | Perigos: roubos, emboscadas, contrabando no porto |

### Evento: Roubo (Theft)

```javascript
{
  id: "random_theft",
  conditions: {
    // Rodrik (ou outro ladrão) precisa estar:
    hunger: "< 20",           // faminto
    gold: "< 10",             // sem dinheiro
    greed: "> 50",            // ganancioso o suficiente
    bravery: "> 30",          // corajoso o suficiente
    // Jogador precisa:
    playerGold: "> 15",       // ter algo pra roubar
  },
  scenarios: [
    {
      // Cenário 1: Roubo furtivo (jogador não está em casa)
      trigger: "player.location !== 'home'",
      description: "O ladrão entra na casa do jogador quando ele não está",
      resolution: "engine_auto",
      stealAmount: { min: 10, max: 30 },
      detectionChance: 0.3,   // 30% chance de alguém ver
    },
    {
      // Cenário 2: Render (jogador está em casa)
      trigger: "player.location === 'home' AND thief.bravery > 60",
      description: "O ladrão invade com o jogador presente",
      resolution: "player_choice",
      options: [
        "fight",    // Iniciar combate
        "talk",     // Tentar conversar / razão
        "comply",   // Entregar o dinheiro
        "flee",     // Fugir
      ]
    },
    {
      // Cenário 3: Pickpocket na rua
      trigger: "player in market/port AND thief in same location",
      description: "O ladrão tenta furtar discretamente",
      resolution: "engine_roll",
      // Se falha: jogador percebe, pode confrontar
      // Se sucesso: jogador perde gold sem saber imediatamente
      detectionCheck: "player.suspicion vs thief.stealth",
    }
  ]
}
```

### Evento: Confronto na Rua

Quando reputation é muito baixa, NPCs com bravery alto podem confrontar:

```javascript
{
  id: "street_confrontation",
  trigger: "reputation < -30 AND npc.bravery > 50 AND npc in same location",
  description: "NPC bloqueia o caminho do jogador",
  flow: [
    "NPC se aproxima com hostilidade",
    "Jogador pode:",
    "  1. Conversar — tentar resolver pacificamente (social check)",
    "  2. Intimidar — ameaçar de volta (pode escalar pra fight)",
    "  3. Lutar — iniciar combate direto",
    "  4. Fugir — correr (perde respect, NPC pode perseguir)", 
    "  5. Ignorar — tentar passar (NPC pode bloquear ou atacar)",
  ]
}
```

### Evento: Criança Foge

```javascript
{
  id: "child_flee",
  trigger: "reputation < -20 AND child_npc in same location",
  description: "Criança corre assustada ao ver o jogador",
  effect: {
    visual: "Criança grita e corre na direção oposta",
    reputation: -2,    // reforça a má fama
    gossip: { heat: 3, text: "A criança fugiu do jogador apavorada" },
  }
}
```

### Evento: NPC Autônomo (exemplo detalhado)

```javascript
// Rodrik furtando ingredientes da Elara
{
  id: "rodrik_steals_elara",
  conditions: {
    rodrik: { hunger: "< 30", gold: "< 5", location: "tavern" },
    elara:  { activity: "not_looking", suspicion: "< 60" },
  },
  outcome_success: {
    rodrik: { hunger: +30, gold: 0 },  // comeu
    elara:  { gold: -5 },               // perdeu ingrediente
    gossip: null,                        // ninguém viu
  },
  outcome_caught: {
    elara: { relation_rodrik: { affinity: -20 } },
    gossip: { heat: 4, text: "Rodrik was caught stealing food from the tavern" },
    consequence: "Elara bans Rodrik from tavern for 3 days",
  }
}
```

---

## 16. ENGINE — O QUE NÃO DEPENDE DE LLM

Tudo isso roda no JavaScript puro, sem chamar o modelo:

| Sistema | Descrição |
|---------|-----------|
| **Stat Evaluation** | Avaliar se uma ação é ALLOWED/DENIED/CONDITIONAL |
| **Effect Application** | Aplicar mudanças de stats, gold, flags |
| **Time Advancement** | Avançar períodos, dias, triggering rotinas |
| **NPC Scheduling** | Mover NPCs entre locais conforme rotina |
| **Need Simulation** | Fome, energia, social decay + comportamentos compensatórios |
| **Gossip Propagation** | Espalhar fofocas pela rede de afinidade |
| **Reputation Tracking** | Calcular deeds, reputação, labels |
| **Passive Mood Effects** | Stats mudando conforme tom da conversa |
| **Random Events** | Rolar dados, checar condições, triggering eventos |
| **Combat Resolution** | Cálculos de ataque, defesa, dano, initiative |
| **Economy Simulation** | NPCs comprando/vendendo entre si |
| **World Reactions** | Crianças fugindo, guardas patrulhando, preços mudando |
| **Price Modifiers** | Aplicar multiplicadores baseado em reputation/friendship |
| **NPC-NPC Interactions** | NPCs se encontram, trocam info, afinidades evoluem |
| **Death/Injury System** | Checar health, aplicar ferimentos, sequelas |

---

## 17. LLM — O QUE SIM DEPENDE DE PROMPT

O LLM é usado SOMENTE para gerar diálogo natural e interpretar input do jogador:

| Uso do LLM | Descrição |
|-------------|-----------|
| **Diálogo com NPC** | Conversa natural, personalizada, em character |
| **Interpretar intent** | Entender se "dá um soco nele" é `start_fight` |
| **Reagir a engine** | NPC responde à decisão ALLOWED/DENIED |
| **Mencionar fofocas** | Engine injeta no prompt; LLM fala naturalmente |
| **Expressar emoção** | Mood tags (friendly, hostile, flirty, neutral) |
| **Questionar jogador** | NPC pergunta sobre ação que ouviu ("ouvi que você...") |
| **Narração de eventos** | Descrever textualmente o que aconteceu (opcional) |

### O que o LLM NÃO faz
- ❌ Decidir se uma ação é permitida (engine faz)
- ❌ Mudar stats diretamente (engine faz)
- ❌ Propagar fofocas (scheduler/engine faz)
- ❌ Mover NPCs (scheduler faz)
- ❌ Resolver combate (engine faz)
- ❌ Registrar deeds (engine faz, com triggers automáticos)

---

## 18. MAPA DE LOCAIS

```
                    ┌──────────────┐
                    │   CASTLE     │
                    │  (Voss,      │
                    │   Aldric)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
        │  MARKET   │ │ TAVERN │ │   PORT    │
        │ (Rodrik,  │ │(Elara, │ │(Sailors, │
        │  Lina)    │ │Thessa) │ │ smugglers)│
        └─────┬─────┘ └────────┘ └─────┬─────┘
              │                        │
              └──────────┬─────────────┘
                         │
              ┌──────────┼──────────┐
              │                     │
        ┌─────▼─────┐        ┌─────▼─────┐
        │  FOREST   │        │   MINES   │
        │  (Mira)   │        │ (Barret)  │
        └───────────┘        └───────────┘
```

Cada local tem:
- NPCs fixos (moram/trabalham ali)
- NPCs visitantes (seguem rotina)
- Eventos possíveis
- Nível de perigo (forest/mines > tavern/market)
- Horários de funcionamento

---

## 19. FLUXO TÉCNICO (TWO-PASS)

```
Jogador digita mensagem
        │
        ▼
┌─────────────────────────────┐
│ chat.js — prepara contexto  │
│ buildSystemPrompt(engine)   │
│ → identity + traits +       │
│   format + rules + actions  │
│   + state + world + history │
│   + examples                │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────────┐
│ PASS 1 — LLM responde      │
│ Ou: <block type="text">    │
│ Ou: <block type="request"> │
└───────────┬─────────────────┘
            │
     ┌──────┴──────┐
     │             │
  TEXT          REQUEST
     │             │
     ▼             ▼
┌─────────┐  ┌─────────────────────┐
│ Mostra  │  │ engine.evaluate()   │
│ Aplica  │  │ → ALLOWED / DENIED  │
│ Passive │  │ engine.applyEffects │
│ Effects │  │ → stats mudam       │
└─────────┘  └─────────┬───────────┘
                       │
                       ▼
              ┌──────────────────────┐
              │ Injeta [ENGINE] msg  │
              │ no histórico         │
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │ PASS 2 — LLM reage  │
              │ ao resultado do      │
              │ engine (em character)│
              └─────────┬────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │ Mostra diálogo       │
              │ Atualiza UI          │
              │ Registra memória     │
              └──────────────────────┘
```

---

## 20. ROADMAP E PRIORIDADES

### Fase 1 — Core Loop ✅ (Atual)
- [x] Chat com LLM via LM Studio
- [x] XML response format (text + request)
- [x] Two-pass flow (request → engine → reaction)
- [x] Stat system (friendship, trust, respect, gold, health)
- [x] Action definitions + evaluation + effects
- [x] Relationship tiers
- [x] Passive mood effects + milestones
- [x] Composable prompt system (6 sections + dynamic state)
- [x] Target validation (menu items)
- [x] NPC class with templates, traits, memory
- [x] World state (locations, time, reputation, deeds)
- [x] NPC gold system (NPCs têm dinheiro próprio)
- [x] paidBy system (NPC ou player paga)

### Fase 2 — Rede Social e Fofocas
- [ ] `npcRelations` com affinidade entre NPCs
- [ ] Gossip system: criação, propagação, degradação
- [ ] Gossip injection into prompts (NPC menciona o que ouviu)
- [ ] Fofoca muda afinidade dos NPCs que ouvem
- [ ] Bardo/Thessa como amplificador de notícias
- [ ] Heat tiers (normal → interessante → quente → explosiva)

### Fase 3 — Rotinas e Vida Autônoma
- [ ] Schedule system (NPCs seguem rotinas)
- [ ] Need system (hunger, energy, social)
- [ ] NPC movement entre locais por período
- [ ] NPCs compram/vendem entre si
- [ ] Ticker/scheduler que roda a cada período
- [ ] Economia circulante (gold gira entre NPCs)

### Fase 4 — Reações do Mundo
- [ ] Reputation tiers com efeitos visuais/mecânicos
- [ ] Crianças fogem, NPCs confrontam, guardas prendem
- [ ] Price modifiers baseados em reputation
- [ ] Location access restrictions (banimento)
- [ ] Deed-triggered reaction chains
- [ ] "Parente decepcionado" system

### Fase 5 — Combate e Guerra
- [ ] Combat resolution system (engine-based)
- [ ] NPC aliado em combate
- [ ] Duel system
- [ ] Surrender/flee mechanics
- [ ] War/faction system
- [ ] War events over multiple ticks
- [ ] Talk-during-combat (interrupt combat com diálogo)

### Fase 6 — Eventos Aleatórios
- [ ] Random event roller por tick
- [ ] Theft events (pickpocket, break-in, holdup)
- [ ] Street confrontation events
- [ ] NPC-NPC conflicts
- [ ] Natural events (storms, festivals, plagues)
- [ ] Bounty hunter system

### Fase 7 — Relacionamentos Profundos
- [ ] Dating system
- [ ] Marriage + ceremony
- [ ] Adoption (Lina)
- [ ] Betrayal detection + reactions
- [ ] Divorce/breakup mechanics
- [ ] Apprenticeship skill teaching
- [ ] Legacy system (NPC remembers EVERYTHING)

### Fase 8 — Polish e Expansão
- [ ] Mais NPCs (8+ com backstories completas)
- [ ] Mais locais (farm, dungeon, ruins)
- [ ] Crafting system
- [ ] Skill tree para jogador
- [ ] Save/load system
- [ ] Visual map UI
- [ ] Pixel art / sprites (opcional)
- [ ] Sound effects (opcional)

---

## APÊNDICE: NPCs — FICHA COMPLETA

### Elara — Tavern Owner
```
Idade: 28 | Local: Taverna | Gold: 200
Traits: loyalty:70, aggression:30, greed:20, honesty:75,
        romanticism:40, bravery:60, suspicion:45, betrayalChance:5
Backstory: Herdou a taverna do pai (aventureiro aposentado que perdeu a mão
           para um dragão). Mãe desapareceu — suspeita do guild de ladrões.
           Guarda uma adaga sob o bar.
Relações: Mira (close_friend:80), Voss (neutral:40), Rodrik (suspicious:15)
Romance: Possível. Precisa friendship 60+ e trust 50+.
Segredos: Sabe onde está o mapa do dungeon do pai. Sabe que Rodrik é ladrão.
```

### Rodrik — Thief / Fake Merchant
```
Idade: 34 | Local: Mercado | Gold: 30
Traits: loyalty:15, aggression:45, greed:85, honesty:10,
        romanticism:20, bravery:50, suspicion:70, betrayalChance:40
Backstory: Se finge de mercador de especiarias. Rouba por necessidade —
           esposa doente e dois filhos. Não é violento por natureza.
Relações: Elara (neutral:30, ela desconfia), Voss (enemy:5, se pego=morto),
          Lina (protective:60, ensina a roubar)
Romance: Não (casado). Mas pode ser subornado/chantageado.
Segredos: Trabalha pro thieves guild. Sabe entradas secretas no porto.
```

### Captain Voss — Guard Captain
```
Idade: 45 | Local: Castelo | Gold: 150
Traits: loyalty:80, aggression:60, greed:10, honesty:85,
        romanticism:10, bravery:90, suspicion:55, betrayalChance:2
Backstory: Serviu na guerra do norte. Cicatriz no rosto. Acredita em lei e
           ordem acima de tudo. Odeia criminosos mas é justo.
Relações: Elara (respectful:50), Rodrik (hate:5), Aldric (ally:70)
Romance: Muito difícil. Romanticism=10. Só com friendship 90+.
Segredos: Sabe de corrupção no castelo. Dividido entre lealdade e justiça.
```

### Mira — Healer / Herbalist
```
Idade: 32 | Local: Floresta | Gold: 80
Traits: loyalty:60, aggression:10, greed:5, honesty:90,
        romanticism:55, bravery:35, suspicion:20, betrayalChance:1
Backstory: Vive isolada na floresta. Conhecimento de ervas e magia menor.
           Amiga de infância da Elara. Desconfia da civilização.
Relações: Elara (best_friend:85), Barret (patient:50), Voss (wary:30)
Romance: Possível se jogador respeita a natureza. Romanticism:55.
Segredos: Sabe de ruínas antigas na floresta profunda. Ouve a floresta.
```

### Old Barret — Retired Miner
```
Idade: 62 | Local: Minas | Gold: 40
Traits: loyalty:50, aggression:20, greed:30, honesty:60,
        romanticism:5, bravery:40, suspicion:65, betrayalChance:10
Backstory: Minerou por 40 anos. Conhece cada túnel. Bebe demais.
           Perdeu amigos nas minas — algo vive lá embaixo.
Relações: Elara (regular_client:45), Voss (grudge:25, o obrigou a parar)
Romance: Não. Muito velho e rabugento.
Segredos: Sabe a localização de veios de ouro nas minas. Viu criaturas.
```

### Lina — Orphan / Pickpocket
```
Idade: 12 | Local: Ruas/Mercado | Gold: 3
Traits: loyalty:40, aggression:15, greed:30, honesty:35,
        romanticism:0, bravery:55, suspicion:80, betrayalChance:15
Backstory: Órfã de rua. Esperta, rápida, sobrevive furtando.
           Rodrik a ensina truques. Sonha com uma família.
Relações: Rodrik (mentor:60), Elara (kind_stranger:40), Voss (fear:10)
Romance: NÃO. É criança. Pode ser adotada.
Segredos: Conhece passagens secretas pela cidade. Viu coisas à noite.
```

### Father Aldric — Priest
```
Idade: 55 | Local: Castelo/Praça | Gold: 100
Traits: loyalty:65, aggression:5, greed:15, honesty:80,
        romanticism:0, bravery:25, suspicion:40, betrayalChance:5
Backstory: Padre da cidade. Moralista, julga ações. Faz sermões que
           espalham informação (amplificador de fofoca). Pode absolver.
Relações: Voss (ally:70), Elara (respectful:55), Mira (suspicious:25)
Romance: Não. É padre.
Segredos: Ouve confissões — sabe de TUDO mas em teoria não conta.
```

### Thessa — Bard
```
Idade: 25 | Local: Taverna/Mercado/Porto | Gold: 50
Traits: loyalty:30, aggression:10, greed:40, honesty:50,
        romanticism:70, bravery:45, suspicion:35, betrayalChance:20
Backstory: Viajante, canta em tavernas, coleta e espalha histórias.
           É a "mídia" do jogo — transforma eventos em canções.
Relações: Elara (employer:60), Rodrik (curious:40), all (knows_everyone:50)
Romance: Possível. Flertadora, mas difícil de fixar (viajante).
Segredos: Já foi espiã. Tem contatos em outras cidades.
```

---

> **"O mundo de The Broken Lamp existe com ou sem você. A diferença é o que você escolhe fazer enquanto está nele."**
