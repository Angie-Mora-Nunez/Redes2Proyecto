import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PartidaService } from '../services/partida.service';

export const partidaGuard: CanActivateFn = () => {
  const partidaService = inject(PartidaService);
  const router = inject(Router);

  if (partidaService.haySesion()) {
    return true;
  }

  return router.createUrlTree(['/']);
};