/** 玩家航空公司：创司 · 购民机 · 飞行员简历/谈薪 */

function ensureAirline(save) {
  if (!save.airline) save.airline = defaultAirline();
  const a = save.airline;
  if (!a.fleet) a.fleet = [];
  if (!a.pilots) a.pilots = [];
  if (!a.applicants) a.applicants = [];
  if (a.nextPilotId == null) a.nextPilotId = 1;
  if (a.nextPlaneId == null) a.nextPlaneId = 1;
  return a;
}

function foundAirline(save, name) {
  const al = ensureAirline(save);
  const n = (name || "").trim();
  if (al.founded) return { ok: false, msg: "已创立航空公司" };
  if (n.length < 2 || n.length > 12) return { ok: false, msg: "公司名需 2～12 字" };
  if (save.coins < 500) return { ok: false, msg: "创立需 500 金币" };
  save.coins -= 500;
  al.name = n;
  al.founded = true;
  // 开业赠一份简历
  if (!al.applicants.length) al.applicants.push(rollPilotApplicant(Date.now() % 1e6));
  saveGame(save);
  return { ok: true };
}

function buyAirliner(save, catalogId) {
  const al = ensureAirline(save);
  if (!al.founded) return { ok: false, msg: "请先创立航空公司" };
  const cat = getAirliner(catalogId);
  if (!cat) return { ok: false, msg: "机型不存在" };
  if (save.coins < cat.price) return { ok: false, msg: "金币不足" };
  save.coins -= cat.price;
  const uid = "ac" + al.nextPlaneId++;
  al.fleet.push({
    uid,
    catalogId: cat.id,
    name: `${cat.makerZh} ${cat.name}`,
    boughtAt: Date.now(),
  });
  saveGame(save);
  return { ok: true, plane: al.fleet[al.fleet.length - 1] };
}

function maybeRollResumes(save) {
  const al = ensureAirline(save);
  if (!al.founded) return;
  const day = dateKey();
  if (al.resumeTimerDay === day && al.applicants.length >= 2) return;
  // 每天最多补到 3 份简历；有概率再来一份
  if (al.resumeTimerDay !== day) {
    al.resumeTimerDay = day;
    if (al.applicants.length < 3 && Math.random() < 0.85) {
      al.applicants.push(rollPilotApplicant(Date.now() % 1e6 + al.applicants.length));
    }
  } else if (al.applicants.length < 3 && Math.random() < 0.25) {
    al.applicants.push(rollPilotApplicant(Math.random() * 1e9));
  }
  saveGame(save);
}

function activeRecruit(save) {
  const al = ensureAirline(save);
  if (!al.founded) return { ok: false, msg: "请先创立航空公司" };
  const cost = 80;
  if (save.coins < cost) return { ok: false, msg: "主动招募需 80 金币中介费" };
  if (al.applicants.length >= 5) return { ok: false, msg: "简历箱已满，先处理现有申请" };
  save.coins -= cost;
  const app = rollPilotApplicant(Date.now() % 1e6 + Math.random() * 999);
  al.applicants.push(app);
  saveGame(save);
  return { ok: true, applicant: app };
}

/**
 * 谈薪：给出月薪（金币/期）。
 * 低于 expectMin → 拒绝继续观望；
 * expectMin～ideal → 有概率接受；
 * ≥ ideal → 直接接受。
 */
function offerPilotSalary(save, applicantId, salary) {
  const al = ensureAirline(save);
  const app = al.applicants.find((x) => x.id === applicantId);
  if (!app) return { ok: false, msg: "简历不存在" };
  const pay = Math.floor(Number(salary) || 0);
  if (pay < 20) return { ok: false, msg: "开价过低" };

  app.lastOffer = pay;
  if (pay < app.expectMin) {
    app.rejectCount = (app.rejectCount || 0) + 1;
    saveGame(save);
    return {
      ok: false,
      rejected: true,
      msg: `${app.name}：薪资太低，我再观望一阵（期望至少 ${app.expectMin}）`,
    };
  }
  if (pay < app.expectIdeal) {
    const chance = 0.35 + ((pay - app.expectMin) / Math.max(1, app.expectIdeal - app.expectMin)) * 0.5;
    if (Math.random() > chance) {
      app.rejectCount = (app.rejectCount || 0) + 1;
      saveGame(save);
      return {
        ok: false,
        rejected: true,
        msg: `${app.name}：还差一点，理想大概 ${app.expectIdeal}，我再考虑考虑`,
      };
    }
  }

  // 接受：扣首期月薪入职
  if (save.coins < pay) {
    return { ok: false, msg: "金币不够支付首期月薪" };
  }
  save.coins -= pay;
  const pilot = {
    id: "p" + al.nextPilotId++,
    name: app.name,
    title: app.title,
    skills: app.skills,
    salary: pay,
    years: app.years,
    hiredAt: Date.now(),
  };
  al.pilots.push(pilot);
  al.applicants = al.applicants.filter((x) => x.id !== applicantId);
  saveGame(save);
  return { ok: true, pilot, msg: `${app.name} 同意月薪 ${pay}，已入职` };
}

function dismissApplicant(save, applicantId) {
  const al = ensureAirline(save);
  al.applicants = al.applicants.filter((x) => x.id !== applicantId);
  saveGame(save);
  return { ok: true };
}

