import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EMPTY, Observable, catchError, filter, finalize, switchMap, timer } from 'rxjs';
import { Fase, Vista } from '../../core/models/game.models';
import { PartidaService, obtenerMensajeDeError } from '../../core/services/partida.service';
 
const INTERVALO_CONSULTA_MS = 2000;
 
// Rutas a las que esta pantalla puede mandar al jugador.
const RUTAS = {
  BIENVENIDA: '/',
  LOBBY: '/lobby',
  GANADOR: '/winner',
} as const;
 
// Pasos de la barra de progreso de la ronda (la fase "terminada" los completa todos).
const PASOS = [
  { fase: Fase.RESPUESTAS, texto: 'Respuestas' },
  { fase: Fase.VOTACION, texto: 'Votación' },
  { fase: Fase.DECISION, texto: 'Decisión' },
  { fase: Fase.RESULTADO, texto: 'Resultado' },
] as const;
 
@Component({
  selector: 'app-juego',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class Juego implements OnInit {
  private readonly api = inject(PartidaService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
 
  protected readonly Fase = Fase;
  protected readonly pasos = PASOS;
 
  // ---------- Estado ----------
 
  /** Última vista de la partida que mandó el servidor*/
  protected readonly vista = signal<Vista | null>(null);
 
  /** Ids de las cartas blancas marcadas, en orden de clic*/
  protected readonly seleccion = signal<number[]>([]);
 
  protected readonly respuestaElegida = signal<string | null>(null);

  protected readonly enviando = signal(false);
 
  protected readonly yo = computed(() => this.vista()?.yo ?? null);
  protected readonly ronda = computed(() => this.vista()?.ronda ?? null);
  protected readonly mano = computed(() => this.yo()?.mano ?? []);
 
  /** Jugadores ordenados por puntos (en empate se conserva el orden original). */
  protected readonly ranking = computed(() =>
    [...(this.vista()?.jugadores ?? [])].sort((a, b) => b.puntos - a.puntos),
  );
 
  protected readonly esSoberano = computed(() => {
    const miId = this.yo()?.id;
    return !!miId && this.ronda()?.soberano_id === miId;
  });
 
  protected readonly esAnfitrion = computed(() => {
    const miId = this.yo()?.id;
    return !!miId && this.vista()?.anfitrion_id === miId;
  });
 
  /** Solo el anfitrión o el soberano actual. */
  protected readonly puedeAvanzar = computed(() => this.esAnfitrion() || this.esSoberano());
 
  protected readonly motivoAvanzar = computed(() => {
    if (this.esAnfitrion() && this.esSoberano()) return 'anfitrión y soberano';
    return this.esAnfitrion() ? 'anfitrión' : 'soberano';
  });
 
  protected readonly mostrarAvanzar = computed(() => {
    const fase = this.vista()?.fase;
    return (
      this.puedeAvanzar() &&
      fase !== Fase.DECISION &&
      fase !== Fase.TERMINADA &&
      fase !== Fase.SALA
    );
  });
 
  protected readonly textoAvanzar = computed(() => {
    switch (this.vista()?.fase) {
      case Fase.RESPUESTAS:
        return 'Cerrar respuestas e iniciar votación';
      case Fase.VOTACION:
        return 'Cerrar votación';
      case Fase.RESULTADO:
        return 'Siguiente ronda';
      default:
        return '';
    }
  });
 
  protected readonly cartasPorElegir = computed(() => this.ronda()?.carta_negra.elegir ?? 1);
 
  protected readonly yaRespondi = computed(
    () => this.vista()?.jugadores.find((j) => j.id === this.yo()?.id)?.ya_respondio ?? false,
  );
 
  protected readonly puedeResponder = computed(
    () => this.vista()?.fase === Fase.RESPUESTAS && !this.esSoberano() && !this.yaRespondi(),
  );
 
  protected readonly puedeEnviar = computed(
    () => this.seleccion().length === this.cartasPorElegir() && !this.enviando(),
  );
 
  protected readonly mostrarConfirmar = computed(() => {
    const fase = this.vista()?.fase;
    if (fase === Fase.VOTACION) return !this.esSoberano() && !this.yo()?.mi_voto;
    if (fase === Fase.DECISION) return this.esSoberano();
    return false;
  });
 
  protected readonly puedeConfirmar = computed(
    () => this.mostrarConfirmar() && this.respuestaElegida() !== null && !this.enviando(),
  );
 
  protected readonly textoConfirmar = computed(() =>
    this.vista()?.fase === Fase.DECISION ? 'Confirmar ganadora' : 'Confirmar voto',
  );
 
  protected readonly totalParticipantes = computed(() =>
    Math.max((this.vista()?.jugadores.length ?? 1) - 1, 0),
  );
 
  protected readonly indicePaso = computed(() => {
    const fase = this.vista()?.fase;
    if (fase === Fase.TERMINADA) return PASOS.length;
    return PASOS.findIndex((p) => p.fase === fase);
  });
 
  protected readonly respuestaGanadora = computed(() => {
    const ronda = this.ronda();
    return ronda?.respuestas.find((r) => r.id === ronda.ganadora) ?? null;
  });
 
  protected readonly ultimoResumen = computed(() => this.vista()?.historial.at(-1) ?? null);
 
  protected readonly ganadorDeRonda = computed(() => {
    const resumen = this.ultimoResumen();
    return this.vista()?.jugadores.find((j) => j.id === resumen?.ganador_id)?.nombre ?? null;
  });
 
  protected readonly mensajeEstado = computed(() => {
    const vista = this.vista();
    const ronda = this.ronda();
    if (!vista || !ronda) return '';
 
    const total = this.totalParticipantes();
    const n = ronda.carta_negra.elegir;
    const cartas = n === 1 ? '1 carta' : `${n} cartas`;
 
    switch (vista.fase) {
      case Fase.RESPUESTAS:
        if (this.esSoberano()) {
          return `Eres el soberano. Espera las respuestas: ${ronda.respuestas_recibidas} de ${total}.`;
        }
        if (this.yaRespondi()) {
          return `Respuesta enviada. Esperando a los demás: ${ronda.respuestas_recibidas} de ${total}.`;
        }
        return `Elige ${cartas} de tu mano (${this.seleccion().length}/${n}).`;
      case Fase.VOTACION:
        if (this.esSoberano()) {
          return `El pueblo está votando: ${ronda.votos_emitidos} de ${total} votos.`;
        }
        if (this.yo()?.mi_voto) {
          return `Voto registrado. Esperando a los demás: ${ronda.votos_emitidos} de ${total}.`;
        }
        return this.respuestaElegida()
          ? 'Confirma tu voto o elige otra respuesta.'
          : '¿Cuál es la más graciosa? Elige una y confirma tu voto. Puedes votar por la tuya.';
      case Fase.DECISION:
        if (!this.esSoberano()) return 'El soberano está decidiendo…';
        return this.respuestaElegida()
          ? 'Confirma tu decisión o elige otra respuesta.'
          : 'Tu turno: elige a la ganadora, respetes o no al pueblo.';
      case Fase.RESULTADO:
        return 'Resultado de la ronda';
      case Fase.TERMINADA:
        return 'La partida terminó.';
      default:
        return '';
    }
  });
 
  // ---------- Ciclo de vida ----------
 
  /** Al abrir la pantalla: arranca la consulta periódica al backend. */
  ngOnInit(): void {
    if (!this.api.haySesion()) {
      this.router.navigate([RUTAS.BIENVENIDA]);
      return;
    }
 
    timer(0, INTERVALO_CONSULTA_MS)
      .pipe(
        // Con la pestaña oculta no consultamos
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
 
  // ---------- Acciones del jugador ----------
 
  /**
   * Marca o desmarca una carta. Si ya están todas las que pide la carta negra,
   * la carta nueva reemplaza a la última elegida (así se corrige un mal clic sin desmarcar antes).
   */
  protected alternarCarta(cartaId: number): void {
    this.seleccion.update((actual) => {
      if (actual.includes(cartaId)) return actual.filter((id) => id !== cartaId);
      if (actual.length < this.cartasPorElegir()) return [...actual, cartaId];
      return [...actual.slice(0, -1), cartaId];
    });
  }
 
  /** Posición (1 o 2) de una carta en la selección; 0 si no está marcada. */
  protected ordenDe(cartaId: number): number {
    return this.seleccion().indexOf(cartaId) + 1;
  }
 
  /** Marca una respuesta sin enviarla; tocarla otra vez la desmarca. */
  protected elegirRespuesta(respuestaId: string): void {
    this.respuestaElegida.update((actual) => (actual === respuestaId ? null : respuestaId));
  }
 
  protected enviarRespuesta(): void {
    if (!this.puedeEnviar()) return;
    this.ejecutar(this.api.enviarRespuesta(this.seleccion()));
  }
 
  /** Segundo paso: envía el voto (pueblo) o la decisión (soberano) según la fase. */
  protected confirmar(): void {
    const respuestaId = this.respuestaElegida();
    if (!respuestaId || !this.puedeConfirmar()) return;
 
    if (this.vista()?.fase === Fase.DECISION) {
      this.ejecutar(this.api.decidir(respuestaId));
    } else {
      this.ejecutar(this.api.votar(respuestaId));
    }
  }
 
  protected avanzar(): void {
    this.ejecutar(this.api.avanzar());
  }
 
  // ---------- Internos ----------
 
  /** Manejo común de acciones: bloquea botones, pinta el resultado o muestra el error. */
  private ejecutar(accion: Observable<Vista>): void {
    this.enviando.set(true);
    accion.pipe(finalize(() => this.enviando.set(false))).subscribe({
      next: (vista) => this.aplicarVista(vista),
      error: (err) => this.snackBar.open(obtenerMensajeDeError(err), 'Cerrar', { duration: 5000 }),
    });
  }
 
  /** Guarda la nueva vista y reacciona a los cambios importantes. */
  private aplicarVista(vista: Vista): void {
    const anterior = this.vista();
    const rondaNueva = !!vista.ronda && vista.ronda.numero !== anterior?.ronda?.numero;
 
    // Ronda nueva: la selección de cartas de la anterior ya no sirve
    if (rondaNueva) this.seleccion.set([]);
 
    // Cambió la ronda o la fase: la respuesta marcada sin confirmar ya no aplica
    if (rondaNueva || vista.fase !== anterior?.fase) this.respuestaElegida.set(null);
 
    this.vista.set(vista);
 
    if (vista.fase === Fase.SALA) this.router.navigate([RUTAS.LOBBY]);
    if (vista.fase === Fase.TERMINADA) this.router.navigate([RUTAS.GANADOR]);
  }
 
  /** Errores de la consulta periódica. */
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