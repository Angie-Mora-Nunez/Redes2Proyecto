
import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { LobbyG } from '../lobby-g/lobby-g';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'lobby', component: LobbyG }
];