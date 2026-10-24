import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EMPTY, catchError, filter, finalize, switchMap, timer } from 'rxjs';
import { Fase, Vista } from '../../core/models/game.models';
import { PartidaService, obtenerMensajeDeError } from '../../core/services/partida.service';
 
// Cada cuántos milisegundos revisamos si el anfitrión eliminó la partida.
const INTERVALO_CONSULTA_MS = 3000;
 
const RUTAS = {
  BIENVENIDA: '/',
  LOBBY: '/lobby',
  JUEGO: '/game',
} as const;
 
@Component({
  selector: 'app-ganador',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './winner.html',
  styleUrl: './winner.css',
})
export class Ganador implements OnInit {
  private readonly api = inject(PartidaService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
 
  protected readonly vista = signal<Vista | null>(null);
 
  /** true mientras se elimina la partida (evita doble clic). */
  protected readonly eliminando = signal(false);
 
  /** Paso de confirmación antes de borrar la partida (acción irreversible). */
  protected readonly confirmandoEliminar = signal(false);
 
  /** Jugadores ordenados por puntos (en empate se conserva el orden original). */
  protected readonly ranking = computed(() =>
    [...(this.vista()?.jugadores ?? [])].sort((a, b) => b.puntos - a.puntos),
  );
 
  /**
   * Solo hay un ganador: la partida termina cuando alguien llega a la meta y en cada
   * ronda se da un solo punto. Se usa ganador_id del backend (con el primero del
   * marcador como respaldo).
   */
  protected readonly ganador = computed(() => {
    const vista = this.vista();
    return vista?.jugadores.find((j) => j.id === vista.ganador_id) ?? this.ranking()[0] ?? null;
  });
 
  protected readonly esAnfitrion = computed(() => {
    const miId = this.vista()?.yo?.id;
    return !!miId && this.vista()?.anfitrion_id === miId;
  });
 
  /** Historial con el nombre del soberano y del ganador de cada ronda. */
  protected readonly rondas = computed(() => {
    const vista = this.vista();
    if (!vista) return [];
    const nombre = (id: string | null | undefined) =>
      vista.jugadores.find((j) => j.id === id)?.nombre ?? 'Jugador';
    return vista.historial.map((r) => ({
      numero: r.numero,
      frase: r.frase,
      respeto: r.respeto_al_pueblo,
      soberano: nombre(r.soberano_id),
      ganador: nombre(r.ganador_id),
    }));
  });
 
  ngOnInit(): void {
    if (!this.api.haySesion()) {
      this.router.navigate([RUTAS.BIENVENIDA]);
      return;
    }
 
    timer(0, INTERVALO_CONSULTA_MS)
      .pipe(
        filter(() => !document.hidden),
        switchMap(() =>
          this.api.obtener().pipe(
            catchError((err) => {
              this.manejarErrorDeConsulta(err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((vista) => this.aplicarVista(vista));
  }
 
  protected pedirConfirmacion(): void {
    this.confirmandoEliminar.set(true);
  }
 
  protected cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }
 
  /** Solo el anfitrión: DELETE /api/partidas/{id}. */
  protected eliminar(): void {
    if (!this.esAnfitrion() || this.eliminando()) return;
    this.eliminando.set(true);
    this.api
      .eliminar()
      .pipe(finalize(() => this.eliminando.set(false)))
      .subscribe({
        complete: () => {
          this.api.limpiarSesion();
          this.router.navigate([RUTAS.BIENVENIDA]);
        },
        error: (err) => {
          this.confirmandoEliminar.set(false);
          this.snackBar.open(obtenerMensajeDeError(err), 'Cerrar', { duration: 5000 });
        },
      });
  }
 
  /** Salir sin borrar: solo olvida la sesión de este navegador. */
  protected volverAlInicio(): void {
    this.api.limpiarSesion();
    this.router.navigate([RUTAS.BIENVENIDA]);
  }
 
  private aplicarVista(vista: Vista): void {
    if (vista.fase === Fase.SALA) {
      this.router.navigate([RUTAS.LOBBY]);
      return;
    }
    if (vista.fase !== Fase.TERMINADA) {
      this.router.navigate([RUTAS.JUEGO]);
      return;
    }
    this.vista.set(vista);
  }
 
  private manejarErrorDeConsulta(err: unknown): void {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 404) {
      this.api.limpiarSesion();
      this.router.navigate([RUTAS.BIENVENIDA]);
      return;
    }
    this.snackBar.open(obtenerMensajeDeError(err), 'Cerrar', { duration: 3000 });
  }
}