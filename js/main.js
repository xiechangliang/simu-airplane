/** 苍穹战机 · 入口 */

document.addEventListener("DOMContentLoaded", () => {
  const save = loadSave();
  if (!save.ownedPlanes.includes("lark")) {
    save.ownedPlanes.unshift("lark");
  }
  for (const id of giftWeaponIds()) {
    if (!save.ownedWeapons.includes(id)) save.ownedWeapons.push(id);
  }
  if (!save.loadouts.lark) save.loadouts.lark = defaultLoadout(getPlane("lark"));
  saveGame(save);
  UI.init(save);
});
