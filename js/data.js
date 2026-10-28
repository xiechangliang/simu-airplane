/** 苍穹战机 · 评级 / 武器 / 真实战机 / 地图 / 模式 */

const TIERS = [
  { id: "low", name: "低级", minScore: 0, maxScore: 24, className: "tier-low" },
  { id: "c", name: "C级", minScore: 25, maxScore: 34, className: "tier-c" },
  { id: "c+", name: "C+级", minScore: 35, maxScore: 44, className: "tier-c-plus" },
  { id: "b", name: "B级", minScore: 45, maxScore: 54, className: "tier-b" },
  { id: "b+", name: "B+级", minScore: 55, maxScore: 64, className: "tier-b-plus" },
  { id: "a", name: "A级", minScore: 65, maxScore: 74, className: "tier-a" },
  { id: "a+", name: "A+级", minScore: 75, maxScore: 84, className: "tier-a-plus" },
  { id: "s", name: "S级", minScore: 85, maxScore: 92, className: "tier-s" },
  { id: "s+", name: "S+级", minScore: 93, maxScore: 100, className: "tier-s-plus" },
];

/**
 * 武器库
 * category: gun | missile | rocket
 * slot: gun | short | medium | heavy（可挂载的挂点类型，heavy 可挂 short/medium）
 * damage: 单发伤害（游戏内数值，参考真实定位做平衡）
 */
const WEAPONS = [
  // —— 初始赠送 ——
  {
    id: "train_gun",
    name: "云雀训练机炮",
    nameEn: "LARK-G 12.7mm",
    category: "gun",
    slot: "gun",
    damage: 5,
    fireRate: 0.14,
    speed: 520,
    range: 520,
    ammo: 400,
    cost: 0,
    gift: true,
    desc: "初始赠送机炮。射速尚可，单发伤害 5，适合熟悉射击节奏。",
  },
  {
    id: "train_ir",
    name: "训练红外弹",
    nameEn: "TR-IR",
    category: "missile",
    slot: "short",
    damage: 28,
    fireRate: 0.85,
    speed: 380,
    range: 480,
    ammo: 2,
    cost: 0,
    gift: true,
    desc: "初始赠送短距导弹。单发伤害 28，弹药仅 2 枚，谨慎使用。",
  },

  // —— 机炮 ——
  {
    id: "m61",
    name: "M61 火神机炮",
    nameEn: "M61 Vulcan 20mm",
    category: "gun",
    slot: "gun",
    damage: 7,
    fireRate: 0.08,
    speed: 620,
    range: 600,
    ammo: 511,
    cost: 1200,
    desc: "美制六管旋转机炮。射速极高，单发伤害 7，持续压制出色。",
  },
  {
    id: "gsh301",
    name: "GSh-30-1 机炮",
    nameEn: "GSh-30-1 30mm",
    category: "gun",
    slot: "gun",
    damage: 11,
    fireRate: 0.16,
    speed: 580,
    range: 580,
    ammo: 150,
    cost: 1400,
    desc: "苏/俄制 30mm 单管机炮。单发伤害 11，弹药偏少但穿透强。",
  },
  {
    id: "gau8",
    name: "GAU-8 复仇者",
    nameEn: "GAU-8 Avenger 30mm",
    category: "gun",
    slot: "gun",
    damage: 16,
    fireRate: 0.1,
    speed: 560,
    range: 560,
    ammo: 1174,
    cost: 3200,
    desc: "A-10 专用七管机炮。单发伤害 16，弹药充裕，对空对地皆猛。",
  },
  {
    id: "bk27",
    name: "BK-27 机炮",
    nameEn: "BK-27 27mm",
    category: "gun",
    slot: "gun",
    damage: 9,
    fireRate: 0.12,
    speed: 600,
    range: 590,
    ammo: 180,
    cost: 1600,
    desc: "欧陆战机常用 27mm 转膛炮。伤害 9，射速与弹量均衡。",
  },
  {
    id: "type23",
    name: "23-3 双管机炮",
    nameEn: "Type 23-3 23mm",
    category: "gun",
    slot: "gun",
    damage: 8,
    fireRate: 0.11,
    speed: 590,
    range: 570,
    ammo: 200,
    cost: 1100,
    desc: "国产双管 23mm。伤害 8，适合国产战机标准配置。",
  },

  // —— 短距红外导弹 ——
  {
    id: "aim9",
    name: "AIM-9 响尾蛇",
    nameEn: "AIM-9 Sidewinder",
    category: "missile",
    slot: "short",
    damage: 48,
    fireRate: 0.7,
    speed: 420,
    range: 520,
    ammo: 1,
    cost: 900,
    desc: "经典近距空空导弹。单发伤害 48，狗斗利器。",
  },
  {
    id: "r73",
    name: "R-73 弓箭手",
    nameEn: "R-73 Archer",
    category: "missile",
    slot: "short",
    damage: 50,
    fireRate: 0.7,
    speed: 410,
    range: 500,
    ammo: 1,
    cost: 950,
    desc: "高机动近距弹。伤害 50，离轴发射能力出色。",
  },
  {
    id: "pl10",
    name: "霹雳-10",
    nameEn: "PL-10",
    category: "missile",
    slot: "short",
    damage: 52,
    fireRate: 0.68,
    speed: 430,
    range: 530,
    ammo: 1,
    cost: 1100,
    desc: "国产先进近距弹。伤害 52，机动与抗干扰优秀。",
  },
  {
    id: "iris_t",
    name: "IRIS-T",
    nameEn: "IRIS-T",
    category: "missile",
    slot: "short",
    damage: 51,
    fireRate: 0.68,
    speed: 425,
    range: 525,
    ammo: 1,
    cost: 1050,
    desc: "欧洲近距红外弹。伤害 51，抗干扰与机动均衡。",
  },

  // —— 中距雷达导弹 ——
  {
    id: "aim120",
    name: "AIM-120 阿姆拉姆",
    nameEn: "AIM-120 AMRAAM",
    category: "missile",
    slot: "medium",
    damage: 72,
    fireRate: 1.0,
    speed: 480,
    range: 780,
    ammo: 1,
    cost: 2200,
    desc: "美制中距主动雷达弹。伤害 72，超视距打击主力。",
  },
  {
    id: "r77",
    name: "R-77 蝰蛇",
    nameEn: "R-77 Adder",
    category: "missile",
    slot: "medium",
    damage: 70,
    fireRate: 1.0,
    speed: 470,
    range: 760,
    ammo: 1,
    cost: 2100,
    desc: "俄制中距主动雷达弹。伤害 70，栅格舵辨识度高。",
  },
  {
    id: "pl15",
    name: "霹雳-15",
    nameEn: "PL-15",
    category: "missile",
    slot: "medium",
    damage: 78,
    fireRate: 1.05,
    speed: 500,
    range: 820,
    ammo: 1,
    cost: 2800,
    desc: "国产远程空空弹。伤害 78，射程与毁伤领先同级。",
  },
  {
    id: "meteor",
    name: "流星导弹",
    nameEn: "MBDA Meteor",
    category: "missile",
    slot: "medium",
    damage: 80,
    fireRate: 1.1,
    speed: 510,
    range: 850,
    ammo: 1,
    cost: 3200,
    desc: "欧洲冲压发动机中距弹。伤害 80，末端能量充沛。",
  },

  // —— 火箭 / 重型 ——
  {
    id: "hydra70",
    name: "Hydra 70 火箭",
    nameEn: "Hydra 70",
    category: "rocket",
    slot: "heavy",
    damage: 22,
    fireRate: 0.22,
    speed: 450,
    range: 500,
    ammo: 7,
    cost: 800,
    desc: "无制导火箭巢。单发伤害 22，齐射压制面目标。",
  },
  {
    id: "s8",
    name: "S-8 火箭",
    nameEn: "S-8",
    category: "rocket",
    slot: "heavy",
    damage: 24,
    fireRate: 0.24,
    speed: 440,
    range: 480,
    ammo: 10,
    cost: 850,
    desc: "俄制航空火箭。伤害 24，弹量多，适合近距扫射。",
  },
];

