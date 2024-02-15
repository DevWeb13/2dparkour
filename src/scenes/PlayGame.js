//

import Phaser from 'phaser';
import Player from '../objects/Player';

import { gameOptions } from '../game';

import { onPlayerJoin, isHost, Joystick } from 'playroomkit';

export default class PlayGame extends Phaser.Scene {
  constructor() {
    super('PlayGame');
  }

  init(data) {
    this.selectedLevel = data.level || 0; // Utilisez le niveau passé ou par défaut à 0
  }

  preload() {
    this.load.image('tile', '/tile.png');
    this.load.image('hero', '/hero.png');
    this.load.tilemapTiledJSON('level', `/level-${this.selectedLevel}.json`);
  }

  create() {
    // setting background color
    this.cameras.main.setBackgroundColor(gameOptions.bgColor);

    // creatin of "level" tilemap
    this.map = this.make.tilemap({
      key: 'level',
      tileWidth: 64,
      tileHeight: 64,
    });

    // Player start position
    const startX = this.map.layer.x;
    const startY = this.map.layer.y;

    // adding tiles (actually one tile) to tilemap
    this.tileset = this.map.addTilesetImage('tileset01', 'tile');

    // which layer should we render? That's right, "layer01"
    this.layer = this.map.createLayer('layer01', this.tileset, 0, 0);

    this.layer.setCollisionBetween(0, 1, true);

    // loading level tilemap
    this.physics.world.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels
    );

    // players and their controllers
    this.players = [];

    onPlayerJoin(async (player) => {
      const joystick = new Joystick(player, {
        type: 'dpad',
        buttons: [{ id: 'jump', label: 'JUMP' }],
      });
      const hero = new Player(
        this,
        this.layer,
        startX,
        startY,
        player.getProfile().color.hex,
        joystick
      );

      this.players.push({ player, hero, joystick });
      player.onQuit(() => {
        this.players = this.players.filter(
          ({ player: _player }) => _player !== player
        );
        hero.destroy();
      });
    });
  }

  update() {
    this.players.forEach(({ player, hero }) => {
      if (isHost()) {
        hero.update();
        player.setState('pos', hero.pos());
      } else {
        const pos = player.getState('pos');
        if (pos) {
          hero.setPos(pos.x, pos.y);
        }
      }
    });
  }
}
