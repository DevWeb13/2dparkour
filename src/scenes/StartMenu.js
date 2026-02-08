// src/scenes/StartMenu.js

import Phaser from 'phaser';

export default class StartMenu extends Phaser.Scene {
  constructor() {
    super({ key: 'StartMenu' });
    this.selectedLevel = 1; // Niveau par défaut
  }

  create() {
    // Créer les boutons pour sélectionner les niveaux
    this.levelButtons = [
      this.add.text(100, 100, 'Niveau 1', { fill: '#0f0' }).setInteractive(),
      this.add.text(100, 150, 'Niveau 2', { fill: '#0f0' }).setInteractive(),
      this.add.text(100, 200, 'Niveau 3', { fill: '#0f0' }).setInteractive(),
    ];

    // Gestionnaires d'événements pour les boutons de niveau
    this.levelButtons.forEach((button, index) => {
      button.on('pointerdown', () => this.selectLevel(index + 1));
    });

    this.selectLevel(this.selectedLevel);

    // Bouton de démarrage
    let startButton = this.add
      .text(100, 250, 'Démarrer', { fill: '#0f0' })
      .setInteractive();
    startButton.on('pointerdown', () => this.startGame());
  }

  selectLevel(level) {
    this.selectedLevel = level;
    this.levelButtons.forEach((button, index) => {
      button.setFill(index + 1 === level ? '#f00' : '#0f0');
    });
  }

  startGame() {
    // Commencer le jeu avec le niveau sélectionné
    this.scene.start('PlayGame', { level: this.selectedLevel });
  }
}