/**
 * 战机
 * stats: speed / armor / agility / range（机体固有，0–20）
 * range = 油箱容量，决定能飞多久、飞多远；伤害由武器挂载决定，无「火力」属性
 * hardpoints: 挂点，default 为现实标准配置
 */
const PLANES = [
  // —— 虚构初始机 ——
  {
    id: "lark",
    name: "云雀",
    nameEn: "Lark Trainer",
    codename: "LARK-01",
    real: false,
    nation: "训练司令部",
    desc: "初始赠送教练机。标准配置：训练机炮（伤害 5）+ 训练红外弹×2（伤害 28）。自带浮筒，可在水面迫降并缓慢返航至最近友方机场。",
    color: "#7ec8e8",
    accent: "#e8a838",
    gift: true,
    unlockCost: 0,
    role: "trainer",
    floats: true,
    // 初始均值水平，定制里付费强化
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "train_gun" },
      { id: "w1", type: "short", default: "train_ir" },
      { id: "w2", type: "short", default: "train_ir" },
    ],
  },

  // —— 传奇虚构机 ——
  {
    id: "world_record",
    name: "世界纪录",
    nameEn: "World Record",
    codename: "WR-BOMBER",
    real: false,
    legend: true,
    role: "bomber",
    nation: "传奇编制",
    desc: "传奇轰炸机。载弹量大、航程远，支线遭遇战时会作为友军自动起飞支援。自带浮筒，可水面迫降。",
    color: "#8a7a68",
    accent: "#e8a838",
    unlockCost: 18000,
    floats: true,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "gau8" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "heavy", default: "hydra70" },
      { id: "w4", type: "heavy", default: "hydra70" },
      { id: "w5", type: "heavy", default: "s8" },
      { id: "w6", type: "medium", default: "aim120" },
    ],
  },
  {
    id: "world_king",
    name: "世界之王",
    nameEn: "World King",
    codename: "WK-ATTACK",
    real: false,
    legend: true,
    role: "attack",
    nation: "传奇编制",
    desc: "传奇攻击机。对地突击与近距压制出色，遭遇战中常与编队一同出击。自带浮筒，可水面迫降。",
    color: "#6a8a5a",
    accent: "#e85d4c",
    unlockCost: 16000,
    floats: true,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "gsh301" },
      { id: "w1", type: "short", default: "r73" },
      { id: "w2", type: "short", default: "r73" },
      { id: "w3", type: "heavy", default: "s8" },
      { id: "w4", type: "heavy", default: "s8" },
      { id: "w5", type: "medium", default: "r77" },
      { id: "w6", type: "medium", default: "r77" },
    ],
  },
  {
    id: "avenger",
    name: "复仇者",
    nameEn: "Avenger",
    codename: "AVG-FIGHTER",
    real: false,
    legend: true,
    role: "fighter",
    nation: "传奇编制",
    desc: "传奇战斗机。制空格斗见长，支线遭遇战中会自动起飞护航。自带浮筒，可水面迫降。",
    color: "#c07070",
    accent: "#ffc857",
    unlockCost: 15000,
    floats: true,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "m61" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "medium", default: "aim120" },
      { id: "w4", type: "medium", default: "aim120" },
      { id: "w5", type: "medium", default: "aim120" },
      { id: "w6", type: "medium", default: "meteor" },
    ],
  },

  // —— 现实战机 ——
  {
    id: "f16",
    name: "F-16 战隼",
    nameEn: "F-16 Fighting Falcon",
    codename: "F-16C",
    real: true,
    nation: "美国",
    desc: "经典多用途轻型战机。标准挂载：M61 火神炮 + AIM-9×2 + AIM-120×2。机动灵活，是空战入门的现实标杆。",
    color: "#6a8fa8",
    accent: "#c8d8e8",
    unlockCost: 3500,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "m61" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "medium", default: "aim120" },
      { id: "w4", type: "medium", default: "aim120" },
    ],
  },
  {
    id: "mig29",
    name: "米格-29",
    nameEn: "MiG-29 Fulcrum",
    codename: "MiG-29",
    real: true,
    nation: "苏联/俄罗斯",
    desc: "近距格斗名机。标准挂载：GSh-30-1 + R-73×2 + R-77×2。爬升与狗斗性能突出。",
    color: "#7a8a6a",
    accent: "#c9a227",
    unlockCost: 4200,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "gsh301" },
      { id: "w1", type: "short", default: "r73" },
      { id: "w2", type: "short", default: "r73" },
      { id: "w3", type: "medium", default: "r77" },
      { id: "w4", type: "medium", default: "r77" },
    ],
  },
  {
    id: "j10",
    name: "歼-10",
    nameEn: "J-10 Vigorous Dragon",
    codename: "J-10C",
    real: true,
    nation: "中国",
    desc: "国产三代半多用途战机。标准挂载：23mm 机炮 + 霹雳-10×2 + 霹雳-15×2。综合性能均衡。",
    color: "#5a7a6a",
    accent: "#e8a838",
    unlockCost: 4800,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "type23" },
      { id: "w1", type: "short", default: "pl10" },
      { id: "w2", type: "short", default: "pl10" },
      { id: "w3", type: "medium", default: "pl15" },
      { id: "w4", type: "medium", default: "pl15" },
    ],
  },
  {
    id: "su27",
    name: "苏-27",
    nameEn: "Su-27 Flanker",
    codename: "Su-27",
    real: true,
    nation: "苏联/俄罗斯",
    desc: "重型制空战斗机。标准挂载：GSh-30-1 + R-73×2 + R-77×4。航程远、挂载多。",
    color: "#8aa4b8",
    accent: "#e85d4c",
    unlockCost: 6500,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "gsh301" },
      { id: "w1", type: "short", default: "r73" },
      { id: "w2", type: "short", default: "r73" },
      { id: "w3", type: "medium", default: "r77" },
      { id: "w4", type: "medium", default: "r77" },
      { id: "w5", type: "medium", default: "r77" },
      { id: "w6", type: "medium", default: "r77" },
    ],
  },
  {
    id: "a10",
    name: "A-10 雷电",
    nameEn: "A-10 Thunderbolt II",
    codename: "A-10C",
    real: true,
    nation: "美国",
    desc: "近距空中支援王牌。标准挂载：GAU-8 复仇者 + Hydra 火箭×2 + AIM-9×2。机炮伤害碾压同级。自带浮筒，可水面迫降。",
    color: "#6b7c5a",
    accent: "#c9a227",
    unlockCost: 5800,
    floats: true,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "gau8" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "heavy", default: "hydra70" },
      { id: "w4", type: "heavy", default: "hydra70" },
    ],
  },
  {
    id: "typhoon",
    name: "台风战斗机",
    nameEn: "Eurofighter Typhoon",
    codename: "EF-2000",
    real: true,
    nation: "欧洲",
    desc: "欧洲四代制空主力。标准挂载：BK-27 + IRIS-T×2 + Meteor×4。超机动与超视距兼备。",
    color: "#7a90a8",
    accent: "#4a9fd4",
    unlockCost: 12000,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "bk27" },
      { id: "w1", type: "short", default: "iris_t" },
      { id: "w2", type: "short", default: "iris_t" },
      { id: "w3", type: "medium", default: "meteor" },
      { id: "w4", type: "medium", default: "meteor" },
      { id: "w5", type: "medium", default: "meteor" },
      { id: "w6", type: "medium", default: "meteor" },
    ],
  },
  {
    id: "j20",
    name: "歼-20",
    nameEn: "J-20 Mighty Dragon",
    codename: "J-20",
    real: true,
    nation: "中国",
    desc: "国产隐身制空战机。标准挂载：内置弹舱霹雳-10×2 + 霹雳-15×4。隐身与远程打击突出。",
    color: "#3a4a58",
    accent: "#e8a838",
    unlockCost: 22000,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "type23" },
      { id: "w1", type: "short", default: "pl10" },
      { id: "w2", type: "short", default: "pl10" },
      { id: "w3", type: "medium", default: "pl15" },
      { id: "w4", type: "medium", default: "pl15" },
      { id: "w5", type: "medium", default: "pl15" },
      { id: "w6", type: "medium", default: "pl15" },
    ],
  },
  {
    id: "f22",
    name: "F-22 猛禽",
    nameEn: "F-22 Raptor",
    codename: "F-22A",
    real: true,
    nation: "美国",
    desc: "五代隐身制空机。标准挂载：M61 + AIM-9×2 + AIM-120×4。超音速巡航与隐身顶尖。",
    color: "#5a6a78",
    accent: "#c8e6f5",
    unlockCost: 28000,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "m61" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "medium", default: "aim120" },
      { id: "w4", type: "medium", default: "aim120" },
      { id: "w5", type: "medium", default: "aim120" },
      { id: "w6", type: "medium", default: "aim120" },
    ],
  },
  {
    id: "f35",
    name: "F-35 闪电 II",
    nameEn: "F-35 Lightning II",
    codename: "F-35A",
    real: true,
    nation: "美国",
    desc: "五代多用途隐身战机。标准挂载：内置机炮 + AIM-9×2 + AIM-120×4。传感融合与态势感知一流。",
    color: "#4a5560",
    accent: "#ffc857",
    unlockCost: 32000,
    stats: { speed: 10, armor: 10, agility: 10, range: 10 },
    hardpoints: [
      { id: "gun", type: "gun", fixed: true, default: "m61" },
      { id: "w1", type: "short", default: "aim9" },
      { id: "w2", type: "short", default: "aim9" },
      { id: "w3", type: "medium", default: "aim120" },
      { id: "w4", type: "medium", default: "aim120" },
      { id: "w5", type: "medium", default: "aim120" },
      { id: "w6", type: "medium", default: "aim120" },
    ],
  },
];

