/** 苍穹战机 · UI（机库改装 / 组队 / 武器栏） */

const UI = {
  save: null,
  engine: null,
  selectedPlaneId: null,
  prepare: { modeId: null, mapId: null, planeId: null, mission: null },
  armSlotId: null,

  init(save) {
    this.save = save;
    this.selectedPlaneId = save.selectedPlane;
    this.fromBase = false;
    this.bindGlobal();
    // 开局先选地图（默认两岛一陆），再起飞
    this.askMapThenFly({ firstBoot: true });
  },

  bindGlobal() {
    document.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", () => this.handleAction(el.dataset.action));
    });
    document.getElementById("btn-pause")?.addEventListener("click", () => this.togglePause());
    document.getElementById("btn-menu")?.addEventListener("click", () => this.openBase());
    document.getElementById("btn-launch")?.addEventListener("click", () => this.launch());
  },

  /** 询问进入哪张地图，再起飞（默认「两岛一陆」） */
  askMapThenFly(opts = {}) {
    unlockCheck(this.save);
    const unlocked = MAPS.filter((m) => this.save.unlockedMaps.includes(m.id));
    const current = this.save.selectedMap || "home_sea";
    const defaultId = unlocked.some((m) => m.id === "home_sea")
      ? "home_sea"
      : unlocked[0]?.id || "home_sea";
    const prefer = unlocked.some((m) => m.id === current) ? current : defaultId;

    const options = unlocked
      .map((m) => {
        const sel = m.id === prefer ? " selected" : "";
        const mark = m.id === "home_sea" ? "（推荐·两岛一陆）" : "";
        const extra = m.layout ? ` · ${m.layout.length} 块陆地` : "";
        return `<option value="${m.id}"${sel}>${m.name}${mark}${extra}</option>`;
      })
      .join("");

    const lockedHint = MAPS.filter((m) => !this.save.unlockedMaps.includes(m.id))
      .slice(0, 3)
      .map((m) => `${m.name}（需累计分 ${m.unlockScore}）`)
      .join(" · ");

    this.showOverlay(
      "选择地图",
      `请选择要进入的海域（航司排班机场也按所选地图列出）：` +
        `<div class="prepare-block" style="margin-top:0.8rem;text-align:left">` +
        `<h4>地图</h4>` +
        `<select id="fly-map-select">${options}</select>` +
        (lockedHint ? `<p class="tower-hint" style="margin-top:0.5rem">未解锁：${lockedHint}</p>` : "") +
        `</div>`,
      [
        {
          label: "起飞进入",
          primary: true,
          fn: () => {
            const sel = document.getElementById("fly-map-select");
            const mapId = sel?.value || "home_sea";
            this.save.selectedMap = mapId;
            saveGame(this.save);
            this.hideOverlay();
            this.enterFreeFlight(true);
          },
        },
        {
          label: opts.firstBoot ? "默认两岛一陆" : "取消",
          fn: () => {
            this.hideOverlay();
            if (opts.firstBoot || !this.engine || !this.engine.running) {
              this.save.selectedMap = this.save.selectedMap || "home_sea";
              saveGame(this.save);
              this.enterFreeFlight(true);
            }
          },
        },
      ]
    );
  },

  /** 进入 / 恢复自由飞行 */
  enterFreeFlight(forceRestart = false) {
    unlockCheck(this.save);
    const plane = getPlane(this.save.selectedPlane);
    const map = getMap(this.save.selectedMap) || getMap("home_sea");
    if (!plane || !map) {
      this.toast("无法起飞：战机或地图数据缺失");
      return;
    }
    document.getElementById("hud-mode").textContent = "自由飞行";
    document.getElementById("hud-map").textContent = map.name;
    document.getElementById("hud-plane").textContent = plane.name;

    this.hideOverlay();
    this.show("game");
    const canvas = document.getElementById("game-canvas");

    // 等一帧让 canvas 恢复尺寸，再启动引擎
    const boot = () => {
      if (forceRestart || !this.engine || !this.engine.running) {
        if (this.engine) this.engine.stop();
        this.engine = new GameEngine(canvas, this.save, (result) => this.onGameEnd(result));
        this.engine.start({
          mode: "free",
          team: false,
          mapId: map.id,
          planeId: plane.id,
          loadout: getPlaneLoadout(this.save, plane.id),
          mission: null,
        });
      } else {
        this.engine.resize();
        this.engine.resume();
      }
      this.refreshMissionRail();
    };
    requestAnimationFrame(() => requestAnimationFrame(boot));
  },

  openBase() {
    if (this.engine && this.engine.running) this.engine.pause();
    this.fromBase = true;
    this.show("menu");
    this.refreshBrief();
  },

  handleAction(action) {
    switch (action) {
      case "resume":
        this.askMapThenFly();
        break;
      case "hangar":
        this.show("hangar");
        this.renderHangar();
        break;
      case "arsenal":
        this.show("arsenal");
        this.renderArsenal();
        break;
      case "modes":
        this.show("modes");
        this.renderModes();
        break;
      case "maps":
        this.show("maps");
        this.renderMaps();
        break;
      case "missions":
        this.show("missions");
        this.renderMissions();
        break;
      case "airline":
        this.openAirline();
        break;
      case "back":
        this.show("menu");
        this.refreshBrief();
        break;
      case "back-modes":
        this.show("modes");
        this.renderModes();
        break;
      case "back-hangar":
        this.show("hangar");
        this.renderHangar();
        break;
      case "open-custom":
        if (this.selectedPlaneId) this.openCustom(this.selectedPlaneId);
        break;
      default:
        break;
    }
  },

  show(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add("active");
    if (name === "game") this.hideOverlay();
    // 离开塔台屏时若引擎仍在跑则停掉（除主动 exit）
    if (name !== "tower" && this.towerEngine && this.towerEngine.running) {
      this.towerEngine.stop();
      this.towerEngine = null;
    }
  },

  refreshMissionRail() {
    const rail = document.getElementById("mission-rail");
    if (!rail) return;
    const list = allMissions(this.save).filter((m) => !m.claimed);
    if (!list.length) {
      rail.innerHTML = `<div class="mission-chip muted">暂无进行中的任务<br/><span class="prog">支线战斗/密送需在任务条点击开始，不会自动弹出</span></div>`;
      return;
    }
    rail.innerHTML = list
      .slice(0, 5)
      .map((m) => {
        const tag = m.mainline ? "主线" : "支线";
        const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
        const cls = m.done ? "done" : m.mainline ? "main" : "side";
        const fight =
          m.combat && !m.done
            ? `<span class="claim">点击发起战斗</span>`
            : (m.escort || m.type === "escort") && !m.done
              ? `<span class="claim">点击开始密送</span>`
              : m.done
                ? `<span class="claim">点击领奖</span>`
                : "";
        return (
          `<div class="mission-chip ${cls}" data-mid="${m.id}" data-combat="${m.combat ? "1" : "0"}" data-escort="${m.escort || m.type === "escort" ? "1" : "0"}">` +
          `<span class="tag">${tag}</span>` +
          `<strong>${m.title}</strong>` +
          `<span class="prog">${m.progress}/${m.target}（${pct}%）</span>` +
          fight +
          `</div>`
        );
      })
      .join("");

    rail.querySelectorAll(".mission-chip").forEach((el) => {
      el.addEventListener("click", () => {
        const mid = el.dataset.mid;
        const m = allMissions(this.save).find((x) => x.id === mid);
        if (!m) return;
        if (m.done && !m.claimed) {
          if (claimMission(this.save, mid)) {
            this.refreshMissionRail();
            this.refreshBrief();
          }
          return;
        }
        if (!this.engine || !this.engine.running || this.engine.mode !== "free") return;
        if (this.engine.paused) this.engine.resume();
        this.show("game");
        // 点击密送支线
        if ((m.escort || m.type === "escort") && !m.done) {
          this.engine.beginEscortMission(m);
          return;
        }
        // 点击战斗支线 → 在当前飞行中触发扩图开战
        if (m.combat && !m.done) {
          this.engine.beginCombatEvent(m, { expand: true, reason: "支线战斗" });
        }
      });
    });
  },

  showCombatToast(msg) {
    const el = document.getElementById("combat-banner");
    if (!el) return;
    el.classList.remove("hidden");
    el.textContent = msg;
    clearTimeout(this._combatToastTimer);
    this._combatToastTimer = setTimeout(() => {
      if (this.engine && this.engine.combatActive) return;
      el.classList.add("hidden");
    }, 4200);
  },

  refreshBrief() {
    unlockCheck(this.save);
    const plane = getPlane(this.save.selectedPlane);
    const tier = planeTier(plane, this.save);
    const maps = this.save.unlockedMaps.length;
    document.getElementById("player-brief").innerHTML =
      `金币 <strong>${this.save.coins}</strong> · 累计得分 <strong>${this.save.totalScore}</strong><br/>` +
      `出战机：<strong>${plane.name}</strong> <span class="tier-badge ${tier.className}">${tier.name}</span> · ` +
      `武器 <strong>${this.save.ownedWeapons.length}</strong> · 地图 <strong>${maps}/${MAPS.length}</strong>`;
  },

  // —— 机库 ——
  renderHangar() {
    const list = document.getElementById("plane-list");
    list.innerHTML = "";
    for (const plane of PLANES) {
      const owned = this.save.ownedPlanes.includes(plane.id);
      const tier = planeTier(plane, this.save);
      const tag = plane.legend
        ? "传奇"
        : plane.real
          ? plane.nation
          : "虚构";
      const role =
        plane.role === "bomber"
          ? "轰炸机"
          : plane.role === "attack"
            ? "攻击机"
            : plane.role === "fighter"
              ? "战斗机"
              : plane.role === "trainer"
                ? "教练机"
                : "";
      const card = document.createElement("div");
      card.className = `plane-card${owned ? "" : " locked"}${plane.id === this.selectedPlaneId ? " selected" : ""}`;
      card.innerHTML =
        `<span class="tier-badge ${tier.className}">${tier.name}</span>` +
        `<div class="meta"><strong>${plane.name}</strong>` +
        `<span>${tag}${role ? " · " + role : ""} · ${plane.codename}${owned ? "" : " · 未拥有"}</span></div>`;
      card.addEventListener("click", () => {
        this.selectedPlaneId = plane.id;
        this.renderHangar();
      });
      list.appendChild(card);
    }
    this.renderPlaneDetail(getPlane(this.selectedPlaneId));
  },

  renderPlaneDetail(plane) {
    const loadout = getPlaneLoadout(this.save, plane.id);
    const stats = getEffectiveStats(plane, this.save);
    const tier = planeTier(plane, this.save);
    const score = planeScore(plane, this.save);
    const owned = this.save.ownedPlanes.includes(plane.id);
    const selected = this.save.selectedPlane === plane.id;
    const box = document.getElementById("plane-detail");

    const statsHtml =
      STAT_KEYS.map((key) => {
        const v = stats[key];
        const base = plane.stats[key] || 10;
        const boost = v - base;
        return (
          `<div class="stat-row"><span>${STAT_LABELS[key]}</span>` +
          `<div class="stat-bar"><i style="width:${(v / 20) * 100}%"></i></div>` +
          `<span>${v}${boost > 0 ? `(+${boost})` : ""}</span></div>`
        );
      }).join("") +
      `<p class="fuel-note">初始属性为均值水平 · 油箱约 ${Math.round(maxFuelSeconds(plane, this.save))} 秒 · 伤害由武器决定` +
      `${plane.floats ? " · 自带浮筒（可水面迫降返航）" : ""}</p>`;

    const loadoutHtml = plane.hardpoints
      .map((hp) => {
        const wid = loadout[hp.id] || hp.default;
        const w = getWeapon(wid);
        return (
          `<div class="loadout-row">` +
          `<span class="slot-type">${SLOT_LABELS[hp.type] || hp.type}</span>` +
          `<span class="slot-weapon">${w ? w.name : "空"}</span>` +
          `<span class="slot-dmg">伤害 ${w ? w.damage : "—"}</span>` +
          `</div>`
        );
      })
      .join("");

    box.innerHTML =
      `<div class="detail-hero">` +
      `<div class="plane-preview"><canvas id="preview-canvas"></canvas></div>` +
      `<div class="detail-info">` +
      `<h3>${plane.name}</h3>` +
      `<span class="tier-badge ${tier.className}">${tier.name}</span>` +
      `<span style="margin-left:0.5rem;color:var(--muted);font-size:0.8rem">综合 ${score}/100` +
      `${plane.legend ? " · 传奇" : plane.real ? " · 现实机型" : ""}</span>` +
      `<p class="desc">${plane.desc}</p>` +
      `</div></div>` +
      `<div class="stat-grid">${statsHtml}</div>` +
      `<h4 class="section-title">当前挂载（概览）</h4>` +
      `<div class="loadout-list">${loadoutHtml}</div>` +
      `<div class="detail-actions" id="detail-actions"></div>` +
      (owned
        ? `<div class="hangar-custom-foot">` +
          `<button class="btn btn-primary btn-custom-enter" type="button" id="btn-enter-custom">定制</button>` +
          `<p class="fuel-note">进入定制：付费强化速度/装甲/机动/油量，并解锁挂点换装（武器需已拥有）</p>` +
          `</div>`
        : "");

    drawPlanePreview(document.getElementById("preview-canvas"), plane);

    const actions = document.getElementById("detail-actions");
    if (owned) {
      if (!selected) {
        const btn = document.createElement("button");
        btn.className = "btn btn-primary";
        btn.textContent = "设为出战";
        btn.onclick = () => {
          this.save.selectedPlane = plane.id;
          saveGame(this.save);
          this.renderHangar();
          this.refreshBrief();
        };
        actions.appendChild(btn);
      } else {
        const b = document.createElement("button");
        b.className = "btn";
        b.disabled = true;
        b.textContent = "当前出战";
        actions.appendChild(b);
      }
      document.getElementById("btn-enter-custom")?.addEventListener("click", () => {
        this.openCustom(plane.id);
      });
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = plane.gift ? "领取" : `解锁 · ${plane.unlockCost} 金币`;
      btn.onclick = () => {
        const r = buyPlane(this.save, plane.id);
        if (!r.ok) {
          this.toast(r.msg);
          return;
        }
        this.save.selectedPlane = plane.id;
        saveGame(this.save);
        this.renderHangar();
        this.refreshBrief();
      };
      actions.appendChild(btn);
    }
  },

  openCustom(planeId) {
    const plane = getPlane(planeId);
    if (!plane || !this.save.ownedPlanes.includes(planeId)) {
      this.toast("请先拥有该战机");
      return;
    }
    this.selectedPlaneId = planeId;
    document.getElementById("custom-title").textContent = `定制 · ${plane.name}`;
    this.show("custom");
    this.renderCustomPage(plane);
  },

  renderCustomPage(plane) {
    const page = document.getElementById("custom-page");
    const unlock = getCustomUnlock(this.save, plane.id);
    const boosts = getStatBoosts(this.save, plane.id);
    const stats = getEffectiveStats(plane, this.save);
    const loadout = getPlaneLoadout(this.save, plane.id);

    const statRows = STAT_KEYS.map((key) => {
      const base = plane.stats[key] || 10;
      const boost = boosts[key] || 0;
      const val = stats[key];
      const cost = statUpgradeCost(boost);
      const maxed = val >= 20;
      return (
        `<div class="custom-row">` +
        `<div><strong>${STAT_LABELS[key]}</strong>` +
        `<p>初始 ${base} · 强化 +${boost} · 当前 <b>${val}</b>/20</p></div>` +
        `<button class="btn btn-primary" data-boost-stat="${key}" ${maxed ? "disabled" : ""}>` +
        (maxed ? "已满" : `强化 · ${cost} 金币`) +
        `</button></div>`
      );
    }).join("");

    const unlockRows = ["basic", "medium", "heavy"]
      .map((key) => {
        const tier = CUSTOM_UNLOCK[key];
        const hasSlot = plane.hardpoints.some((h) => tier.slots.includes(h.type));
        if (!hasSlot && key !== "basic") return "";
        if (unlock[key]) {
          return `<div class="custom-row unlocked"><strong>${tier.name}</strong><span>已解锁</span></div>`;
        }
        const blocked = tier.requires && !unlock[tier.requires];
        return (
          `<div class="custom-row"><div><strong>${tier.name}</strong><p>${tier.desc}</p></div>` +
          `<button class="btn btn-primary" data-unlock-tier="${key}" ${blocked ? "disabled" : ""}>` +
          (blocked ? "需先开基础定制" : `解锁 · ${tier.cost} 金币`) +
          `</button></div>`
        );
      })
      .join("");

    const loadoutHtml = plane.hardpoints
      .map((hp) => {
        const wid = loadout[hp.id] || hp.default;
        const w = getWeapon(wid);
        const canEdit = isSlotCustomizable(this.save, plane.id, hp.type);
        return (
          `<div class="loadout-row${canEdit ? " clickable" : " locked-slot"}" data-slot="${hp.id}">` +
          `<span class="slot-type">${SLOT_LABELS[hp.type]}</span>` +
          `<span class="slot-weapon">${w ? w.name : "空"}${canEdit ? "" : '<span class="slot-lock">未解锁</span>'}</span>` +
          `<span class="slot-dmg">伤害 ${w ? w.damage : "—"}</span></div>`
        );
      })
      .join("");

    page.innerHTML =
      `<p class="fuel-note">金币：<strong style="color:var(--amber)">${this.save.coins}</strong> · 属性从均值起步，每次强化需付费</p>` +
      `<h4 class="section-title">属性强化</h4><div class="custom-list">${statRows}</div>` +
      `<h4 class="section-title">挂点权限</h4><div class="custom-list">${unlockRows}</div>` +
      `<h4 class="section-title">起飞挂载（点已解锁挂点换装 · 仅已拥有武器）</h4>` +
      `<div class="loadout-list">${loadoutHtml}</div>` +
      `<div class="detail-actions" style="margin-top:1rem">` +
      `<button class="btn" type="button" id="btn-reset-loadout">恢复标准挂载</button>` +
      `</div>`;

    page.querySelectorAll("[data-boost-stat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = buyStatBoost(this.save, plane.id, btn.dataset.boostStat);
        if (!r.ok) {
          this.toast(r.msg);
          return;
        }
        this.renderCustomPage(plane);
        this.refreshBrief();
      });
    });
    page.querySelectorAll("[data-unlock-tier]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = buyCustomUnlock(this.save, plane.id, btn.dataset.unlockTier);
        if (!r.ok) {
          this.toast(r.msg);
          return;
        }
        this.toast(`已解锁：${CUSTOM_UNLOCK[btn.dataset.unlockTier].name}`);
        this.renderCustomPage(plane);
        this.refreshBrief();
      });
    });
    page.querySelectorAll(".loadout-row").forEach((row) => {
      row.addEventListener("click", () => {
        const hp = plane.hardpoints.find((h) => h.id === row.dataset.slot);
        if (!hp) return;
        if (!isSlotCustomizable(this.save, plane.id, hp.type)) {
          const key = slotUnlockKey(hp.type);
          this.toast(`请先解锁「${CUSTOM_UNLOCK[key].name}」`);
          return;
        }
        this.openSlotPicker(plane.id, row.dataset.slot, true);
      });
    });
    document.getElementById("btn-reset-loadout")?.addEventListener("click", () => {
      resetLoadout(this.save, plane.id);
      this.renderCustomPage(plane);
    });
  },

  openSlotPicker(planeId, slotId, fromCustom = false) {
    const plane = getPlane(planeId);
    const hp = plane.hardpoints.find((h) => h.id === slotId);
    if (!hp) return;
    if (!isSlotCustomizable(this.save, planeId, hp.type)) {
      this.toast("该挂点尚未解锁定制");
      return;
    }
    const owned = WEAPONS.filter(
      (w) => this.save.ownedWeapons.includes(w.id) && canFitWeapon(hp.type, w)
    );
    if (!owned.length) {
      this.toast("没有可装入的已拥有武器，请先去武器库购买。");
      return;
    }

    const options = owned
      .map((w) => {
        return `<button class="btn slot-opt" data-wid="${w.id}">${w.name} · 伤害 ${w.damage} · 弹量 ${w.ammo}</button>`;
      })
      .join("");

    this.showOverlay(
      `定制挂载 · ${SLOT_LABELS[hp.type]}`,
      `仅显示你已拥有的武器：<div class="slot-opt-list">${options}</div>`,
      [{ label: "取消", fn: () => this.hideOverlay() }]
    );

    document.querySelectorAll(".slot-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = setLoadoutSlot(this.save, planeId, slotId, btn.dataset.wid);
        if (!r.ok) {
          this.toast(r.msg);
          return;
        }
        this.hideOverlay();
        if (fromCustom) this.renderCustomPage(plane);
        else this.renderHangar();
      });
    });
  },

  // —— 武器库 ——
  renderArsenal() {
    const list = document.getElementById("arsenal-list");
    list.innerHTML = "";
    const cats = [
      ["gun", "机炮"],
      ["missile", "导弹"],
      ["rocket", "火箭"],
    ];
    for (const [cat, label] of cats) {
      const title = document.createElement("h3");
      title.className = "arsenal-cat";
      title.textContent = label;
      list.appendChild(title);

      for (const w of WEAPONS.filter((x) => x.category === cat)) {
        const owned = this.save.ownedWeapons.includes(w.id);
        const card = document.createElement("div");
        card.className = `weapon-card${owned ? " owned" : ""}`;
        card.innerHTML =
          `<div class="weapon-head"><strong>${w.name}</strong>` +
          `<span class="dmg-tag">伤害 ${w.damage}</span></div>` +
          `<p>${w.desc}</p>` +
          `<div class="weapon-meta">${w.nameEn} · 弹量 ${w.ammo} · 射速 ${w.fireRate}s` +
          `${owned ? " · 已拥有" : ` · ${w.cost} 金币`}</div>`;
        if (!owned && !w.gift) {
          const btn = document.createElement("button");
          btn.className = "btn btn-primary";
          btn.textContent = `购买 · ${w.cost}`;
          btn.onclick = () => {
            const r = buyWeapon(this.save, w.id);
            if (!r.ok) {
              this.toast(r.msg);
              return;
            }
            this.renderArsenal();
            this.refreshBrief();
          };
          card.appendChild(btn);
        }
        list.appendChild(card);
      }
    }
  },

  // —— 模式 ——
  renderModes() {
    const grid = document.getElementById("mode-grid");
    grid.innerHTML = "";
    for (const mode of MODES) {
      const card = document.createElement("div");
      card.className = "mode-card";
      card.innerHTML =
        `<h3>${mode.name}</h3><p>${mode.desc}</p><span class="mode-tag">${mode.tag}</span>`;
      card.addEventListener("click", () => this.openPrepare(mode.id));
      grid.appendChild(card);
    }
  },

  openAirline() {
    this.airlineTab = this.airlineTab === "tower" ? "home" : this.airlineTab || "home";
    maybeRollResumes(this.save);
    this.show("airline");
    this.bindAirlineTabs();
    this.syncAirlineTabs();
    this.renderAirline();
  },

  syncAirlineTabs() {
    const root = document.getElementById("screen-airline");
    if (!root) return;
    root.querySelectorAll("[data-airline-tab]").forEach((b) => {
      b.classList.toggle("btn-primary", b.dataset.airlineTab === (this.airlineTab || "home"));
    });
  },

  bindAirlineTabs() {
    const root = document.getElementById("screen-airline");
    if (!root || root._airlineBound) return;
    root._airlineBound = true;
    root.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-airline-tab]");
      if (tab) {
        this.airlineTab = tab.dataset.airlineTab;
        this.syncAirlineTabs();
        if (this.airlineTab === "tower") {
          this.enterTower();
          return;
        }
        this.renderAirline();
        return;
      }
      const act = e.target.closest("[data-airline]");
      if (!act) return;
      this.handleAirlineAction(act);
    });
  },

  handleAirlineAction(el) {
    const act = el.dataset.airline;
    if (act === "found") {
      const name = document.getElementById("airline-name-input")?.value || "";
      const r = foundAirline(this.save, name);
      this.toast(r.ok ? `「${name.trim()}」开业成功（-500）` : r.msg);
      this.renderAirline();
      this.refreshBrief();
      return;
    }
    if (act === "buy-plane") {
      const r = buyAirliner(this.save, el.dataset.id);
      if (!r.ok) this.toast(r.msg);
      else this.toast(`购入 ${r.plane.name}（-${getAirliner(el.dataset.id).price}）`);
      this.renderAirline();
      this.refreshBrief();
      return;
    }
    if (act === "recruit") {
      const r = activeRecruit(this.save);
      this.toast(r.ok ? `${r.applicant.name} 投来简历（中介 -80）` : r.msg);
      this.renderAirline();
      this.refreshBrief();
      return;
    }
    if (act === "offer") {
      const id = el.dataset.id;
      const input = document.getElementById(`offer-${id}`);
      const pay = input ? input.value : el.dataset.pay;
      const r = offerPilotSalary(this.save, id, pay);
      this.toast(r.msg || (r.ok ? "已入职" : "失败"));
      this.renderAirline();
      this.refreshBrief();
      return;
    }
    if (act === "dismiss-app") {
      dismissApplicant(this.save, el.dataset.id);
      this.renderAirline();
      return;
    }
    if (act === "fire") {
      const r = firePilot(this.save, el.dataset.id);
      this.toast(r.msg || "已解约");
      this.renderAirline();
      return;
    }
    if (act === "assign-duty") {
      const pid = el.dataset.id;
      const planeSel = document.getElementById(`duty-plane-${pid}`);
      const fromSel = document.getElementById(`duty-from-${pid}`);
      const toSel = document.getElementById(`duty-to-${pid}`);
      const r = assignPilotDuty(
        this.save,
        pid,
        planeSel?.value,
        fromSel?.value,
        toSel?.value
      );
      this.toast(r.msg || (r.ok ? "已排班" : "失败"));
      this.renderAirline();
      return;
    }
    if (act === "clear-duty") {
      clearPilotDuty(this.save, el.dataset.id);
      this.toast("已清空排班");
      this.renderAirline();
      return;
    }
    if (act === "open-tower") {
      this.airlineTab = "tower";
      this.syncAirlineTabs();
      this.enterTower();
    }
  },

  renderAirline() {
    const page = document.getElementById("airline-page");
    const hint = document.getElementById("airline-hint");
    if (!page) return;
    const al = ensureAirline(this.save);
    if (hint) {
      hint.textContent = al.founded
        ? `${al.name} · 金币 ${this.save.coins} · 机队 ${al.fleet.length} · 飞行员 ${al.pilots.length}`
        : `创立费 500 金币 · 当前持有 ${this.save.coins}`;
    }
    const tab = this.airlineTab || "home";
    if (!al.founded) {
      page.innerHTML =
        `<div class="airline-card">` +
        `<h3>创立航空公司</h3>` +
        `<p class="tower-hint">用金币创办自己的航司，采购波音 / 空客 / C919 等民机，并招募飞行员谈定月薪。</p>` +
        `<label class="airline-label">公司名称</label>` +
        `<input id="airline-name-input" class="airline-input" maxlength="12" placeholder="例如：苍穹航空" />` +
        `<button class="btn btn-primary" data-airline="found" type="button">创立 · 500 金币</button>` +
        `</div>`;
      return;
    }
    if (tab === "fleet") {
      page.innerHTML =
        `<p class="tower-hint">金币：<strong style="color:var(--amber)">${this.save.coins}</strong> · 点击机型购买加入机队</p>` +
        `<div class="airline-grid">` +
        AIRLINER_CATALOG.map((p) => {
          const owned = al.fleet.filter((f) => f.catalogId === p.id).length;
          return (
            `<div class="airline-card">` +
            `<h3>${p.makerZh} ${p.name}</h3>` +
            `<p>${p.maker} · 座级约 ${p.seats} · ${p.tier}</p>` +
            `<p class="airline-price">${p.price} 金币</p>` +
            `<p class="tower-hint">已拥有 ${owned} 架</p>` +
            `<button class="btn btn-primary" data-airline="buy-plane" data-id="${p.id}" type="button" ${this.save.coins < p.price ? "disabled" : ""}>购买</button>` +
            `</div>`
          );
        }).join("") +
        `</div>` +
        (al.fleet.length
          ? `<h4 class="section-title">现有机队</h4><ul class="airline-list">` +
            al.fleet.map((f) => `<li>${f.name} <span class="tower-hint">#${f.uid}</span></li>`).join("") +
            `</ul>`
          : "");
      return;
    }
    if (tab === "pilots") {
      maybeRollResumes(this.save);
      const apps = al.applicants
        .map((app) => {
          return (
            `<div class="airline-card">` +
            `<h3>${app.name} · ${app.title}</h3>` +
            `<p>${app.note} · 飞行 ${app.years} 年</p>` +
            `<p class="tower-hint">期望月薪 ≥ ${app.expectMin}（理想约 ${app.expectIdeal}）` +
            `${app.lastOffer != null ? ` · 上次开价 ${app.lastOffer}` : ""}</p>` +
            `<div class="tower-cmd-row">` +
            `<input id="offer-${app.id}" class="airline-input airline-input-sm" type="number" min="20" value="${app.expectMin}" />` +
            `<button class="btn btn-primary" data-airline="offer" data-id="${app.id}" type="button">提出月薪</button>` +
            `<button class="btn" data-airline="dismiss-app" data-id="${app.id}" type="button">婉拒</button>` +
            `</div></div>`
          );
        })
        .join("");
      const map = getMap(this.save.selectedMap) || getMap("home_sea");
      const airports = listAirportNames(this.save);
      const pilots = al.pilots.length
        ? al.pilots
            .map((p) => {
              const flyable = al.fleet.filter((f) => pilotCanFly(p, f.catalogId));
              const planeOpts =
                `<option value="">选择执飞机</option>` +
                flyable
                  .map(
                    (f) =>
                      `<option value="${f.uid}" ${p.assignedPlaneUid === f.uid ? "selected" : ""}>${f.name}</option>`
                  )
                  .join("");
              const fromOpts =
                `<option value="">起点机场</option>` +
                airports
                  .map(
                    (n) =>
                      `<option value="${n}" ${p.routeFrom === n ? "selected" : ""}>${n}</option>`
                  )
                  .join("");
              const toOpts =
                `<option value="">终点机场</option>` +
                airports
                  .map(
                    (n) =>
                      `<option value="${n}" ${p.routeTo === n ? "selected" : ""}>${n}</option>`
                  )
                  .join("");
              return (
                `<div class="airline-card">` +
                `<h3>${p.name}</h3>` +
                `<p>${p.title} · 月薪 ${p.salary}</p>` +
                `<p class="tower-hint">可飞：${skillsLabel(p.skills)}</p>` +
                `<p class="airline-duty"><strong>当前排班：</strong>${pilotDutyText(p, this.save)}</p>` +
                `<div class="airline-duty-form">` +
                `<select id="duty-plane-${p.id}" class="airline-input">${planeOpts}</select>` +
                `<select id="duty-from-${p.id}" class="airline-input">${fromOpts}</select>` +
                `<select id="duty-to-${p.id}" class="airline-input">${toOpts}</select>` +
                `</div>` +
                `<div class="tower-cmd-row">` +
                `<button class="btn btn-primary" data-airline="assign-duty" data-id="${p.id}" type="button">保存排班</button>` +
                `<button class="btn" data-airline="clear-duty" data-id="${p.id}" type="button">清空</button>` +
                `<button class="btn" data-airline="fire" data-id="${p.id}" type="button">解约</button>` +
                `</div>` +
                (flyable.length
                  ? ""
                  : `<p class="tower-hint">暂无其可驾驶的机队飞机，请先采购匹配机型</p>`) +
                `</div>`
              );
            })
            .join("")
        : `<p class="tower-hint">尚无在职飞行员</p>`;
      page.innerHTML =
        `<p class="tower-hint">当前地图「${map ? map.name : "两岛一陆"}」机场：${airports.join("、") || "无"}（换图请在「返回飞行」时重选）</p>` +
        `<div class="tower-cmd-row" style="margin-bottom:0.75rem">` +
        `<button class="btn btn-primary" data-airline="recruit" type="button">主动招募（80 金币）</button>` +
        `<span class="tower-hint">排班后和平飞行与塔台才会出现「${al.name}」登记航线</span>` +
        `</div>` +
        `<h4 class="section-title">简历箱（${al.applicants.length}）</h4>` +
        (apps || `<p class="tower-hint">暂无新简历，可主动招募</p>`) +
        `<h4 class="section-title">在职飞行员与航线（${al.pilots.length}）</h4>${pilots}`;
      return;
    }
    // home
    const dutyLines = al.pilots.length
      ? al.pilots
          .map((p) => `<li><strong>${p.name}</strong> — ${pilotDutyText(p, this.save)}</li>`)
          .join("")
      : "<li>暂无飞行员排班</li>";
    page.innerHTML =
      `<div class="airline-card">` +
      `<h3>${al.name}</h3>` +
      `<p>机队 ${al.fleet.length} 架 · 飞行员 ${al.pilots.length} 名 · 金币 ${this.save.coins}</p>` +
      `<p class="tower-hint">已登记航线 ${listedAirlineFlights(this.save).length} 条 · 和平飞行与塔台只会刷登记航班（不会无故冒出公司名）。</p>` +
      `<div class="tower-cmd-row" style="margin-top:0.6rem">` +
      `<button class="btn btn-primary" data-airline="open-tower" type="button">进入塔台指挥</button>` +
      `</div>` +
      `</div>` +
      `<div class="airline-card">` +
      `<h3>机组排班一览</h3>` +
      `<ul class="airline-list">${dutyLines}</ul>` +
      `<p class="tower-hint">到「飞行员」页为每人指定执飞机型与起降机场（仅当前所选地图）。</p>` +
      `</div>`;
  },

  enterTower() {
    if (this.engine && this.engine.running) this.engine.pause();
    if (this.towerEngine) {
      this.towerEngine.stop();
      this.towerEngine = null;
    }
    this.airlineTab = "tower";
    this.show("tower");
    this.towerEngine = new TowerEngine(this.save, () => {
      this.towerEngine = null;
      this.airlineTab = "home";
      this.openAirline();
    });
    window.UI = this;
    this.towerEngine.start();
  },

  renderMaps() {
    unlockCheck(this.save);
    const grid = document.getElementById("map-grid");
    grid.innerHTML = "";
    for (const map of MAPS) {
      const unlocked = this.save.unlockedMaps.includes(map.id);
      const card = document.createElement("div");
      card.className = `map-card${unlocked ? "" : " locked"}`;
      card.innerHTML =
        `<h3>${map.name}</h3><p>${map.desc}</p>` +
        `<p style="margin-top:0.5rem;font-size:0.78rem;color:var(--steel)">` +
        `陆块 ${(map.layout || []).length} · 海域 ${map.size}` +
        `${(map.layout || []).some((l) => l.type === "continent") ? " · 含大陆" : ""}</p>` +
        `<div class="map-status">${unlocked ? "已解锁" : `需累计得分 ${map.unlockScore}`}</div>`;
      if (unlocked) {
        card.addEventListener("click", () => {
          this.save.selectedMap = map.id;
          saveGame(this.save);
          this.toast(`已选择地图：${map.name}`);
          this.refreshBrief();
        });
      }
      grid.appendChild(card);
    }
  },

  renderMissions() {
    document.getElementById("mission-date").textContent = `今日 · ${this.save.missionDay} · 主线=每日 · 支线=随机`;
    const list = document.getElementById("mission-list");
    list.innerHTML = "";
    const groups = [
      ["主线任务（每日）", this.save.missions || []],
      ["支线任务（随机）", this.save.sideMissions || []],
    ];
    for (const [title, arr] of groups) {
      const h = document.createElement("h3");
      h.className = "arsenal-cat";
      h.textContent = title;
      list.appendChild(h);
      for (const m of arr) {
        const card = document.createElement("div");
        card.className = `mission-card${m.claimed ? " done" : ""}`;
        const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
        card.innerHTML =
          `<h3>${m.title}</h3><p>${m.desc}</p>` +
          `<p style="margin-top:0.5rem;font-size:0.8rem;color:var(--foam)">进度 ${m.progress}/${m.target}（${pct}%）</p>` +
          `<div class="reward">奖励 ${m.reward} 金币${m.claimed ? " · 已领取" : m.done ? " · 可领取" : ""}</div>`;
        if (m.done && !m.claimed) {
          card.addEventListener("click", () => {
            claimMission(this.save, m.id);
            this.toast(`领取 ${m.reward} 金币`);
            this.renderMissions();
            this.refreshMissionRail();
            this.refreshBrief();
          });
        } else if (!m.done && (m.escort || m.type === "escort")) {
          card.addEventListener("click", () => {
            if (this.engine && this.engine.running && this.engine.mode === "free") {
              this.show("game");
              this.engine.beginEscortMission(m);
            } else {
              this.toast("请先进入自由飞行，再从任务栏开始密送");
            }
          });
        } else if (!m.done && m.combat) {
          card.addEventListener("click", () => this.openPrepare("combat", m));
        }
        list.appendChild(card);
      }
    }
  },

  openPrepare(modeId, mission = null) {
    this.prepare.modeId = modeId;
    this.prepare.mission = mission;
    this.prepare.planeId = this.save.selectedPlane;
    this.prepare.mapId = this.save.selectedMap;

    const mode = getMode(modeId);
    document.getElementById("prepare-title").textContent = mode ? mode.name : "出战准备";
    document.getElementById("prepare-hint").textContent = mission
      ? mission.desc
      : mode
        ? mode.tag
        : "";

    const owned = PLANES.filter((p) => this.save.ownedPlanes.includes(p.id));
    document.getElementById("prepare-plane").innerHTML =
      `<div class="prepare-block"><h4>选择战机</h4>` +
      `<select id="sel-plane">${owned
        .map((p) => {
          const t = planeTier(p, this.save);
          return `<option value="${p.id}" ${p.id === this.prepare.planeId ? "selected" : ""}>${p.name}（${t.name}）</option>`;
        })
        .join("")}</select></div>`;

    const unlocked = MAPS.filter((m) => this.save.unlockedMaps.includes(m.id));
    document.getElementById("prepare-map").innerHTML =
      `<div class="prepare-block"><h4>选择地图</h4>` +
      `<select id="sel-map">${unlocked
        .map(
          (m) =>
            `<option value="${m.id}" ${m.id === this.prepare.mapId ? "selected" : ""}>${m.name}${m.connected ? " · 连岛" : ""}</option>`
        )
        .join("")}</select></div>`;

    const loadHint = document.getElementById("prepare-loadout");
    if (loadHint) {
      const refresh = () => {
        const pid = document.getElementById("sel-plane")?.value || this.prepare.planeId;
        const plane = getPlane(pid);
        const loadout = getPlaneLoadout(this.save, pid);
        loadHint.innerHTML =
          `<div class="prepare-block"><h4>当前挂载</h4>` +
          plane.hardpoints
            .map((hp) => {
              const w = getWeapon(loadout[hp.id] || hp.default);
              return `<div class="mini-load">${SLOT_LABELS[hp.type]}：${w ? `${w.name}（伤 ${w.damage}）` : "空"}</div>`;
            })
            .join("") +
          `</div>`;
      };
      refresh();
      document.getElementById("sel-plane")?.addEventListener("change", refresh);
    }

    this.show("prepare");
  },

  launch() {
    const planeSel = document.getElementById("sel-plane");
    const mapSel = document.getElementById("sel-map");
    if (planeSel) this.prepare.planeId = planeSel.value;
    if (mapSel) this.prepare.mapId = mapSel.value;

    this.save.selectedPlane = this.prepare.planeId;
    this.save.selectedMap = this.prepare.mapId;
    saveGame(this.save);

    const mode = getMode(this.prepare.modeId);
    const map = getMap(this.prepare.mapId);
    const plane = getPlane(this.prepare.planeId);
    const playMode = this.prepare.modeId === "mission" ? this.missionCombatMode() : this.prepare.modeId;

    document.getElementById("hud-mode").textContent = mode?.name || playMode;
    document.getElementById("hud-map").textContent = map.name;
    document.getElementById("hud-plane").textContent = plane.name;

    this.show("game");
    const canvas = document.getElementById("game-canvas");
    if (this.engine) this.engine.stop();
    this.engine = new GameEngine(canvas, this.save, (result) => this.onGameEnd(result));
    this.engine.start({
      mode: playMode,
      team: playMode === "team" || mode?.team,
      mapId: this.prepare.mapId,
      planeId: this.prepare.planeId,
      loadout: getPlaneLoadout(this.save, this.prepare.planeId),
      mission: this.prepare.mission,
    });
  },

  missionCombatMode() {
    const m = this.prepare.mission;
    if (!m) return "combat";
    if (m.type === "explore") return "free";
    if (m.type === "survive") return "survive";
    return "combat";
  },

  togglePause() {
    if (!this.engine || !this.engine.running) return;
    if (this.engine.paused) {
      this.hideOverlay();
      this.show("game");
      this.engine.resume();
    } else {
      this.engine.pause();
      this.showOverlay("暂停", "飞行暂停中。可继续巡航，或打开基地改装 / 查看任务。", [
        {
          label: "继续飞行",
          primary: true,
          fn: () => {
            this.hideOverlay();
            this.engine.resume();
          },
        },
        {
          label: "打开基地",
          fn: () => {
            this.hideOverlay();
            this.openBase();
          },
        },
        {
          label: "结束本次飞行",
          fn: () => {
            this.hideOverlay();
            this.engine.endGame(true);
          },
        },
      ]);
    }
  },

  onGameEnd(result) {
    const wasFree = this.engine && this.engine.mode === "free";
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }
    this.refreshMissionRail();
    const title = result.crashed ? "战机坠毁" : "飞行结束";
    let body =
      `得分 ${result.score} · 击坠 ${result.kills} · 存活 ${result.time}s` +
      (result.combo > 1 ? ` · 最高连击 ${result.combo}` : "") +
      `<br/>获得金币 <strong style="color:var(--amber)">${result.coins}</strong>`;
    if (result.alliesLeft !== undefined) body += `<br/>队友存活 ${result.alliesLeft}`;

    this.show("game");
    this.showOverlay(title, body, [
      {
        label: wasFree || result.crashed ? "重新起飞" : "再来一局",
        primary: true,
        fn: () => {
          this.hideOverlay();
          if (wasFree || !this.prepare.modeId) this.enterFreeFlight(true);
          else this.openPrepare(this.prepare.modeId, this.prepare.mission);
        },
      },
      {
        label: "打开基地",
        fn: () => {
          this.hideOverlay();
          this.openBase();
        },
      },
    ]);
  },

  showOverlay(title, html, actions) {
    const overlay = document.getElementById("overlay");
    const card = document.getElementById("overlay-card");
    card.innerHTML = `<h3>${title}</h3><div class="overlay-body">${html}</div><div class="actions"></div>`;
    const box = card.querySelector(".actions");
    for (const a of actions) {
      const btn = document.createElement("button");
      btn.className = a.primary ? "btn btn-primary" : "btn";
      btn.textContent = a.label;
      btn.onclick = a.fn;
      box.appendChild(btn);
    }
    overlay.classList.remove("hidden");
  },

  hideOverlay() {
    document.getElementById("overlay").classList.add("hidden");
  },

  toast(msg) {
    this.showOverlay("提示", msg, [{ label: "好的", primary: true, fn: () => this.hideOverlay() }]);
  },
};

window.UI = UI;
