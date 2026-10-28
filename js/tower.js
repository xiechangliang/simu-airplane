/** 塔台指挥：格子买地扩建 · 起降调度 · 应急通道优先 */

class TowerEngine {
  constructor(save, onExit) {
    this.save = save;
    this.onExit = onExit;
    this.running = false;
    this.paused = false;
    this.aircraft = [];
    this.selectedId = null;
    this.spawnTimer = 3;
    this.depTimer = 8;
    this.time = 0;
    this.log = [];
    this._raf = null;
    this.lastTs = 0;
    this.viewCanvas = null;
    this.radarCanvas = null;
    this.buildTool = "buy"; // buy | runway | taxi | tower | terminal | erase
    this.hoverCell = null;
    this.uiDirty = true;
    this._uiSig = "";
    this._panelTimer = 0;
    /** 自动指挥：按列表顺序分配起降；忙碌时只处理前 3 架 */
    this.autoCommand = false;
    this.autoCd = 0;
    this.AUTO_HANDLE_LIMIT = 3;
    this.ensureTowerSave();
  }

  ensureTowerSave() {
    if (!this.save.tower) this.save.tower = { ...TOWER_DEFAULT };
    const t = this.save.tower;
    if (t.funds == null) t.funds = TOWER_DEFAULT.funds;
    if (t.landings == null) t.landings = 0;
    if (t.takeoffs == null) t.takeoffs = 0;
    if (!t.grid || !t.grid.cells) t.grid = createDefaultTowerGrid();
    if (!t.grid.nextRwyId) t.grid.nextRwyId = 2;
  }

  get tower() {
    return this.save.tower;
  }

  get grid() {
    return this.tower.grid;
  }

  start() {
    this.ensureTowerSave();
    this.viewCanvas = document.getElementById("tower-view");
    this.radarCanvas = document.getElementById("tower-radar");
    this.running = true;
    this.paused = false;
    this.aircraft = [];
    this.selectedId = null;
    this.spawnTimer = 2.5;
    this.depTimer = 10;
    this.time = 0;
    this.log = ["塔台值班开始 · 苍澜国际机场（格子买地扩建）"];
    this.buildTool = "buy";
    this.autoCommand = false;
    this.autoCd = 0;
    this.uiDirty = true;
    this._uiSig = "";
    this._panelTimer = 0;
    this.bindUi();
    this.bindCanvas();
    this.bindRadarPick();
    this.renderPanels();
    this.renderAutoBtn();
    this.lastTs = performance.now();
    this._raf = requestAnimationFrame((t) => this.loop(t));
    this.pushLog(this.facilitySummary());
    this.pushLog("提示：可开启「自动指挥」按列表顺序分配起降（繁忙时仅前 3 架）；故障机需你授权应急通道");
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    saveGame(this.save);
  }

  facilitySummary() {
    const s = this.countFacilities();
    return `设施：跑道×${s.runways} · 滑道格×${s.taxi} · 塔台×${s.tower} · 航站楼格×${s.terminal} · 已购地×${s.owned}`;
  }

