/** 本地存档 · 含武器库存与改装挂载 */

const SAVE_KEY = "skywing_save_v3";

function defaultSave() {
  const today = dateKey();
  const loadouts = {};
  for (const p of PLANES) loadouts[p.id] = defaultLoadout(p);

  return {
    coins: 800,
    totalScore: 0,
    ownedPlanes: ["lark"],
    selectedPlane: "lark",
    unlockedMaps: ["home_sea"],
    selectedMap: "home_sea",
    ownedWeapons: giftWeaponIds(),
    loadouts,
    /** 每架机的定制解锁：{ basic, medium, heavy } */
    customUnlocks: {},
    /** 每架机属性强化：{ speed, armor, agility, range } 各为已购等级 */
    statBoosts: {},
    missionDay: today,
    missions: rollDailyMissions(today),
    sideMissions: rollSideMissions(today),
    landCount: 0,
    stats: { kills: 0, flights: 0, playTime: 0 },
    /** 塔台指挥机场设施 */
    tower: { ...TOWER_DEFAULT, grid: createDefaultTowerGrid() },
    /** 玩家自创航空公司 */
    airline: defaultAirline(),
  };
}

function getCustomUnlock(save, planeId) {
  if (!save.customUnlocks) save.customUnlocks = {};
  if (!save.customUnlocks[planeId]) {
    save.customUnlocks[planeId] = { basic: false, medium: false, heavy: false };
  }
  return save.customUnlocks[planeId];
}

function isSlotCustomizable(save, planeId, slotType) {
  const u = getCustomUnlock(save, planeId);
  const key = slotUnlockKey(slotType);
  return !!u[key];
}

function buyCustomUnlock(save, planeId, tierId) {
  const plane = getPlane(planeId);
  const tier = CUSTOM_UNLOCK[tierId];
  if (!plane || !tier) return { ok: false, msg: "无法解锁" };
  if (!save.ownedPlanes.includes(planeId)) return { ok: false, msg: "未拥有该机" };
  const u = getCustomUnlock(save, planeId);
  if (u[tierId]) return { ok: false, msg: "已解锁" };
  if (tier.requires && !u[tier.requires]) {
    return { ok: false, msg: `请先解锁${CUSTOM_UNLOCK[tier.requires].name}` };
  }
  if (save.coins < tier.cost) return { ok: false, msg: "金币不足" };
  save.coins -= tier.cost;
  u[tierId] = true;
  saveGame(save);
  return { ok: true };
}

function getStatBoosts(save, planeId) {
  if (!save.statBoosts) save.statBoosts = {};
  if (!save.statBoosts[planeId]) {
    save.statBoosts[planeId] = { speed: 0, armor: 0, agility: 0, range: 0 };
  }
  return save.statBoosts[planeId];
}

