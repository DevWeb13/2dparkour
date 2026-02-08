import Phaser from 'phaser';
import Player from '../objects/Player';

import { gameOptions } from '../game';

import { onPlayerJoin, isHost, Joystick, myPlayer } from 'playroomkit';

const COURSE_ZONE_COUNT = 3;
const RUNE_RADIUS = 22;
const EXTRA_VERTICAL_ROWS = 14;

export default class PlayGame extends Phaser.Scene {
  constructor() {
    super('PlayGame');
  }

  init(data = {}) {
    this.selectedLevel = data.level || 1;
  }

  preload() {
    this.load.image('tile', '/tile.png');
    this.load.image('hero', '/hero.png');

    this.load.tilemapTiledJSON('level-1', '/level-1.json');
    this.load.tilemapTiledJSON('level-2', '/level-2.json');
    this.load.tilemapTiledJSON('level-3', '/level-3.json');
  }

  create() {
    this.cameras.main.setBackgroundColor(gameOptions.bgColor);

    this.players = [];
    this.raceStartedAt = Date.now();
    this.winnerId = null;

    this.buildCourse();
    this.createRaceUI();

    onPlayerJoin(async (player) => {
      const joystick = new Joystick(player, {
        type: 'buttons',
        buttons: [
          { id: 'left', label: '←' },
          { id: 'right', label: '→' },
          { id: 'jump', label: 'JUMP' },
        ],
      });

      const hero = new Player(
        this,
        this.layer,
        this.spawnPoint.x,
        this.spawnPoint.y,
        player.getProfile().color.hex,
        joystick
      );

      const entry = {
        player,
        hero,
        runes: new Set(),
        finishedAtMs: null,
      };

      this.players.push(entry);

      const me = myPlayer();
      if (me && me.id === player.id) {
        // Suivi horizontal + vertical pour autoriser des parcours plus hauts.
        this.cameras.main.startFollow(hero.body(), true, 0.12, 0.12);
      }

      player.onQuit(() => {
        this.players = this.players.filter(({ player: p }) => p !== player);
        hero.destroy();
      });
    });
  }

