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

// Cada cuántos milisegundos le preguntamos al servidor cómo va la partida.
const INTERVALO_CONSULTA_MS = 2000;

// Rutas a las que esta pantalla puede mandar al jugador.
const RUTAS = {
  BIENVENIDA: '/',
  LOBBY: '/lobby',
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

  // Expuestos al HTML
  protected readonly Fase = Fase;
  protected readonly pasos = PASOS;

  // ---------- Estado ----------

  /** Última vista de la partida que mandó el servidor (null = cargando). */
  protected readonly vista = signal<Vista | null>(null);

  /** Ids de las cartas blancas marcadas, en orden de clic (el orden importa al backend). */
  protected readonly seleccion = signal<number[]>([]);

  /** true mientras hay una petición en camino: bloquea botones y evita doble clic. */
  protected readonly enviando = signal(false);

  // ---------- Datos derivados ----------

  protected readonly yo = computed(() => this.vista()?.yo ?? null);
  protected readonly ronda = computed(() => this.vista()?.ronda ?? null);
  protected readonly mano = computed(() => this.yo()?.mano ?? []);

  /** Jugadores ordenados por puntos (en empate se conserva el orden original). */
  protected readonly ranking = computed(() =>
    [...(this.vista()?.jugadores ?? [])].sort((a, b) => b.puntos - a.puntos),
  );

  // Se exige que exista mi id para evitar que "undefined === undefined" dé true.
  protected readonly esSoberano = computed(() => {
    const miId = this.yo()?.id;
    return !!miId && this.ronda()?.soberano_id === miId;
  });

  protected readonly esAnfitrion = computed(() => {
    const miId = this.yo()?.id;
    return !!miId && this.vista()?.anfitrion_id === miId;
  });

  /** Regla del backend para POST /avanzar: solo el anfitrión o el soberano actual. */
  protected readonly puedeAvanzar = computed(() => this.esAnfitrion() || this.esSoberano());

  /** Explica en pantalla por qué se ve el botón de avanzar. */
  protected readonly motivoAvanzar = computed(() => {
    if (this.esAnfitrion() && this.esSoberano()) return 'anfitrión y soberano';
    return this.esAnfitrion() ? 'anfitrión' : 'soberano';
  });

  /** El botón de avanzar no aplica en "decision" (se avanza al elegir) ni al terminar. */
  protected readonly mostrarAvanzar = computed(() => {
    const fase = this.vista()?.fase;
    return (
      this.puedeAvanzar() &&
      fase !== Fase.DECISION &&
      fase !== Fase.TERMINADA &&
      fase !== Fase.SALA
    );
  });

  /** Texto del botón de avanzar según lo que hace el backend en cada fase. */
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

  /** ¿Me toca escoger cartas ahora? */
  protected readonly puedeResponder = computed(
    () => this.vista()?.fase === Fase.RESPUESTAS && !this.esSoberano() && !this.yaRespondi(),
  );

  /** Validación: exactamente las cartas que pide la carta negra y nada en curso. */
  protected readonly puedeEnviar = computed(
    () => this.seleccion().length === this.cartasPorElegir() && !this.enviando(),
  );

  /** Quienes responden y votan: todos menos el soberano. */
  protected readonly totalParticipantes = computed(() =>
    Math.max((this.vista()?.jugadores.length ?? 1) - 1, 0),
  );

  /** Posición en la barra de progreso (4 = todos los pasos completados). */
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

  /** Nombre de quien ganó la ronda que acaba de terminar. */
  protected readonly ganadorDeRonda = computed(() => {
    const resumen = this.ultimoResumen();
    return this.vista()?.jugadores.find((j) => j.id === resumen?.ganador_id)?.nombre ?? null;
  });

  /** Mensaje único de "qué está pasando / qué me toca" según fase y rol. */
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
        return '¿Cuál es la más graciosa? Puedes votar por la tuya.';
      case Fase.DECISION:
        return this.esSoberano()
          ? 'Tu turno: elige a la ganadora, respetes o no al pueblo.'
          : 'El soberano está decidiendo…';
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
        // Con la pestaña oculta no consultamos: ahorra red y carga del servidor
        filter(() => !document.hidden),
        // switchMap descarta una consulta lenta si ya toca la siguiente
        switchMap(() =>
          this.api.obtener().pipe(
            catchError((err) => {
              this.manejarErrorDeConsulta(err);
              return EMPTY; // el error no corta el bucle
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((vista) => this.aplicarVista(vista));
  }

  // ---------- Acciones del jugador ----------

  /** Marca o desmarca una carta respetando el máximo que pide la carta negra. */
  protected alternarCarta(cartaId: number): void {
    this.seleccion.update((actual) => {
      if (actual.includes(cartaId)) return actual.filter((id) => id !== cartaId);
      if (actual.length < this.cartasPorElegir()) return [...actual, cartaId];
      return actual; // ya está el máximo: se ignora el clic
    });
  }

  /** Posición (1 o 2) de una carta en la selección; 0 si no está marcada. */
  protected ordenDe(cartaId: number): number {
    return this.seleccion().indexOf(cartaId) + 1;
  }

  protected enviarRespuesta(): void {
    if (!this.puedeEnviar()) return;
    this.ejecutar(this.api.enviarRespuesta(this.seleccion()));
  }

  protected votar(respuestaId: string): void {
    this.ejecutar(this.api.votar(respuestaId));
  }

  protected decidir(respuestaId: string): void {
    this.ejecutar(this.api.decidir(respuestaId));
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
    // Ronda nueva: la selección de la anterior ya no sirve
    const rondaAnterior = this.vista()?.ronda?.numero;
    if (vista.ronda && vista.ronda.numero !== rondaAnterior) {
      this.seleccion.set([]);
    }

    this.vista.set(vista);

    if (vista.fase === Fase.SALA) this.router.navigate([RUTAS.LOBBY]);
    // TODO: con la pantalla de ganador: if (vista.fase === Fase.TERMINADA) navegar a ella.
  }

  /** Errores de la consulta periódica. */
  private manejarErrorDeConsulta(err: unknown): void {
    const status = (err as { status?: number }).status;

    // 401 = token inválido o ajeno; 404 = la partida ya no existe
    if (status === 401 || status === 404) {
      this.api.limpiarSesion();
      this.router.navigate([RUTAS.BIENVENIDA]);
      return;
    }
    this.snackBar.open(obtenerMensajeDeError(err), 'Cerrar', { duration: 3000 });
  }
}