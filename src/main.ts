import './style.css';
import { Game } from './game/game';

const view = document.getElementById('view');
if (!(view instanceof HTMLCanvasElement)) {
  throw new Error('Missing canvas');
}

new Game(view);