/**
 * layout: 归一化坐标 x/y（0–1）相对地图尺寸
 * type: island 小岛 | continent 大陆
 * 每块陆地带机场跑道
 */
const MAPS = [
  {
    id: "home_sea",
    name: "两岛一陆",
    desc: "入门海域：东礁岛、西沙岛与苍澜大陆，航线简单，适合自由巡航。",
    size: 5200,
    unlockScore: 0,
    enemyDensity: 0.45,
    color: "#1e6b9a",
    layout: [
      { type: "island", x: 0.22, y: 0.32, r: 240, name: "东礁岛", runwayAngle: 0.2 },
      { type: "island", x: 0.78, y: 0.28, r: 220, name: "西沙岛", runwayAngle: -0.3 },
      { type: "continent", x: 0.50, y: 0.70, r: 520, name: "苍澜大陆", runwayAngle: 0.05 },
    ],
  },
  {
    id: "twin_arch",
    name: "双湾群岛",
    desc: "进阶海域：多座小岛与小礁环绕双湾大陆，航线选择更多。",
    size: 6600,
    unlockScore: 400,
    enemyDensity: 0.8,
    color: "#158070",
    layout: [
      { type: "island", x: 0.14, y: 0.20, r: 200, name: "北风岛", runwayAngle: 0.4 },
      { type: "island", x: 0.84, y: 0.22, r: 190, name: "南星岛", runwayAngle: -0.2 },
      { type: "island", x: 0.32, y: 0.42, r: 175, name: "中礁", runwayAngle: 0.1 },
      { type: "island", x: 0.55, y: 0.28, r: 130, name: "碎浪礁", runwayAngle: -0.35 },
      { type: "island", x: 0.72, y: 0.48, r: 145, name: "青苔小岛", runwayAngle: 0.25 },
      { type: "island", x: 0.22, y: 0.58, r: 120, name: "灯塔礁", runwayAngle: 0.55 },
      { type: "island", x: 0.48, y: 0.12, r: 110, name: "白帆礁", runwayAngle: -0.1 },
      { type: "continent", x: 0.62, y: 0.74, r: 540, name: "双湾大陆", runwayAngle: 0 },
    ],
  },
  {
    id: "grand_chain",
    name: "连岛大陆",
    desc: "复杂群岛：小岛、小礁与东西两陆交错，适合长途巡航与空战。",
    size: 8200,
    unlockScore: 1800,
    enemyDensity: 1.15,
    color: "#0d6b6b",
    layout: [
      { type: "island", x: 0.12, y: 0.18, r: 190, name: "雾岛", runwayAngle: 0.5 },
      { type: "island", x: 0.36, y: 0.14, r: 165, name: "鲸背岛", runwayAngle: -0.4 },
      { type: "island", x: 0.58, y: 0.20, r: 155, name: "火岩岛", runwayAngle: 0.15 },
      { type: "island", x: 0.82, y: 0.16, r: 140, name: "望海岛", runwayAngle: -0.1 },
      { type: "island", x: 0.90, y: 0.42, r: 170, name: "珊瑚岛", runwayAngle: 0.3 },
      { type: "island", x: 0.08, y: 0.45, r: 125, name: "盐田礁", runwayAngle: -0.25 },
      { type: "island", x: 0.28, y: 0.38, r: 115, name: "螺壳礁", runwayAngle: 0.45 },
      { type: "island", x: 0.48, y: 0.36, r: 105, name: "苔绿小礁", runwayAngle: 0 },
      { type: "island", x: 0.68, y: 0.40, r: 130, name: "断桥礁", runwayAngle: -0.5 },
      { type: "island", x: 0.78, y: 0.58, r: 120, name: "渔火小岛", runwayAngle: 0.2 },
      { type: "island", x: 0.18, y: 0.72, r: 135, name: "南十字礁", runwayAngle: -0.15 },
      { type: "continent", x: 0.34, y: 0.62, r: 460, name: "西陆", runwayAngle: 0.08 },
      { type: "continent", x: 0.66, y: 0.78, r: 490, name: "东陆", runwayAngle: -0.12 },
    ],
  },
  {
    id: "storm_realm",
    name: "风暴疆域",
    desc: "广阔战场，岛屿与大陆交错，敌机密度高。",
    size: 9200,
    unlockScore: 9000,
    enemyDensity: 1.5,
    color: "#0a4a6e",
    layout: [
      { type: "island", x: 0.12, y: 0.20, r: 200, name: "雷鸣岛", runwayAngle: 0.3 },
      { type: "island", x: 0.30, y: 0.35, r: 170, name: "碎礁", runwayAngle: -0.5 },
      { type: "island", x: 0.55, y: 0.15, r: 220, name: "银翼岛", runwayAngle: 0 },
      { type: "island", x: 0.85, y: 0.28, r: 200, name: "远航岛", runwayAngle: 0.25 },
      { type: "island", x: 0.20, y: 0.70, r: 190, name: "暗潮岛", runwayAngle: -0.2 },
      { type: "continent", x: 0.48, y: 0.55, r: 420, name: "中枢大陆", runwayAngle: 0.05 },
      { type: "continent", x: 0.75, y: 0.72, r: 540, name: "风暴大陆", runwayAngle: -0.08 },
    ],
  },
  {
    id: "endless_sky",
    name: "无尽苍穹",
    desc: "终极大地图：多座大陆与群岛铺满海域，积分越高飞得越远。",
    size: 11000,
    unlockScore: 18000,
    enemyDensity: 1.9,
    color: "#082840",
    layout: [
      { type: "island", x: 0.10, y: 0.18, r: 180, name: "边陲一号", runwayAngle: 0.2 },
      { type: "island", x: 0.28, y: 0.12, r: 160, name: "边陲二号", runwayAngle: -0.3 },
      { type: "island", x: 0.50, y: 0.20, r: 200, name: "中环岛", runwayAngle: 0.1 },
      { type: "island", x: 0.72, y: 0.15, r: 170, name: "晨光岛", runwayAngle: 0.4 },
      { type: "island", x: 0.90, y: 0.30, r: 190, name: "暮色岛", runwayAngle: -0.15 },
      { type: "island", x: 0.15, y: 0.55, r: 175, name: "南十字", runwayAngle: 0 },
      { type: "continent", x: 0.38, y: 0.48, r: 460, name: "北陆", runwayAngle: 0.06 },
      { type: "continent", x: 0.65, y: 0.58, r: 500, name: "中陆", runwayAngle: -0.05 },
      { type: "continent", x: 0.55, y: 0.82, r: 580, name: "南陆", runwayAngle: 0.02 },
    ],
  },
];

