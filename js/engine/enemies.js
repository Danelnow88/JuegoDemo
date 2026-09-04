// ===== ENGINE: enemigos =====
// spawnEnemy/spawnElite empujan a `enemies` (por ref); killEnemy y updateEnemies devuelven
// los valores `let` que en game.js deben reasignarse (score, shake) y flags (gameOver).
// El resto de estado se muta por referencia (player, arrays) o via callbacks/closures.
(() => {
  'use strict';
  const NV = window.NV;

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
    if (st.enemies.length >= st.MAX_ENEMIES) return;
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

    const side = Math.random() < 0.5 ? 0 : st.W;
    const y = 80 + Math.random() * (st.H - 200);
    const hpScale = NV.enemyHpScale(st.wave); // B1: curva única en balance.js
    const dmgScale = Math.min(60, Math.round(st.wave * 1.5)); // el daño enemigo también escala
    st.enemies.push({
      x: side, y: y,
      hp: Math.round(type.hp * hpScale), maxHp: Math.round(type.hp * hpScale),
      speed: type.speed + Math.min(40, st.wave * 2.5),
      radius: type.radius, color: type.color, shape: type.shape,
      enemyTypeId: type.id,
      score: type.score * (1 + st.wave * 0.1), xp: type.xp * (1 + st.wave * 0.1),
      dead: false, behavior: type.behavior,
      angle: Math.random() * Math.PI * 2, erraticTimer: 0,
      knockbackRes: type.knockbackRes || 0, knockVelX: 0, knockVelY: 0,
      damage: (type.damage || 10) + dmgScale, shield: type.shield || false, shieldCd: 0, resist: type.resist || 0,
      shootTimer: 0, stunChance: type.stunChance || 0,
      // Evento CAMPO MINADO: algunos enemigos detonan en cadena al morir.
      mine: !!(st.waveEvent === 'mines' && Math.random() < 0.5),
    });
    // Traza de spawn para los espectros (nuevos y legacy WebGL) en consola.
    if (type.id && type.id.indexOf('specter_') === 0) {
      console.log('[SPAWN] wave=' + st.wave + ' type=' + type.id);
    }
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
      if (st.enemies.length >= st.MAX_ENEMIES) break;
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
      const pushed = {
        x: side, y: y,
        hp: Math.round(elite.hp + st.wave * st.wave * 1.5), maxHp: Math.round(elite.hp + st.wave * st.wave * 1.5),
        speed: elite.speed + st.wave,
        radius: elite.radius, color: elite.color, shape: elite.shape,
        score: elite.score, xp: elite.xp, dead: false,
        behavior: elite.behavior, angle: Math.random() * Math.PI * 2,
        erraticTimer: 0, isElite: true, eliteDamage: eliteDmg,
        knockbackRes: 0.3, knockVelX: 0, knockVelY: 0, shootTimer: 0,
        stunChance: elite.stunChance || 0, resist: elite.resist || 0,
      };
      // Metadatos para render espectral (solo cuando el tipo define id).
      if (elite.id) pushed.enemyTypeId = elite.id;
      if (elite.visualId) pushed.visualId = elite.visualId;
      st.enemies.push(pushed);
      // Traza de spawn para élites espectrales.
      if (elite.spectralElite && elite.id && elite.id.indexOf('specter_') === 0) {
        console.log('[SPAWN] wave=' + st.wave + ' type=' + elite.id);
      }
    }
  };

  // ---- Derribo (muta player/weaponLevels/weaponKills por ref; devuelve nuevo score) ----
  NV.killEnemy = function (st) {
    const e = st.e;
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
    if (st.weaponKills[wid] >= st.WEAPON_KILLS_PER_LEVEL * curLevel) {
      st.weaponLevels[wid] = curLevel + 1;
      st.addFloatText(st.player.x, st.player.y - 40, st.currentWeapon.name + ' → Nv ' + (curLevel + 1), '#ffd700');
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
    // Evento CAMPO MINADO: el enemigo mina explota al morir (área, daño al jugador si está cerca).
    if (e.mine) {
      st.spawnExplosion(e.x, e.y, 26, '#ff5f9b', 0.9);
      if (st.computePlayerHit && Math.hypot(e.x - st.player.x, e.y - st.player.y) < 90) {
        st.computePlayerHit(20);
      }
    }
    // KAMIKAZE: siempre detona al morir (por disparo o por autodetonacion).
    if (e.behavior === 'kami') {
      st.spawnExplosion(e.x, e.y, 34, '#ff5f3d', 1.1);
      if (st.computePlayerHit && Math.hypot(e.x - st.player.x, e.y - st.player.y) < 95) {
        st.computePlayerHit(24);
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
    const { enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, computePlayerHit, addFloatText } = st;
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
      const stunned = e.stun > 0;
      // Congelante: algunos enemigos ralentizados (slowUntil).
      if (e.slowUntil > 0) e.slowUntil -= dt;
      const spd = e.speed * (e.slowUntil > 0 ? 0.5 : 1);
      if (!stunned) {
        if (e.behavior === 'chase') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += Math.cos(angle) * spd * dt + kbx * dt;
          e.y += Math.sin(angle) * spd * dt + kby2 * dt;
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
          if (e.erraticTimer <= 0) { e.angle += (Math.random() - 0.5) * 3; e.erraticTimer = 0.5; }
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
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (dist > 170) {
            const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
            e.x += Math.cos(angle) * spd * 0.5 * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * 0.5 * dt + kby2 * dt;
          } else {
            // Separación ranged (cuadrícula, no O(n²)): mismo radio (radius+...)*0.7
            // y mismo empuje ((minD-od)*1.2*dt) que antes.
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
            e.shootTimer += dt;
            if (e.shootTimer > 1.2) {
              e.shootTimer = 0;
              const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
              if (bullets.length < MAX_BULLETS && st.enemyBulletCount() < MAX_ENEMY_BULLETS)
                bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250, damage: e.damage, color: e.color, isEnemy: true, dead: false, sourceEnemy: e, sourceType: e.enemyTypeId || 'ranged' });
            }
          }
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
        const hit = computePlayerHit(baseDmg);
        if (hit.dodged) {
          e.atkFlash = 0.25; // gesto corto: destaca QUÉ enemigo intentó golpear
          addFloatText(st.player.x, st.player.y - 20, 'ESQUIVA', '#8dfaff');
        } else {
          const damage = hit.dmg;
          const hpBefore = st.player.hp;
          st.player.hp -= damage;
          if (st.onPlayerDamaged) st.onPlayerDamaged({ cause: 'contact', enemy: e, hpBefore, hpAfter: st.player.hp, damage, crit: !!hit.crit });
          if (st.sfx && st.sfx.playerHit && st.player.hp > 0) st.sfx.playerHit();
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
          addFloatText(st.player.x, st.player.y - 20, '-' + damage + (hit.crit ? ' ★CRIT' : ''), hit.crit ? '#ff0' : (e.isElite ? '#ff0' : '#ff5f9b'));
          if (st.player.hp <= 0) { gameOver = true; return { enemies: enemies.filter((x) => !x.dead), shake, gameOver }; }
        }
      }
    }
    // Fusión posterior al movimiento/contacto del frame: si 3+ enemigos de la
    // misma especie quedaron tocándose, se condensan en uno más grande y peligroso.
    fuseEnemies(enemies, st);
    return { enemies: enemies.filter((e) => !e.dead), shake, gameOver };
  };
})();