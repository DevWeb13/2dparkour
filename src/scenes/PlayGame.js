import Phaser from 'phaser';
import Player from '../objects/Player';

import { gameOptions } from '../game';

import { onPlayerJoin, isHost, Joystick, myPlayer } from 'playroomkit';

const COURSE_ZONE_COUNT = 3;
const RUNE_RADIUS = 26;

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

    // Charge les 3 maps pour construire un parcours horizontal en 3 zones.
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
        type: 'dpad',
        buttons: [{ id: 'jump', label: 'JUMP' }],
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
        joystick,
        runes: new Set(),
        finishedAtMs: null,
      };

      this.players.push(entry);

      // On suit la caméra du joueur local (host ou client).
      const me = myPlayer();
      if (me && me.id === player.id) {
        this.cameras.main.startFollow(hero.body(), true, 0.1, 0.1);
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
          mergedData[y].push(raw[y * zoneWidth + x]);
        }
      }
    });

    this.map = this.make.tilemap({
      data: mergedData,
      tileWidth: 64,
      tileHeight: 64,
    });

    this.tileset = this.map.addTilesetImage('tile', 'tile', 64, 64, 0, 0, 0);
    this.layer = this.map.createLayer(0, this.tileset, 0, 0);
    this.layer.setCollisionBetween(0, 1, true);

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.spawnPoint = { x: 64, y: this.map.heightInPixels - 180 };

    const third = this.map.widthInPixels / COURSE_ZONE_COUNT;
    const y = this.map.heightInPixels - 260;

    this.runes = [
      this.createRune(third * 0.5, y, 0),
      this.createRune(third * 1.5, y - 80, 1),
      this.createRune(third * 2.3, y - 40, 2),
    ];

    this.finishZone = this.add.rectangle(
      this.map.widthInPixels - 120,
      this.map.heightInPixels - 240,
      120,
      240,
      0x00ff88,
      0.25
    );
    this.add
      .text(this.finishZone.x - 45, this.finishZone.y - 95, 'FIN', {
        color: '#003322',
        fontSize: '24px',
        fontStyle: 'bold',
      })
      .setScrollFactor(1);
  }

  createRune(x, y, id) {
    const rune = this.add.circle(x, y, RUNE_RADIUS, 0xffcc00, 0.9);
    this.add.text(x - 8, y - 14, `${id + 1}`, {
      color: '#402d00',
      fontSize: '22px',
      fontStyle: 'bold',
    });
    return { id, x, y, view: rune };
  }

  createRaceUI() {
    this.titleText = this.add
      .text(12, 10, 'DUEL PARKOUR — Récupère les 3 runes puis touche la zone FIN', {
        color: '#ffffff',
        fontSize: '20px',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(12, 42, 'Temps: 0.00s', {
        color: '#ffffff',
        fontSize: '18px',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.statusText = this.add
      .text(12, 70, '', {
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

    this.statusText.setText(`Runes: ${runes}/${this.runes.length} — file vers FIN`);
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