const SIDE_MISSION_TEMPLATES = [
  { type: "kill", title: "支线·遭遇战", desc: "击落 {n} 架敌机", n: [3, 5, 8], reward: [180, 320, 500], combat: true },
  { type: "survive", title: "支线·突围", desc: "在敌区存活 {n} 秒", n: [40, 60, 90], reward: [160, 280, 420], combat: true },
  { type: "score", title: "支线·积分猎杀", desc: "获得 {n} 分", n: [120, 250, 400], reward: [150, 260, 400], combat: true },
  { type: "land", title: "支线·转场降落", desc: "在任意机场成功降落 {n} 次", n: [1, 2, 3], reward: [200, 350, 520], combat: false },
  {
    type: "escort",
    title: "支线·密送要员",
    desc: "与要员机同时起飞，护送其抵达目的机场；途中避免交战，且勿被敌侦察机记录",
    n: [1, 1, 1],
    reward: [260, 400, 580],
    combat: false,
    escort: true,
  },
];

/** 民航机呼号前缀 */
const CIVIL_CALLSIGNS = ["苍穹航", "群岛联航", "蓝湾航空", "晨光民航", "南十字航", "珊瑚快线"];

const MODES = [
  {
    id: "free",
    name: "自由飞行",
    tag: "单人 · 驾驶探索",
    team: false,
    desc: "随意驾驶战机穿梭群岛。可用机炮/导弹练习射击，熟悉武器手感。",
  },
  {
    id: "combat",
    name: "空战对决",
    tag: "单人 · 战斗出击",
    team: false,
    desc: "独自驾驶战机歼灭敌机。伤害完全由武器栏中的机炮与导弹造成。",
  },
  {
    id: "team",
    name: "组队空战",
    tag: "组队 · AI 队友",
    team: true,
    desc: "你操控己机，2 名电脑队友并肩作战，敌方机群亦由电脑操控。",
  },
  {
    id: "mission",
    name: "任务出击",
    tag: "单人 · 每日目标",
    team: false,
    desc: "执行当日随机派送的任务：击坠、巡逻、存活等。完成后领取金币。",
  },
  {
    id: "survive",
    name: "生存挑战",
    tag: "单人 · 极限试炼",
    team: false,
    desc: "敌机不断增援，尽可能坚持更久。弹药管理与武器切换至关重要。",
  },
];

