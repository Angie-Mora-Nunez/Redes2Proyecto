
import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { LobbyG } from './features/lobby-g/lobby-g';
import { partidaGuard } from './core/guards/season-guard';


export const routes: Routes = [
  { path: '', component: Home },
  {  path: 'lobby',component: LobbyG, canActivate: [partidaGuard] },
  {path: 'game',loadComponent: () => import('./features/game/game').then((m) => m.Juego),},
  { path: 'winner', loadComponent: () => import('./features/winner/winner').then((m) => m.Ganador) },
  { path: '**', redirectTo: '' }
];