function firePilot(save, pilotId) {
  const al = ensureAirline(save);
  const p = al.pilots.find((x) => x.id === pilotId);
  if (!p) return { ok: false, msg: "飞行员不存在" };
  al.pilots = al.pilots.filter((x) => x.id !== pilotId);
  saveGame(save);
  return { ok: true, msg: `已解约 ${p.name}` };
}

function skillsLabel(skills) {
  if (!skills || !skills.length) return "—";
  if (skills.includes("all")) return "全机型";
  return skills
    .map((s) => {
      const plane = getAirliner(s);
      if (plane) return plane.name;
      if (s === "Boeing") return "波音全系";
      if (s === "Airbus") return "空客全系";
      if (s === "COMAC") return "商飞系列";
      return s;
    })
    .join("、");
}

/**
 * 机场名列表：默认只用当前所选地图（如「两岛一陆」），避免航线下拉塞满全图机场。
 * @param {object} [save]
 * @param {{ allMaps?: boolean }} [opts] 传 allMaps:true 时汇总全部地图（兼容校验）
 */
function listAirportNames(save, opts = {}) {
  const names = [];
  const seen = new Set();
  const maps = opts.allMaps
    ? MAPS
    : [getMap((save && save.selectedMap) || "home_sea") || MAPS[0]].filter(Boolean);
  for (const map of maps) {
    for (const spot of map.layout || []) {
      if (!spot.name || seen.has(spot.name)) continue;
      seen.add(spot.name);
      names.push(spot.name);
    }
  }
  return names;
}

function fleetPlaneByUid(save, uid) {
  return ensureAirline(save).fleet.find((f) => f.uid === uid) || null;
}

function pilotDutyText(pilot, save) {
  if (!pilot) return "未排班";
  const plane = pilot.assignedPlaneUid ? fleetPlaneByUid(save, pilot.assignedPlaneUid) : null;
  const from = pilot.routeFrom || "";
  const to = pilot.routeTo || "";
  if (!plane && !from) return "未排班（请指定执飞机型与航线）";
  const planeName = plane ? plane.name : "未指定机型";
  const route = from && to ? `${from} ↔ ${to}` : "未指定航线";
  return `执飞 ${planeName} · 航线 ${route}`;
}

/** 为飞行员指定执飞机与往返航线（和平时会出现在空域往返） */
function assignPilotDuty(save, pilotId, fleetUid, fromName, toName) {
  const al = ensureAirline(save);
  if (!al.founded) return { ok: false, msg: "请先创立航空公司" };
  const pilot = al.pilots.find((p) => p.id === pilotId);
  if (!pilot) return { ok: false, msg: "飞行员不存在" };
  const plane = fleetUid ? fleetPlaneByUid(save, fleetUid) : null;
  if (!plane) return { ok: false, msg: "请选择机队中的飞机" };
  if (!pilotCanFly(pilot, plane.catalogId)) {
    return { ok: false, msg: `${pilot.name} 资质不符，无法驾驶 ${plane.name}` };
  }
  const airports = listAirportNames(save);
  const allAirports = listAirportNames(save, { allMaps: true });
  if (!fromName || !toName || fromName === toName) {
    return { ok: false, msg: "请选择不同的起降机场" };
  }
  if (!airports.includes(fromName) || !airports.includes(toName)) {
    if (allAirports.includes(fromName) && allAirports.includes(toName)) {
      return { ok: false, msg: "该机场不在当前所选地图，请先在起飞前更换地图，或选本地图机场" };
    }
    return { ok: false, msg: "机场名称无效" };
  }
  // 同一架机不能同时派给两名飞行员
  for (const p of al.pilots) {
    if (p.id !== pilotId && p.assignedPlaneUid === fleetUid) {
      p.assignedPlaneUid = "";
      p.routeFrom = "";
      p.routeTo = "";
    }
  }
  pilot.assignedPlaneUid = fleetUid;
  pilot.routeFrom = fromName;
  pilot.routeTo = toName;
  saveGame(save);
  return {
    ok: true,
    msg: `已排班：${pilot.name} 执飞 ${plane.name}，航线 ${fromName} ↔ ${toName}`,
  };
}

function clearPilotDuty(save, pilotId) {
  const al = ensureAirline(save);
  const pilot = al.pilots.find((p) => p.id === pilotId);
  if (!pilot) return { ok: false, msg: "飞行员不存在" };
  pilot.assignedPlaneUid = "";
  pilot.routeFrom = "";
  pilot.routeTo = "";
  saveGame(save);
  return { ok: true };
}

/** 已排班、可出飞的机组（和平民航用） */
function listedAirlineFlights(save) {
  const al = ensureAirline(save);
  if (!al.founded || !al.name) return [];
  const out = [];
  for (const pilot of al.pilots) {
    if (!pilot.assignedPlaneUid || !pilot.routeFrom || !pilot.routeTo) continue;
    const plane = fleetPlaneByUid(save, pilot.assignedPlaneUid);
    if (!plane) continue;
    if (!pilotCanFly(pilot, plane.catalogId)) continue;
    out.push({
      airlineName: al.name,
      pilot,
      plane,
      fromName: pilot.routeFrom,
      toName: pilot.routeTo,
    });
  }
  return out;
}