/** 塔台模式：格子买地扩建 */
const TOWER_GRID_W = 14;
const TOWER_GRID_H = 10;
const TOWER_CELL_BUY = 120; // 买一格地皮
const TOWER_BUILD_COST = {
  runway: 80, // 在已购格子上铺跑道
  taxi: 40,
  tower: 200,
  terminal: 150,
};
const TOWER_AIRLINES = [
  { id: "sky", name: "苍穹航", color: "#7ec8e8" },
  { id: "arch", name: "群岛联航", color: "#e8a838" },
  { id: "bay", name: "蓝湾航空", color: "#4a9fd4" },
  { id: "dawn", name: "晨光民航", color: "#c9a227" },
  { id: "cross", name: "南十字航", color: "#3db88a" },
  { id: "coral", name: "珊瑚快线", color: "#e85d4c" },
];

/** 生成初始机场格子：中央一条跑道 + 旁侧滑道 + 一座塔台 + 一小块航站楼 */
function createDefaultTowerGrid() {
  const w = TOWER_GRID_W;
  const h = TOWER_GRID_H;
  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push({ owned: false, type: "empty", rwyId: 0 });
    cells.push(row);
  }
  const midY = Math.floor(h / 2);
  const midX = Math.floor(w / 2);
  // 跑道：横向 5 格
  for (let x = midX - 2; x <= midX + 2; x++) {
    cells[midY][x] = { owned: true, type: "runway", rwyId: 1 };
  }
  // 滑道：跑道北侧
  for (let x = midX - 1; x <= midX + 1; x++) {
    cells[midY - 1][x] = { owned: true, type: "taxi", rwyId: 0 };
  }
  // 塔台
  cells[midY - 2][midX] = { owned: true, type: "tower", rwyId: 0 };
  // 航站楼 2 格
  cells[midY + 1][midX] = { owned: true, type: "terminal", rwyId: 0 };
  cells[midY + 1][midX + 1] = { owned: true, type: "terminal", rwyId: 0 };
  return { w, h, cells, nextRwyId: 2 };
}

