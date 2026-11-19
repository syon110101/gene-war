/* GENE WAR — Tactical Turn Battle
   * Keeps the existing breeding, research, collection and save systems.
   * Battle is a 3v3 round-based system; no automatic battle simulation.
   */
(function () {
  "use strict";
  var battle = null;
  var battleBusy = false;

  function alive(list) { return list.filter(function (u) { return u.hp > 0; }); }
  function gene(u, locus) { return expressed(u.g, locus); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function roll(n) { return Math.random() < n; }
  function combatStats(u) {
    var s = stats(u);
    return {
      maxHp: s.hp,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      speed: s.speed,
      shield: 0,
      energy: 3,
      maxEnergy: 3,
      acted: false,
      status: [],
      guarding: false,
      name: u.name,
      id: u.id,
      source: u
    };
  }
  function makeEnemy(i) {
    var stage = state.stage;
    var names = ["잿빛 사냥꾼", "수정 골렘", "심연의 포식자", "폭풍 비룡", "황혼의 수호자"];
    var hp = 92 + stage * 17 + i * 9;
    return {
      id: "enemy-" + i + "-" + Date.now(),
      name: names[(stage + i - 1) % names.length],
      maxHp: hp, hp: hp,
      atk: 15 + stage * 3 + i * 2,
      def: 5 + Math.floor(stage * 0.8) + i,
      speed: 1,
      shield: 0,
      energy: 2,
      maxEnergy: 2,
      acted: false,
      status: [],
      guarding: false,
      isBoss: i === 2 && stage % 5 === 0
    };
  }
  function log(message) {
    battle.log.push(message);
    if (battle.log.length > 70) battle.log.shift();
  }
  function addStatus(target, type, turns, power) {
    var old = target.status.find(function (s) { return s.type === type; });
    if (old) {
      old.turns = Math.max(old.turns, turns);
      old.power = Math.max(old.power || 0, power || 0);
    } else {
      target.status.push({ type: type, turns: turns, power: power || 0 });
    }
  }
  function statusLabel(status) {
    var labels = { poison: "중독", burn: "화상", freeze: "빙결", weaken: "약화", regen: "재생" };
    return labels[status.type] || status.type;
  }
  function applyStartTurn(unit) {
    if (unit.hp <= 0) return;
    unit.guarding = false;
    unit.status.slice().forEach(function (s) {
      if (s.type === "poison" || s.type === "burn") {
        var damage = Math.max(2, s.power || Math.round(unit.maxHp * 0.06));
        unit.hp = Math.max(0, unit.hp - damage);
        log(unit.name + "에게 " + statusLabel(s) + " 피해 " + damage + "!");
      } else if (s.type === "regen") {
        var heal = Math.max(3, s.power || 10);
        var before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        if (unit.hp > before) log(unit.name + " 재생 +" + (unit.hp - before) + " HP");
      }
      s.turns -= 1;
    });
    unit.status = unit.status.filter(function (s) { return s.turns > 0; });
  }
  function damage(target, amount) {
    var value = Math.max(1, Math.round(amount));
    if (target.guarding) value = Math.max(1, Math.round(value * 0.45));
    if (target.shield > 0) {
      var absorbed = Math.min(target.shield, value);
      target.shield -= absorbed;
      value -= absorbed;
      if (absorbed) log(target.name + "의 보호막이 " + absorbed + " 피해를 흡수!");
    }
    target.hp = Math.max(0, target.hp - value);
    return value;
  }
  function chooseTarget(list) {
    var living = alive(list);
    if (!living.length) return null;
    var front = living.filter(function (u) { return u.position === "front"; });
    var pool = front.length ? front : living;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function teamSlots() {
    var chosen = state.formation.slice(0, 3).map(function (id) { return unit(id); }).filter(Boolean);
    var unique = [];
    chosen.forEach(function (u) { if (unique.indexOf(u) < 0) unique.push(u); });
    return unique.slice(0, 3);
  }
  function startBattle() {
    if (battleBusy) return;
    var party = teamSlots();
    if (!party.length) return toast("전투에 참가할 생명체를 1마리 이상 편성하세요.");
    var allies = party.map(function (u, i) {
      var c = combatStats(u);
      c.position = i === 0 ? "front" : (i === 1 ? "front" : "back");
      return c;
    });
    battle = {
      allies: allies,
      enemies: [makeEnemy(0), makeEnemy(1), makeEnemy(2)],
      round: 1,
      active: 0,
      phase: "player",
      log: ["스테이지 " + state.stage + " 전투 시작! 행동할 생명체를 선택하세요."],
      result: null,
      selectedAction: "attack"
    };
    allies.forEach(applyStartTurn);
    render();
  }
  function activeAlly() {
    if (!battle) return null;
    return battle.allies[battle.active] || null;
  }
  function nextAlly() {
    var next = -1;
    for (var i = battle.active + 1; i < battle.allies.length; i++) {
      if (battle.allies[i].hp > 0 && !battle.allies[i].acted) { next = i; break; }
    }
    if (next >= 0) {
      battle.active = next;
      return true;
    }
    return false;
  }
  function endCheck() {
    if (!alive(battle.enemies).length) {
      finishBattle(true);
      return true;
    }
    if (!alive(battle.allies).length) {
      finishBattle(false);
      return true;
    }
    return false;
  }
  function finishBattle(win) {
    battle.result = win ? "win" : "loss";
    battle.phase = "finished";
    if (win) {
      var stageWon = state.stage;
      var gold = 65 + stageWon * 17;
      var data = 14 + stageWon * 3;
      var energy = 18 + stageWon * 2;
      state.gold += gold;
      state.data += data;
      state.energy += energy;
      state.wins += 1;
      state.stage += 1;
      battle.allies.forEach(function (c) {
        if (c.hp > 0 && c.source) {
          c.source.xp += 28 + stageWon * 5;
          while (c.source.xp >= c.source.level * 35) {
            c.source.xp -= c.source.level * 35;
            c.source.level += 1;
          }
        }
      });
      state.log.push("스테이지 " + stageWon + " 전투 승리! 골드 +" + gold + ", 연구 데이터 +" + data + ", 에너지 +" + energy);
      log("전투 승리! 생존한 생명체가 경험치를 획득했습니다.");
    } else {
      state.energy += 8;
      state.log.push("스테이지 " + state.stage + " 전투 패배. 생명 에너지 +8");
      log("전투 패배. 군단을 훈련하거나 교배한 뒤 다시 도전하세요.");
    }
    save();
    render();
  }
  function playerAction(action) {
    if (!battle || battle.phase !== "player" || battle.result || battleBusy) return;
    var actor = activeAlly();
    if (!actor || actor.hp <= 0 || actor.acted) return;
    var targets = alive(battle.enemies);
    if (!targets.length) return endCheck();
    var target = chooseTarget(battle.enemies);
    var base = actor.atk;
    var isBlue = gene(actor.source, "A");
    var isHard = gene(actor.source, "B");
    var hasWings = gene(actor.source, "C");

    if (action === "attack") {
      var amount = damage(target, base * (0.9 + Math.random() * 0.25) - target.def * 0.45);
      log(actor.name + "의 기본 공격! " + target.name + "에게 " + amount + " 피해.");
      actor.energy = Math.min(actor.maxEnergy, actor.energy + 1);
    } else if (action === "defend") {
      actor.guarding = true;
      actor.shield += Math.round(actor.def * 1.8 + 8);
      log(actor.name + " 방어 태세! 이번 라운드 피해 감소 및 보호막 획득.");
      actor.energy = Math.min(actor.maxEnergy, actor.energy + 1);
    } else if (action === "skill") {
      if (actor.energy < 2) return toast("스킬 에너지가 부족합니다. 기본 공격이나 방어로 회복하세요.");
      actor.energy -= 2;
      var skillName, skillDamage;
      if (isBlue) {
        skillName = "서리 파동";
        skillDamage = base * 1.65 - target.def * 0.25;
        var dealt = damage(target, skillDamage);
        if (roll(0.32)) { addStatus(target, "freeze", 1, 0); log(target.name + " 빙결! 다음 행동을 잃습니다."); }
      } else {
        skillName = "황금 균열";
        skillDamage = base * 1.9 - target.def * 0.2;
        dealt = damage(target, skillDamage);
        if (roll(0.25)) addStatus(target, "weaken", 2, 0);
      }
      log(actor.name + "의 " + skillName + "! " + target.name + "에게 " + dealt + " 피해.");
    } else if (action === "gene") {
      if (actor.energy < 3) return toast("유전자 능력에는 에너지 3이 필요합니다.");
      actor.energy -= 3;
      if (isHard) {
        var shield = Math.round(actor.maxHp * 0.22 + actor.def * 2);
        actor.shield += shield;
        addStatus(actor, "regen", 2, Math.round(actor.maxHp * 0.045));
        log(actor.name + "의 외골격 각성! 보호막 " + shield + " 및 재생 효과.");
      } else if (hasWings) {
        var total = 0;
        alive(battle.enemies).forEach(function (enemy) {
          total += damage(enemy, base * 0.9 - enemy.def * 0.2);
        });
        log(actor.name + "의 폭풍 강습! 적 전체에게 총 " + total + " 피해.");
      } else {
        var heal = Math.round(actor.maxHp * 0.24);
        var before = actor.hp;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        addStatus(actor, "regen", 2, Math.round(actor.maxHp * 0.05));
        log(actor.name + "의 생명력 공명! HP +" + (actor.hp - before) + " 및 재생 효과.");
      }
    } else {
      return;
    }

    actor.acted = true;
    if (endCheck()) return;
    if (nextAlly()) {
      render();
      return;
    }
    enemyPhase();
  }
  function enemyPhase() {
    if (!battle || battle.result) return;
    battle.phase = "enemy";
    battleBusy = true;
    battle.enemies.forEach(function (enemy) {
      if (enemy.hp <= 0 || !alive(battle.allies).length) return;
      applyStartTurn(enemy);
      if (enemy.hp <= 0) return;
      var frozen = enemy.status.some(function (s) { return s.type === "freeze"; });
      if (frozen) {
        enemy.status = enemy.status.filter(function (s) { return s.type !== "freeze"; });
        log(enemy.name + "은(는) 빙결되어 행동하지 못했습니다.");
        return;
      }
      var target = chooseTarget(battle.allies);
      if (!target) return;
      if (enemy.energy >= 2 && roll(0.28)) {
        enemy.energy -= 2;
        var hit = damage(target, enemy.atk * 1.55 - target.def * 0.2);
        log(enemy.name + "의 강타! " + target.name + "에게 " + hit + " 피해.");
        if (roll(0.18)) addStatus(target, "weaken", 2, 0);
      } else {
        var hit2 = damage(target, enemy.atk * (0.85 + Math.random() * 0.2) - target.def * 0.5);
        log(enemy.name + "의 공격! " + target.name + "에게 " + hit2 + " 피해.");
        enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 1);
      }
    });
    if (endCheck()) { battleBusy = false; return; }
    battle.round += 1;
    battle.allies.forEach(function (ally) {
      ally.acted = false;
      ally.energy = Math.min(ally.maxEnergy, ally.energy + 1);
      applyStartTurn(ally);
    });
    if (endCheck()) { battleBusy = false; return; }
    battle.enemies.forEach(function (enemy) {
      enemy.acted = false;
      enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 1);
    });
    battle.active = battle.allies.findIndex(function (a) { return a.hp > 0; });
    battle.phase = "player";
    battleBusy = false;
    render();
  }
  function battleUnitCard(u, side, index) {
    var pct = clamp(u.hp / u.maxHp * 100, 0, 100);
    var active = side === "ally" && battle.phase === "player" && battle.active === index && !u.acted && u.hp > 0;
    var statuses = u.status.map(function (s) { return statusLabel(s) + " " + s.turns; }).join(" · ");
    var art = side === "ally" ? sprite(u.source) : '<div class="enemy-art">' + (u.isBoss ? "👹" : ["🐺","🪨","🐉","🦂"][index % 4]) + '</div>';
    return '<div class="battle-unit ' + (active ? "is-active " : "") + (u.hp <= 0 ? "is-dead" : "") + '">' +
      art + '<div class="battle-unit-info"><b>' + u.name + (u.isBoss ? " ★" : "") + '</b>' +
      '<div class="battle-hp"><span style="width:' + pct + '%"></span></div>' +
      '<small>HP ' + Math.ceil(u.hp) + ' / ' + u.maxHp + '　🛡 ' + u.shield + '</small>' +
      '<small>⚔ ' + u.atk + '　◆ ' + u.energy + '/' + u.maxEnergy + '</small>' +
      '<small class="status-text">' + (statuses || "상태 이상 없음") + '</small></div></div>';
  }
  function battleScreen() {
    if (!battle) return battleSetupView();
    var allyHtml = battle.allies.map(function (u, i) { return battleUnitCard(u, "ally", i); }).join("");
    var enemyHtml = battle.enemies.map(function (u, i) { return battleUnitCard(u, "enemy", i); }).join("");
    var actor = activeAlly();
    var finished = !!battle.result;
    var controls = "";
    if (finished) {
      controls = '<div class="battle-result"><h2>' + (battle.result === "win" ? "🏆 전투 승리!" : "패배") + '</h2><p>' +
        (battle.result === "win" ? "군단이 스테이지를 돌파했습니다." : "군단이 패배했습니다. 생명체를 강화하고 다시 도전하세요.") +
        '</p><button class="primary" onclick="closeBattle()">전투 결과 확인</button></div>';
    } else if (battle.phase === "player" && actor) {
      controls = '<div class="battle-controls"><div class="turn-heading">ROUND ' + battle.round + ' · ' + actor.name + '의 행동</div>' +
        '<div class="action-grid">' +
        '<button onclick="battleAct(\\'attack\\')">⚔️ 기본 공격<small>에너지 +1</small></button>' +
        '<button onclick="battleAct(\\'defend\\')">🛡️ 방어<small>피해 감소 · 보호막</small></button>' +
        '<button onclick="battleAct(\\'skill\\')" ' + (actor.energy < 2 ? "disabled" : "") + '>✨ 유전자 스킬<small>에너지 2 · 강력한 공격</small></button>' +
        '<button onclick="battleAct(\\'gene\\')" ' + (actor.energy < 3 ? "disabled" : "") + '>🧬 고유 유전자<small>에너지 3 · 개체별 효과</small></button>' +
        '</div><p class="muted">행동을 선택하면 다음 아군의 차례로 넘어갑니다. 모든 아군이 행동하면 적이 반격합니다.</p></div>';
    } else {
      controls = '<div class="battle-controls"><h3>적의 차례</h3><p>상대 군단이 행동하고 있습니다...</p></div>';
    }
    return '<div class="battle-arena panel"><div class="battle-top"><div><small>GENE WAR · STAGE ' + state.stage + '</small><h2>⚔️ 유전자 전쟁</h2></div><div class="round-pill">ROUND ' + battle.round + '</div></div>' +
      '<div class="battle-side-title enemy-title">상대 군단</div><div class="battle-team enemy-team">' + enemyHtml + '</div>' +
      '<div class="arena-divider"><span>VS</span></div>' +
      '<div class="battle-side-title ally-title">내 군단</div><div class="battle-team ally-team">' + allyHtml + '</div>' +
      controls + '<div class="panel battle-log-panel"><h3>전투 기록</h3><div class="log battle-log">' + battle.log.slice(-14).reverse().map(function (x) { return "› " + x; }).join("\\n") + '</div></div></div>';
  }
  function battleSetupView() {
    var opts = '<option value="">— 빈 슬롯 —</option>' + state.units.map(function (u) {
      return '<option value="' + u.id + '">' + u.name + ' · Lv.' + u.level + '</option>';
    }).join("");
    return '<div class="panel"><h2>⚔️ 군단 편성</h2><p>최대 3마리로 팀을 구성하세요. 각 생명체는 라운드마다 한 번 행동합니다. 전열 생명체가 우선 공격받습니다.</p>' +
      '<div class="formation battle-formation">' + [0,1,2].map(function (i) {
        var id = state.formation[i] || "";
        return '<div class="slot front"><b>' + (i === 0 ? "선봉" : i === 1 ? "중앙" : "후방") + '</b><br><select onchange="setBattleSlot(' + i + ',this.value)">' +
          opts.replace('value="' + id + '"', 'value="' + id + '" selected') + '</select></div>';
      }).join("") + '</div><div class="row" style="margin-top:14px"><button onclick="autoBattleTeam()">추천 편성</button><button class="primary" onclick="beginBattle()">전투 시작</button></div></div>' +
      '<div class="panel"><h2>전투 규칙</h2><ul><li>아군 3마리가 각각 행동한 뒤 적 군단이 반격합니다.</li><li>기본 공격과 방어는 에너지를 회복합니다.</li><li>유전자 스킬은 에너지 2, 고유 유전자 능력은 에너지 3을 사용합니다.</li><li>유전자형에 따라 고유 능력과 스킬 효과가 달라집니다.</li></ul></div>' +
      '<div class="panel"><h2>최근 전투 기록</h2><div class="log">' + state.log.filter(function (x) { return x.indexOf("전투") >= 0 || x.indexOf("승리") >= 0 || x.indexOf("패배") >= 0; }).slice(-10).reverse().join("\\n") + '</div></div>';
  }
  window.battleAct = playerAction;
  window.beginBattle = startBattle;
  window.closeBattle = function () { battle = null; battleBusy = false; render(); };
  window.setBattleSlot = function (i, id) {
    if (id && state.formation.some(function (x, j) { return j < 3 && j !== i && x === id; })) {
      toast("같은 생명체는 중복 편성할 수 없습니다.");
      return;
    }
    state.formation[i] = id || null;
    save();
    render();
  };
  window.autoBattleTeam = function () {
    var chosen = state.units.slice().sort(function (a, b) {
      var x = stats(a), y = stats(b);
      return (y.hp + y.atk * 4 + y.def * 3) - (x.hp + x.atk * 4 + x.def * 3);
    }).slice(0, 3).map(function (u) { return u.id; });
    state.formation[0] = chosen[0] || null;
    state.formation[1] = chosen[1] || null;
    state.formation[2] = chosen[2] || null;
    save();
    render();
  };
  battleView = battleScreen;
  fight = startBattle;
  document.addEventListener("click", function (event) {
    if (event.target && event.target.matches("#nav button")) {
      if (battle && battle.result === null) battle = null;
    }
  });
  render();
})();