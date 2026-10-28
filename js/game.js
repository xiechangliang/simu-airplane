/** 苍穹战机 · 游戏引擎（武器伤害 + 组队 AI） */

class GameEngine {
  constructor(canvas, save, onEnd) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.save = save;
    this.onEnd = onEnd;
    this.running = false;
    this.paused = false;
    this.keys = {};
    this.particles = [];
    this.projectiles = [];
    this.enemies = [];
    this.allies = [];
    this.pickups = [];
    this.islands = [];
    this.clouds = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.aliveTime = 0;
    this.spawnTimer = 0;
    this.missionRef = null;
    this.teamMode = false;
    this._boundKeyDown = (e) => this.onKey(e, true);
    this._boundKeyUp = (e) => this.onKey(e, false);
    this._raf = null;
    this.lastTs = 0;
  }

  start(config) {
    this.mode = config.mode;
    this.teamMode = !!config.team || config.mode === "team";
    this.map = getMap(config.mapId);
    this.planeData = getPlane(config.planeId);
    this.loadout = config.loadout || getPlaneLoadout(this.save, config.planeId);
    this.missionRef = config.mission || null;
    this.resize();
    this.buildWorld();
    this.resetPlayer();
    this.allies = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.aliveTime = 0;
    this.spawnTimer = 0;
    this.combatActive = false;
    this.combatMission = null;
    this.combatBanner = 0;
    this.combatEventTimer = 25 + Math.random() * 35; // 自由飞行一段时间后才可能触发支线战
    this.baseWorldSize = this.worldSize;
    this.tempIslands = [];
    this.civilians = [];
    this.civSpawnTimer = 4;
    this.escortActive = false;
    this.escort = null;
    this.detection = 0;
    this.scouts = [];
    this.raidTimer = 35 + Math.random() * 25;
    this.sessionCoins = 0;
    if (this.teamMode) this.spawnAllies(2);
    if (this.mode === "free") {
      this.spawnPeacePatrols();
      this.spawnGatherScouts(2);
    }
    // 非自由飞行模式（空战/生存等）开局即进入战斗态
    if (this.mode !== "free") {
      this.beginCombatEvent(null, { expand: false, reason: "模式战斗" });
    }
    this.running = true;
    this.paused = false;
    this.lastTs = performance.now();
    window.addEventListener("keydown", this._boundKeyDown);
    window.addEventListener("keyup", this._boundKeyUp);
    window.addEventListener("resize", (this._onResize = () => this.resize()));
    this.loop(this.lastTs);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener("keydown", this._boundKeyDown);
    window.removeEventListener("keyup", this._boundKeyUp);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTs = performance.now();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
  }

  buildWorld() {
    const size = this.map.size;
    this.worldSize = size;
    this.islands = [];
    const layout = this.map.layout || [];

    for (const spot of layout) {
      const x = spot.x * size;
      const y = spot.y * size;
      this.islands.push(this.makeIsland(x, y, spot.r, spot.type === "continent", spot));
    }

    // 兼容旧数据：无 layout 时回退
    if (!this.islands.length) {
      this.islands.push(this.makeIsland(size * 0.5, size * 0.65, 480, true, { name: "主陆", runwayAngle: 0 }));
      this.islands.push(this.makeIsland(size * 0.25, size * 0.3, 220, false, { name: "小岛A", runwayAngle: 0.2 }));
      this.islands.push(this.makeIsland(size * 0.75, size * 0.28, 200, false, { name: "小岛B", runwayAngle: -0.2 }));
    }

    this.clouds = [];
    for (let i = 0; i < 50; i++) {
      this.clouds.push({
        x: Math.random() * size,
        y: Math.random() * size,
        r: 40 + Math.random() * 90,
        a: 0.08 + Math.random() * 0.12,
        drift: 8 + Math.random() * 16,
      });
    }

    this.waypoints = [];
    for (let i = 0; i < this.islands.length + 2; i++) {
      this.waypoints.push({
        x: 200 + Math.random() * (size - 400),
        y: 200 + Math.random() * (size - 400),
        taken: false,
      });
    }
  }

  makeIsland(x, y, r, continent = false, spot = {}) {
    const ang = spot.runwayAngle || 0;
    const len = continent ? r * 0.9 : r * 0.75;
    const wid = continent ? 40 : 32;
    const maxHp = Math.round((continent ? 520 : 280) + r * 0.85);
    return {
      x,
      y,
      r,
      name: spot.name || (continent ? "大陆" : "小岛"),
      continent,
      peaks: this.makePeaks(r),
      occupied: false,
      maxHp,
      hp: maxHp,
      // 机场跑道（矩形中心在陆地中心）
      runway: {
        x,
        y,
        length: len,
        width: wid,
        angle: ang,
        name: (spot.name || "机场") + "机场",
      },
    };
  }

  /** 占领/解放时重置血条 */
  resetIslandHp(isle) {
    if (!isle) return;
    if (!isle.maxHp) isle.maxHp = Math.round((isle.continent ? 520 : 280) + isle.r * 0.85);
    isle.hp = isle.maxHp;
  }

  markIslandOccupied(isle, occupied) {
    if (!isle) return;
    isle.occupied = !!occupied;
    this.resetIslandHp(isle);
  }

  /** 自由飞行开局：复仇者 + 世界之王巡逻 */
  spawnPeacePatrols() {
    const ids = ["avenger", "world_king"];
    let i = 0;
    for (const id of ids) {
      if (this.planeData && this.planeData.id === id) continue;
      const plane = getPlane(id);
      if (!plane) continue;
      this.pushAlly(plane, i++, false);
      const a = this.allies[this.allies.length - 1];
      if (a) {
        a.patrol = true;
        a.label = `${plane.name}·巡逻`;
        a.patrolIndex = i;
        a.patrolTimer = 0;
        const fields = this.friendlyIslands().length ? this.friendlyIslands() : this.islands;
        if (fields.length) {
          const dest = fields[i % fields.length];
          a.patrolTarget = dest;
          a.x = dest.runway.x + (Math.random() - 0.5) * 80;
          a.y = dest.runway.y + (Math.random() - 0.5) * 80;
          a.angle = dest.runway.angle - Math.PI / 2;
        }
      }
    }
  }

  /** 集合 / 侦察机：和平巡逻，易被敌战斗机袭扰 */
  spawnGatherScouts(n = 2) {
    const fields = this.friendlyIslands().length ? this.friendlyIslands() : this.islands;
    if (!fields.length) return;
    for (let i = 0; i < n; i++) {
      const home = fields[i % fields.length];
      const kind = i % 2 === 0 ? "scout" : "gather";
      const dest = fields[(i + 1) % fields.length] || home;
      this.scouts.push({
        x: home.runway.x + (Math.random() - 0.5) * 40,
        y: home.runway.y + (Math.random() - 0.5) * 40,
        angle: Math.atan2(dest.runway.y - home.runway.y, dest.runway.x - home.runway.x),
        speed: kind === "scout" ? 95 : 72,
        turn: 1.8,
        hp: kind === "scout" ? 32 : 40,
        maxHp: kind === "scout" ? 32 : 40,
        r: 12,
        team: "ally",
        scout: true,
        gather: kind === "gather",
        label: kind === "scout" ? "侦察机" : "集合机",
        from: home,
        to: dest,
        invuln: 0,
        color: kind === "scout" ? "#7ec8e8" : "#9ad4b0",
      });
    }
  }

  makePeaks(r) {
    const n = 8 + Math.floor(Math.random() * 5);
    const peaks = [];
    for (let i = 0; i < n; i++) peaks.push(0.75 + Math.random() * 0.35);
    return peaks;
  }

  snapshotAmmo(bag) {
    const snap = {};
    for (const list of [bag.guns, bag.shorts, bag.mediums, bag.heavies]) {
      for (const st of list) snap[st.slotId] = st.weapon.ammo;
    }
    return snap;
  }

  restoreFromTakeoff() {
    const p = this.player;
    p.hp = this.takeoff.maxHp;
    p.maxHp = this.takeoff.maxHp;
    p.fuel = this.takeoff.maxFuel;
    p.maxFuel = this.takeoff.maxFuel;
    for (const list of [this.weapons.guns, this.weapons.shorts, this.weapons.mediums, this.weapons.heavies]) {
      for (const st of list) {
        st.ammo = this.takeoff.ammo[st.slotId] ?? st.weapon.ammo;
        st.cooldown = 0;
      }
    }
    this.landFlash = 1.2;
    this.burst(p.x, p.y, "#3db88a", 18);
  }

  /** 根据挂载构建运行时武器状态 */
  buildWeaponState(plane, loadout) {
    const guns = [];
    const shorts = [];
    const mediums = [];
    const heavies = [];

    for (const hp of plane.hardpoints) {
      const wid = loadout[hp.id] || hp.default;
      const w = getWeapon(wid);
      if (!w) continue;
      const state = {
        slotId: hp.id,
        weapon: w,
        ammo: w.ammo,
        cooldown: 0,
      };
      if (w.category === "gun") guns.push(state);
      else if (w.slot === "short") shorts.push(state);
      else if (w.slot === "medium") mediums.push(state);
      else heavies.push(state);
    }
    return { guns, shorts, mediums, heavies };
  }

  resetPlayer() {
    const s = getEffectiveStats(this.planeData, this.save);
    this.weapons = this.buildWeaponState(this.planeData, this.loadout);
    const maxHp = 40 + s.armor * 4;
    const maxFuel = maxFuelSeconds(this.planeData, this.save);
    // 从大陆/最大陆地附近起飞
    const home = [...this.islands].sort((a, b) => b.r - a.r)[0];
    const startX = home ? home.x : this.worldSize / 2;
    const startY = home ? home.y - home.r * 0.6 : this.worldSize / 2;
    this.player = {
      x: startX,
      y: startY,
      angle: -Math.PI / 2,
      vx: 0,
      vy: -120,
      hp: maxHp,
      maxHp,
      speed: 140 + s.speed * 12,
      turn: 2.2 + s.agility * 0.12,
      invuln: 0,
      team: "player",
      fuel: maxFuel,
      maxFuel,
      alt: 800,
      maxAlt: 3200,
      grounded: false,
      onWater: false,
      waterTaxi: false,
      taxiTarget: null,
      kmh: 0,
      hasFloats: !!(this.planeData && this.planeData.floats),
    };
    this.takeoff = {
      maxHp,
      maxFuel,
      ammo: this.snapshotAmmo(this.weapons),
    };
    this.canLand = false;
    this.overRunway = null;
    this.landHold = 0;
    this.landHoldNeed = 0.85;
    this.landFlash = 0;
    this.landCountSession = 0;
    this.allyReinforceTimer = COMBAT_REINFORCE_INTERVAL;
    this.camX = this.player.x;
    this.camY = this.player.y;
  }

  spawnAllies(n) {
    const pool = PLANES.filter((p) => this.save.ownedPlanes.includes(p.id));
    for (let i = 0; i < n; i++) {
      const plane = pool[Math.min(i, pool.length - 1)] || getPlane("lark");
      this.pushAlly(plane, i, false);
    }
  }

  /** 未被敌方占领的小岛 / 大陆 */
  friendlyIslands() {
    return this.islands.filter((i) => !i.occupied);
  }

  occupiedIslands() {
    return this.islands.filter((i) => i.occupied);
  }

  /** 选一座友方机场（轮换，避免全挤在同一座） */
  pickFriendlyAirfield(index = 0) {
    const list = this.friendlyIslands();
    if (!list.length) return null;
    // 优先大陆，再小岛
    const sorted = [...list].sort((a, b) => Number(b.continent) - Number(a.continent) || b.r - a.r);
    return sorted[index % sorted.length];
  }

  nearestFriendlyIsland(x, y) {
    const list = this.friendlyIslands();
    if (!list.length) return null;
    let best = null;
    let bestD = Infinity;
    for (const isle of list) {
      const d = Math.hypot(isle.runway.x - x, isle.runway.y - y);
      if (d < bestD) {
        bestD = d;
        best = isle;
      }
    }
    return best;
  }

  isOverIsland(x, y) {
    return this.islands.some((isle) => Math.hypot(isle.x - x, isle.y - y) < isle.r * 0.92);
  }

  isOverWater(x, y) {
    return !this.isOverIsland(x, y);
  }

  playerHasFloats() {
    return !!(this.planeData && this.planeData.floats);
  }

  /** 支线遭遇战：世界之王 / 世界纪录 / 云雀 / 复仇者 从友方岛起飞 */
  spawnCombatSupportAllies() {
    this.allies = this.allies.filter((a) => !a.combatSupport);
    let i = 0;
    for (const id of COMBAT_ALLY_IDS) {
      if (this.planeData && this.planeData.id === id) continue;
      const plane = getPlane(id);
      if (!plane) continue;
      this.pushAlly(plane, i++, true);
    }
  }

  /** 遭遇战周期性增援：复仇者 / 世界纪录 / 世界之王（友方机场起飞） */
  spawnCombatReinforcements() {
    const aliveSupport = this.allies.filter((a) => a.combatSupport && a.hp > 0).length;
    if (aliveSupport >= 9) return 0;
    let spawned = 0;
    let i = this.allies.length;
    for (const id of COMBAT_REINFORCE_IDS) {
      if (this.planeData && this.planeData.id === id) continue;
      const plane = getPlane(id);
      if (!plane) continue;
      this.pushAlly(plane, i++, true);
      spawned++;
    }
    if (spawned && window.UI) {
      window.UI.showCombatToast(`友军增援从友方机场起飞：复仇者 · 世界纪录 · 世界之王（+${spawned}）`);
    }
    return spawned;
  }

  tickCombatAllyReinforce(dt) {
    if (!this.combatActive) return;
    this.allyReinforceTimer = (this.allyReinforceTimer ?? COMBAT_REINFORCE_INTERVAL) - dt;
    if (this.allyReinforceTimer > 0) return;
    this.allyReinforceTimer = COMBAT_REINFORCE_INTERVAL;
    this.spawnCombatReinforcements();
  }

  pushAlly(plane, index, combatSupport) {
    const loadout = getPlaneLoadout(this.save, plane.id);
    const s = getEffectiveStats(plane, this.save);
    // 遭遇战友军：从未被占领的小岛/大陆跑道起飞
    const field = combatSupport ? this.pickFriendlyAirfield(index) : null;
    let x;
    let y;
    let angle;
    if (field) {
      const side = index % 2 === 0 ? 1 : -1;
      const along = (index % 3) * 28 - 28;
      const ca = Math.cos(field.runway.angle);
      const sa = Math.sin(field.runway.angle);
      x = field.runway.x + ca * along + -sa * side * 22;
      y = field.runway.y + sa * along + ca * side * 22;
      angle = field.runway.angle - Math.PI / 2;
      // 略微朝向玩家所在方向
      if (this.player) angle = Math.atan2(this.player.y - y, this.player.x - x);
    } else {
      const offset = (index + 1) * 70;
      const side = index % 2 === 0 ? 1 : -1;
      x = this.player.x - Math.cos(this.player.angle) * offset + Math.sin(this.player.angle) * side * 50;
      y = this.player.y - Math.sin(this.player.angle) * offset - Math.cos(this.player.angle) * side * 50;
      angle = this.player.angle;
    }
    this.allies.push({
      x,
      y,
      angle,
      vx: Math.cos(angle) * 80,
      vy: Math.sin(angle) * 80,
      hp: 36 + s.armor * 3.5,
      maxHp: 36 + s.armor * 3.5,
      speed: 130 + s.speed * 11,
      turn: 2.0 + s.agility * 0.1,
      invuln: 0.8,
      team: "ally",
      plane,
      weapons: this.buildWeaponState(plane, loadout),
      color: combatSupport ? plane.accent || "#3db88a" : "#3db88a",
      fireCd: 0.5,
      r: 16,
      combatSupport: !!combatSupport,
      label: plane.name,
      homeIsle: field ? field.name : null,
    });
  }

  onKey(e, down) {
    const k = e.key.toLowerCase();
    const block = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "j", "k", "q", "e", "f", "r", "c", "g"];
    if (block.includes(k) || e.code === "Space") e.preventDefault();
    this.keys[k] = down;
    if (e.code === "Space") this.keys[" "] = down;
    if (down && k === "escape" && window.UI) window.UI.togglePause();
  }

  loop(ts) {
    if (!this.running) return;
    this._raf = requestAnimationFrame((t) => this.loop(t));
    if (this.paused) {
      this.draw();
      return;
    }
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.update(dt);
    this.draw();
  }

  update(dt) {
    this.aliveTime += dt;
    this.tickWeaponCooldowns(this.weapons, dt);
    this.updatePlayer(dt);
    this.updateAllies(dt);
    this.updateScouts(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.updatePickups(dt);
    this.spawnLogic(dt);
    this.checkMissionProgress();
    this.syncHud();
    if (this.player.hp <= 0) this.endGame(false);
  }

  /** 即时入账民航票款等 */
  awardCoins(amount, reason) {
    const n = Math.max(0, Math.floor(amount));
    if (!n) return;
    this.save.coins += n;
    this.sessionCoins = (this.sessionCoins || 0) + n;
    this.score += Math.floor(n * 0.35);
    saveGame(this.save);
    if (window.UI && reason) window.UI.showCombatToast(`${reason} +${n} 金币`);
  }

  tickWeaponCooldowns(bag, dt) {
    for (const list of [bag.guns, bag.shorts, bag.mediums, bag.heavies]) {
      for (const st of list) st.cooldown = Math.max(0, st.cooldown - dt);
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    const left = this.keys["a"] || this.keys["arrowleft"];
    const right = this.keys["d"] || this.keys["arrowright"];
    const up = this.keys["w"] || this.keys["arrowup"];
    const down = this.keys["s"] || this.keys["arrowdown"];
    const climb = this.keys["r"];
    const descend = this.keys["c"];
    const outOfFuel = p.fuel <= 0;

    // 浮筒水面滑行：缓慢开回最近友方机场
    if (p.waterTaxi) {
      this.updateWaterTaxi(dt);
      return;
    }

    if (p.grounded) {
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.kmh = Math.round(Math.hypot(p.vx, p.vy) * 3.2);
      if (up && !outOfFuel) {
        p.grounded = false;
        p.onWater = false;
        p.alt = 80;
        p.vy = -Math.cos(p.angle) * 40;
        p.vx = Math.sin(p.angle) * 40;
      }
      this.updateLandAvailability(dt);
      this.landFlash = Math.max(0, this.landFlash - dt);
      return;
    }

    if (left) p.angle -= p.turn * dt;
    if (right) p.angle += p.turn * dt;

    // 高度：R 爬升 / C 下降；燃油耗尽则自动缓降至 0
    let climbRate = 0;
    if (outOfFuel) {
      climbRate = -95;
    } else {
      if (climb) climbRate = 220;
      if (descend) climbRate = -260;
      if (!climb && !descend && p.alt > 1200) climbRate = -40;
    }
    p.alt = Math.max(0, Math.min(3500, p.alt + climbRate * dt));

    let thrust = 0;
    if (up && !outOfFuel) thrust = 1;
    if (down) thrust = -0.35;

    const altDrag = 1 - Math.min(0.15, p.alt / 20000);
    const cruiseMul = outOfFuel ? 0.22 : thrust === 0 ? 0.62 : thrust > 0 ? 1 : 0.3;
    const targetSpeed = p.speed * cruiseMul * altDrag;
    const ax = Math.cos(p.angle) * targetSpeed;
    const ay = Math.sin(p.angle) * targetSpeed;
    p.vx += (ax - p.vx) * Math.min(1, 3 * dt);
    p.vy += (ay - p.vy) * Math.min(1, 3 * dt);
    if (thrust === 0 || outOfFuel) {
      p.vx *= 1 - 0.35 * dt;
      p.vy *= 1 - 0.35 * dt;
    }

    const speedNow = Math.hypot(p.vx, p.vy);
    p.kmh = Math.round(speedNow * 3.2);

    if (!p.grounded && !outOfFuel) {
      const burn = Math.max(0.15, (p.kmh / 180) * (thrust > 0 ? 1.25 : 0.85));
      p.fuel = Math.max(0, p.fuel - burn * dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(40, Math.min(this.worldSize - 40, p.x));
    p.y = Math.max(40, Math.min(this.worldSize - 40, p.y));
    this.camX += (p.x - this.camX) * Math.min(1, 5 * dt);
    this.camY += (p.y - this.camY) * Math.min(1, 5 * dt);
    p.invuln = Math.max(0, p.invuln - dt);
    this.landFlash = Math.max(0, this.landFlash - dt);

    this.updateLandAvailability(dt);
    this.checkAltitudeTouchdown();

    if (this.keys[" "] || this.keys["j"]) this.fireGroup(p, this.weapons.guns, "player");
    if (this.keys["k"] || this.keys["q"]) this.fireGroup(p, this.weapons.shorts, "player");
    if (this.keys["e"]) this.fireGroup(p, this.weapons.mediums, "player");
    if (this.keys["g"] || this.keys["f"]) this.fireGroup(p, this.weapons.heavies, "player");

    for (const c of this.clouds) {
      c.x += c.drift * dt * 0.3;
      if (c.x > this.worldSize + 100) c.x = -100;
    }

    if (this.mode === "free") {
      for (const w of this.waypoints) {
        if (w.taken) continue;
        if (Math.hypot(w.x - p.x, w.y - p.y) < 50) {
          w.taken = true;
          this.score += 30;
          this.burst(w.x, w.y, "#ffc857", 12);
          this.spawnPickup(w.x, w.y, "heal");
        }
      }
    }
  }

  /** 高度触地：跑道正常落地 / 水面浮筒迫降 / 无浮筒坠海 */
  checkAltitudeTouchdown() {
    const p = this.player;
    if (!p || p.grounded || p.waterTaxi || p.alt > 8) return;

    // 已在跑道上方且可降落 → 直接落地补给
    if (this.canLand && this.activeRunway) {
      this.requestLanding();
      return;
    }

    if (this.isOverWater(p.x, p.y)) {
      if (p.hasFloats || this.playerHasFloats()) {
        this.beginWaterTaxi();
      } else {
        p.hp = 0;
        this.burst(p.x, p.y, "#4a90c8", 20);
        if (window.UI) window.UI.showCombatToast("无浮筒坠入海面");
      }
      return;
    }

    // 落到陆地非跑道：硬着陆，进最近友方跑道补给
    const near = this.nearestFriendlyIsland(p.x, p.y);
    if (near) {
      this.activeRunway = near;
      this.canLand = true;
      this.requestLanding();
      p.hp = Math.max(8, p.hp * 0.55);
      if (window.UI) window.UI.showCombatToast("硬着陆，已滑入友方机场补给");
    } else {
      p.hp = 0;
    }
  }

  beginWaterTaxi() {
    const p = this.player;
    if (!p || p.waterTaxi) return;
    const home = this.nearestFriendlyIsland(p.x, p.y);
    if (!home) {
      p.hp = 0;
      return;
    }
    p.alt = 0;
    p.onWater = true;
    p.waterTaxi = true;
    p.grounded = false;
    p.taxiTarget = home;
    p.vx = 0;
    p.vy = 0;
    p.kmh = 0;
    this.landHold = 0;
    this.burst(p.x, p.y, "#7ec8e8", 14);
    if (window.UI) {
      window.UI.showCombatToast(`浮筒着水，正在缓慢返航「${home.name}」机场…`);
    }
  }

  updateWaterTaxi(dt) {
    const p = this.player;
    const target = p.taxiTarget || this.nearestFriendlyIsland(p.x, p.y);
    if (!target) {
      p.waterTaxi = false;
      p.hp = 0;
      return;
    }
    p.taxiTarget = target;
    p.alt = 0;
    p.onWater = true;

    const tx = target.runway.x;
    const ty = target.runway.y;
    const desired = Math.atan2(ty - p.y, tx - p.x);
    let diff = desired - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += Math.sign(diff) * Math.min(Math.abs(diff), 1.1 * dt);

    const taxiSpeed = 38;
    p.vx = Math.cos(p.angle) * taxiSpeed;
    p.vy = Math.sin(p.angle) * taxiSpeed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(40, Math.min(this.worldSize - 40, p.x));
    p.y = Math.max(40, Math.min(this.worldSize - 40, p.y));
    p.kmh = Math.round(taxiSpeed * 3.2);
    this.camX += (p.x - this.camX) * Math.min(1, 4 * dt);
    this.camY += (p.y - this.camY) * Math.min(1, 4 * dt);

    const hint = document.getElementById("land-hint");
    const hintText = document.getElementById("land-hint-text");
    if (hint) hint.classList.remove("hidden");
    if (hintText) hintText.textContent = `浮筒滑行中 → 「${target.name}」机场（自动返航）`;

    if (Math.hypot(p.x - tx, p.y - ty) < Math.max(36, target.runway.width)) {
      p.waterTaxi = false;
      p.onWater = false;
      this.activeRunway = target;
      this.canLand = true;
      this.requestLanding();
      if (window.UI) window.UI.showCombatToast(`已抵达「${target.name}」，完成补给`);
    }
  }

  /** 是否在跑道上方 */
  pointOnRunway(x, y, runway) {
    const dx = x - runway.x;
    const dy = y - runway.y;
    const ca = Math.cos(-runway.angle);
    const sa = Math.sin(-runway.angle);
    const lx = dx * ca - dy * sa;
    const ly = dx * sa + dy * ca;
    return Math.abs(lx) <= runway.length / 2 + 8 && Math.abs(ly) <= runway.width / 2 + 18;
  }

  updateLandAvailability(dt = 0) {
    const p = this.player;
    if (p.waterTaxi) return;

    this.activeRunway = null;
    this.canLand = false;
    this.canWaterLand = false;
    if (!p.grounded) {
      for (const isle of this.islands) {
        if (this.pointOnRunway(p.x, p.y, isle.runway) && p.alt <= 120) {
          this.activeRunway = isle;
          this.canLand = true;
          break;
        }
      }
      // 自带浮筒：海面上低空可按住 C 着水，随后自动返航友方机场
      if (
        !this.canLand &&
        (p.hasFloats || this.playerHasFloats()) &&
        this.isOverWater(p.x, p.y) &&
        p.alt <= 120
      ) {
        this.canWaterLand = true;
      }
    }

    const descend = this.keys["c"];
    const hint = document.getElementById("land-hint");
    const hintText = document.getElementById("land-hint-text");
    const holdBar = document.getElementById("land-hold-bar");
    const holdFill = document.getElementById("land-hold-fill");
    const holdingLand = this.canLand || this.canWaterLand;

    if (holdingLand && descend && dt > 0) {
      this.landHold = Math.min(this.landHoldNeed, this.landHold + dt);
      if (this.landHold >= this.landHoldNeed) {
        if (this.canLand) this.requestLanding();
        else if (this.canWaterLand) this.beginWaterTaxi();
        return;
      }
    } else if (!holdingLand || !descend) {
      this.landHold = Math.max(0, this.landHold - dt * 2.5);
    }

    const holdPct = this.landHoldNeed > 0 ? this.landHold / this.landHoldNeed : 0;
    if (holdBar) holdBar.classList.toggle("hidden", holdPct <= 0.02);
    if (holdFill) holdFill.style.width = `${Math.round(holdPct * 100)}%`;

    if (hint) {
      if (this.canLand) {
        hint.classList.remove("hidden");
        if (hintText) {
          hintText.textContent = descend
            ? `正在降落「${this.activeRunway.name}」… 按住 C ${Math.round(holdPct * 100)}%`
            : `已对准「${this.activeRunway.name}」· 高度 ${Math.round(p.alt)} m · 按住 C 下降降落`;
        }
      } else if (this.canWaterLand) {
        hint.classList.remove("hidden");
        if (hintText) {
          hintText.textContent = descend
            ? `浮筒着水中… 按住 C ${Math.round(holdPct * 100)}%`
            : `海面 · 高度 ${Math.round(p.alt)} m · 本机有浮筒，按住 C 着水后自动返航友方机场`;
        }
      } else {
        let near = null;
        for (const isle of this.islands) {
          if (this.pointOnRunway(p.x, p.y, isle.runway)) {
            near = isle;
            break;
          }
        }
        if (near && p.alt > 120) {
          hint.classList.remove("hidden");
          if (hintText) {
            hintText.textContent = `在「${near.name}」机场上空 · 请降至 120 m 以下，再按住 C 降落（当前 ${Math.round(p.alt)} m）`;
          }
        } else if (p.fuel <= 0) {
          hint.classList.remove("hidden");
          if (hintText) {
            hintText.textContent = p.hasFloats || this.playerHasFloats()
              ? `燃油耗尽，高度缓降中… 触水将用浮筒自动返航`
              : `燃油耗尽，高度缓降中… 无浮筒触水会坠毁`;
          }
        } else {
          hint.classList.add("hidden");
        }
      }
    }
  }

  /** 跑道上空 + ≤120m + 按住下降键：落地补给 */
  requestLanding() {
    if (!this.canLand || !this.player || this.player.grounded) return false;
    const p = this.player;
    const isle = this.activeRunway;
    p.grounded = true;
    p.waterTaxi = false;
    p.onWater = false;
    p.taxiTarget = null;
    p.alt = 0;
    p.vx *= 0.1;
    p.vy *= 0.1;
    if (isle) {
      p.x = isle.runway.x;
      p.y = isle.runway.y;
      p.angle = isle.runway.angle;
    }
    this.restoreFromTakeoff();
    p.alt = 0;
    p.grounded = true;
    this.landHold = 0;
    this.save.landCount = (this.save.landCount || 0) + 1;
    for (const m of allMissions(this.save)) {
      if (m.done || m.type !== "land") continue;
      m.progress = Math.min(m.target, this.save.landCount);
      if (m.progress >= m.target) m.done = true;
    }
    saveGame(this.save);
    this.canLand = false;
    this.updateLandAvailability(0);
    if (window.UI) window.UI.refreshMissionRail();
    return true;
  }

  fireGroup(unit, group, team) {
    if (!group || !group.length) return;
    // 找第一门有弹药且冷却好的
    const ready = group.find((st) => st.ammo > 0 && st.cooldown <= 0);
    if (!ready) return;
    const w = ready.weapon;
    this.spawnProjectile(unit.x, unit.y, unit.angle, w, team);
    ready.ammo -= 1;
    ready.cooldown = w.fireRate;
    // 密送中开火极易被记录
    if (this.escortActive && team === "player") {
      this.detection = Math.min(100, this.detection + 8);
    }
  }

  spawnProjectile(x, y, angle, weapon, team) {
    const isMissile = weapon.category === "missile" || weapon.category === "rocket";
    this.projectiles.push({
      x: x + Math.cos(angle) * 24,
      y: y + Math.sin(angle) * 24,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      angle,
      damage: weapon.damage,
      team,
      life: weapon.range / weapon.speed,
      weapon,
      r: isMissile ? 5 : 3,
      guided: weapon.category === "missile",
    });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];

      // 简易导引：导弹朝最近敌方微调
      if (b.guided) {
        const targets = b.team === "enemy" ? this.friendlyUnits() : this.enemies;
        let best = null;
        let bestD = 420;
        for (const t of targets) {
          const d = Math.hypot(t.x - b.x, t.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best) {
          const desired = Math.atan2(best.y - b.y, best.x - b.x);
          let diff = desired - b.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          b.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.8 * dt);
          const sp = Math.hypot(b.vx, b.vy) || b.weapon.speed;
          b.vx = Math.cos(b.angle) * sp;
          b.vy = Math.sin(b.angle) * sp;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (b.team === "player" || b.team === "ally") {
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            e.hp -= b.damage;
            this.burst(b.x, b.y, "#ffc857", b.guided ? 8 : 3);
            this.projectiles.splice(i, 1);
            // 友军击杀的积分/金币也算玩家的
            if (e.hp <= 0) this.killEnemy(j, true);
            hit = true;
            break;
          }
        }
        if (!hit && this.damageIslandAt(b.x, b.y, b.damage, "enemy")) {
          this.burst(b.x, b.y, "#ff8a6a", 5);
          this.projectiles.splice(i, 1);
        }
      } else {
        // 敌弹打玩家与队友 / 集合侦察机
        let hit = false;
        for (const unit of this.friendlyUnits()) {
          if (unit.invuln > 0) continue;
          if (Math.hypot(unit.x - b.x, unit.y - b.y) < 18) {
            unit.hp -= b.damage;
            unit.invuln = 0.55;
            this.burst(b.x, b.y, "#e85d4c", 6);
            this.projectiles.splice(i, 1);
            if (unit === this.player) this.combo = 0;
            hit = true;
            break;
          }
        }
        if (!hit && this.damageIslandAt(b.x, b.y, b.damage, "friendly")) {
          this.burst(b.x, b.y, "#e85d4c", 5);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  /** 炮弹打到小岛：耗血条，归零则易主 */
  damageIslandAt(x, y, damage, targetSide) {
    for (const isle of this.islands) {
      if (Math.hypot(isle.x - x, isle.y - y) > isle.r * 0.72) continue;
      const isEnemyIsle = !!isle.occupied;
      if (targetSide === "enemy" && !isEnemyIsle) continue;
      if (targetSide === "friendly" && isEnemyIsle) continue;
      if (!isle.maxHp) this.resetIslandHp(isle);
      isle.hp = Math.max(0, isle.hp - damage);
      if (isle.hp <= 0) this.flipIslandOwner(isle);
      return true;
    }
    return false;
  }

  flipIslandOwner(isle) {
    const wasEnemy = !!isle.occupied;
    isle.occupied = !wasEnemy;
    isle._raidBase = false;
    this.resetIslandHp(isle);
    if (wasEnemy) {
      // 玩家夺取敌占岛
      isle.temporary = false;
      this.score += 80;
      this.awardCoins(60 + Math.floor(Math.random() * 80), `夺取「${isle.name}」为我方`);
    } else if (window.UI) {
      window.UI.showCombatToast(`警告：「${isle.name}」失守，落入敌手`);
    }
  }

  friendlyUnits() {
    const units = [this.player, ...this.allies.filter((a) => a.hp > 0)];
    if (this.escort && this.escort.vip && this.escort.vip.hp > 0) units.push(this.escort.vip);
    for (const s of this.scouts || []) {
      if (s.hp > 0) units.push(s);
    }
    return units;
  }

  /** —— 民航：和平时期往返各岛/大陆；开战自动返航 —— */
  tickCivilians(dt) {
    this.updateCivilians(dt);
    if (this.combatActive || this.escortActive) return;
    if (this.mode !== "free") return;
    const maxCiv = Math.min(5, Math.max(2, this.islands.length));
    this.civSpawnTimer -= dt;
    if (this.civSpawnTimer > 0) return;
    this.civSpawnTimer = 7 + Math.random() * 8;
    const live = this.civilians.filter((c) => !c.returning).length;
    if (live >= maxCiv) return;
    // 优先刷玩家航司已排班航班（如银河航空），其余再刷普通民航
    if (!this.spawnPlayerAirlineCivilian()) {
      this.spawnCivilian();
    }
  }

  findIslandByName(name) {
    if (!name) return null;
    return this.islands.find((i) => i.name === name) || null;
  }

  civCapacity(c) {
    if (c.playerAirline) return 80 + Math.floor(Math.random() * 40);
    return 40 + Math.floor(Math.random() * 30);
  }

  beginBoarding(c) {
    c.phase = "boarding";
    c.passengers = 0;
    c.capacity = this.civCapacity(c);
    c.boardRate = (c.playerAirline ? 9 : 7) + Math.random() * 6;
    c.x = c.from.runway.x;
    c.y = c.from.runway.y;
    c.angle = Math.atan2(c.to.runway.y - c.from.runway.y, c.to.runway.x - c.from.runway.x);
    c.route = `${c.from.name}→${c.to.name}`;
  }

  /** 和平时：按航司排班（飞行员+机型+航线）起飞往返；仅当前地图上存在的登记航线 */
  spawnPlayerAirlineCivilian() {
    const flights = typeof listedAirlineFlights === "function" ? listedAirlineFlights(this.save) : [];
    if (!flights.length) return false;
    const activePilotIds = new Set(
      this.civilians.filter((c) => c.playerAirline && c.pilotId).map((c) => c.pilotId)
    );
    const pool = flights.filter((f) => {
      if (activePilotIds.has(f.pilot.id)) return false;
      const from = this.findIslandByName(f.fromName);
      const to = this.findIslandByName(f.toName);
      return from && to && from !== to;
    });
    if (!pool.length) return false;
    const job = pool[Math.floor(Math.random() * pool.length)];
    const from = this.findIslandByName(job.fromName);
    const to = this.findIslandByName(job.toName);
    if (!from || !to || from === to) return false;
    const num = 100 + Math.floor(Math.random() * 800);
    const c = {
      x: from.runway.x,
      y: from.runway.y,
      angle: Math.atan2(to.runway.y - from.runway.y, to.runway.x - from.runway.x),
      speed: 58 + Math.random() * 20,
      from,
      to,
      home: from,
      returning: false,
      label: `${job.airlineName}${num}`,
      route: `${from.name}→${to.name}`,
      planeName: job.plane.name,
      pilotName: job.pilot.name,
      pilotId: job.pilot.id,
      playerAirline: true,
      r: 18,
      color: "#ffc857",
      alt: 950 + Math.random() * 350,
      phase: "boarding",
      passengers: 0,
      capacity: 90,
    };
    this.beginBoarding(c);
    this.civilians.push(c);
    return true;
  }

  spawnCivilian() {
    const fields = this.friendlyIslands().length ? this.friendlyIslands() : this.islands;
    if (fields.length < 2) return;
    let from = fields[Math.floor(Math.random() * fields.length)];
    let to = fields[Math.floor(Math.random() * fields.length)];
    let guard = 0;
    while (to === from && guard++ < 8) to = fields[Math.floor(Math.random() * fields.length)];
    if (to === from) return;
    const call = CIVIL_CALLSIGNS[Math.floor(Math.random() * CIVIL_CALLSIGNS.length)];
    const num = 100 + Math.floor(Math.random() * 800);
    const c = {
      x: from.runway.x,
      y: from.runway.y,
      angle: Math.atan2(to.runway.y - from.runway.y, to.runway.x - from.runway.x),
      speed: 55 + Math.random() * 25,
      from,
      to,
      home: from,
      returning: false,
      label: `${call}${num}`,
      route: `${from.name}→${to.name}`,
      r: 18,
      color: "#c8d8e8",
      alt: 900 + Math.random() * 400,
      phase: "boarding",
      passengers: 0,
      capacity: 50,
    };
    this.beginBoarding(c);
    this.civilians.push(c);
  }

  civiliansReturnHome(reason) {
    for (const c of this.civilians) {
      if (c.returning) continue;
      c.returning = true;
      c.phase = "flying";
      const home = c.home || this.nearestFriendlyIsland(c.x, c.y) || this.islands[0];
      c.to = home;
      c.home = home;
    }
    if (reason && this.civilians.length && window.UI) {
      window.UI.showCombatToast(reason);
    }
  }

  /** 抵达后结算票款（玩家航司更高） */
  payoutCivilianTrip(c) {
    if (c.returning) return;
    const pax = Math.max(1, c.passengers || c.capacity || 40);
    let pay;
    if (c.playerAirline) {
      pay = 45 + Math.floor(pax * (0.9 + Math.random() * 1.4));
      pay = Math.min(280, Math.max(50, pay));
    } else {
      pay = 18 + Math.floor(pax * (0.35 + Math.random() * 0.55));
      pay = Math.min(90, Math.max(15, pay));
    }
    const tag = c.playerAirline
      ? `${c.label} 满客抵达 ${c.to.name}`
      : `${c.label} 航班抵达`;
    this.awardCoins(pay, tag);
  }

  updateCivilians(dt) {
    for (let i = this.civilians.length - 1; i >= 0; i--) {
      const c = this.civilians[i];
      const dest = c.to;
      if (!dest) {
        this.civilians.splice(i, 1);
        continue;
      }

      // 候机上客：停在跑道，乘客逐渐坐满再起飞
      if (c.phase === "boarding" && !c.returning) {
        c.x = c.from.runway.x;
        c.y = c.from.runway.y;
        c.passengers = Math.min(c.capacity, c.passengers + (c.boardRate || 8) * dt);
        if (c.passengers >= c.capacity) {
          c.passengers = c.capacity;
          c.phase = "flying";
          if (c.playerAirline && window.UI) {
            window.UI.showCombatToast(`${c.label} 客满起飞 · ${c.route}`);
          }
        }
        continue;
      }

      const desired = Math.atan2(dest.runway.y - c.y, dest.runway.x - c.x);
      let diff = desired - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.sign(diff) * Math.min(Math.abs(diff), 1.4 * dt);
      const spd = c.returning ? c.speed * 1.15 : c.speed;
      c.x += Math.cos(c.angle) * spd * dt;
      c.y += Math.sin(c.angle) * spd * dt;

      if (Math.hypot(c.x - dest.runway.x, c.y - dest.runway.y) < 40) {
        if (c.returning || this.combatActive) {
          this.civilians.splice(i, 1);
          continue;
        }
        this.payoutCivilianTrip(c);
        const nextFrom = c.to;
        const nextTo = c.from;
        c.from = nextFrom;
        c.to = nextTo;
        c.home = nextFrom;
        this.beginBoarding(c);
      }
    }
  }

  /** —— 护送支线：同时起飞，送到目的地，避战避侦测 —— */
  beginEscortMission(mission) {
    if (this.escortActive || this.combatActive) return false;
    const fields = this.friendlyIslands().length >= 2 ? this.friendlyIslands() : this.islands;
    if (fields.length < 2) {
      if (window.UI) window.UI.showCombatToast("可用机场不足，无法执行密送");
      return false;
    }
    // 选相距较远的一对岛
    let best = null;
    let bestD = 0;
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const d = Math.hypot(fields[i].x - fields[j].x, fields[i].y - fields[j].y);
        if (d > bestD) {
          bestD = d;
          best = [fields[i], fields[j]];
        }
      }
    }
    if (!best) best = [fields[0], fields[1]];
    const [origin, dest] = Math.random() < 0.5 ? best : [best[1], best[0]];

    // 与要员同时从起点出发
    const p = this.player;
    p.x = origin.runway.x + 30;
    p.y = origin.runway.y + 20;
    p.alt = 120;
    p.grounded = false;
    p.waterTaxi = false;
    p.angle = Math.atan2(dest.runway.y - origin.runway.y, dest.runway.x - origin.runway.x);
    p.vx = Math.cos(p.angle) * 80;
    p.vy = Math.sin(p.angle) * 80;
    this.camX = p.x;
    this.camY = p.y;

    const vipAngle = p.angle;
    const vip = {
      x: origin.runway.x - 25,
      y: origin.runway.y - 15,
      angle: vipAngle,
      vx: Math.cos(vipAngle) * 70,
      vy: Math.sin(vipAngle) * 70,
      hp: 55,
      maxHp: 55,
      speed: 95,
      turn: 1.6,
      r: 17,
      invuln: 1,
      team: "ally",
      label: "要员专机",
      color: "#e8d4a8",
      escortVip: true,
    };

    this.escortActive = true;
    this.detection = 0;
    this.escort = {
      mission: mission || null,
      origin,
      dest,
      vip,
      startedAt: this.aliveTime,
      delivered: false,
      failed: false,
    };

    // 民航避让
    this.civiliansReturnHome("密送开始，民航机紧急返航");

    // 少量侦察机（不扩图开战，只巡逻记录）
    this.enemies = [];
    for (let i = 0; i < 2; i++) {
      this.spawnReconNearRoute(origin, dest, i);
    }

    if (mission) {
      this.escort.progressBase = mission.progress || 0;
    }

    if (window.UI) {
      window.UI.refreshMissionRail();
      window.UI.showCombatToast(
        `密送任务：与要员同时起飞 ${origin.name} → ${dest.name} · 护送抵达，避免交战与被记录`
      );
    }
    return true;
  }

  spawnReconNearRoute(origin, dest, index) {
    const t = 0.25 + index * 0.35;
    const mx = origin.x + (dest.x - origin.x) * t;
    const my = origin.y + (dest.y - origin.y) * t;
    const side = index % 2 === 0 ? 1 : -1;
    const nx = -(dest.y - origin.y);
    const ny = dest.x - origin.x;
    const len = Math.hypot(nx, ny) || 1;
    const x = mx + (nx / len) * (180 + index * 60) * side;
    const y = my + (ny / len) * (180 + index * 60) * side;
    this.enemies.push({
      x: Math.max(60, Math.min(this.worldSize - 60, x)),
      y: Math.max(60, Math.min(this.worldSize - 60, y)),
      angle: Math.atan2(my - y, mx - x),
      hp: 28,
      maxHp: 28,
      speed: 70 + Math.random() * 20,
      turn: 1.5,
      r: 13,
      fireCd: 99,
      missileCd: 99,
      gunDamage: 2,
      missileDamage: 8,
      tier: 0,
      color: "#9aa8b8",
      team: "enemy",
      recon: true,
      label: "敌侦察机",
      homeIsle: null,
    });
  }

  tickEscort(dt) {
    if (!this.escortActive || !this.escort) return;
    const esc = this.escort;
    const vip = esc.vip;
    if (!vip || vip.hp <= 0) {
      this.failEscort("要员专机被击落，密送失败");
      return;
    }

    // 要员飞向目的地（略跟玩家，但不强求）
    const dest = esc.dest;
    const desired = Math.atan2(dest.runway.y - vip.y, dest.runway.x - vip.x);
    let diff = desired - vip.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    vip.angle += Math.sign(diff) * Math.min(Math.abs(diff), vip.turn * dt);
    vip.x += Math.cos(vip.angle) * vip.speed * dt;
    vip.y += Math.sin(vip.angle) * vip.speed * dt;
    vip.invuln = Math.max(0, vip.invuln - dt);

    // 侦察记录：靠近玩家/要员则升侦测（机身由 updateEnemies 移动）
    for (const e of this.enemies) {
      if (!e.recon) continue;
      const dPlayer = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      const dVip = Math.hypot(e.x - vip.x, e.y - vip.y);
      if (dPlayer < 260) this.detection = Math.min(100, this.detection + dt * (16 + (260 - dPlayer) * 0.035));
      if (dVip < 240) this.detection = Math.min(100, this.detection + dt * (12 + (240 - dVip) * 0.028));
      if (dPlayer >= 320 && dVip >= 300) this.detection = Math.max(0, this.detection - dt * 3.5);
    }

    // 玩家主动交战惩罚
    if (this.keys[" "] || this.keys["j"] || this.keys["q"] || this.keys["e"] || this.keys["g"] || this.keys["k"] || this.keys["f"]) {
      this.detection = Math.min(100, this.detection + dt * 28);
    }

    if (this.detection >= 100) {
      this.failEscort("行动已被敌方记录，密送失败");
      return;
    }

    // 抵达
    if (Math.hypot(vip.x - dest.runway.x, vip.y - dest.runway.y) < 55) {
      this.completeEscort();
    }
  }

  completeEscort() {
    if (!this.escortActive || !this.escort) return;
    const esc = this.escort;
    const mission = esc.mission;
    this.score += 120;
    if (mission) {
      mission.progress = mission.target;
      mission.done = true;
      saveGame(this.save);
    }
    this.escortActive = false;
    this.enemies = this.enemies.filter((e) => !e.recon);
    this.escort = null;
    this.detection = 0;
    if (window.UI) {
      window.UI.refreshMissionRail();
      window.UI.showCombatToast("要员已安全抵达，密送成功");
    }
  }

  failEscort(reason) {
    if (!this.escortActive) return;
    this.escortActive = false;
    this.enemies = this.enemies.filter((e) => !e.recon);
    this.escort = null;
    this.detection = 0;
    if (window.UI) {
      window.UI.refreshMissionRail();
      window.UI.showCombatToast(reason || "密送失败");
    }
  }

  spawnLogic(dt) {
    // 自由飞行：和平刷民航；支线战斗才刷敌；护送另计；偶发袭扰
    if (this.mode === "free") {
      this.tickCombatEventChance(dt);
      this.tickCivilians(dt);
      this.tickEscort(dt);
      this.tickPeaceRaid(dt);
      if (!this.combatActive) return;
    }

    if (!this.combatActive && this.mode === "free") return;

    const density =
      this.map.enemyDensity *
      (this.mode === "survive" ? 1.5 + this.aliveTime * 0.02 : 1) *
      (this.teamMode ? 1.25 : 1) *
      (this.combatActive ? 1.2 : 1);
    const maxEnemies = Math.min(
      16,
      Math.floor(3 + density * 4 + (this.mode === "survive" ? this.aliveTime / 20 : 0) + (this.teamMode ? 2 : 0))
    );
    this.spawnTimer += dt;
    const interval = Math.max(0.55, 2.2 / density);
    if (this.spawnTimer >= interval && this.enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnEnemyNearOccupied(density);
    }
    if (this.combatActive) this.tickCombatAllyReinforce(dt);
  }

  /** 和平偶发：敌战斗机袭击集合/侦察机与巡逻编队 */
  tickPeaceRaid(dt) {
    if (this.combatActive || this.escortActive) return;
    // 清理已结束的袭扰
    const raiders = this.enemies.filter((e) => e.raid);
    if (raiders.length) {
      this._raidLife = (this._raidLife || 0) + dt;
      if (this._raidLife > 55 || raiders.every((e) => e.hp <= 0)) {
        this.enemies = this.enemies.filter((e) => !e.raid);
        this._raidLife = 0;
        this.raidTimer = 40 + Math.random() * 45;
      }
      return;
    }

    this.raidTimer = (this.raidTimer ?? 40) - dt;
    if (this.raidTimer > 0) return;
    this.raidTimer = 55 + Math.random() * 50;
    this._raidLife = 0;

    // 保证天上有集合/侦察机可被盯
    if (!this.scouts.length) this.spawnGatherScouts(2);

    const fields = this.occupiedIslands().length
      ? this.occupiedIslands()
      : this.islands.filter((i) => !i.continent);
    const origin = fields.length
      ? fields[Math.floor(Math.random() * fields.length)]
      : this.islands[Math.floor(Math.random() * this.islands.length)];
    if (!origin) return;

    // 临时把一座边缘小岛标为敌占，方便起飞；袭扰结束不强制清（可被血条夺回）
    if (!origin.occupied && !origin.continent) {
      this.markIslandOccupied(origin, true);
      origin._raidBase = true;
    }

    const n = 2 + (Math.random() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = origin.x + Math.cos(ang) * (origin.r * 0.4 + 40);
      const y = origin.y + Math.sin(ang) * (origin.r * 0.4 + 40);
      this.spawnEnemyAt(x, y, 1.2 + Math.random(), origin);
      const e = this.enemies[this.enemies.length - 1];
      if (e) {
        e.raid = true;
        e.label = "敌袭扰机";
        e.color = "#e07060";
      }
    }
    if (window.UI) {
      window.UI.showCombatToast("敌战斗机编队出现，正在袭击集合/侦察机！");
    }
  }

  /**
   * 支线战斗 / 密送：仅当玩家在任务条主动点击「开始」时触发。
   * 此处只负责已开战局的收尾，绝不自动弹出战斗或密送。
   */
  tickCombatEventChance(dt) {
    if (this.escortActive) return;
    if (!this.combatActive) return;
    if (this.combatMission && this.combatMission.done) {
      this.combatBanner = Math.max(this.combatBanner, 0.01);
      this._combatEndDelay = (this._combatEndDelay || 0) + dt;
      if (this._combatEndDelay > 2.5) {
        this.endCombatEvent("支线完成，敌占区解除");
      }
    }
  }

  /**
   * 开启战斗事件：临时扩图 + 敌占红岛 + 刷敌
   */
  beginCombatEvent(mission, opts = {}) {
    if (this.combatActive || this.escortActive) return;
    this.civiliansReturnHome("战时警报：民航机全部返航避险");
    this.combatActive = true;
    this.combatMission = mission || null;
    this._combatEndDelay = 0;
    this.combatBanner = 4.5;
    this.killsAtCombatStart = this.kills;
    this.scoreAtCombatStart = this.score;
    this.combatSurviveStart = this.aliveTime;
    this.combatKillBase = mission && mission.type === "kill" ? mission.progress : 0;
    this.combatScoreBase = mission && mission.type === "score" ? mission.progress : 0;
    this.combatSurviveBase = mission && mission.type === "survive" ? mission.progress : 0;

    const expand = opts.expand !== false;
    if (expand) {
      this.baseWorldSize = this.baseWorldSize || this.worldSize;
      const grow = 1.35;
      this.worldSize = Math.floor(this.baseWorldSize * grow);
      // 在扩大区域生成 1～2 座敌占岛
      const extra = 1 + (Math.random() < 0.5 ? 1 : 0);
      this.tempIslands = [];
      for (let i = 0; i < extra; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = this.baseWorldSize * 0.42 + Math.random() * this.baseWorldSize * 0.12;
        const cx = this.baseWorldSize / 2 + Math.cos(ang) * dist;
        const cy = this.baseWorldSize / 2 + Math.sin(ang) * dist;
        const isle = this.makeIsland(cx, cy, 160 + Math.random() * 80, false, {
          name: "敌占岛·" + (i + 1),
          runwayAngle: Math.random() * 0.6 - 0.3,
        });
        this.markIslandOccupied(isle, true);
        isle.temporary = true;
        this.islands.push(isle);
        this.tempIslands.push(isle);
      }
    }

    // 原有小岛里随机 1 座（非最大大陆）标为敌占
    const candidates = this.islands.filter((i) => !i.continent && !i.occupied);
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.markIslandOccupied(pick, true);
    } else if (this.islands.length) {
      // 若只有大陆，也标一座
      const sorted = [...this.islands].sort((a, b) => a.r - b.r);
      this.markIslandOccupied(sorted[0], true);
    }

    // 初始敌机出现在敌占岛附近
    for (let i = 0; i < 4; i++) {
      this.spawnEnemyNearOccupied(1.0 + Math.random());
    }

    // 遭遇战友军自动起飞，并启动周期性增援计时
    this.allyReinforceTimer = COMBAT_REINFORCE_INTERVAL;
    if (this.mode === "free" || opts.expand) {
      this.spawnCombatSupportAllies();
    }

    if (window.UI) {
      window.UI.refreshMissionRail();
      window.UI.showCombatToast(
        mission
          ? `支线遭遇战：${mission.title} — 友军编队已起飞，红色岛屿为敌占区`
          : `战斗开始 — 海域扩大，红色岛屿为敌占区`
      );
    }
  }

  endCombatEvent(reason) {
    if (!this.combatActive) return;
    this.combatActive = false;
    this.combatMission = null;
    this._combatEndDelay = 0;
    this.enemies = this.enemies.filter((e) => e.raid);
    this.allies = this.allies.filter((a) => !a.combatSupport);
    this.civSpawnTimer = 6;
    // 临时敌岛：未夺取则移除；已夺取（occupied=false）留作友方永久岛
    const keptTemp = [];
    for (const isle of this.islands) {
      if (!isle.temporary) continue;
      if (!isle.occupied) {
        isle.temporary = false;
        keptTemp.push(isle.name);
      }
    }
    this.islands = this.islands.filter((i) => !i.temporary);
    this.tempIslands = [];
    // 永久岛保留当前归属（血条打空易主后继续有效）
    for (const isle of this.islands) this.resetIslandHp(isle);
    if (this.baseWorldSize) {
      this.worldSize = this.baseWorldSize;
      const p = this.player;
      p.x = Math.max(40, Math.min(this.worldSize - 40, p.x));
      p.y = Math.max(40, Math.min(this.worldSize - 40, p.y));
    }
    this.combatBanner = 3;
    if (window.UI) {
      window.UI.refreshMissionRail();
      let msg = reason || "战区结束";
      if (keptTemp.length) msg += ` · 收复 ${keptTemp.join("、")}`;
      window.UI.showCombatToast(msg);
    }
  }

  /** 敌机只能从己方占领的小岛/大陆跑道起飞 */
  spawnEnemyNearOccupied(density) {
    const occupied = this.occupiedIslands();
    if (!occupied.length) return;
    const isle = occupied[Math.floor(Math.random() * occupied.length)];
    const side = Math.random() < 0.5 ? 1 : -1;
    const along = (Math.random() - 0.5) * isle.runway.length * 0.6;
    const ca = Math.cos(isle.runway.angle);
    const sa = Math.sin(isle.runway.angle);
    let x = isle.runway.x + ca * along - sa * side * (18 + Math.random() * 20);
    let y = isle.runway.y + sa * along + ca * side * (18 + Math.random() * 20);
    // 刚离地：沿跑道方向略微前移
    const takeoff = isle.runway.angle - Math.PI / 2;
    x += Math.cos(takeoff) * (40 + Math.random() * 50);
    y += Math.sin(takeoff) * (40 + Math.random() * 50);
    x = Math.max(60, Math.min(this.worldSize - 60, x));
    y = Math.max(60, Math.min(this.worldSize - 60, y));
    this.spawnEnemyAt(x, y, density, isle);
  }

  spawnEnemy(density) {
    // 非遭遇战：仍要求有敌占岛才刷；没有则不刷
    this.spawnEnemyNearOccupied(density);
  }

  spawnEnemyAt(x, y, density, homeIsle = null) {
    const p = this.player;
    const tier = Math.min(4, Math.floor(density + Math.random() * 2));
    const gunDmg = 5 + tier * 2;
    const missileDmg = 30 + tier * 10;
    let angle = Math.atan2(p.y - y, p.x - x);
    if (homeIsle) angle = Math.atan2(p.y - y, p.x - x);
    this.enemies.push({
      x,
      y,
      angle,
      hp: 24 + tier * 20,
      maxHp: 24 + tier * 20,
      speed: 90 + tier * 25 + Math.random() * 30,
      turn: 1.2 + tier * 0.25,
      r: 14 + tier,
      fireCd: 1 + Math.random(),
      missileCd: 3 + Math.random() * 2,
      gunDamage: gunDmg,
      missileDamage: missileDmg,
      tier,
      color: ["#c07070", "#d4883a", "#c9a227", "#e85d4c", "#ff7a6a"][tier],
      team: "enemy",
      homeIsle: homeIsle ? homeIsle.name : null,
    });
  }

  updateEnemies(dt) {
    const friendlies = this.friendlyUnits();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // 追最近友军；袭扰机优先打集合/侦察机；战区敌机也可去砸友方小岛血条
      let target = this.player;
      let best = Infinity;
      let islandTarget = null;
      for (const f of friendlies) {
        let d = Math.hypot(f.x - e.x, f.y - e.y);
        if (e.raid && f.scout) d *= 0.55;
        if (d < best) {
          best = d;
          target = f;
        }
      }
      if (this.combatActive && (!target || best > 520)) {
        for (const isle of this.friendlyIslands()) {
          const d = Math.hypot(isle.x - e.x, isle.y - e.y);
          if (d < best) {
            best = d;
            islandTarget = isle;
            target = { x: isle.runway.x, y: isle.runway.y };
          }
        }
      }

      const desired = Math.atan2(target.y - e.y, target.x - e.x);
      let diff = desired - e.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.angle += Math.sign(diff) * Math.min(Math.abs(diff), e.turn * dt);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;

      e.fireCd -= dt;
      e.missileCd -= dt;
      const dist = Math.hypot(target.x - e.x, target.y - e.y);

      if (e.fireCd <= 0 && dist < 500 && Math.abs(diff) < 0.45) {
        // 敌机炮（打到友方岛上也会扣血条）
        this.projectiles.push({
          x: e.x + Math.cos(e.angle) * 20,
          y: e.y + Math.sin(e.angle) * 20,
          vx: Math.cos(e.angle) * 320,
          vy: Math.sin(e.angle) * 320,
          angle: e.angle,
          damage: e.gunDamage,
          team: "enemy",
          life: 1.4,
          weapon: { category: "gun", name: "敌机炮", damage: e.gunDamage },
          r: 3,
          guided: false,
        });
        e.fireCd = 0.9 - e.tier * 0.1 + Math.random() * 0.35;
        if (islandTarget && dist < islandTarget.r * 0.9) {
          this.damageIslandAt(islandTarget.x, islandTarget.y, e.gunDamage * 0.85, "friendly");
        }
      }

      if (e.missileCd <= 0 && dist < 620 && Math.abs(diff) < 0.55) {
        this.projectiles.push({
          x: e.x + Math.cos(e.angle) * 22,
          y: e.y + Math.sin(e.angle) * 22,
          vx: Math.cos(e.angle) * 360,
          vy: Math.sin(e.angle) * 360,
          angle: e.angle,
          damage: e.missileDamage,
          team: "enemy",
          life: 1.8,
          weapon: { category: "missile", name: "敌导弹", damage: e.missileDamage },
          r: 5,
          guided: true,
        });
        e.missileCd = 4.5 - e.tier * 0.4;
      }

      // 撞击
      for (const f of friendlies) {
        if (f.invuln > 0) continue;
        if (Math.hypot(f.x - e.x, f.y - e.y) < e.r + 16) {
          f.hp -= 10 + e.tier * 3;
          e.hp -= 22;
          f.invuln = 0.75;
          this.burst((f.x + e.x) / 2, (f.y + e.y) / 2, "#e85d4c", 10);
          if (f === this.player) this.combo = 0;
          // 撞击击落（含友军）均计入玩家战绩
          if (e.hp <= 0) this.killEnemy(i, true);
          break;
        }
      }
    }

    // 移除阵亡队友
    this.allies = this.allies.filter((a) => a.hp > 0);
  }

  updateAllies(dt) {
    if (!this.allies.length) return;
    const fields = this.friendlyIslands().length ? this.friendlyIslands() : this.islands;
    for (const a of this.allies) {
      this.tickWeaponCooldowns(a.weapons, dt);
      a.invuln = Math.max(0, a.invuln - dt);

      // 编队 / 巡逻：有敌人则接战
      let target = null;
      let best = 700;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        if (d < best) {
          best = d;
          target = e;
        }
      }

      let desiredAngle;
      let thrust = 0.85;
      if (target) {
        desiredAngle = Math.atan2(target.y - a.y, target.x - a.x);
        thrust = 1;
      } else if (a.patrol && fields.length) {
        if (!a.patrolTarget || Math.hypot(a.x - a.patrolTarget.runway.x, a.y - a.patrolTarget.runway.y) < 70) {
          a.patrolTimer = (a.patrolTimer || 0) - dt;
          if (!a.patrolTarget || a.patrolTimer <= 0) {
            a.patrolTarget = fields[Math.floor(Math.random() * fields.length)];
            a.patrolTimer = 6 + Math.random() * 8;
          }
        }
        const tx = a.patrolTarget.runway.x;
        const ty = a.patrolTarget.runway.y;
        desiredAngle = Math.atan2(ty - a.y, tx - a.x);
        thrust = Math.hypot(tx - a.x, ty - a.y) < 90 ? 0.45 : 0.9;
      } else {
        const formX = this.player.x - Math.cos(this.player.angle) * 80 + Math.sin(this.player.angle) * 60;
        const formY = this.player.y - Math.sin(this.player.angle) * 80 - Math.cos(this.player.angle) * 60;
        desiredAngle = Math.atan2(formY - a.y, formX - a.x);
        if (Math.hypot(formX - a.x, formY - a.y) < 50) thrust = 0.4;
      }

      let diff = desiredAngle - a.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.angle += Math.sign(diff) * Math.min(Math.abs(diff), a.turn * dt);

      a.vx = Math.cos(a.angle) * a.speed * thrust;
      a.vy = Math.sin(a.angle) * a.speed * thrust;
      a.x = Math.max(40, Math.min(this.worldSize - 40, a.x + a.vx * dt));
      a.y = Math.max(40, Math.min(this.worldSize - 40, a.y + a.vy * dt));

      if (target && Math.abs(diff) < 0.4) {
        if (best < 480) this.fireGroup(a, a.weapons.guns, "ally");
        if (best < 560 && Math.random() < 0.02) this.fireGroup(a, a.weapons.shorts, "ally");
        if (best < 700 && Math.random() < 0.012) this.fireGroup(a, a.weapons.mediums, "ally");
      }
    }
  }

  updateScouts(dt) {
    if (!this.scouts || !this.scouts.length) return;
    const fields = this.friendlyIslands().length ? this.friendlyIslands() : this.islands;
    for (let i = this.scouts.length - 1; i >= 0; i--) {
      const s = this.scouts[i];
      if (s.hp <= 0) {
        this.burst(s.x, s.y, s.color || "#7ec8e8", 10);
        this.scouts.splice(i, 1);
        continue;
      }
      s.invuln = Math.max(0, (s.invuln || 0) - dt);
      if (!s.to || !fields.length) continue;
      const dest = s.to;
      const desired = Math.atan2(dest.runway.y - s.y, dest.runway.x - s.x);
      let diff = desired - s.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.angle += Math.sign(diff) * Math.min(Math.abs(diff), s.turn * dt);
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;
      if (Math.hypot(s.x - dest.runway.x, s.y - dest.runway.y) < 50) {
        s.from = dest;
        s.to = fields[Math.floor(Math.random() * fields.length)];
        if (s.to === s.from && fields.length > 1) {
          s.to = fields[(fields.indexOf(s.from) + 1) % fields.length];
        }
      }
    }
    // 和平时保持至少 1 架集合/侦察机在空
    if (
      this.mode === "free" &&
      !this.combatActive &&
      !this.escortActive &&
      this.scouts.length < 1
    ) {
      this.spawnGatherScouts(2);
    }
  }

  killEnemy(index, creditPlayer = true) {
    const e = this.enemies[index];
    if (!e) return;
    this.burst(e.x, e.y, e.color, 16);
    this.enemies.splice(index, 1);
    if (creditPlayer) {
      this.kills += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 40 + e.tier * 30 + this.combo * 5;
    } else {
      this.score += 20 + e.tier * 15;
    }
    if (Math.random() < 0.28) this.spawnPickup(e.x, e.y, Math.random() < 0.5 ? "heal" : "ammo");
  }

  spawnPickup(x, y, type) {
    this.pickups.push({ x, y, type, life: 12, bob: Math.random() * Math.PI * 2 });
  }

  updatePickups(dt) {
    const units = this.friendlyUnits();
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.life -= dt;
      u.bob += dt * 3;
      if (u.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      for (const unit of units) {
        if (Math.hypot(u.x - unit.x, u.y - unit.y) < 28) {
          if (u.type === "heal") unit.hp = Math.min(unit.maxHp, unit.hp + 25);
          if (u.type === "ammo") this.restockWeapons(unit === this.player ? this.weapons : unit.weapons);
          if (u.type === "coin") this.score += 50;
          this.burst(u.x, u.y, "#3db88a", 8);
          this.pickups.splice(i, 1);
          break;
        }
      }
    }
  }

  restockWeapons(bag) {
    for (const list of [bag.guns, bag.shorts, bag.mediums, bag.heavies]) {
      for (const st of list) {
        st.ammo = Math.min(st.weapon.ammo, st.ammo + Math.ceil(st.weapon.ammo * 0.4));
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  checkMissionProgress() {
    const lives = allMissions(this.save);
    let changed = false;
    const combatKills = this.kills - (this.killsAtCombatStart || 0);
    const combatScore = this.score - (this.scoreAtCombatStart || 0);
    const combatSurvive = Math.floor(this.aliveTime - (this.combatSurviveStart || 0));

    for (const live of lives) {
      if (live.done || live.claimed) continue;
      let next = live.progress;
      if (live.type === "explore") {
        next = Math.max(next, Math.min(live.target, Math.floor(this.aliveTime)));
      } else if (live.type === "land") {
        // 降落任务在 requestLanding 更新
      } else if (live.combat) {
        // 战斗类任务只在战斗事件中推进
        if (!this.combatActive) continue;
        if (live.type === "kill") {
          next = Math.min(live.target, (this.combatKillBase || 0) + combatKills);
        } else if (live.type === "score") {
          next = Math.min(live.target, (this.combatScoreBase || 0) + Math.floor(combatScore));
        } else if (live.type === "survive") {
          next = Math.min(live.target, (this.combatSurviveBase || 0) + combatSurvive);
        } else if (live.type === "combo") {
          next = Math.max(next, Math.min(live.target, this.maxCombo));
        }
      } else {
        if (live.type === "kill") next = Math.max(next, Math.min(live.target, this.kills));
        else if (live.type === "score") next = Math.max(next, Math.min(live.target, Math.floor(this.score)));
        else if (live.type === "survive") next = Math.max(next, Math.min(live.target, Math.floor(this.aliveTime)));
        else if (live.type === "combo") next = Math.max(next, Math.min(live.target, this.maxCombo));
      }
      if (next !== live.progress) {
        live.progress = next;
        changed = true;
      }
      if (live.progress >= live.target) {
        live.done = true;
        changed = true;
      }
    }
    if (changed) {
      saveGame(this.save);
      if (window.UI) window.UI.refreshMissionRail();
    }
  }

  syncHud() {
    const p = this.player;
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    const fuelPct = Math.max(0, p.fuel / p.maxFuel) * 100;

    const kmhEl = document.getElementById("dash-kmh");
    const altEl = document.getElementById("dash-alt");
    const fill = document.getElementById("hp-fill");
    const scoreEl = document.getElementById("hud-score");
    const fuelFill = document.getElementById("fuel-fill");
    const fuelText = document.getElementById("fuel-text");
    const combatEl = document.getElementById("combat-banner");
    const alliesWrap = document.getElementById("dash-allies");
    const alliesEl = document.getElementById("hud-allies");

    if (kmhEl) kmhEl.textContent = String(p.kmh || 0);
    if (altEl) altEl.textContent = String(Math.round(p.alt || 0));
    if (fill) fill.style.width = `${hpPct}%`;
    if (scoreEl) scoreEl.textContent = String(Math.floor(this.score));
    if (fuelFill) {
      fuelFill.style.width = `${fuelPct}%`;
      fuelFill.classList.toggle("low", fuelPct <= 20);
      fuelFill.classList.toggle("empty", fuelPct <= 0);
    }
    if (fuelText) {
      fuelText.textContent =
        p.waterTaxi
          ? "浮筒返航中"
          : p.grounded
            ? "已降落 · 按 W 起飞"
            : fuelPct <= 0
              ? "燃油耗尽 · 缓降中"
              : `${Math.round(fuelPct)}%`;
    }

    const allyCount = this.allies.filter((a) => a.hp > 0).length;
    if (alliesEl) alliesEl.textContent = String(allyCount);
    if (alliesWrap) alliesWrap.classList.toggle("hidden", allyCount <= 0);

    if (combatEl) {
      const raidCount = this.enemies.filter((e) => e.raid).length;
      if (this.escortActive && this.escort) {
        combatEl.classList.remove("hidden");
        const destName = this.escort.dest ? this.escort.dest.name : "目的地";
        combatEl.textContent = `🛡 密送中 → ${destName} · 侦测 ${Math.round(this.detection)}% · 勿交战、拉开侦察机`;
      } else if (this.combatActive) {
        combatEl.classList.remove("hidden");
        const title = this.combatMission ? this.combatMission.title : "战斗中";
        combatEl.textContent = `⚔ ${title} · 友军 ${allyCount} · 打空敌岛血条可夺取`;
      } else if (raidCount > 0) {
        combatEl.classList.remove("hidden");
        combatEl.textContent = `⚠ 敌袭扰机 ${raidCount} · 正在攻击集合/侦察机 · 可还击并夺取敌占岛`;
      } else {
        combatEl.classList.add("hidden");
      }
    }

    const ammoEl = document.getElementById("hud-ammo");
    if (ammoEl) {
      const g = this.weapons.guns[0];
      const s = this.weapons.shorts.find((x) => x.ammo > 0) || this.weapons.shorts[0];
      const m = this.weapons.mediums.find((x) => x.ammo > 0) || this.weapons.mediums[0];
      const h = this.weapons.heavies.find((x) => x.ammo > 0) || this.weapons.heavies[0];
      const parts = [];
      if (g) parts.push(`机炮 ${g.ammo}`);
      if (s) parts.push(`短弹 ${this.sumAmmo(this.weapons.shorts)}`);
      if (m) parts.push(`中弹 ${this.sumAmmo(this.weapons.mediums)}`);
      if (h) parts.push(`火箭 ${this.sumAmmo(this.weapons.heavies)}`);
      if (allyCount > 0) parts.push(`友军 ${allyCount}`);
      if (this.combatActive) parts.push("战斗中");
      if (this.landFlash > 0) parts.push("已补给");
      ammoEl.textContent = parts.join(" · ") || "无武器";
    }
  }

  sumAmmo(list) {
    return list.reduce((n, st) => n + st.ammo, 0);
  }

  endGame(manual) {
    if (!this.running) return;
    this.running = false;
    const coinsGain = Math.floor(this.score / 4) + this.kills * 15;
    this.save.coins += coinsGain;
    this.save.totalScore += this.score;
    this.save.stats.kills += this.kills;
    this.save.stats.flights += 1;
    this.save.stats.playTime += Math.floor(this.aliveTime);

    if (this.mode === "free") addProgress(this.save, "explore", Math.floor(this.aliveTime));
    else {
      addProgress(this.save, "kill", this.kills);
      addProgress(this.save, "score", this.score);
      addProgress(this.save, "survive", Math.floor(this.aliveTime));
      addProgress(this.save, "combo", this.maxCombo);
    }

    unlockCheck(this.save);
    saveGame(this.save);

    this.onEnd({
      win: manual || this.player.hp > 0,
      score: Math.floor(this.score),
      kills: this.kills,
      coins: coinsGain + (this.sessionCoins || 0),
      time: Math.floor(this.aliveTime),
      combo: this.maxCombo,
      crashed: this.player.hp <= 0,
      alliesLeft: this.allies.length,
    });
  }

  // —— 绘制 ——
  draw() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0d3a58");
    g.addColorStop(1, "#071828");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 - this.camX, h / 2 - this.camY);
    this.drawOceanFloor(ctx);
    this.drawIslands(ctx);
    this.drawWaypoints(ctx);
    this.drawClouds(ctx);
    this.drawPickups(ctx);
    this.drawProjectiles(ctx);
    this.drawCivilians(ctx);
    this.drawScouts(ctx);
    this.drawEnemies(ctx);
    this.drawAllies(ctx);
    this.drawEscortVip(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    this.drawBoundary(ctx);
    ctx.restore();
    this.drawMinimap(ctx);
  }

  drawOceanFloor(ctx) {
    ctx.strokeStyle = "rgba(30, 107, 154, 0.15)";
    ctx.lineWidth = 1;
    const step = 200;
    for (let x = 0; x <= this.worldSize; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.worldSize);
      ctx.stroke();
    }
    for (let y = 0; y <= this.worldSize; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.worldSize, y);
      ctx.stroke();
    }
  }

  drawIslands(ctx) {
    for (const isle of this.islands) {
      const n = isle.peaks.length;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const idx = i % n;
        const a = (idx / n) * Math.PI * 2;
        const rr = isle.r * isle.peaks[idx];
        const x = isle.x + Math.cos(a) * rr;
        const y = isle.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(isle.x, isle.y, 10, isle.x, isle.y, isle.r);
      if (isle.occupied) {
        // 敌占区：红色
        grad.addColorStop(0, "#8a3030");
        grad.addColorStop(0.55, "#5a2020");
        grad.addColorStop(1, "#a07050");
      } else if (isle.continent) {
        grad.addColorStop(0, "#2f6b45");
        grad.addColorStop(0.55, "#24553a");
        grad.addColorStop(1, "#b8a878");
      } else {
        grad.addColorStop(0, "#3a8b5a");
        grad.addColorStop(0.6, "#2a6b4a");
        grad.addColorStop(1, "#c8b87a");
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = isle.occupied ? "rgba(232, 93, 76, 0.85)" : "rgba(200, 184, 122, 0.4)";
      ctx.lineWidth = isle.occupied ? 3 : 2;
      ctx.stroke();

      if (isle.occupied) {
        ctx.fillStyle = "rgba(255, 100, 80, 0.95)";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("敌占", isle.x, isle.y - isle.r * 0.15);
      }

      // 血条：敌占岛常显；友方岛受伤时显示
      const maxHp = isle.maxHp || 1;
      const showBar = isle.occupied || isle.hp < maxHp - 0.5;
      if (showBar) {
        const bw = Math.max(48, isle.r * 0.55);
        const bh = 6;
        const bx = isle.x - bw / 2;
        const by = isle.y - isle.r * 0.55;
        const pct = Math.max(0, Math.min(1, isle.hp / maxHp));
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = isle.occupied ? "#e85d4c" : "#3db88a";
        ctx.fillRect(bx, by, bw * pct, bh);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);
      }

      // 机场跑道（敌占岛跑道也画，但偏红）
      this.drawRunway(ctx, isle);
    }
  }

  drawRunway(ctx, isle) {
    const rw = isle.runway;
    if (!rw) return;
    ctx.save();
    ctx.translate(rw.x, rw.y);
    ctx.rotate(rw.angle);
    // 道面
    ctx.fillStyle = "rgba(55, 62, 70, 0.92)";
    ctx.fillRect(-rw.length / 2, -rw.width / 2, rw.length, rw.width);
    ctx.strokeStyle = this.activeRunway === isle ? "rgba(61, 184, 138, 0.95)" : "rgba(255, 200, 87, 0.75)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-rw.length / 2, -rw.width / 2, rw.length, rw.width);
    // 中线
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(-rw.length / 2 + 8, 0);
    ctx.lineTo(rw.length / 2 - 8, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    // 端线
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(-rw.length / 2 + 4, -rw.width / 2 + 2, 6, rw.width - 4);
    ctx.fillRect(rw.length / 2 - 10, -rw.width / 2 + 2, 6, rw.width - 4);
    ctx.restore();

    ctx.fillStyle = "rgba(255, 200, 87, 0.9)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isle.name || "机场", rw.x, rw.y - rw.width / 2 - 14);
  }

  drawWaypoints(ctx) {
    if (this.mode !== "free") return;
    for (const w of this.waypoints) {
      if (w.taken) continue;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 200, 87, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w.x, w.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffc857";
      ctx.fill();
    }
  }

  drawClouds(ctx) {
    for (const c of this.clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 230, 245, ${c.a})`;
      ctx.fill();
    }
  }

  drawPickups(ctx) {
    for (const u of this.pickups) {
      const bob = Math.sin(u.bob) * 4;
      ctx.beginPath();
      ctx.arc(u.x, u.y + bob, 8, 0, Math.PI * 2);
      ctx.fillStyle = u.type === "heal" ? "#3db88a" : u.type === "ammo" ? "#4a9fd4" : "#e8a838";
      ctx.fill();
    }
  }

  drawProjectiles(ctx) {
    for (const b of this.projectiles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      if (b.weapon.category === "missile" || b.weapon.category === "rocket") {
        ctx.fillStyle = b.team === "enemy" ? "#e85d4c" : "#ffc857";
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillStyle = "rgba(255,140,60,0.8)";
        ctx.fillRect(-10, -1.5, 4, 3);
      } else {
        ctx.fillStyle = b.team === "enemy" ? "#ff8a7a" : "#ffe08a";
        ctx.beginPath();
        ctx.arc(0, 0, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCivilians(ctx) {
    for (const c of this.civilians) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      const body = c.playerAirline
        ? c.returning
          ? "rgba(255, 200, 87, 0.45)"
          : "rgba(255, 200, 87, 0.95)"
        : c.returning
          ? "rgba(200, 210, 220, 0.55)"
          : "rgba(220, 230, 240, 0.9)";
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-14, 9);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-14, -9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.playerAirline ? "rgba(232, 168, 56, 0.9)" : "rgba(180, 190, 200, 0.85)";
      ctx.fillRect(-6, -16, 4, 32);
      ctx.restore();
      ctx.fillStyle = c.playerAirline
        ? "rgba(255, 220, 140, 0.98)"
        : c.returning
          ? "rgba(180,190,200,0.7)"
          : "rgba(200,220,240,0.95)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      let top = c.returning ? `${c.label}·返航` : c.label;
      if (c.phase === "boarding" && !c.returning) {
        const pct = c.capacity ? Math.round((c.passengers / c.capacity) * 100) : 0;
        top = `${c.label}·候机 ${pct}%`;
      }
      ctx.fillText(top, c.x, c.y - 22);
      if (c.playerAirline && !c.returning) {
        ctx.fillStyle = "rgba(230, 210, 160, 0.9)";
        ctx.font = "10px sans-serif";
        ctx.fillText(
          `${c.pilotName || ""} · ${c.planeName || ""} · ${c.route || ""}`,
          c.x,
          c.y - 34
        );
      }
    }
  }

  drawScouts(ctx) {
    for (const s of this.scouts || []) {
      if (s.hp <= 0) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = s.color || "#7ec8e8";
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, 7);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-10, -7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(180, 220, 235, 0.95)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.label || "侦察机", s.x, s.y - 18);
      const pct = Math.max(0, s.hp / s.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(s.x - 14, s.y - 28, 28, 3);
      ctx.fillStyle = "#7ec8e8";
      ctx.fillRect(s.x - 14, s.y - 28, 28 * pct, 3);
    }
  }

  drawEscortVip(ctx) {
    if (!this.escortActive || !this.escort || !this.escort.vip) return;
    const a = this.escort.vip;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.fillStyle = a.color || "#e8d4a8";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(232, 212, 168, 0.95)";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("要员", a.x, a.y - 22);
    // 目的地指引线
    const dest = this.escort.dest;
    if (dest) {
      ctx.strokeStyle = "rgba(232, 212, 168, 0.35)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(dest.runway.x, dest.runway.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, -10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (e.recon || e.raid || e.label) {
        ctx.fillStyle = e.raid ? "rgba(255,140,120,0.95)" : "rgba(180,190,200,0.9)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.raid ? "袭扰" : e.recon ? "侦察" : e.label, e.x, e.y - 18);
      }
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(e.x - 14, e.y - e.r - 10, 28, 3);
        ctx.fillStyle = "#e85d4c";
        ctx.fillRect(e.x - 14, e.y - e.r - 10, 28 * (e.hp / e.maxHp), 3);
      }
    }
  }

  drawAllies(ctx) {
    for (const a of this.allies) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, 9);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, -9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(200,230,245,0.8)";
      ctx.beginPath();
      ctx.ellipse(4, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = a.combatSupport ? "rgba(255,200,87,0.95)" : "rgba(61,184,138,0.9)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(a.label || "友", a.x, a.y - 22);
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const col = this.planeData.color;
    const acc = this.planeData.accent;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-8, 18);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, 8);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(200, 230, 245, 0.85)";
    ctx.beginPath();
    ctx.ellipse(6, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 40) {
      ctx.fillStyle = `rgba(232, 168, 56, ${0.3 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-22 - Math.random() * 10, 4);
      ctx.lineTo(-22 - Math.random() * 10, -4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }
  }

  drawBoundary(ctx) {
    ctx.strokeStyle = "rgba(232, 168, 56, 0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.worldSize, this.worldSize);
  }

  drawMinimap(ctx) {
    const size = 110;
    const pad = 14;
    const x = this.viewW - size - pad;
    const y = this.viewH - size - pad;
    const scale = size / this.worldSize;
    ctx.fillStyle = "rgba(8, 22, 40, 0.7)";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "rgba(200, 230, 245, 0.3)";
    ctx.strokeRect(x, y, size, size);
    for (const isle of this.islands) {
      ctx.beginPath();
      ctx.arc(x + isle.x * scale, y + isle.y * scale, Math.max(2, isle.r * scale), 0, Math.PI * 2);
      ctx.fillStyle = isle.occupied ? "rgba(232, 93, 76, 0.85)" : "rgba(61, 184, 138, 0.7)";
      ctx.fill();
    }
    for (const c of this.civilians) {
      ctx.fillStyle = "rgba(200,220,240,0.85)";
      ctx.fillRect(x + c.x * scale - 1, y + c.y * scale - 1, 2, 2);
    }
    for (const e of this.enemies) {
      ctx.fillStyle = e.recon ? "#9aa8b8" : "#e85d4c";
      ctx.fillRect(x + e.x * scale - 1.5, y + e.y * scale - 1.5, 3, 3);
    }
    for (const a of this.allies) {
      ctx.fillStyle = "#3db88a";
      ctx.fillRect(x + a.x * scale - 1.5, y + a.y * scale - 1.5, 3, 3);
    }
    for (const s of this.scouts || []) {
      ctx.fillStyle = "#7ec8e8";
      ctx.fillRect(x + s.x * scale - 1, y + s.y * scale - 1, 2, 2);
    }
    if (this.escort && this.escort.vip) {
      ctx.fillStyle = "#e8d4a8";
      ctx.fillRect(x + this.escort.vip.x * scale - 2, y + this.escort.vip.y * scale - 2, 4, 4);
    }
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.arc(x + this.player.x * scale, y + this.player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlanePreview(canvas, plane) {
  const ctx = canvas.getContext("2d");
  const dpr = 2;
  canvas.width = 140 * dpr;
  canvas.height = 100 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, 140, 100);
  ctx.fillStyle = "rgba(10, 30, 50, 0.5)";
  ctx.fillRect(0, 0, 140, 100);
  ctx.save();
  ctx.translate(70, 52);
  ctx.rotate(-0.4);
  ctx.scale(2.2, 2.2);
  ctx.fillStyle = plane.color;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = plane.accent;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, 7);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-12, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(200, 230, 245, 0.9)";
  ctx.beginPath();
  ctx.ellipse(5, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