const TOWER_DEFAULT = {
  funds: 2000,
  landings: 0,
  takeoffs: 0,
  grid: null, // 懒创建
};

/** 民航客机目录（玩家航空公司用金币购买） */
const AIRLINER_CATALOG = [
  { id: "b737", maker: "Boeing", makerZh: "波音", name: "737 MAX", seats: 178, price: 2800, tier: "narrow" },
  { id: "b747", maker: "Boeing", makerZh: "波音", name: "747-8", seats: 410, price: 9200, tier: "wide" },
  { id: "b777", maker: "Boeing", makerZh: "波音", name: "777-300ER", seats: 396, price: 7800, tier: "wide" },
  { id: "b787", maker: "Boeing", makerZh: "波音", name: "787 Dreamliner", seats: 296, price: 6500, tier: "wide" },
  { id: "a320", maker: "Airbus", makerZh: "空客", name: "A320neo", seats: 180, price: 3000, tier: "narrow" },
  { id: "a330", maker: "Airbus", makerZh: "空客", name: "A330-900", seats: 300, price: 6200, tier: "wide" },
  { id: "a350", maker: "Airbus", makerZh: "空客", name: "A350-900", seats: 325, price: 8600, tier: "wide" },
  { id: "a380", maker: "Airbus", makerZh: "空客", name: "A380", seats: 525, price: 14000, tier: "super" },
  { id: "c919", maker: "COMAC", makerZh: "中国商飞", name: "C919", seats: 164, price: 3600, tier: "narrow" },
  { id: "arj21", maker: "COMAC", makerZh: "中国商飞", name: "ARJ21 / C909", seats: 90, price: 1800, tier: "regional" },
  { id: "cr929", maker: "COMAC", makerZh: "中俄联合", name: "CR929 概念", seats: 280, price: 7200, tier: "wide" },
  { id: "concorde", maker: "Aérospatiale/BAC", makerZh: "英法", name: "Concorde 协和", seats: 100, price: 16000, tier: "legend" },
  { id: "tu154", maker: "Tupolev", makerZh: "图波列夫", name: "图-154", seats: 180, price: 2200, tier: "classic" },
  { id: "il96", maker: "Ilyushin", makerZh: "伊尔", name: "伊尔-96", seats: 262, price: 4800, tier: "wide" },
];