function buyStatBoost(save, planeId, statKey) {
  const plane = getPlane(planeId);
  if (!plane || !save.ownedPlanes.includes(planeId)) return { ok: false, msg: "未拥有该机" };
  if (!STAT_KEYS.includes(statKey)) return { ok: false, msg: "属性无效" };
  const boosts = getStatBoosts(save, planeId);
  const cur = boosts[statKey] || 0;
  const base = plane.stats[statKey] || 10;
  if (base + cur >= 20) return { ok: false, msg: "已达属性上限" };
  const cost = statUpgradeCost(cur);
  if (save.coins < cost) return { ok: false, msg: "金币不足" };
  save.coins -= cost;
  boosts[statKey] = cur + 1;
  saveGame(save);
  return { ok: true, cost };
}

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadSave() {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) ||
      localStorage.getItem("skywing_save_v2") ||
      localStorage.getItem("skywing_save_v1");
    let data;
    if (raw) {
      const old = JSON.parse(raw);
      data = { ...defaultSave(), ...old };
      data.ownedPlanes = (data.ownedPlanes || ["lark"]).filter((id) => getPlane(id));
      if (!data.ownedPlanes.length) data.ownedPlanes = ["lark"];
      if (!getPlane(data.selectedPlane)) data.selectedPlane = data.ownedPlanes[0];
      // 旧地图 id 迁移
      const mapAlias = { dawn_isle: "home_sea", twin_reef: "twin_arch", coral_chain: "grand_chain", storm_arch: "storm_realm", endless_sea: "endless_sky" };
      data.unlockedMaps = [...new Set((data.unlockedMaps || []).map((id) => mapAlias[id] || id).filter((id) => getMap(id)))];
      if (!data.unlockedMaps.length) data.unlockedMaps = ["home_sea"];
      data.selectedMap = mapAlias[data.selectedMap] || data.selectedMap;
      if (!getMap(data.selectedMap)) data.selectedMap = "home_sea";
    } else {
      data = defaultSave();
      saveGame(data);
      return data;
    }

    if (!data.loadouts) data.loadouts = {};
    if (!data.ownedWeapons) data.ownedWeapons = giftWeaponIds();
    if (!data.customUnlocks) data.customUnlocks = {};
    if (!data.statBoosts) data.statBoosts = {};
    if (!data.sideMissions) data.sideMissions = rollSideMissions(dateKey());
    for (const m of data.sideMissions || []) {
      if (m.type === "escort") m.escort = true;
    }
    if (data.landCount == null) data.landCount = 0;
    if (!data.tower) data.tower = { ...TOWER_DEFAULT };
    else data.tower = { ...TOWER_DEFAULT, ...data.tower };
    if (!data.tower.grid || !data.tower.grid.cells) {
      data.tower.grid = createDefaultTowerGrid();
    }
    if (data.tower.takeoffs == null) data.tower.takeoffs = 0;
    if (!data.airline) data.airline = defaultAirline();
    else data.airline = { ...defaultAirline(), ...data.airline };
    if (!data.airline.fleet) data.airline.fleet = [];
    if (!data.airline.pilots) data.airline.pilots = [];
    if (!data.airline.applicants) data.airline.applicants = [];

    for (const id of giftWeaponIds()) {
      if (!data.ownedWeapons.includes(id)) data.ownedWeapons.push(id);
    }
    for (const p of PLANES) {
      if (!data.loadouts[p.id]) data.loadouts[p.id] = defaultLoadout(p);
      if (data.ownedPlanes.includes(p.id)) {
        for (const wid of standardWeaponIdsForPlane(p)) {
          if (!data.ownedWeapons.includes(wid)) data.ownedWeapons.push(wid);
        }
      }
    }

    if (!data.ownedPlanes.includes("lark")) data.ownedPlanes.unshift("lark");

    if (data.missionDay !== dateKey()) {
      data.missionDay = dateKey();
      data.missions = rollDailyMissions(data.missionDay);
      data.sideMissions = rollSideMissions(data.missionDay);
    }
    saveGame(data);
    return data;
  } catch {
    return defaultSave();
  }
}

function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function seededRand(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 0x100000000;
  };
}

function rollFromTemplates(templates, seedStr, prefix, count) {
  const rand = seededRand(seedStr + prefix);
  const shuffled = [...templates].sort(() => rand() - 0.5);
  return shuffled.slice(0, count).map((tpl, i) => {
    const tier = Math.floor(rand() * 3);
    const n = tpl.n[tier];
    const reward = tpl.reward[tier];
    return {
      id: `${prefix}${i}-${tpl.type}-${n}`,
      type: tpl.type,
      title: tpl.title,
      desc: tpl.desc.replace("{n}", String(n)),
      target: n,
      progress: 0,
      reward,
      done: false,
      claimed: false,
      mainline: prefix === "m",
      combat: !!tpl.combat,
      escort: !!tpl.escort,
    };
  });
}

function rollDailyMissions(seedStr) {
  return rollFromTemplates(MISSION_TEMPLATES, seedStr, "m", 3);
}

