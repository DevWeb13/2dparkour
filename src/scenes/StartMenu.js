// src/scenes/StartMenu.js

import Phaser from 'phaser';

export default class StartMenu extends Phaser.Scene {
  constructor() {
    super({ key: 'StartMenu' });
    this.selectedLevel = 1; // Niveau par défaut
  }

  create() {
    this.cameras.main.setBackgroundColor('#1f1b2e');

    this.add.text(70, 40, 'DUEL PARKOUR', {
      fill: '#ffffff',
      fontSize: '44px',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });

    this.add.text(70, 92, 'Objectif: 3 runes + FIN', {
      fill: '#ffd76a',
      fontSize: '22px',
      stroke: '#000000',
      strokeThickness: 4,
    });

    // Créer les boutons pour sélectionner les niveaux
    this.levelButtons = [
      this.createButton(90, 150, 'Niveau 1'),
      this.createButton(90, 205, 'Niveau 2'),
      this.createButton(90, 260, 'Niveau 3'),
    ];

    // Gestionnaires d'événements pour les boutons de niveau
    this.levelButtons.forEach((button, index) => {
      button.on('pointerdown', () => this.selectLevel(index + 1));
    });

    this.selectLevel(this.selectedLevel);

    this.startButton = this.createButton(90, 335, 'Lancer la partie');
    this.startButton.setFill('#9aff9a');
    this.startButton.on('pointerdown', () => this.startGame());

    this.add.text(90, 400, 'Contrôles mobile: joystick virtuel + JUMP\nQuitter en match: bouton Retour', {
      fill: '#d9d9d9',
      fontSize: '18px',
      lineSpacing: 6,
    });
  }

  createButton(x, y, label) {
    return this.add
      .text(x, y, label, {
        fill: '#d0ffd0',
        fontSize: '30px',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setInteractive({ useHandCursor: true });
  }

  selectLevel(level) {
    this.selectedLevel = level;
    this.levelButtons.forEach((button, index) => {
      button.setFill(index + 1 === level ? '#ff7a7a' : '#d0ffd0');
    });
  }

  startGame() {
    // Commencer le jeu avec le niveau sélectionné
    this.scene.start('PlayGame', { level: this.selectedLevel });
  }
}