function getAirliner(id) {
  return AIRLINER_CATALOG.find((a) => a.id === id) || null;
}

const PILOT_FIRST = ["林", "陈", "王", "赵", "周", "吴", "郑", "冯", "韩", "曹", "许", "沈"];
const PILOT_GIVEN = ["远航", "凌云", "天行", "海阔", "星驰", "长空", "晨曦", "无帆", "破晓", "无际", "御风", "苍穹"];

function defaultAirline() {
  return {
    name: "",
    founded: false,
    fleet: [],
    pilots: [],
    applicants: [],
    nextPilotId: 1,
    nextPlaneId: 1,
    resumeTimerDay: "",
  };
}

/** 随机生成一份飞行员简历 */
function rollPilotApplicant(seed = Math.random()) {
  const r = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const name = PILOT_FIRST[Math.floor(r() * PILOT_FIRST.length)] + PILOT_GIVEN[Math.floor(r() * PILOT_GIVEN.length)];
  const roll = r();
  let skills;
  let title;
  let expectMin;
  if (roll < 0.18) {
    skills = ["all"];
    title = "全机型机长";
    expectMin = 180 + Math.floor(r() * 120);
  } else if (roll < 0.4) {
    skills = ["Boeing"];
    title = "波音系列专机";
    expectMin = 120 + Math.floor(r() * 80);
  } else if (roll < 0.62) {
    skills = ["Airbus"];
    title = "空客系列专机";
    expectMin = 120 + Math.floor(r() * 80);
  } else if (roll < 0.78) {
    skills = ["COMAC", "c919", "arj21"];
    title = "国产民机专机";
    expectMin = 100 + Math.floor(r() * 70);
  } else {
    const picks = AIRLINER_CATALOG.filter((a) => a.tier === "narrow" || a.tier === "regional");
    const one = picks[Math.floor(r() * picks.length)];
    skills = [one.id];
    title = `${one.makerZh} ${one.name} 专机`;
    expectMin = 80 + Math.floor(r() * 60);
  }
  return {
    id: "app-" + Math.floor(r() * 1e9),
    name,
    title,
    skills,
    expectMin,
    expectIdeal: expectMin + 40 + Math.floor(r() * 50),
    years: 3 + Math.floor(r() * 18),
    note: skills[0] === "all" ? "可驾驶公司全部民机机型" : `资质：${skills.join(" / ")}`,
  };
}

function pilotCanFly(pilot, airlinerId) {
  if (!pilot || !airlinerId) return false;
  if (pilot.skills.includes("all")) return true;
  const plane = getAirliner(airlinerId);
  if (!plane) return false;
  if (pilot.skills.includes(plane.id)) return true;
  if (pilot.skills.includes(plane.maker)) return true;
  if (pilot.skills.includes(plane.makerZh)) return true;
  return false;
}