  buildCourse() {
    const order = this.getZoneOrder(this.selectedLevel);
    const maps = order.map((level) => this.cache.tilemap.get(`level-${level}`).data);

    const zoneWidth = maps[0].width;
    const zoneHeight = maps[0].height;
    const mergedData = Array.from({ length: zoneHeight }, () => []);

    maps.forEach((mapData) => {
      const raw = mapData.layers.find((layer) => layer.name === 'layer01').data;
      for (let y = 0; y < zoneHeight; y++) {
        for (let x = 0; x < zoneWidth; x++) {
          const tiledGid = raw[y * zoneWidth + x];
          // Tiled: 0 = empty, 1 = first tile. Phaser data-map: -1 = empty, 0 = first tile.
          mergedData[y].push(tiledGid === 0 ? -1 : tiledGid - 1);
        }
      }
    });

    const paddedData = this.addVerticalSpace(mergedData, EXTRA_VERTICAL_ROWS);

    this.openCoursePassages(paddedData, zoneWidth, zoneHeight + EXTRA_VERTICAL_ROWS);
    this.addVerticalChallenges(paddedData, zoneWidth, zoneHeight + EXTRA_VERTICAL_ROWS);
    this.openFinishAccess(paddedData, zoneWidth, zoneHeight + EXTRA_VERTICAL_ROWS);

    this.map = this.make.tilemap({
      data: paddedData,
      tileWidth: 32,
      tileHeight: 32,
    });

    this.tileset = this.map.addTilesetImage('tile', 'tile', 32, 32, 0, 0, 0);
    this.layer = this.map.createLayer(0, this.tileset, 0, 0);
    this.layer.setCollisionByExclusion([-1]);

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.spawnPoint = { x: 48, y: this.map.heightInPixels - 96 };

    const third = this.map.widthInPixels / COURSE_ZONE_COUNT;
    const baseY = this.map.heightInPixels - 110;

    this.runes = [
      this.createRune(third * 0.42, baseY - 96, 0),
      this.createRune(third * 1.47, baseY - 320, 1),
      this.createRune(third * 2.38, baseY - 230, 2),
    ];

    this.finishZone = this.add.rectangle(
      this.map.widthInPixels - 56,
      this.map.heightInPixels - 64,
      80,
      96,
      0x00ff88,
      0.25
    );

    this.add
      .text(this.finishZone.x - 22, this.finishZone.y - 44, 'FIN', {
        color: '#003322',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setScrollFactor(1);
  }


  addVerticalSpace(data, extraRows) {
    const rowWidth = data[0].length;
    const emptyRows = Array.from({ length: extraRows }, () =>
      Array.from({ length: rowWidth }, () => -1)
    );
    return [...emptyRows, ...data];
  }

  addVerticalChallenges(mergedData, zoneWidth, zoneHeight) {
    const setSolid = (x, y) => {
      if (x < 0 || y < 0 || y >= zoneHeight || x >= mergedData[y].length) return;
      mergedData[y][x] = 0;
    };

    const makeStair = (baseX, baseY, steps, direction = 1) => {
      for (let i = 0; i < steps; i++) {
        setSolid(baseX + i * direction, baseY - i);
        setSolid(baseX + i * direction + direction, baseY - i);
      }
    };

    const top = 6;
    const h = zoneHeight;

    // Zone 1 : montée progressive.
    makeStair(8, h - 8, 8, 1);
    setSolid(18, h - 15);
    setSolid(19, h - 15);

    // Zone 2 : tour verticale avec paliers.
    const z2 = zoneWidth + 14;
    for (let y = h - 6; y >= top + 8; y--) setSolid(z2, y);
    for (let x = z2; x <= z2 + 4; x++) setSolid(x, h - 18);
    for (let x = z2 - 5; x <= z2 - 1; x++) setSolid(x, h - 24);
    for (let x = z2 + 5; x <= z2 + 8; x++) setSolid(x, h - 30);

    // Zone 3 : sections hautes pour forcer un suivi caméra vertical.
    const z3 = zoneWidth * 2 + 10;
    makeStair(z3, h - 10, 7, 1);
    for (let x = z3 + 10; x <= z3 + 16; x++) setSolid(x, h - 24);
    for (let x = z3 + 18; x <= z3 + 23; x++) setSolid(x, h - 31);
  }

  openCoursePassages(mergedData, zoneWidth, zoneHeight) {
    const seamColumns = [zoneWidth - 1, zoneWidth, zoneWidth * 2 - 1, zoneWidth * 2];

    const setSolid = (x, y) => {
      if (x < 0 || y < 0 || y >= zoneHeight || x >= mergedData[y].length) return;
      mergedData[y][x] = 0;
    };

    const setEmpty = (x, y) => {
      if (x < 0 || y < 0 || y >= zoneHeight || x >= mergedData[y].length) return;
      mergedData[y][x] = -1;
    };

    // Supprime les murs verticaux bloquants sur les jonctions entre zones.
    seamColumns.forEach((col) => {
      for (let y = 1; y < zoneHeight - 1; y++) {
        setEmpty(col, y);
      }
      setSolid(col, zoneHeight - 1);
    });

    // Ajoute des petites marches "parkour" pour franchir les passages de zone.
    const seamSteps = [zoneWidth - 2, zoneWidth * 2 - 2];
    seamSteps.forEach((x) => {
      setSolid(x - 1, zoneHeight - 4);
      setSolid(x, zoneHeight - 5);
      setSolid(x + 1, zoneHeight - 6);
      setSolid(x + 2, zoneHeight - 7);

      setSolid(x + 4, zoneHeight - 6);
      setSolid(x + 5, zoneHeight - 7);
      setSolid(x + 6, zoneHeight - 8);
    });

    // Garantit au minimum une ligne de progression au sol.
    for (let x = 0; x < mergedData[zoneHeight - 1].length; x++) {
      setSolid(x, zoneHeight - 1);
    }
  }


  openFinishAccess(mergedData, zoneWidth, zoneHeight) {
    const setSolid = (x, y) => {
      if (x < 0 || y < 0 || y >= zoneHeight || x >= mergedData[y].length) return;
      mergedData[y][x] = 0;
    };

    const setEmpty = (x, y) => {
      if (x < 0 || y < 0 || y >= zoneHeight || x >= mergedData[y].length) return;
      mergedData[y][x] = -1;
    };

    const endX = mergedData[0].length - 1;

    // Ouvre un couloir final vers la zone FIN (à droite) et évite les murs fermés.
    for (let x = endX - 7; x <= endX; x++) {
      for (let y = zoneHeight - 5; y >= zoneHeight - 10; y--) {
        setEmpty(x, y);
      }
      setSolid(x, zoneHeight - 1);
    }

    // Crée une petite rampe de montée vers FIN.
    setSolid(endX - 9, zoneHeight - 3);
    setSolid(endX - 8, zoneHeight - 3);
    setSolid(endX - 7, zoneHeight - 4);
    setSolid(endX - 6, zoneHeight - 4);
    setSolid(endX - 5, zoneHeight - 5);
    setSolid(endX - 4, zoneHeight - 5);
  }

  createRune(x, y, id) {
    const rune = this.add.circle(x, y, RUNE_RADIUS, 0xffcc00, 0.9);
    this.add.text(x - 7, y - 12, `${id + 1}`, {
      color: '#402d00',
      fontSize: '18px',
      fontStyle: 'bold',
    });
    return { id, x, y, view: rune };
  }

  createRaceUI() {
    this.add
      .text(12, 10, 'DUEL PARKOUR — Récupère 3 runes puis FIN', {
        color: '#ffffff',
        fontSize: '18px',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(12, 38, 'Temps: 0.00s', {
        color: '#ffffff',
        fontSize: '18px',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.statusText = this.add
      .text(12, 66, '', {
        color: '#ffe28a',
        fontSize: '18px',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  getZoneOrder(level) {
    const all = [1, 2, 3];
    const start = Math.max(1, Math.min(3, level));
    const idx = all.indexOf(start);
    return [all[idx], all[(idx + 1) % 3], all[(idx + 2) % 3]];
  }

  isInsideFinishZone(heroBody) {
    const x = heroBody.x + heroBody.width / 2;
    const y = heroBody.y + heroBody.height / 2;

    return (
      x >= this.finishZone.x - this.finishZone.width / 2 &&
      x <= this.finishZone.x + this.finishZone.width / 2 &&
      y >= this.finishZone.y - this.finishZone.height / 2 &&
      y <= this.finishZone.y + this.finishZone.height / 2
    );
  }

  updateRaceStateHost(entry) {
    if (this.winnerId) return;

    const centerX = entry.hero.body().x + 16;
    const centerY = entry.hero.body().y + 16;

    this.runes.forEach((rune) => {
      if (entry.runes.has(rune.id)) return;

      const dist = Phaser.Math.Distance.Between(centerX, centerY, rune.x, rune.y);
      if (dist <= RUNE_RADIUS + 8) {
        entry.runes.add(rune.id);
      }
    });

    const runesCollected = entry.runes.size;

    if (runesCollected === this.runes.length && this.isInsideFinishZone(entry.hero.body())) {
      this.winnerId = entry.player.id;
      entry.finishedAtMs = Date.now() - this.raceStartedAt;
      this.players.forEach(({ hero }) => hero.setFrozen(true));
    }

    entry.player.setState('race', {
      runesCollected,
      runeIds: [...entry.runes],
      winnerId: this.winnerId,
      finishedAtMs: entry.finishedAtMs,
    });
  }

  refreshUI() {
    const elapsed = ((Date.now() - this.raceStartedAt) / 1000).toFixed(2);
    this.timerText.setText(`Temps: ${elapsed}s`);

    const me = myPlayer();
    if (!me) return;

    const mine = this.players.find(({ player }) => player.id === me.id);
    if (!mine) return;

    const raceState = mine.player.getState('race') || {};
    const runes = raceState.runesCollected ?? mine.runes.size;

    if (raceState.winnerId) {
      const iWon = raceState.winnerId === me.id;
      const winnerName = this.players.find(({ player }) => player.id === raceState.winnerId)?.player
        .getProfile()
        ?.name;

      this.statusText.setText(
        iWon
          ? `🏆 Victoire ! Temps: ${((raceState.finishedAtMs || 0) / 1000).toFixed(2)}s`
          : `💥 ${winnerName || 'Un joueur'} gagne la manche`
      );
      return;
    }

    this.statusText.setText(`Runes: ${runes}/${this.runes.length} — traverse les zones vers FIN`);
  }

  update() {
    this.players.forEach((entry) => {
      const { player, hero } = entry;

      if (isHost()) {
        hero.update();
        this.updateRaceStateHost(entry);
        player.setState('pos', hero.pos());
      } else {
        const pos = player.getState('pos');
        if (pos) {
          hero.setPos(pos.x, pos.y);
        }

        const raceState = player.getState('race');
        if (raceState?.winnerId && !this.winnerId) {
          this.winnerId = raceState.winnerId;
          this.players.forEach(({ hero: h }) => h.setFrozen(true));
        }
      }
    });

    this.runes.forEach((rune) => {
      const collectedByAnyone = this.players.some(({ player }) => {
        const race = player.getState('race');
        return (race?.runeIds || []).includes(rune.id);
      });
      rune.view.setAlpha(collectedByAnyone ? 0.2 : 0.9);
    });

    this.refreshUI();
  }
}
