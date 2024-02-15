// src/scenes/StartMenu.js

import Phaser from 'phaser';

export default class StartMenu extends Phaser.Scene {
  constructor() {
    super({ key: 'StartMenu' });
    this.selectedLevel = 1; // Niveau par défaut
  }

  create() {
    // Créer les boutons pour sélectionner les niveaux
    let level1Button = this.add
      .text(100, 100, 'Niveau 1', { fill: '#0f0' })
      .setInteractive();
    let level2Button = this.add
      .text(100, 150, 'Niveau 2', { fill: '#0f0' })
      .setInteractive();
    let level3Button = this.add
      .text(100, 200, 'Niveau 3', { fill: '#0f0' })
      .setInteractive();

    // Gestionnaires d'événements pour les boutons de niveau
    level1Button.on('pointerdown', () => {
      this.selectedLevel = 1;
      this.updateButtonColors(level1Button, level2Button);
    });
    level2Button.on('pointerdown', () => {
      this.selectedLevel = 2;
      this.updateButtonColors(level2Button, level1Button);
    });
    level3Button.on('pointerdown', () => {
      this.selectedLevel = 3;
      this.updateButtonColors(level3Button, level1Button);
    });

    // Bouton de démarrage
    let startButton = this.add
      .text(100, 250, 'Démarrer', { fill: '#0f0' })
      .setInteractive();
    startButton.on('pointerdown', () => this.startGame());
  }

  updateButtonColors(selectedButton, otherButton) {
    selectedButton.setFill('#f00'); // Couleur pour le bouton sélectionné
    otherButton.setFill('#0f0'); // Couleur par défaut pour l'autre bouton
  }

  startGame() {
    // Commencer le jeu avec le niveau sélectionné
    this.scene.start('PlayGame', { level: this.selectedLevel });
  }
}