  countFacilities() {
    const g = this.grid;
    let owned = 0;
    let taxi = 0;
    let tower = 0;
    let terminal = 0;
    const rwyIds = new Set();
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.cells[y][x];
        if (!c.owned) continue;
        owned++;
        if (c.type === "taxi") taxi++;
        if (c.type === "tower") tower++;
        if (c.type === "terminal") terminal++;
        if (c.type === "runway" && c.rwyId) rwyIds.add(c.rwyId);
      }
    }
    return { owned, taxi, tower, terminal, runways: rwyIds.size || 0, rwyIds: [...rwyIds].sort((a, b) => a - b) };
  }

  bindUi() {
    const root = document.getElementById("screen-tower");
    if (!root) return;
    if (!root._towerBound) {
      root._towerBound = true;
      root.addEventListener("click", (e) => {
        const eng = window.UI && window.UI.towerEngine;
        if (!eng || !eng.running) return;
        const btn = e.target.closest("[data-tower]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        eng.handleTowerAction(btn);
      });
    }
  }

  handleTowerAction(btn) {
    const act = btn.dataset.tower;
    if (act === "exit") {
      this.stop();
      if (this.onExit) this.onExit();
      return;
    }
    if (act === "pause") {
      this.paused = !this.paused;
      btn.textContent = this.paused ? "继续" : "暂停";
      return;
    }
    if (act === "tool") {
      this.buildTool = btn.dataset.tool;
      this.renderBuildBar();
      this.pushLog(`建造工具：${this.toolLabel(this.buildTool)}`);
      return;
    }
    if (act === "auto") {
      this.autoCommand = !this.autoCommand;
      this.renderAutoBtn();
      this.pushLog(
        this.autoCommand
          ? `自动指挥已开启 · 按列表顺序处理起降，同时最多 ${this.AUTO_HANDLE_LIMIT} 架；故障机需授权应急通道`
          : "自动指挥已关闭"
      );
      return;
    }
    if (act === "land") this.commandLand(+btn.dataset.rwy);
    else if (act === "hold") this.commandHold(+btn.dataset.laps);
    else if (act === "takeoff") this.commandTakeoff(+btn.dataset.rwy);
    else if (act === "emergency") this.commandEmergency();
    else if (act === "auth-emergency") {
      const a = this.aircraft.find((x) => x.id === btn.dataset.id);
      if (a) this.authorizeEmergency(a);
    } else if (act === "select") this.selectAircraft(btn.dataset.id);
    this.uiDirty = true;
  }

  renderAutoBtn() {
    const btn = document.getElementById("btn-tower-auto");
    if (!btn) return;
    btn.textContent = this.autoCommand ? "自动指挥：开" : "自动指挥：关";
    btn.classList.toggle("btn-primary", this.autoCommand);
  }

  toolLabel(t) {
    return (
      {
        buy: "买地皮",
        runway: "铺跑道",
        taxi: "铺滑行道",
        tower: "建塔台",
        terminal: "建航站楼",
        erase: "拆除建筑（保留地皮）",
      }[t] || t
    );
  }

  bindCanvas() {
    const canvas = this.viewCanvas;
    if (!canvas || canvas._towerGrid) return;
    canvas._towerGrid = true;
    canvas.style.cursor = "crosshair";
    const toCell = (e) => {
      const eng = window.UI && window.UI.towerEngine;
      if (!eng) return null;
      const rect = canvas.getBoundingClientRect();
      const layout = eng.gridLayout(rect.width, rect.height);
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const x = Math.floor((mx - layout.originX) / layout.cell);
      const y = Math.floor((my - layout.originY) / layout.cell);
      if (x < 0 || y < 0 || x >= eng.grid.w || y >= eng.grid.h) return null;
      return { x, y };
    };
    canvas.addEventListener("mousemove", (e) => {
      const eng = window.UI && window.UI.towerEngine;
      if (!eng || !eng.running) return;
      eng.hoverCell = toCell(e);
    });
    canvas.addEventListener("mouseleave", () => {
      const eng = window.UI && window.UI.towerEngine;
      if (eng) eng.hoverCell = null;
    });
    canvas.addEventListener("click", (e) => {
      const eng = window.UI && window.UI.towerEngine;
      if (!eng || !eng.running) return;
      const cell = toCell(e);
      if (cell) eng.applyTool(cell.x, cell.y);
    });
  }

  bindRadarPick() {
    const canvas = this.radarCanvas;
    if (!canvas || canvas._towerPick) return;
    canvas._towerPick = true;
    canvas.style.cursor = "pointer";
    canvas.addEventListener("click", (e) => {
      const eng = window.UI && window.UI.towerEngine;
      if (!eng || !eng.running) return;
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      const cx = rect.left + size / 2;
      const cy = rect.top + size / 2;
      const range = eng.radarRange();
      const scale = (size * 0.46) / range;
      const mx = e.clientX - cx;
      const my = e.clientY - cy;
      let best = null;
      let bestD = 22;
      for (const a of eng.aircraft) {
        if (a.state === "done") continue;
        const px = a.x * scale;
        const py = a.y * scale;
        const d = Math.hypot(mx - px, my - py);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      if (best) eng.selectAircraft(best.id);
    });
  }

  gridLayout(w, h) {
    const g = this.grid;
    const pad = 16;
    const cell = Math.min((w - pad * 2) / g.w, (h - pad * 2) / g.h);
    const originX = (w - cell * g.w) / 2;
    const originY = (h - cell * g.h) / 2;
    return { cell, originX, originY };
  }

  applyTool(x, y) {
    const c = this.grid.cells[y][x];
    const tool = this.buildTool;
    if (tool === "buy") {
      if (c.owned) {
        this.pushLog("该格已购买");
        return;
      }
      if (this.tower.funds < TOWER_CELL_BUY) {
        this.pushLog("资金不足，无法买地");
        return;
      }
      this.tower.funds -= TOWER_CELL_BUY;
      c.owned = true;
      c.type = "empty";
      c.rwyId = 0;
      this.pushLog(`购入地皮 (${x},${y}) · -${TOWER_CELL_BUY}`);
      saveGame(this.save);
      this.uiDirty = true;
      this.renderPanels();
      return;
    }
    if (!c.owned) {
      this.pushLog("请先购买该格地皮，再建造");
      return;
    }
    if (tool === "erase") {
      if (c.type === "empty") return;
      c.type = "empty";
      c.rwyId = 0;
      this.pushLog(`拆除 (${x},${y}) 上的建筑`);
      saveGame(this.save);
      this.uiDirty = true;
      this.renderPanels();
      return;
    }
    const cost = TOWER_BUILD_COST[tool];
    if (cost == null) return;
    if (c.type === tool && tool !== "runway") {
      this.pushLog("该格已是相同建筑");
      return;
    }
    if (this.tower.funds < cost) {
      this.pushLog("资金不足");
      return;
    }
    this.tower.funds -= cost;
    if (tool === "runway") {
      const nid = this.neighborRwyId(x, y);
      c.type = "runway";
      c.rwyId = nid || this.grid.nextRwyId++;
      this.pushLog(`铺设跑道格 (${x},${y}) · RWY ${String(c.rwyId).padStart(2, "0")} · -${cost}`);
    } else {
      c.type = tool;
      c.rwyId = 0;
      const names = { taxi: "滑行道", tower: "塔台", terminal: "航站楼" };
      this.pushLog(`建造${names[tool]} (${x},${y}) · -${cost}`);
    }
    saveGame(this.save);
    this.uiDirty = true;
    this.renderPanels();
  }

  neighborRwyId(x, y) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.grid.w || ny >= this.grid.h) continue;
      const n = this.grid.cells[ny][nx];
      if (n.owned && n.type === "runway" && n.rwyId) return n.rwyId;
    }
    return 0;
  }

  runwayList() {
    return this.countFacilities().rwyIds;
  }

  hasTerminal() {
    return this.countFacilities().terminal > 0;
  }

  hasTower() {
    return this.countFacilities().tower > 0;
  }

  maxTraffic() {
    const s = this.countFacilities();
    return 3 + s.tower + Math.floor(s.taxi / 2) + s.terminal;
  }

  radarRange() {
    const s = this.countFacilities();
    return 360 + s.tower * 90 + s.owned * 2;
  }

  pushLog(msg) {
    const mm = String(Math.floor(this.time / 60)).padStart(2, "0");
    const ss = String(Math.floor(this.time % 60)).padStart(2, "0");
    this.log.unshift(`[${mm}:${ss}] ${msg}`);
    if (this.log.length > 50) this.log.length = 50;
    const el = document.getElementById("tower-log");
    if (el) el.innerHTML = this.log.map((l) => `<div>${l}</div>`).join("");
  }

  loop(ts) {
    if (!this.running) return;
    this._raf = requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (!this.paused) this.update(dt);
    this.draw();
  }

  update(dt) {
    this.time += dt;
    const fac = this.countFacilities();
    if (!fac.runways) {
      // 无跑道时仍可买地，不刷机
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(5, 12 - fac.tower * 1.5 - Math.random() * 2);
        if (this.aircraft.filter((a) => a.state !== "done").length < this.maxTraffic()) {
          this.spawnApproach();
        }
      }
      // 有航站楼则刷离港起飞
      if (this.hasTerminal()) {
        this.depTimer -= dt;
        if (this.depTimer <= 0) {
          this.depTimer = 14 + Math.random() * 8 - fac.terminal;
          if (this.aircraft.filter((a) => a.kind === "dep" && a.state !== "done").length < 2) {
            this.spawnDeparture();
          }
        }
      }
    }

    for (const a of this.aircraft) {
      if (a.state === "done") continue;
      this.updateAircraft(a, dt);
    }
    this.tickAutoCommand(dt);
    this.updateEmergencyAlert();
    const before = this.aircraft.length;
    this.aircraft = this.aircraft.filter((a) => a.state !== "done" || a.fade > 0);
    for (const a of this.aircraft) {
      if (a.state === "done") a.fade -= dt;
    }
    if (this.aircraft.length !== before) this.uiDirty = true;

    this._panelTimer += dt;
    const sig =
      this.aircraft
        .filter((a) => a.state !== "done")
        .map((a) => `${a.id}:${a.state}:${a.priority}:${a.holdLapsLeft}:${a.assignedRwy}`)
        .join("|") + `#${this.selectedId}#${this.buildTool}`;
    if (sig !== this._uiSig) {
      this._uiSig = sig;
      this.uiDirty = true;
    }
    if (this.uiDirty || this._panelTimer > 0.45) {
      this._panelTimer = 0;
      this.uiDirty = false;
      this.renderFunds();
      this.renderTrafficList();
      this.renderCommandPanel();
      this.renderFacilities();
    } else {
      this.renderFunds();
    }
  }

  /** 仅当玩家已在航司登记排班航线时，才可能刷本公司航班 */
  pickTowerAirline(preferPlayerChance = 0.4) {
    const flights =
      typeof listedAirlineFlights === "function" ? listedAirlineFlights(this.save) : [];
    if (flights.length && Math.random() < preferPlayerChance) {
      const job = flights[Math.floor(Math.random() * flights.length)];
      return {
        id: "player",
        name: job.airlineName,
        color: "#ffc857",
        route: `${job.fromName}→${job.toName}`,
        planeName: job.plane?.name || "",
        pilotName: job.pilot?.name || "",
        playerAirline: true,
      };
    }
    const base = TOWER_AIRLINES[Math.floor(Math.random() * TOWER_AIRLINES.length)];
    return { ...base, route: "", planeName: "", pilotName: "", playerAirline: false };
  }

  spawnApproach() {
    if (!this.runwayList().length) return;
    const airline = this.pickTowerAirline(0.4);
    const num = 100 + Math.floor(Math.random() * 800);
    const callsign = `${airline.name}${num}`;
    const ang = Math.random() * Math.PI * 2;
    const dist = this.radarRange() * (0.72 + Math.random() * 0.25);
    const emergency = Math.random() < 0.12;
    const id = "arr-" + Math.floor(this.time * 1000) + "-" + Math.floor(Math.random() * 999);
    const ac = {
      id,
      kind: "arr",
      callsign,
      airline: airline.name,
      color: emergency ? "#e85d4c" : airline.color,
      route: airline.route || "",
      planeName: airline.planeName || "",
      playerAirline: !!airline.playerAirline,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      angle: ang + Math.PI,
      speed: emergency ? 55 : 42 + Math.random() * 18,
      alt: emergency ? 900 + Math.random() * 400 : 1800 + Math.random() * 900,
      state: "approach",
      assignedRwy: null,
      holdLapsLeft: 0,
      holdAngle: 0,
      progress: 0,
      patience: emergency ? 35 : 55 + Math.random() * 40,
      fade: 1.2,
      requested: false,
      emergency,
      emergencyAuth: false, // 故障机需玩家授权应急通道后，自动指挥才会处理
      priority: emergency ? 1 : 0,
      queueAt: this.time,
    };
    this.aircraft.push(ac);
    const routeHint = airline.route ? ` · 航线 ${airline.route}` : "";
    this.pushLog(
      emergency
        ? `⚠ 故障机 ${callsign} 进近！请授权「应急通道」后才会优先自动降落`
        : `${callsign}（${airline.name}）进入雷达，请求降落${routeHint}`
    );
    if (!this.selectedId || emergency) this.selectedId = id;
    this.uiDirty = true;
  }

  spawnDeparture() {
    if (!this.hasTerminal() || !this.runwayList().length) return;
    const airline = this.pickTowerAirline(0.45);
    const num = 100 + Math.floor(Math.random() * 800);
    const callsign = `${airline.name}${num}`;
    const id = "dep-" + Math.floor(this.time * 1000) + "-" + Math.floor(Math.random() * 999);
    const gate = this.randomTerminalCell();
    const ac = {
      id,
      kind: "dep",
      callsign,
      airline: airline.name,
      color: airline.color,
      route: airline.route || "",
      planeName: airline.planeName || "",
      playerAirline: !!airline.playerAirline,
      x: (gate.x - this.grid.w / 2) * 28,
      y: (gate.y - this.grid.h / 2) * 28,
      angle: -Math.PI / 2,
      speed: 35,
      alt: 0,
      state: "gate", // gate | taxiOut | lineup | departing | done
      assignedRwy: null,
      holdLapsLeft: 0,
      progress: 0,
      patience: 70,
      fade: 1.2,
      requested: false,
      emergency: false,
      priority: 0,
      queueAt: this.time,
    };
    this.aircraft.push(ac);
    const routeHint = airline.route ? ` · ${airline.route}` : "";
    this.pushLog(`${callsign} 在航站楼登机完毕，请求起飞${routeHint}`);
    this.uiDirty = true;
  }

  randomTerminalCell() {
    const list = [];
    for (let y = 0; y < this.grid.h; y++) {
      for (let x = 0; x < this.grid.w; x++) {
        const c = this.grid.cells[y][x];
        if (c.owned && c.type === "terminal") list.push({ x, y });
      }
    }
    return list[Math.floor(Math.random() * list.length)] || { x: 0, y: 0 };
  }

  selectAircraft(id) {
    this.selectedId = id;
    this.uiDirty = true;
    this.renderTrafficList();
    this.renderCommandPanel();
  }

  getSelected() {
    return this.aircraft.find((a) => a.id === this.selectedId && a.state !== "done");
  }

  runwayBusy(rwy, excludeId = null) {
    return this.aircraft.some(
      (a) =>
        a.id !== excludeId &&
        a.assignedRwy === rwy &&
        (a.state === "final" || a.state === "landing" || a.state === "lineup" || a.state === "departing")
    );
  }

  /** 列表排序分：待授权应急置顶显示；已授权应急第 1/2；其余按时间 */
  queueScore(a) {
    if (a.emergency && a.emergencyAuth) return 200 + (a.queueBoost || 0);
    if (a.emergency && !a.emergencyAuth) return 150; // 列表靠前提醒，但不占自动名额
    return a.priority || 0;
  }

  /** 指挥队列：应急（待授权也显示在前）→ 进近优先于起飞 → 进场时间 */
  commandQueue() {
    return this.aircraft
      .filter((a) => {
        if (a.state === "done") return false;
        if (a.kind === "arr") {
          return a.state === "approach" || (a.state === "holding" && a.holdLapsLeft <= 0);
        }
        if (a.kind === "dep") return a.state === "gate";
        return false;
      })
      .sort((a, b) => {
        const pa = this.queueScore(a);
        const pb = this.queueScore(b);
        if (pb !== pa) return pb - pa;
        if (a.kind !== b.kind) return a.kind === "arr" ? -1 : 1;
        return a.queueAt - b.queueAt;
      });
  }

  /** 自动指挥可处理的队列：不含「未授权故障机」（它们需应急通道提到前 1/2 位） */
  autoHandleQueue() {
    return this.commandQueue().filter((a) => !(a.emergency && !a.emergencyAuth));
  }

  landingQueue() {
    return this.commandQueue().filter((a) => a.kind === "arr");
  }

  pendingEmergencyAuth() {
    return this.aircraft.filter(
      (a) => a.kind === "arr" && a.emergency && !a.emergencyAuth && a.state !== "done"
    );
  }

  updateEmergencyAlert() {
    const el = document.getElementById("tower-alert");
    if (!el) return;
    const list = this.pendingEmergencyAuth();
    if (!list.length) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML =
      `<strong>⚠ 故障机请求应急通道</strong>` +
      list
        .map(
          (a) =>
            `<button class="btn btn-danger" data-tower="auth-emergency" data-id="${a.id}" type="button">授权 ${a.callsign}</button>`
        )
        .join("") +
      (this.autoCommand
        ? `<span class="tower-hint">点授权=应急通道：插入自动指挥第 1/2 位并优先降落</span>`
        : `<span class="tower-hint">授权后将优先降落；开自动指挥时会插入前三位</span>`);
  }

  /**
   * 自动指挥：按可处理列表前 3 架分配起降。
   * 未授权故障机不占这 3 个名额；点「应急通道」后插到第 1 或第 2 位并立即指挥。
   */
  tickAutoCommand(dt) {
    if (!this.autoCommand) return;
    this.autoCd -= dt;
    if (this.autoCd > 0) return;
    this.autoCd = 1.15;

    const rwys = this.runwayList();
    if (!rwys.length) return;

    const fullAuto = this.autoHandleQueue();
    const backlog = fullAuto.length > this.AUTO_HANDLE_LIMIT;
    const handle = fullAuto.slice(0, this.AUTO_HANDLE_LIMIT);

    if (backlog) {
      this._overloadCd = (this._overloadCd || 0) - 1.15;
      if (this._overloadCd <= 0) {
        this._overloadCd = 14;
        this.pushLog(
          `自动指挥过载：可处理 ${fullAuto.length} 架，仅指挥前 ${this.AUTO_HANDLE_LIMIT} 架（故障机请先开应急通道插队）`
        );
      }
    } else {
      this._overloadCd = 0;
    }

    for (const a of handle) {
      if (a.kind === "arr") {
        if (a.state === "approach" && !a.requested) {
          const free = rwys.find((r) => !this.runwayBusy(r, a.id));
          if (free) this.assignLand(a, free, true);
          else this.assignHold(a, 1, true);
        } else if (a.state === "holding" && a.holdLapsLeft <= 0) {
          const free = rwys.find((r) => !this.runwayBusy(r, a.id));
          if (free) this.assignLand(a, free, true);
        }
      } else if (a.kind === "dep" && a.state === "gate") {
        const free = rwys.find((r) => !this.runwayBusy(r, a.id));
        if (free) this.assignTakeoff(a, free, true);
      }
    }
  }

  /** 应急通道：插到自动队列第 1 位（若已有一台已授权应急则第 2 位），并立刻指挥降落 */
  authorizeEmergency(a) {
    if (!a || a.kind !== "arr") return;
    a.emergency = true;
    a.emergencyAuth = true;
    a.priority = 10;
    a.color = "#e85d4c";
    // 已有其他已授权应急 → 排第 2；否则第 1
    const otherAuth = this.aircraft.some(
      (x) => x.id !== a.id && x.emergency && x.emergencyAuth && x.state !== "done"
    );
    a.queueBoost = otherAuth ? 1 : 2;
    a.queueAt = 0; // 同优先级下也靠前

    const rwys = this.runwayList();
    let free = rwys.find((r) => !this.runwayBusy(r, a.id));
    if (!free && rwys.length) free = rwys[0];
    if (free) {
      this.assignLand(a, free, this.autoCommand);
      this.pushLog(
        `应急通道：${a.callsign} 已插队至自动列表第 ${otherAuth ? 2 : 1} 位 → RWY ${String(free).padStart(2, "0")}`
      );
    } else {
      a.requested = true;
      this.pushLog(`应急通道：${a.callsign} 已插队至第 ${otherAuth ? 2 : 1} 位，等待跑道空出`);
    }
    this.uiDirty = true;
    this.updateEmergencyAlert();
    this.renderCommandPanel();
    this.renderTrafficList();
  }

  commandEmergency() {
    const a = this.getSelected();
    if (!a || a.kind !== "arr") {
      this.pushLog("请先选择一架进近飞机以开启应急通道");
      return;
    }
    this.authorizeEmergency(a);
  }

  assignLand(a, rwy, fromAuto = false) {
    if (!a || a.kind !== "arr") return false;
    if (!this.runwayList().includes(rwy)) return false;
    if (a.state === "landing" || a.state === "taxi" || a.state === "done") return false;
    if (this.runwayBusy(rwy, a.id) && !(a.emergency && a.emergencyAuth)) return false;
    a.assignedRwy = rwy;
    a.holdLapsLeft = 0;
    a.state = "final";
    a.requested = true;
    this.pushLog(
      `${fromAuto ? "自动" : "塔台"}→${a.callsign}：许可降落 RWY ${String(rwy).padStart(2, "0")}`
    );
    this.uiDirty = true;
    return true;
  }

  assignHold(a, laps, fromAuto = false) {
    if (!a || a.kind !== "arr") return false;
    if (a.state === "landing" || a.state === "taxi" || a.state === "done") return false;
    a.holdLapsLeft = Math.max(1, laps);
    a.state = "holding";
    a.holdAngle = Math.atan2(a.y, a.x);
    a.assignedRwy = a.assignedRwy || this.runwayList()[0] || 1;
    a.requested = true;
    a.progress = 0;
    this.pushLog(
      `${fromAuto ? "自动" : "塔台"}→${a.callsign}：绕飞 ${laps} 圈后再进近`
    );
    this.uiDirty = true;
    return true;
  }

  assignTakeoff(a, rwy, fromAuto = false) {
    if (!a || a.kind !== "dep") return false;
    if (!this.runwayList().includes(rwy)) return false;
    if (this.runwayBusy(rwy, a.id)) return false;
    a.assignedRwy = rwy;
    a.requested = true;
    a.state = "taxiOut";
    a.progress = 0;
    this.pushLog(
      `${fromAuto ? "自动" : "塔台"}→${a.callsign}：滑出，RWY ${String(rwy).padStart(2, "0")} 起飞`
    );
    this.uiDirty = true;
    return true;
  }

  commandLand(rwy) {
    const a = this.getSelected();
    if (!a || a.kind !== "arr") {
      this.pushLog("请选择一架进近（降落）飞机");
      return;
    }
    if (!this.assignLand(a, rwy, false)) {
      this.pushLog(`无法指派降落 RWY ${String(rwy).padStart(2, "0")}（占用或不存在）`);
    }
  }

  commandHold(laps) {
    const a = this.getSelected();
    if (!a || a.kind !== "arr") {
      this.pushLog("请选择进近飞机");
      return;
    }
    this.assignHold(a, laps, false);
  }

  commandTakeoff(rwy) {
    const a = this.getSelected();
    if (!a || a.kind !== "dep") {
      this.pushLog("请选择一架待起飞（离港）飞机");
      return;
    }
    if (!this.assignTakeoff(a, rwy, false)) {
      this.pushLog(`RWY ${String(rwy).padStart(2, "0")} 占用或不存在，暂不可起飞`);
    }
  }

  runwayGeom(rwy) {
    // 从格子推算跑道中心线（世界坐标，与场面绘制一致）
    const cells = [];
    for (let y = 0; y < this.grid.h; y++) {
      for (let x = 0; x < this.grid.w; x++) {
        const c = this.grid.cells[y][x];
        if (c.owned && c.type === "runway" && c.rwyId === rwy) cells.push({ x, y });
      }
    }
    if (!cells.length) return { x0: -80, y0: 0, x1: 80, y1: 0 };
    cells.sort((a, b) => a.x - b.x || a.y - b.y);
    const toWorld = (p) => ({
      x: (p.x - this.grid.w / 2 + 0.5) * 28,
      y: (p.y - this.grid.h / 2 + 0.5) * 28,
    });
    const a = toWorld(cells[0]);
    const b = toWorld(cells[cells.length - 1]);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }

  runwayApproachPoint(rwy) {
    const rw = this.runwayGeom(rwy);
    const dx = rw.x0 - rw.x1;
    const dy = rw.y0 - rw.y1;
    const len = Math.hypot(dx, dy) || 1;
    return { x: rw.x0 + (dx / len) * 40, y: rw.y0 + (dy / len) * 40 };
  }

  turnToward(cur, desired, maxStep) {
    let d = desired - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.sign(d) * Math.min(Math.abs(d), maxStep);
  }

  updateAircraft(a, dt) {
    if (a.kind === "dep") {
      this.updateDeparture(a, dt);
      return;
    }
    a.patience -= dt;

    if (!a.requested && a.state === "approach") {
      const dist = Math.hypot(a.x, a.y);
      if (dist > 160) {
        const desired = Math.atan2(-a.y, -a.x);
        a.angle += this.turnToward(a.angle, desired, 1.2 * dt);
        a.x += Math.cos(a.angle) * a.speed * dt;
        a.y += Math.sin(a.angle) * a.speed * dt;
        a.alt = Math.max(900, a.alt - 20 * dt);
      } else {
        a.angle += 0.55 * dt;
        a.x += Math.cos(a.angle) * a.speed * 0.7 * dt;
        a.y += Math.sin(a.angle) * a.speed * 0.7 * dt;
      }
      if (a.patience <= 0) {
        this.pushLog(`${a.callsign} 燃油告急，复飞离开`);
        a.state = "done";
        a.fade = 0.8;
        this.tower.funds = Math.max(0, this.tower.funds - (a.emergency ? 80 : 40));
        saveGame(this.save);
      }
      return;
    }

    if (a.state === "holding") {
      const radius = 140 + (a.assignedRwy || 1) * 20;
      a.holdAngle += (a.speed / radius) * dt;
      a.x = Math.cos(a.holdAngle) * radius;
      a.y = Math.sin(a.holdAngle) * radius;
      a.angle = a.holdAngle + Math.PI / 2;
      a.alt = 1200;
      a.progress += (a.speed / radius) * dt;
      if (a.progress >= Math.PI * 2) {
        a.progress = 0;
        a.holdLapsLeft -= 1;
        this.pushLog(`${a.callsign} 完成绕飞，剩余 ${Math.max(0, a.holdLapsLeft)} 圈`);
        if (a.holdLapsLeft <= 0) {
          const rwy = a.assignedRwy || this.runwayList()[0];
          if (rwy && this.runwayBusy(rwy, a.id) && !a.emergency) {
            a.holdLapsLeft = 1;
            this.pushLog(`${a.callsign}：跑道占用，继续绕飞`);
          } else if (rwy) {
            a.state = "final";
            this.pushLog(`${a.callsign} 转入进近 RWY ${String(rwy).padStart(2, "0")}`);
          }
        }
      }
      return;
    }

    if (a.state === "final") {
      const rwy = a.assignedRwy || this.runwayList()[0];
      if (!rwy) return;
      const target = this.runwayApproachPoint(rwy);
      const desired = Math.atan2(target.y - a.y, target.x - a.x);
      a.angle += this.turnToward(a.angle, desired, 1.8 * dt);
      a.x += Math.cos(a.angle) * a.speed * 1.15 * dt;
      a.y += Math.sin(a.angle) * a.speed * 1.15 * dt;
      a.alt = Math.max(80, a.alt - (a.emergency ? 160 : 120) * dt);
      if (Math.hypot(a.x - target.x, a.y - target.y) < 30 && a.alt < 220) {
        if (this.runwayBusy(rwy, a.id) && !a.emergency) {
          a.state = "holding";
          a.holdLapsLeft = 1;
          a.holdAngle = Math.atan2(a.y, a.x);
          a.progress = 0;
          this.pushLog(`${a.callsign} 冲突复飞`);
        } else {
          a.state = "landing";
          a.progress = 0;
          this.pushLog(`${a.callsign} 接地 RWY ${String(rwy).padStart(2, "0")}`);
        }
      }
      return;
    }

    if (a.state === "landing") {
      const rwy = a.assignedRwy || 1;
      const rw = this.runwayGeom(rwy);
      a.progress = Math.min(1, a.progress + dt * (a.emergency ? 0.45 : 0.35));
      a.x = rw.x0 + (rw.x1 - rw.x0) * a.progress;
      a.y = rw.y0 + (rw.y1 - rw.y0) * a.progress;
      a.angle = Math.atan2(rw.y1 - rw.y0, rw.x1 - rw.x0);
      a.alt = 0;
      if (a.progress >= 1) {
        a.state = "taxi";
        a.progress = 0;
        this.pushLog(`${a.callsign} 脱离跑道，滑行至航站楼`);
      }
      return;
    }

    if (a.state === "taxi") {
      a.progress = Math.min(1, a.progress + dt * 0.3);
      if (a.progress >= 1) {
        const pay = (a.emergency ? 140 : 90) + this.countFacilities().terminal * 8;
        this.tower.funds += pay;
        this.tower.landings = (this.tower.landings || 0) + 1;
        this.save.coins += Math.floor(pay * 0.12);
        saveGame(this.save);
        this.pushLog(`${a.callsign} 停靠航站楼 · +${pay}`);
        a.state = "done";
        a.fade = 1.2;
        if (this.selectedId === a.id) this.selectedId = null;
        this.uiDirty = true;
      }
    }
  }

  updateDeparture(a, dt) {
    a.patience -= dt;
    if (a.state === "gate") {
      if (a.patience <= 0) {
        this.pushLog(`${a.callsign} 取消起飞，返回机库`);
        a.state = "done";
        a.fade = 0.6;
      }
      return;
    }
    if (a.state === "taxiOut") {
      const rwy = a.assignedRwy;
      const rw = this.runwayGeom(rwy);
      a.progress = Math.min(1, a.progress + dt * 0.28);
      a.x = rw.x0 + (rw.x1 - rw.x0) * 0.15;
      a.y = rw.y0 + (rw.y1 - rw.y0) * 0.15 + (1 - a.progress) * 40;
      a.alt = 0;
      if (a.progress >= 1) {
        if (this.runwayBusy(rwy, a.id)) {
          a.progress = 0.85;
          return;
        }
        a.state = "lineup";
        a.progress = 0;
        this.pushLog(`${a.callsign} 进入跑道头，起飞滑跑`);
      }
      return;
    }
    if (a.state === "lineup" || a.state === "departing") {
      a.state = "departing";
      const rwy = a.assignedRwy;
      const rw = this.runwayGeom(rwy);
      a.progress = Math.min(1, a.progress + dt * 0.4);
      a.x = rw.x0 + (rw.x1 - rw.x0) * a.progress;
      a.y = rw.y0 + (rw.y1 - rw.y0) * a.progress;
      a.angle = Math.atan2(rw.y1 - rw.y0, rw.x1 - rw.x0);
      a.alt = a.progress * 200;
      if (a.progress >= 1) {
        const pay = 70 + this.countFacilities().terminal * 6;
        this.tower.funds += pay;
        this.tower.takeoffs = (this.tower.takeoffs || 0) + 1;
        this.save.coins += Math.floor(pay * 0.1);
        saveGame(this.save);
        this.pushLog(`${a.callsign} 起飞离场 · +${pay}`);
        a.state = "done";
        a.fade = 1;
        if (this.selectedId === a.id) this.selectedId = null;
        this.uiDirty = true;
      }
    }
  }

  renderPanels() {
    this.renderFunds();
    this.renderBuildBar();
    this.renderTrafficList();
    this.renderCommandPanel();
    this.renderFacilities();
  }

  renderFunds() {
    const el = document.getElementById("tower-funds");
    if (el) el.textContent = String(Math.floor(this.tower.funds));
    const land = document.getElementById("tower-landings");
    if (land) land.textContent = String(this.tower.landings || 0);
    const take = document.getElementById("tower-takeoffs");
    if (take) take.textContent = String(this.tower.takeoffs || 0);
  }

  renderFacilities() {
    const fac = document.getElementById("tower-facilities");
    if (fac) fac.textContent = this.facilitySummary().replace("设施：", "");
  }

  renderBuildBar() {
    const box = document.getElementById("tower-buildbar");
    if (!box) return;
    const tools = [
      ["buy", `买地 ${TOWER_CELL_BUY}`],
      ["runway", `跑道 ${TOWER_BUILD_COST.runway}`],
      ["taxi", `滑行道 ${TOWER_BUILD_COST.taxi}`],
      ["tower", `塔台 ${TOWER_BUILD_COST.tower}`],
      ["terminal", `航站楼 ${TOWER_BUILD_COST.terminal}`],
      ["erase", "拆除"],
    ];
    box.innerHTML = tools
      .map(
        ([id, label]) =>
          `<button class="btn${this.buildTool === id ? " btn-primary" : ""}" data-tower="tool" data-tool="${id}" type="button">${label}</button>`
      )
      .join("");
  }

  renderTrafficList() {
    const list = document.getElementById("tower-traffic");
    if (!list) return;
    const q = this.commandQueue();
    const qIndex = new Map(q.map((a, i) => [a.id, i]));
    const live = this.aircraft.filter((a) => a.state !== "done");
    live.sort((a, b) => {
      const ia = qIndex.has(a.id) ? qIndex.get(a.id) : 999;
      const ib = qIndex.has(b.id) ? qIndex.get(b.id) : 999;
      if (ia !== ib) return ia - ib;
      return (b.priority || 0) - (a.priority || 0) || a.queueAt - b.queueAt;
    });
    if (!live.length) {
      list.innerHTML = `<div class="tower-empty">暂无航班 · 点击场面格子买地/扩建</div>`;
      return;
    }
    const autoNote = this.autoCommand
      ? `<div class="tower-empty">自动指挥中 · 仅处理列表前 ${this.AUTO_HANDLE_LIMIT} 架待指挥航班</div>`
      : "";
    list.innerHTML =
      autoNote +
      live
        .map((a) => {
          let st = a.state;
          if (a.kind === "arr") {
            st =
              a.state === "approach"
                ? a.emergency && !a.emergencyAuth
                  ? "待授权应急"
                  : "进近待命"
                : a.state === "holding"
                  ? `绕飞剩 ${a.holdLapsLeft}`
                  : a.state === "final"
                    ? `进近 RWY ${String(a.assignedRwy).padStart(2, "0")}`
                    : a.state === "landing"
                      ? "降落中"
                      : a.state === "taxi"
                        ? "滑行入库"
                        : a.state;
          } else {
            st =
              a.state === "gate"
                ? "航站楼待起飞"
                : a.state === "taxiOut"
                  ? "滑出"
                  : a.state === "lineup" || a.state === "departing"
                    ? "起飞滑跑"
                    : a.state;
          }
          const qi = qIndex.get(a.id);
          const autoQ = this.autoHandleQueue();
          const autoIdx = autoQ.findIndex((x) => x.id === a.id);
          let autoTag = "";
          if (a.emergency && !a.emergencyAuth) autoTag = " · 需应急通道插队";
          else if (this.autoCommand && autoIdx >= 0) {
            autoTag =
              autoIdx < this.AUTO_HANDLE_LIMIT ? ` · 自动#${autoIdx + 1}` : " · 排队等空位";
          }
          const tag = a.emergency ? "⚠应急 " : a.kind === "dep" ? "起飞 " : "降落 ";
          const sel = a.id === this.selectedId ? " selected" : "";
          return (
            `<button class="tower-ac${sel}${a.emergency ? " emergency" : ""}" data-tower="select" data-id="${a.id}" type="button">` +
            `<strong style="color:${a.color}">${qi != null ? `#${qi + 1} ` : ""}${tag}${a.callsign}</strong>` +
            `<span>${a.airline}${a.route ? " · " + a.route : ""}${autoTag}</span>` +
            `<span>${st}${a.kind === "arr" ? ` · ${Math.round(a.alt)} m` : ""}</span></button>`
          );
        })
        .join("");
  }

  renderCommandPanel() {
    const box = document.getElementById("tower-commands");
    if (!box) return;
    const a = this.getSelected();
    const rwys = this.runwayList();
    if (!a) {
      box.innerHTML =
        `<p class="tower-hint">点选航班后可指挥。开启「自动指挥」将按列表顺序分配起降（最多前 3 架）。故障机须先授权应急通道。</p>`;
      return;
    }
    if (a.kind === "arr") {
      const rwyBtns = rwys.length
        ? rwys
            .map(
              (r) =>
                `<button class="btn btn-primary" data-tower="land" data-rwy="${r}" type="button">降落 RWY ${String(r).padStart(2, "0")}</button>`
            )
            .join("")
        : `<span class="tower-hint">请先铺设跑道格</span>`;
      const emergBtn =
        a.emergency && !a.emergencyAuth
          ? `<button class="btn btn-danger" data-tower="auth-emergency" data-id="${a.id}" type="button">授权应急通道</button>`
          : `<button class="btn btn-danger" data-tower="emergency" type="button">应急通道（优先降落）</button>`;
      box.innerHTML =
        `<div class="tower-sel-head"><strong style="color:${a.color}">${a.callsign}</strong> · ${a.airline}${a.emergency ? (a.emergencyAuth ? " · 应急已授权" : " · 待授权应急") : ""}</div>` +
        `<p class="tower-hint">高度 ${Math.round(a.alt)} m · 距场 ${Math.round(Math.hypot(a.x, a.y))} m${a.route ? " · " + a.route : ""}${a.planeName ? " · " + a.planeName : ""}</p>` +
        `<div class="tower-cmd-row">${rwyBtns}</div>` +
        `<div class="tower-cmd-row">` +
        `<button class="btn" data-tower="hold" data-laps="1" type="button">绕飞 1 圈</button>` +
        `<button class="btn" data-tower="hold" data-laps="2" type="button">绕飞 2 圈</button>` +
        `<button class="btn" data-tower="hold" data-laps="3" type="button">绕飞 3 圈</button>` +
        `</div>` +
        `<div class="tower-cmd-row">${emergBtn}</div>`;
      return;
    }
    // departure
    const rwyBtns = rwys.length
      ? rwys
          .map(
            (r) =>
              `<button class="btn btn-primary" data-tower="takeoff" data-rwy="${r}" type="button">起飞 RWY ${String(r).padStart(2, "0")}</button>`
          )
          .join("")
      : `<span class="tower-hint">需要跑道才能起飞</span>`;
    box.innerHTML =
      `<div class="tower-sel-head"><strong style="color:${a.color}">${a.callsign}</strong> · 离港起飞</div>` +
      `<p class="tower-hint">航站楼待班 · 指派跑道起飞${a.route ? " · " + a.route : ""}${a.planeName ? " · " + a.planeName : ""}</p>` +
      `<div class="tower-cmd-row">${rwyBtns}</div>`;
  }

  draw() {
    this.drawAirportView();
    this.drawRadar();
  }

  drawAirportView() {
    const canvas = this.viewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 360;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0a2a22";
    ctx.fillRect(0, 0, w, h);

    const layout = this.gridLayout(w, h);
    const { cell, originX, originY } = layout;
    const g = this.grid;

    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.cells[y][x];
        const px = originX + x * cell;
        const py = originY + y * cell;
        if (!c.owned) {
          ctx.fillStyle = "rgba(20, 50, 70, 0.55)";
        } else if (c.type === "runway") {
          ctx.fillStyle = "rgba(55, 60, 68, 0.95)";
        } else if (c.type === "taxi") {
          ctx.fillStyle = "rgba(70, 78, 86, 0.9)";
        } else if (c.type === "tower") {
          ctx.fillStyle = "rgba(232, 168, 56, 0.85)";
        } else if (c.type === "terminal") {
          ctx.fillStyle = "rgba(74, 159, 212, 0.85)";
        } else {
          ctx.fillStyle = "rgba(40, 90, 70, 0.75)";
        }
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "rgba(200,230,245,0.12)";
        ctx.strokeRect(px, py, cell, cell);
        if (c.type === "runway" && c.rwyId) {
          ctx.fillStyle = "rgba(255,200,87,0.9)";
          ctx.font = `${Math.max(9, cell * 0.28)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(String(c.rwyId).padStart(2, "0"), px + cell / 2, py + cell / 2 + 3);
        }
      }
    }

    if (this.hoverCell) {
      const { x, y } = this.hoverCell;
      ctx.strokeStyle = "rgba(255, 200, 87, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(originX + x * cell, originY + y * cell, cell, cell);
    }

    // 场面飞机
    for (const a of this.aircraft) {
      if (a.state === "done" && a.fade <= 0) continue;
      const near =
        a.kind === "dep" ||
        a.state === "landing" ||
        a.state === "taxi" ||
        a.state === "final" ||
        a.state === "taxiOut" ||
        a.state === "departing" ||
        a.state === "lineup" ||
        Math.hypot(a.x, a.y) < 200;
      if (!near) continue;
      const sx = originX + g.w * cell * 0.5 + a.x * (cell / 28);
      const sy = originY + g.h * cell * 0.5 + a.y * (cell / 28);
      ctx.save();
      ctx.globalAlpha = a.state === "done" ? Math.max(0, a.fade) : 1;
      ctx.translate(sx, sy);
      ctx.rotate(a.angle);
      ctx.fillStyle = a.id === this.selectedId ? "#ffc857" : a.color;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, 4);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = "rgba(200,230,245,0.75)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`工具：${this.toolLabel(this.buildTool)} · 点击格子操作`, 12, 18);
  }

  drawRadar() {
    const canvas = this.radarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(canvas.clientWidth || 280, canvas.clientHeight || 280);
    if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const range = this.radarRange();
    const scale = (size * 0.46) / range;

    ctx.fillStyle = "#041018";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(61, 184, 138, 0.35)";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (size * 0.48 * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.48, cy);
    ctx.lineTo(cx + size * 0.48, cy);
    ctx.moveTo(cx, cy - size * 0.48);
    ctx.lineTo(cx, cy + size * 0.48);
    ctx.stroke();

    const sweep = (this.time * 0.7) % (Math.PI * 2);
    ctx.fillStyle = "rgba(61,184,138,0.1)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.48, sweep - 0.5, sweep);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#e8a838";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    for (const a of this.aircraft) {
      if (a.state === "done" || a.kind === "dep" && a.alt <= 0 && a.state !== "departing") {
        if (a.kind === "dep" && (a.state === "gate" || a.state === "taxiOut")) continue;
      }
      if (a.state === "done") continue;
      const dist = Math.hypot(a.x, a.y);
      if (dist > range * 1.05 && a.kind === "arr") continue;
      const px = cx + a.x * scale;
      const py = cy + a.y * scale;
      const selected = a.id === this.selectedId;
      ctx.fillStyle = selected ? "#ffc857" : a.color;
      ctx.beginPath();
      ctx.arc(px, py, selected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(220,235,245,0.9)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText((a.emergency ? "⚠" : "") + a.callsign, px + 7, py - 4);
      ctx.fillStyle = "rgba(160,180,200,0.85)";
      ctx.fillText(a.airline + (a.kind === "dep" ? "·起飞" : ""), px + 7, py + 8);
    }

    ctx.fillStyle = "rgba(61,184,138,0.8)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`雷达 · ${Math.round(range)} m`, cx, size - 10);
  }
}