const MISSION_TEMPLATES = [
  { type: "kill", title: "主线·清剿空域", desc: "击落 {n} 架敌机", n: [5, 8, 12], reward: [300, 500, 800], combat: true },
  { type: "score", title: "主线·高分突袭", desc: "单局获得 {n} 分", n: [200, 400, 700], reward: [250, 450, 700], combat: true },
  { type: "survive", title: "主线·耐久巡航", desc: "存活 {n} 秒", n: [60, 90, 120], reward: [280, 480, 750], combat: false },
  { type: "explore", title: "主线·海域勘察", desc: "自由飞行中飞行 {n} 秒", n: [45, 75, 100], reward: [200, 400, 600], combat: false },
  { type: "land", title: "主线·机场降落", desc: "成功降落机场 {n} 次", n: [1, 2, 3], reward: [260, 420, 650], combat: false },
  { type: "combo", title: "主线·连击考验", desc: "达成 {n} 连击", n: [3, 5, 8], reward: [320, 550, 900], combat: true },
];

const SLOT_LABELS = {
  gun: "机炮",
  short: "短距挂点",
  medium: "中距挂点",
  heavy: "多用途挂点",
};

/** 机库定制：分档付费解锁可改装挂点 */
const CUSTOM_UNLOCK = {
  basic: {
    id: "basic",
    name: "基础定制",
    cost: 500,
    slots: ["gun", "short"],
    desc: "付费开启后，可自定义机炮与短距导弹（仅限已拥有的武器）。",
  },
  medium: {
    id: "medium",
    name: "中距挂点",
    cost: 1500,
    slots: ["medium"],
    desc: "解锁中距导弹挂点的改装权限。",
    requires: "basic",
  },
  heavy: {
    id: "heavy",
    name: "火箭 / 重挂点",
    cost: 2500,
    slots: ["heavy"],
    desc: "解锁火箭炮等多用途挂点的改装权限。",
    requires: "basic",
  },
};

function slotUnlockKey(slotType) {
  if (slotType === "gun" || slotType === "short") return "basic";
  if (slotType === "medium") return "medium";
  if (slotType === "heavy") return "heavy";
  return "basic";
}

function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id);
}

function getPlane(id) {
  return PLANES.find((p) => p.id === id);
}

function getMap(id) {
  return MAPS.find((m) => m.id === id);
}

function getMode(id) {
  return MODES.find((m) => m.id === id);
}

function defaultLoadout(plane) {
  const load = {};
  for (const hp of plane.hardpoints) load[hp.id] = hp.default;
  return load;
}

/** 武器是否可挂到该挂点 */
function canFitWeapon(slotType, weapon) {
  if (!weapon) return false;
  if (slotType === "gun") return weapon.slot === "gun";
  if (slotType === "short") return weapon.slot === "short";
  if (slotType === "medium") return weapon.slot === "medium";
  if (slotType === "heavy") return weapon.slot === "short" || weapon.slot === "medium" || weapon.slot === "heavy";
  return false;
}

const STAT_KEYS = ["speed", "armor", "agility", "range"];
const STAT_LABELS = { speed: "速度", armor: "装甲", agility: "机动", range: "油量" };
/** 每升一级属性的费用（随等级递增） */
function statUpgradeCost(currentBoost) {
  return 280 + currentBoost * 220;
}

/** 有效属性 = 机体初始均值 + 付费强化（上限 20） */
function getEffectiveStats(plane, save) {
  const base = plane.stats;
  const boosts = (save && save.statBoosts && save.statBoosts[plane.id]) || {};
  const out = {};
  for (const k of STAT_KEYS) {
    out[k] = Math.min(20, (base[k] || 10) + (boosts[k] || 0));
  }
  return out;
}

/** 机体综合分：速度+装甲+机动+油量，映射到 0–100（伤害不参与评级） */
function planeScore(plane, save) {
  const s = getEffectiveStats(plane, save);
  const raw = s.speed + s.armor + s.agility + s.range;
  return Math.round((raw / 80) * 100);
}

function planeTier(plane, save) {
  const score = planeScore(plane, save);
  return TIERS.find((t) => score >= t.minScore && score <= t.maxScore) || TIERS[0];
}

/** 油箱容量（秒）：续航属性越高，能飞越久 */
function maxFuelSeconds(plane, save) {
  const s = getEffectiveStats(plane, save);
  return 40 + s.range * 9;
}

/** 遭遇战初始友军编队 */
const COMBAT_ALLY_IDS = ["world_king", "world_record", "lark", "avenger"];
/** 遭遇战周期性增援（复仇者 / 世界纪录 / 世界之王） */
const COMBAT_REINFORCE_IDS = ["avenger", "world_record", "world_king"];
/** 增援间隔（秒） */
const COMBAT_REINFORCE_INTERVAL = 28;

function giftWeaponIds() {
  return WEAPONS.filter((w) => w.gift).map((w) => w.id);
}

function standardWeaponIdsForPlane(plane) {
  return [...new Set(plane.hardpoints.map((h) => h.default))];
}
