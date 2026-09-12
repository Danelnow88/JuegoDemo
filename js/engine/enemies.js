// ===== ENGINE: enemigos =====
// spawnEnemy/spawnElite empujan a `enemies` (por ref); killEnemy y updateEnemies devuelven
// los valores `let` que en game.js deben reasignarse (score, shake) y flags (gameOver).
// El resto de estado se muta por referencia (player, arrays) o via callbacks/closures.
(() => {
  'use strict';
  const NV = window.NV;

  function getDiffMult(kind) { return (typeof NV.difficultySafeMult === "function") ? NV.difficultySafeMult(kind, NV.runDifficulty) : 1; }

  function canSpawn(st, count, heavyCount) {
    if (NV.canSpawnHostileBatch) return NV.canSpawnHostileBatch(st, count, heavyCount);
    if (st.ignoreHostileBudget === true) return true;
    let heavy = 0;
    for (const e of st.enemies) if (!e.dead && (e.isElite || e.hostileClass === 'heavy')) heavy++;
    return st.enemies.filter((e) => !e.dead).length + count <= (st.MAX_HOSTILES || st.MAX_ENEMIES || 30)
      && heavy + (heavyCount || 0) <= (st.MAX_HEAVY_HOSTILES || 7);
  }
  function hostileClass(entity) {
    if (NV.hostileClassOf) return NV.hostileClassOf(entity);
    return entity && entity.isElite ? 'heavy' : ((entity && entity.hostileClass) || 'light');
  }

  function reportSpawnCandidate(st, candidate) {
    if (typeof st.onSpawnCandidate !== 'function') return;
    try { st.onSpawnCandidate(Object.freeze(candidate)); } catch (_) { /* hook futuro no altera spawn actual */ }
  }
  NV.describeEnemySpawnCandidate = function (type, x, y, isElite) {
    return { typeId: type && (type.id || type.visualId) || null, x, y, isElite: !!isElite };
  };

  // ---- F07 SPITTER: constantes de banda/telegraph/disparo ----
  // Banda espacial: lejos -> approach, en banda -> strafe, cerca -> retreat.
  // WINDUP real con snapshot + lead parcial topado; ATTACK = 1 disparo sin
  // homing; RECOVERY = ventana de castigo sin refire.

  // ---- Selección ponderada: tipos con 'weight' usan ese valor; el resto defaulta a 1.0 ----
  // Si ningún tipo disponible define weight, la selección es equivalente a uniforme.
  NV.weightedRandom = function (items) {
    if (!items || !items.length) return null;
    let total = 0;
    const weights = [];
    for (let i = 0; i < items.length; i++) {
      const w = typeof items[i].weight === 'number' ? items[i].weight : 1.0;
      weights.push(w);
      total += w;
    }
    if (total <= 0) return items[0];
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  // ---- Spawn normal ----
  NV.spawnEnemy = function (st) {
    if (!canSpawn(st, 1, 0)) return false;
    if (st.boss && !st.boss.dead) return;

    const spectersEnabled = NV.SPECTER_ENABLED !== false;
    const enabledTypes = spectersEnabled
      ? st.ENEMY_TYPES
      : st.ENEMY_TYPES.filter((t) => t.shape !== 'specter');

    let type;
    const forcedType = st.forceTypeId && enabledTypes.find((t) => t.id === st.forceTypeId);
    if (forcedType) {
      // Force spawn: buscar el tipo específico (ignora minWave para testing/debug).
      type = forcedType;
    } else {
      // Pool por oleada: cada tipo tiene su minWave. Los umbrales reproducen el
      // desbloqueo escalonado original (slice por índice); kamikaze entra desde la 10.
      const available = enabledTypes.filter((t) => (t.minWave || 1) <= st.wave);
      type = NV.weightedRandom(available);
    }
    if (!type) return;
    const hostileClass = type.hostileClass || 'light';
    if (!canSpawn(st, 1, hostileClass === 'heavy' ? 1 : 0)) return false;

    const side = Math.random() < 0.5 ? 0 : st.W;
    const y = 80 + Math.random() * (st.H - 200);
    const hpScale = NV.enemyHpScale(st.wave); // B1: curva única en balance.js
    const dmgScale = Math.min(60, Math.round(st.wave * 1.5)); // el daño enemigo también escala
    // Down-scale líquido (Visual Lab): si el tipo tiene modelo asignado, el
    // radio de hitbox se adapta al factor del modelo (labModelHitboxFactor =
    // factorVisual / 0.8 previo) para que la detección coincida con la silueta
    // dibujada a su nuevo tamaño. Sin renderer cargado (sandboxes): radio datos.
    let hitboxRadius = type.radius;
    if (type.id && NV.LAB_SPECTER_IDS && NV.labModelHitboxFactor) {
      const mi = NV.LAB_SPECTER_IDS[type.id];
      if (mi !== undefined) hitboxRadius = type.radius * NV.labModelHitboxFactor(mi);
    }
    reportSpawnCandidate(st, NV.describeEnemySpawnCandidate(type, side, y, false));
    st.enemies.push({
      x: side, y: y,
      hp: Math.round(type.hp * hpScale * 0.85 * getDiffMult("hp")), maxHp: Math.round(type.hp * hpScale * 0.85 * getDiffMult("hp")),
      speed: type.speed + Math.min(40, st.wave * 1.5),
      radius: hitboxRadius, color: type.color, shape: type.shape,
      enemyTypeId: type.id,
      hostileClass,
      movementClass: type.movementClass || (NV.enemyMovementClass ? NV.enemyMovementClass(type) : ((type.behavior === 'kami' || type.speed >= 150) ? 'fast' : (type.speed <= 70 ? 'slow' : 'normal'))),
      score: type.score * (1 + st.wave * 0.1), xp: type.xp * (1 + st.wave * 0.1),
      dead: false, behavior: type.behavior,
      angle: Math.random() * Math.PI * 2, erraticTimer: 0,
      knockbackRes: type.knockbackRes || 0, knockVelX: 0, knockVelY: 0,
      damage: ((type.damage || 10) + dmgScale) * 0.80 * getDiffMult("dmg"), shield: type.shield || false, shieldCd: 0, resist: type.resist || 0,
      hitFlash: 0, hitSlowUntil: 0, hitSlowImmunity: 0,
      erraticTargetAngle: Math.random() * Math.PI * 2,
      shootTimer: 0, stunChance: type.stunChance || 0,
    });
    // Traza de spawn para los espectros (nuevos y legacy WebGL) en consola.
    if (type.id && type.id.indexOf('specter_') === 0) {
      console.log('[SPAWN] wave=' + st.wave + ' type=' + type.id);
    }
    return true;
  };

  // ---- Spawn élite (cada 2 oleadas, desde la 3) ----
  NV.spawnElite = function (st) {
    if (st.wave < 3) return;
    if (st.wave % 2 === 0) return;
    if (st.boss && !st.boss.dead) return; // no élites durante un jefe
    // Élites base = ciclo original intacto. Espectrales = minWave + weight.
    const baseElites = st.ELITE_TYPES.filter((t) => !t.spectralElite);
    const spectralElites = st.ELITE_TYPES.filter((t) => t.spectralElite && (t.minWave || 1) <= st.wave);
    // Evento LLUVIA DE ÉLITES: 1 élite extra (3 en vez de 2) en cada spawn.
    const count = st.waveEvent === 'elites' ? 3 : 2;
    const startIndex = baseElites.length ? ((st.wave / 2 - 1) * 2) % baseElites.length : 0;
    for (let i = 0; i < count; i++) {
      if (!canSpawn(st, 1, 1)) break;
      let elite = baseElites.length ? baseElites[(startIndex + i) % baseElites.length] : null;
      // Chance rara de reemplazar por un élite espectral disponible (suma de weights).
      if (spectralElites.length) {
        const spectralWeight = spectralElites.reduce((s, se) => s + (typeof se.weight === 'number' ? se.weight : 0), 0);
        if (spectralWeight > 0 && Math.random() < Math.min(0.5, spectralWeight)) {
          elite = NV.weightedRandom(spectralElites) || elite;
        }
      }
      if (!elite) {
        // Sin élites base disponibles: cae al espectral disponible o se salta.
        elite = NV.weightedRandom(spectralElites);
        if (!elite) continue;
      }
      const side = Math.random() < 0.5 ? 0 : st.W;
      const y = 80 + Math.random() * (st.H - 200);
      const eliteDmg = elite.damage + Math.min(80, Math.round(st.wave * 2));
      // Down-scale líquido: la élite adapta su hitbox al factor del modelo que
      // la dibuja (id para las espectrales, visualId para las base). El ratio
      // uniforme del modelo 5 preserva la jerarquía relativa entre élites.
      let hitboxRadius = elite.radius;
      const eliteKey = elite.id || elite.visualId;
      if (eliteKey && NV.LAB_SPECTER_IDS && NV.labModelHitboxFactor) {
        const mi = NV.LAB_SPECTER_IDS[eliteKey];
        if (mi !== undefined) hitboxRadius = elite.radius * NV.labModelHitboxFactor(mi);
      }
      const pushed = {
        x: side, y: y,
        hp: Math.round((elite.hp + st.wave * st.wave * 1.5) * 0.85 * getDiffMult("hp")), maxHp: Math.round((elite.hp + st.wave * st.wave * 1.5) * 0.85 * getDiffMult("hp")),
        speed: elite.speed + st.wave,
        radius: hitboxRadius, color: elite.color, shape: elite.shape,
        score: elite.score, xp: elite.xp, dead: false,
        behavior: elite.behavior, angle: Math.random() * Math.PI * 2,
        hostileClass: 'heavy',
        movementClass: elite.movementClass || (NV.enemyMovementClass ? NV.enemyMovementClass(elite) : ((elite.behavior === 'kami' || elite.speed >= 150) ? 'fast' : (elite.speed <= 70 ? 'slow' : 'normal'))),
        erraticTimer: 0, isElite: true, eliteDamage: eliteDmg * 0.80 * getDiffMult("dmg"), hitFlash: 0, hitSlowUntil: 0, hitSlowImmunity: 0, erraticTargetAngle: Math.random() * Math.PI * 2,
        knockbackRes: 0.3, knockVelX: 0, knockVelY: 0, shootTimer: 0,
        stunChance: elite.stunChance || 0, resist: elite.resist || 0,
      };
      // Metadatos para render espectral (solo cuando el tipo define id).
      if (elite.id) pushed.enemyTypeId = elite.id;
      if (elite.visualId) pushed.visualId = elite.visualId;
      reportSpawnCandidate(st, NV.describeEnemySpawnCandidate(elite, side, y, true));
      st.enemies.push(pushed);
      // Traza de spawn para élites espectrales.
      if (elite.spectralElite && elite.id && elite.id.indexOf('specter_') === 0) {
        console.log('[SPAWN] wave=' + st.wave + ' type=' + elite.id);
      }
    }
  };

  // ---- Derribo (muta player/weaponLevels/weaponKills por ref; devuelve nuevo score) ----
  // Estilo del número de daño. Delegado en balance.js (NV.damageFloatStyle)
  // cuando está cargado; fallback mínimo para sandboxes aislados.
  function hitFloatStyle(dealt, crit) {
    if (NV.damageFloatStyle) return NV.damageFloatStyle(dealt, crit);
    return { color: crit ? '#FF2A4B' : '#FFFFFF', size: crit ? 17 : 13 };
  }
  NV.killEnemy = function (st) {
    const e = st.e;
    if (e.killResolved) return st.score;
    e.killResolved = true;
    e.dead = true;
    let score = st.score + e.score;
    st.player.xp += e.xp;
    st.addFloatText(e.x, e.y, '+' + Math.round(e.score), e.isElite ? '#ff0' : '#ffcf76');
    while (st.player.xp >= st.player.xpToNext) {
      st.player.xp -= st.player.xpToNext;
      st.player.level++;
      st.player.xpToNext = Math.floor(st.player.xpToNext * 1.5);
      st.player.maxHp += 10;
      st.player.hp = Math.min(st.player.hp + 20, st.player.maxHp);
      st.addFloatText(st.player.x, st.player.y - 50, 'LEVEL UP!', '#ff0');
      (st.sfx.playerLevelUp || st.sfx.levelup)();
      st.triggerFlash('#ff0');
    }
    // El arma equipada gana XP por derribos y sube de nivel.
    const wid = st.currentWeapon.id;
    const curLevel = st.weaponLevels[wid] || 1;
    st.weaponKills[wid] = (st.weaponKills[wid] || 0) + st.weaponKillProgress();
    // Tope duro de nivel de arma (WEAPON_MAX_LEVEL): Nv100 = pico de poder.
    // Sin texto flotante de subida: el nivel se lee en el HUD (badge del slot).
    if (curLevel < (NV.BALANCE.WEAPON_MAX_LEVEL || 100) && st.weaponKills[wid] >= st.WEAPON_KILLS_PER_LEVEL * curLevel) {
      st.weaponLevels[wid] = curLevel + 1;
      (st.sfx.fuse || st.sfx.levelup)(curLevel + 1);
    }
    st.spawnExplosion(e.x, e.y, 8, e.color, 0.3);
    if (e.isElite) {
      // El élite garantiza shards de mayor valor: matarlo es una decisión económica.
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', value: 3, dead: false });
    } else if (Math.random() < 0.15 + st.player.luck * 0.01 + (st.player.permGreed || 0) * NV.BALANCE.GREED_PERM_DROP) {
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', dead: false });
    }
    // Consumible RECOMPENSA: +1 shard y score doble por derribo durante su duración.
    if (st.player.bounty > 0) {
      score += e.score; // doble (ya sumamos el base arriba)
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', value: 1, dead: false });
      st.addFloatText(e.x, e.y - 20, '+1 SHD BONUS', '#ffd700');
    }
    // Evento DÍA DE PAGO: cada derribo suelta además un shard extra de valor 2.
    if (st.waveEvent === 'payday') {
      st.pickups.push({ x: e.x + 6, y: e.y + 6, type: 'shard', value: 2, dead: false });
    }
    // KAMIKAZE: siempre detona al morir (por disparo o por autodetonacion).
    if (e.behavior === 'kami') {
      st.spawnExplosion(e.x, e.y, 34, '#ff5f3d', 1.1);
      if (!e.kamikazeDamageApplied && st.applyPlayerDamage && Math.hypot(e.x - st.player.x, e.y - st.player.y) < 95) {
        e.kamikazeDamageApplied = true;
        const hit = st.applyPlayerDamage(24, { cause: 'kamikaze-explosion', enemy: e, allowCrit: false, allowDodge: false });
        if (hit && hit.killed && st.onPlayerKilled) st.onPlayerKilled(hit);
      }
    }
    if (st.sfx.enemyDeath) st.sfx.enemyDeath(e.isElite ? 'elite' : 'normal', { x: e.x, worldWidth: st.W || 900 });
    else st.sfx.explosion(e.isElite ? 'elite' : 'normal', { x: e.x, worldWidth: st.W || 900 });
    return score;
  };

  // ---- Combo de kills (E1): encadena derribos con <2s entre ellos ----
  // combo = { count, timer } (estado en game.js). Devuelve bonus a aplicar.
  NV.comboOnKill = function (combo) {
    combo.count = combo.timer > 0 ? combo.count + 1 : 1;
    combo.timer = 2;
    const milestone = combo.count % 5 === 0; // cada 5: +1 shard
    return { count: combo.count, bonusScore: Math.min(50, 2 * combo.count), gemBonus: milestone ? 1 : 0, milestone };
  };

  NV.comboTick = function (combo, dt) {
    if (combo.timer > 0) { combo.timer -= dt; if (combo.timer < 0) { combo.timer = 0; combo.count = 0; } }
    return combo;
  };

  // ---- Consumibles: bomba de vacío y congelante ----
  NV.voidBomb = function (enemies, boss) {
    for (const e of enemies) { if (!e.dead) e.hp = Math.max(1, e.hp - Math.round(e.maxHp * 0.25)); }
    if (boss && !boss.dead) boss.hp = Math.max(1, boss.hp - Math.round(boss.maxHp * 0.25));
  };
  NV.freezeEnemies = function (enemies, duration) {
    for (const e of enemies) { if (!e.dead) e.slowUntil = duration; }
  };

  // ----- Cuadrícula espacial (spatial hash) para vecinos cercanos -----
  // Reemplaza los loops O(n²) de separación entre enemigos (común, swarm, ranged)
  // por un barrido de celdas adyacentes: O(n) amortizado. Preserva los radios de
  // búsqueda y las fórmulas de empuje EXACTAS, solo cambia la forma de hallar
  // vecinos. CELL_SIZE fijo >= máximo radio de separación (GOLIATH 36*2+6=78).
  const SEP_CELL = 96;
  function gridCellX(x) { return Math.floor(x / SEP_CELL); }
  function gridCellY(y) { return Math.floor(y / SEP_CELL); }
  function buildSpatialGrid(enemies) {
    const grid = new Map();
    for (let i = 0; i < enemies.length; i++) {
      const it = enemies[i];
      if (it.dead) continue;
      const cx = gridCellX(it.x), cy = gridCellY(it.y);
      const key = cx + ',' + cy;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(it);
    }
    return grid;
  }
  // Llama cb(otro) para cada enemigo vivo en celdas adyacentes a e (dx,dy en {-1,0,1}).
  // Como SEP_CELL >= radio de separación, 3x3 celdas siempre cubren el vecindario.
  function forEachGridNeighbor(e, grid, cb) {
    const cx = gridCellX(e.x), cy = gridCellY(e.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get((cx + dx) + ',' + (cy + dy));
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const other = cell[k];
          if (other !== e) cb(other);
        }
      }
    }
  }

  // ---- Fusión de enemigos: misma especie que se tocan se fusionan en uno más fuerte ----
  // fusionLevel: 0 = normal, 1+ = fusionado (más HP, daño, tamaño). Indicador visual en render.
  const FUSION_MIN = 3;       // enemigos mínimos para fusionar
  const FUSION_RADIUS = 40;   // distancia para considerarse "juntos"
  // ---- SPITTER (F07): banda de rango y tiempos ----
  // too far -> approach · en banda -> strafe/reposición · too close -> retreat.
  // WINDUP real (cero spawn, aim snapshot legible) -> ATTACK (1 disparo de la
  // familia existente, lead parcial topado, sin homing) -> RECOVERY real (sin
  // refire). Strafe persistente para evitar jitter izquierda/derecha.
  const SPIT_FAR = 320;
  const SPIT_NEAR = 180;
  const SPIT_BAND_MID = 250;
  const SPIT_WINDUP = 0.6;
  const SPIT_RECOVERY = 1.0;
  const SPIT_CYCLE = 1.6;
  const SPIT_BULLET_SPEED = 250;
  const SPIT_LEAD_FACTOR = 0.5;
  const SPIT_LEAD_CAP = 60;
  const SPIT_STRAFE_HOLD = 1.6;
  function enemyFusionKey(e) {
    // "Especie" estable: los espectrales usan enemyTypeId; los legacy caen a
    // visualId/shape/behavior para NO fusionar cualquier enemigo undefined con otro.
    return e.enemyTypeId || e.visualId || ((e.shape || 'enemy') + '|' + (e.behavior || 'chase') + '|' + (e.isElite ? 'elite' : 'normal'));
  }
  function fuseEnemies(enemies, st) {
    const grid = buildSpatialGrid(enemies);
    const fused = new Set();
    for (const e of enemies) {
      if (e.dead || fused.has(e)) continue;
      const key = enemyFusionKey(e);
      // Buscar mismos de su especie cercanos (excluye él mismo).
      const sameType = [];
      forEachGridNeighbor(e, grid, (other) => {
        if (other.dead || fused.has(other) || other === e) return;
        if (enemyFusionKey(other) !== key) return;
        if (Math.hypot(other.x - e.x, other.y - e.y) < FUSION_RADIUS) sameType.push(other);
      });
      if (sameType.length + 1 < FUSION_MIN) continue; // +1 por e mismo
      // Fusionar: e es el "anfitrión", los demás mueren y le transfieren poder.
      const group = [e, ...sameType];
      let totalHp = 0, totalMaxHp = 0, totalDmg = 0, cx = 0, cy = 0, maxLevel = e.fusionLevel || 0;
      for (const g of group) {
        totalHp += g.hp;
        totalMaxHp += g.maxHp;
        totalDmg += g.damage;
        cx += g.x; cy += g.y;
        maxLevel = Math.max(maxLevel, g.fusionLevel || 0);
        if (g !== e) { g.dead = true; fused.add(g); }
      }
      const n = group.length;
      e.x = cx / n; e.y = cy / n; // centróide del grupo
      e.hp = totalHp;
      e.maxHp = totalMaxHp;
      e.damage = Math.round(totalDmg * (1 + 0.15 * (n - 1))); // +15% por cada fusión extra
      e.radius = Math.min(60, e.radius * (1 + 0.18 * (n - 1))); // crece con tope
      e.fusionLevel = maxLevel + 1;
      // La fusión conserva su renderer, pero su clasificación mecánica puede escalar.
      // Extrema (nivel 3+ o radio 45+) consume heavy sólo si queda presupuesto; de
      // lo contrario permanece medium para no violar el cap autoritativo.
      if (hostileClass(e) !== 'heavy') {
        const extreme = e.fusionLevel >= 3 || e.radius >= 45;
        e.hostileClass = extreme && canSpawn(st, 0, 1) ? 'heavy' : 'medium';
      }
      e.color = fusionColor(e.fusionLevel);
      e.fusionFlash = 0.9;
      if (st && st.addFloatText) st.addFloatText(e.x, e.y - e.radius - 16, 'FUSION ' + e.fusionLevel, e.color);
      if (st && st.spawnExplosion) st.spawnExplosion(e.x, e.y, Math.max(18, e.radius * 0.8), e.color, 0.55);
      fused.add(e);
    }
  }
  function fusionColor(level) {
    // Progresión visual: normal → amarillo → naranja → rojo → blanco (fusión extrema).
    return ['#d8f6ff', '#ffe04a', '#ff9a24', '#ff3a24', '#ffffff'][Math.min(level, 4)];
  }
  // ---- Update de todos los enemigos (comportamientos, daño al jugador) ----
  // Devuelve { enemies, shake, gameOver }. Mutaciones de array/player por ref; los
  // primitivos let (enemies filtrado, shake) y el flag gameOver vuelven del retorno.
  NV.updateEnemies = function (dt, st) {
    const { enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, applyPlayerDamage, addFloatText } = st;
    let shake = st.shake || 0;
    let gameOver = false;
    // Cuadrícula espacial de vecinos (una pasada O(n)) — reutilizada por las 3
    // separaciones (común, swarm, ranged) y el chequeo de contacto posterior.
    const grid = buildSpatialGrid(enemies);

    for (const e of enemies) {
      if (e.dead) continue;

      const kb = e.knockVelX || 0;
      const kby = e.knockVelY || 0;
      const kbx = Math.abs(kb) > 0.1 ? kb : 0;
      const kby2 = Math.abs(kby) > 0.1 ? kby : 0;

            if (e.stun > 0) e.stun -= dt;
            if (e.shieldCd > 0) e.shieldCd = Math.max(0, e.shieldCd - dt);
            if (e.contactCd > 0) e.contactCd = Math.max(0, e.contactCd - dt);
            if (e.atkFlash > 0) e.atkFlash = Math.max(0, e.atkFlash - dt);
            if (e.fusionFlash > 0) e.fusionFlash = Math.max(0, e.fusionFlash - dt);
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      const stunned = e.stun > 0;
      // Congelante: algunos enemigos ralentizados (slowUntil).
      if (e.slowUntil > 0) e.slowUntil -= dt;
      if (e.hitSlowUntil > 0) e.hitSlowUntil = Math.max(0, e.hitSlowUntil - dt);
      if (e.hitSlowImmunity > 0) e.hitSlowImmunity = Math.max(0, e.hitSlowImmunity - dt);
      // Campo Minado acelera movimiento efectivo sin mutar permanentemente e.speed.
      const eventSpeed = NV.minefieldEnemySpeed ? NV.minefieldEnemySpeed(e, st.waveEvent) : e.speed;
      const hitSlowActive = e.hitSlowUntil > 0;
      const hitSlowMult = hitSlowActive ? NV.hitSlowFor(e.isElite ? "ELITE" : "NORMAL").multiplier : 1;
      const spd = eventSpeed * (e.slowUntil > 0 ? 0.5 : 1) * hitSlowMult;
      if (!stunned) {
        if (e.behavior === 'chase') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += Math.cos(angle) * spd * dt + kbx * dt;
          e.y += Math.sin(angle) * spd * dt + kby2 * dt;
        } else if (e.behavior === 'flank') {
          // RUNNER (F06): flanqueador. F05 (NV.enemyState) es la UNICA fuente
          // autoritativa de state lifecycle CUANDO disponible; fallback interno si no.
          const player = st.player;
          const dx = player.x - e.x, dy = player.y - e.y;
          const distToPlayer = Math.hypot(dx, dy);
          const invDist = Math.max(distToPlayer, 1);

          // Inicializar flankSide una sola vez (persistido en e.flankSide).
          if (e.flankSide !== -1 && e.flankSide !== 1) {
            e.flankSide = Math.random() < 0.5 ? -1 : 1;
          }

          // --- State lifecycle: F05 es autoridad; fallback interno si no cargado ---
          if (NV.enemyState) {
            if (!e.intent) {
              e.intent = NV.enemyState.createIntent(e);
              e.intent.preferredRange = 130;
            }
            NV.enemyState.updateIntent(e, dt); // tick del timer
            var intent = e.intent;
            var state = intent.state;
            var t = intent.stateTimer;
          } else {
            if (!e.flankState) e.flankState = 'idle';
            if (e.stateTimer == null) e.stateTimer = 0.8;
            e.stateTimer -= dt;
            if (e.stateTimer < 0) e.stateTimer = 0;
            var state = e.flankState;
            var t = e.stateTimer;
          }

          var targetX, targetY;
          var next;

          if (state === 'idle' || state === 'positioning') {
            // APPROACH: acercamiento lateral. Target offset lateral respecto al
            // jugador, PERO distinto de player.center.
            next = state;
            var flankOffset = 90 + e.flankSide * 30;
            targetX = player.x + (-dy / invDist) * flankOffset;
            targetY = player.y + (dx / invDist) * flankOffset;
            if (distToPlayer < 80 || t <= 0) {
              next = 'attack'; // -> COMMIT
              e.committedTargetX = player.x + e.flankSide * 18; // SNAPSHOT
              e.committedTargetY = player.y + e.flankSide * 10; // SNAPSHOT
              e.commitDirX = e.committedTargetX - e.x; // SNAPSHOT
              e.commitDirY = e.committedTargetY - e.y; // SNAPSHOT
              if (NV.enemyState) e.intent.stateTimer = 0.45; else e.stateTimer = 0.45;
            }
          } else if (state === 'attack' || state === 'COMMIT') {
            // COMMIT: lunge hacia el SNAPSHOT. El jugador no redirige al Runner.
            next = state;
            targetX = e.committedTargetX;
            targetY = e.committedTargetY;
            if (t <= 0 || distToPlayer < e.radius + 20) {
              next = 'recovery'; // -> RECOVERY
              if (NV.enemyState) e.intent.stateTimer = 0.6; else e.stateTimer = 0.6;
              if (Math.random() < 0.4) e.flankSide = -e.flankSide;
            }
          } else if (state === 'recovery') {
            // RECOVERY: retroceso crea separacion antes del proximo approach.
            next = state;
            var awayDist = Math.hypot(e.x - player.x, e.y - player.y);
            var retreatDist = 120;
            targetX = e.x + (dx ? -dx / Math.max(awayDist, 1) : 0) * retreatDist;
            targetY = e.y + (dy ? -dy / Math.max(awayDist, 1) : 0) * retreatDist;
            if (t <= 0) {
              next = 'positioning'; // -> APPROACH
              if (NV.enemyState) e.intent.stateTimer = 0.8; else e.stateTimer = 0.8;
            }
          } else {
            // Fallback a POSITIONING (APPROACH) si estado inesperado.
            next = 'positioning';
            targetX = player.x + (-dy / invDist) * (90 + e.flankSide * 30);
            targetY = player.y + (dx / invDist) * (90 + e.flankSide * 30);
            if (NV.enemyState) e.intent.stateTimer = Math.max(e.intent.stateTimer, 0.8);
          }

          // Persistir estado (F05 es autoridad; fallback usa campos propios).
          if (NV.enemyState) {
            intent.state = next;
          } else {
            e.flankState = next;
          }

          // Movimiento hacia el objetivo.
          var toTargetX = targetX - e.x;
          var toTargetY = targetY - e.y;
          var toTargetDist = Math.hypot(toTargetX, toTargetY);
          if (toTargetDist > 1e-3) {
            var inv = 1 / toTargetDist;
            var moveSpeed = spd;
            e.x += toTargetX * inv * moveSpeed * dt;
            e.y += toTargetY * inv * moveSpeed * dt;
          }
          // Steering de F05 (factor de movimiento, sin override de legacy).
          if (NV.enemyState) NV.enemyState.computeSteering(e);
        } else if (e.behavior === 'kami') {
          // KAMIKAZE: persigue; a <130px se arma (mecha 0.8s, parpadeo) y detonan.
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (!e.armed && dist < 130) { e.armed = true; e.fuse = 0.8; }
          if (e.armed) {
            e.fuse -= dt;
            const creep = spd * 0.3 * dt; // avanza lento mientras está armado
            e.x += Math.cos(angle) * creep;
            e.y += Math.sin(angle) * creep;
            if (e.fuse <= 0) {
              e.dead = true;
              if (st.onKill) st.onKill(e); // pasa por killEnemy: puntos/drops/explosión
              continue;
            }
          } else {
            e.x += Math.cos(angle) * spd * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * dt + kby2 * dt;
          }
        } else if (e.behavior === 'erratic') {
          e.erraticTimer -= dt;
          if (e.erraticTimer <= 0) { e.erraticTargetAngle = Math.random() * Math.PI * 2; e.erraticTimer = 0.5; }
          const _angleDiff = Math.atan2(Math.sin(e.erraticTargetAngle - e.angle), Math.cos(e.erraticTargetAngle - e.angle));
          e.angle += _angleDiff * Math.min(1, 5 * dt);
          e.x += (Math.cos(e.angle) * spd + kbx) * dt;
          e.y += (Math.sin(e.angle) * spd + kby2) * dt;
        } else if (e.behavior === 'swarm') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += (Math.cos(angle) * spd + kbx) * dt;
          e.y += (Math.sin(angle) * spd + kby2) * dt;
          // Evitar amontonarse con otros swarm próximos (cuadrícula, no O(n²)):
          // mismo radio (radius*4) y mismo empuje (10*dt) que antes.
          forEachGridNeighbor(e, grid, (other) => {
            if (!other.dead && Math.hypot(other.x - e.x, other.y - e.y) < e.radius * 4) {
              const oa = Math.atan2(other.y - e.y, other.x - e.x);
              e.x -= Math.cos(oa) * 10 * dt;
              e.y -= Math.sin(oa) * 10 * dt;
            }
          });
        } else if (e.behavior === 'shield') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (dist > e.radius + 30) {
            e.x += Math.cos(angle) * spd * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * dt + kby2 * dt;
          }
        } else if (e.behavior === 'ranged') {
          // SPITTER / ESCOPURAS (F07): F05 es la autoridad de estados.
          // Banda [SPIT_NEAR, SPIT_FAR]: lejos -> approach, en banda ->
          // strafe persistente, cerca -> RETREAT. WINDUP real sin spawn con
          // aim snapshot + lead parcial topado; ATTACK = 1 disparo familia
          // existente sin homing; RECOVERY = ventana de castigo sin refire.
          const pdx = st.player.x - e.x, pdy = st.player.y - e.y;
          const dist = Math.hypot(pdx, pdy);
          const invD = Math.max(dist, 1);
          if (e.spitStrafe !== -1 && e.spitStrafe !== 1) {
            e.spitStrafe = Math.random() < 0.5 ? -1 : 1;
            e.spitStrafeT = SPIT_STRAFE_HOLD;
          }
          if (!(e.spitStrafeT > 0)) {
            e.spitStrafeT = SPIT_STRAFE_HOLD;
            if (Math.random() < 0.35) e.spitStrafe = -e.spitStrafe;
          } else {
            e.spitStrafeT -= dt;
          }
          let rState, rTimer;
          if (NV.enemyState) {
            if (!e.intent) {
              e.intent = NV.enemyState.createIntent(e);
              e.intent.preferredRange = SPIT_BAND_MID;
              e.intent.flankOffset = 90;
            }
            NV.enemyState.updateIntent(e, dt);
            rState = e.intent.state;
            rTimer = e.intent.stateTimer;
          } else {
            if (e.spitState == null) { e.spitState = 'idle'; e.spitTimer = 0; }
            e.spitTimer = Math.max(0, (e.spitTimer || 0) - dt);
            rState = e.spitState;
            rTimer = e.spitTimer;
          }
          const setRState = (next, timer) => {
            if (NV.enemyState) { e.intent.state = next; e.intent.stateTimer = timer; }
            else { e.spitState = next; e.spitTimer = timer; }
            rState = next; rTimer = timer;
          };
          const fireSpitterShot = () => {
            const tx0 = (e.spitAimX != null ? e.spitAimX : st.player.x);
            const ty0 = (e.spitAimY != null ? e.spitAimY : st.player.y);
            const ang = Math.atan2(ty0 - e.y, tx0 - e.x);
            if (bullets.length < MAX_BULLETS && st.enemyBulletCount() < MAX_ENEMY_BULLETS)
              bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * SPIT_BULLET_SPEED, vy: Math.sin(ang) * SPIT_BULLET_SPEED, damage: e.damage, color: e.color, isEnemy: true, dead: false, sourceEnemy: e, sourceType: e.enemyTypeId || 'ranged' });
            e.shootTimer = 0;
            e.spitFired = true;
          };
          if (rState === 'idle') {
            e.shootTimer = e.shootTimer || 0;
            e.spitFired = false;
            setRState('positioning', Math.max(rTimer || 0, 0.2));
          } else if (rState === 'positioning') {
            e.shootTimer = (e.shootTimer || 0) + dt;
            e.spitFired = false;
            if (dist < SPIT_NEAR) {
              setRState('retreat', 0.6);
            } else if (dist >= SPIT_NEAR && dist <= SPIT_FAR && e.shootTimer >= SPIT_CYCLE) {
              const pvx = st.player.moveVx || 0, pvy = st.player.moveVy || 0;
              const tof = dist / SPIT_BULLET_SPEED;
              let lx = pvx * tof * SPIT_LEAD_FACTOR, ly = pvy * tof * SPIT_LEAD_FACTOR;
              const lm = Math.hypot(lx, ly);
              if (lm > SPIT_LEAD_CAP) { lx *= SPIT_LEAD_CAP / lm; ly *= SPIT_LEAD_CAP / lm; }
              e.spitAimX = st.player.x + lx;
              e.spitAimY = st.player.y + ly;
              e.spitFired = false;
              setRState('windup', SPIT_WINDUP);
            } else {
              let mx, my;
              if (dist > SPIT_FAR) {
                mx = (pdx / invD) * spd * 0.5; my = (pdy / invD) * spd * 0.5;
              } else {
                const sx = (-pdy / invD) * e.spitStrafe, sy = (pdx / invD) * e.spitStrafe;
                const drift = (dist - SPIT_BAND_MID) / Math.max(SPIT_FAR - SPIT_NEAR, 1);
                mx = sx * spd * 0.4 + (pdx / invD) * spd * 0.25 * drift;
                my = sy * spd * 0.4 + (pdy / invD) * spd * 0.25 * drift;
              }
              e.x += mx * dt + kbx * dt;
              e.y += my * dt + kby2 * dt;
            }
          } else if (rState === 'windup') {
            if (rTimer <= 0) {
              fireSpitterShot();
              setRState('recovery', SPIT_RECOVERY);
            }
          } else if (rState === 'attack') {
            if (!e.spitFired) fireSpitterShot();
            setRState('recovery', SPIT_RECOVERY);
          } else if (rState === 'recovery') {
            if (rTimer <= 0) setRState('positioning', 0.2);
          } else if (rState === 'retreat') {
            e.spitFired = false;
            const rx = (-pdx / invD), ry = (-pdy / invD);
            e.x += rx * spd * 0.6 * dt + kbx * dt;
            e.y += ry * spd * 0.6 * dt + kby2 * dt;
            if (dist > SPIT_NEAR + 30 || rTimer <= 0) setRState('positioning', 0.2);
          } else {
            setRState('positioning', 0.2);
          }
          // Separación ranged (cuadrícula, no O(n²)): mismo radio (radius+...)*0.7
          // y mismo empuje ((minD-od)*1.2*dt) que antes. Vale en todos los estados.
          forEachGridNeighbor(e, grid, (other) => {
            if (other.dead) return;
            const od = Math.hypot(other.x - e.x, other.y - e.y);
            const minD = (e.radius + other.radius) * 0.7;
            if (od > 0 && od < minD) {
              const a2 = Math.atan2(e.y - other.y, e.x - other.x);
              const push = (minD - od) * 1.2 * dt;
              e.x += Math.cos(a2) * push;
              e.y += Math.sin(a2) * push;
            }
          });
          if (NV.enemyState) NV.enemyState.computeSteering(e);
        }
      }

      // Separación suave común para enemigos cuerpo a cuerpo: evita que varios
      // chase/kami/erratic/shield se apilen sobre el mismo punto del jugador.
      // Cuadrícula espacial (no O(n²)): mismo minD (r+r+6) y mismo empuje que antes.
      if (e.behavior !== 'ranged') {
        const idx = enemies.indexOf(e);
        forEachGridNeighbor(e, grid, (other) => {
          if (other.dead) return;
          const dx = e.x - other.x, dy = e.y - other.y;
          const od = Math.hypot(dx, dy);
          const minD = e.radius + other.radius + 6;
          if (od < minD) {
            // superposición exacta: dirección determinística por índice (igual que antes)
            const a = od > 0 ? Math.atan2(dy, dx) : (idx - enemies.indexOf(other)) * 2.399963229728653;
            const push = Math.min(1.6, (minD - od) * 7 * dt);
            e.x += Math.cos(a) * push;
            e.y += Math.sin(a) * push;
          }
        });
      }

      e.knockVelX = (e.knockVelX || 0) * 0.92;
      e.knockVelY = (e.knockVelY || 0) * 0.92;

            const d = Math.hypot(e.x - st.player.x, e.y - st.player.y);
      const inContact = d < e.radius + 20;
      if (inContact && st.player.invuln <= 0 && st.player.stun <= 0 && (e.contactCd || 0) <= 0) {
        const baseDmg = e.isElite ? (e.eliteDamage || 0) : e.damage;
        const hit = applyPlayerDamage(baseDmg, { cause: 'contact', enemy: e });
        if (hit.dodged) {
          e.atkFlash = 0.25; // gesto corto: destaca QUÉ enemigo intentó golpear
        } else if (hit.applied) {
          st.player.invuln = 0.5;
          const contactAngle = d > 0 ? Math.atan2(e.y - st.player.y, e.x - st.player.x) : e.angle || 0;
          const contactPush = Math.max(90, (e.speed || 0) * 1.2) * (1 - (e.knockbackRes || 0) * 0.5);
          e.knockVelX = Math.cos(contactAngle) * contactPush;
          e.knockVelY = Math.sin(contactAngle) * contactPush;
          e.contactCd = 1.0;
          e.atkFlash = 0.45; // gesto de ataque: el render destaca QUÉ enemigo está golpeando
          if (st.spawnExplosion) st.spawnExplosion(player.x + Math.cos(contactAngle) * 12, player.y + Math.sin(contactAngle) * 12, 3, '#ff6b6b', 0.5); // chispa de impacto en el punto de contacto
          // El atacante muere al dañar: cada pérdida de HP por contacto tiene una
          // causa ÚNICA, visible e inequívoca (el enemigo que golpeó explota en su
          // posición, vía killEnemy: puntos/xp/drops/explosión). Sin "turnos" de
          // golpes entre enemigos que rodean al jugador.
          e.dead = true;
          if (st.onKill) st.onKill(e);
          if (e.stunChance && Math.random() < e.stunChance) { st.player.stun = 0.6; addFloatText(st.player.x, st.player.y - 30, 'STUN', '#ff0'); }
          shake = Math.max(shake, hit.crit ? 0.3 : 0.15);
          if (hit.killed) { gameOver = true; return { enemies: enemies.filter((x) => !x.dead), shake, gameOver }; }
        }
      }
    }
    // Fusión posterior al movimiento/contacto del frame: si 3+ enemigos de la
    // misma especie quedaron tocándose, se condensan en uno más grande y peligroso.
    fuseEnemies(enemies, st);
    return { enemies: enemies.filter((e) => !e.dead), shake, gameOver };
  };
})();