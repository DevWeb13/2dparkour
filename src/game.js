// src/game.js

import Phaser from 'phaser';
import PlayGame from './scenes/PlayGame';
import StartMenu from './scenes/StartMenu';

import { insertCoin } from 'playroomkit';
import ColorReplacePipelinePlugin from 'phaser3-rex-plugins/plugins/colorreplacepipeline-plugin.js';

export const gameOptions = {
  // width of the game, in pixels
  gameWidth: 14 * 32,
  // height of the game, in pixels
  gameHeight: 23 * 32,
  // background color
  bgColor: 0xf7deb5,
};

// Phaser 3 game configuration
const config = {
  type: Phaser.AUTO,
  width: gameOptions.gameWidth,
  height: gameOptions.gameHeight,
  parent: 'container',
  scene: [StartMenu, PlayGame],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    global: [
      {
        key: 'rexColorReplacePipeline',
        plugin: ColorReplacePipelinePlugin,
        start: true,
      },
    ],
  },
};

insertCoin().then(() => {
  // creating a new Phaser 3 game instance
  const game = new Phaser.Game(config);
});