/** 随机支线任务（非主线） */
function rollSideMissions(seedStr) {
  const rand = seededRand(seedStr + "side");
  const count = 2 + Math.floor(rand() * 2); // 2–3 条
  const list = rollFromTemplates(SIDE_MISSION_TEMPLATES, seedStr, "s", count);
  // 保证至少有机会出现护送类：若抽中无 escort，按概率补一条
  if (!list.some((m) => m.type === "escort") && rand() < 0.55) {
    const tpl = SIDE_MISSION_TEMPLATES.find((t) => t.type === "escort");
    if (tpl) {
      list.push({
        id: `s-escort-${Math.floor(rand() * 9999)}`,
        type: "escort",
        title: tpl.title,
        desc: tpl.desc,
        target: 1,
        progress: 0,
        reward: tpl.reward[1],
        done: false,
        claimed: false,
        mainline: false,
        combat: false,
        escort: true,
      });
    }
  }
  for (const m of list) {
    if (m.type === "escort") m.escort = true;
  }
  return list;
}

function unlockCheck(save) {
  let changed = false;
  for (const map of MAPS) {
    if (!save.unlockedMaps.includes(map.id) && save.totalScore >= map.unlockScore) {
      save.unlockedMaps.push(map.id);
      changed = true;
    }
  }
  if (changed) saveGame(save);
  return changed;
}

function allMissions(save) {
  return [...(save.missions || []), ...(save.sideMissions || [])];
}

function addProgress(save, type, amount) {
  for (const m of allMissions(save)) {
    if (m.done || m.type !== type) continue;
    m.progress = Math.min(m.target, m.progress + amount);
    if (m.progress >= m.target) m.done = true;
  }
  saveGame(save);
}

function claimMission(save, missionId) {
  const m = allMissions(save).find((x) => x.id === missionId);
  if (!m || !m.done || m.claimed) return false;
  m.claimed = true;
  save.coins += m.reward;
  saveGame(save);
  return true;
}

function buyPlane(save, planeId) {
  const plane = getPlane(planeId);
  if (!plane || save.ownedPlanes.includes(planeId)) return { ok: false, msg: "无法购买" };
  if (save.coins < plane.unlockCost) return { ok: false, msg: "金币不足" };
  save.coins -= plane.unlockCost;
  save.ownedPlanes.push(planeId);
  if (!save.loadouts[planeId]) save.loadouts[planeId] = defaultLoadout(plane);
  for (const wid of standardWeaponIdsForPlane(plane)) {
    if (!save.ownedWeapons.includes(wid)) save.ownedWeapons.push(wid);
  }
  saveGame(save);
  return { ok: true };
}

function buyWeapon(save, weaponId) {
  const w = getWeapon(weaponId);
  if (!w) return { ok: false, msg: "武器不存在" };
  if (save.ownedWeapons.includes(weaponId)) return { ok: false, msg: "已拥有" };
  if (save.coins < w.cost) return { ok: false, msg: "金币不足" };
  save.coins -= w.cost;
  save.ownedWeapons.push(weaponId);
  saveGame(save);
  return { ok: true };
}

function setLoadoutSlot(save, planeId, slotId, weaponId) {
  const plane = getPlane(planeId);
  if (!plane || !save.ownedPlanes.includes(planeId)) return { ok: false, msg: "未拥有该机" };
  const hp = plane.hardpoints.find((h) => h.id === slotId);
  if (!hp) return { ok: false, msg: "挂点无效" };
  if (!isSlotCustomizable(save, planeId, hp.type)) {
    return { ok: false, msg: "该挂点尚未解锁定制，请先付费开启" };
  }
  const w = getWeapon(weaponId);
  if (!w) return { ok: false, msg: "武器无效" };
  if (!save.ownedWeapons.includes(weaponId)) return { ok: false, msg: "未拥有该武器，请先去武器库购买" };
  if (!canFitWeapon(hp.type, w)) return { ok: false, msg: "不兼容此挂点" };

  if (!save.loadouts[planeId]) save.loadouts[planeId] = defaultLoadout(plane);
  save.loadouts[planeId][slotId] = weaponId;
  saveGame(save);
  return { ok: true };
}

function resetLoadout(save, planeId) {
  const plane = getPlane(planeId);
  if (!plane) return;
  save.loadouts[planeId] = defaultLoadout(plane);
  saveGame(save);
}

function getPlaneLoadout(save, planeId) {
  const plane = getPlane(planeId);
  if (!plane) return {};
  return save.loadouts[planeId] || defaultLoadout(plane);
}
