
import { Component, OnInit, OnDestroy,ChangeDetectorRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { PartidaService } from '../../core/services/partida.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {Subscription,interval,startWith,switchMap,catchError,of} from 'rxjs';

@Component({
  selector: 'app-lobby-g',
  imports: [CommonModule, MatCardModule, RouterLink,MatButtonModule],
  templateUrl: './lobby-g.html',
  styleUrl: './lobby-g.css',
})
export class LobbyG implements OnInit, OnDestroy {

  private actualizacionSub?: Subscription;

  seasonId = '';
  hostName = '';
  esAnfitrion = false; //Colocamos el anfitrion como falso para darle un 
  startSeason = false;
  error='';

  listCodes: string[] = [];
  codesfseason: { [seasonId: string]: string } = {};

  jugadores: {
    id: string;
    nombre: string;
    es_anfitrion: boolean;
  }[] = [];

  constructor(private partidaService: PartidaService,private cdr: ChangeDetectorRef, private router: Router ) {}
  //metodo que detecta y actualiza los erores

//codigo para usar luego 
generateCode(): string {
  let code: string;
      do {code = Math.floor(1000 + Math.random() * 9000).toString();} 
        while(this.listCodes.includes(code));
  this.listCodes.push(code);
  return code;
}//método que genera un código al azar de 4 digitos
addCode(): void {
      this.generateCode();
  }//crea codigos y los mete a una lista para que no haya posibilidades que sean el mismoi
//..................


startGame(): void {
  if (!this.esAnfitrion || this.startSeason) {
    return;}

  if (this.jugadores.length < 4 ||this.jugadores.length > 22 ||this.jugadores.length % 2 !== 0) {
    this.error ='Se necesitan entre 4 y 22 jugadores y la cantidad debe ser par.';
    return;}

  this.startSeason = true;
  this.error = '';

  this.partidaService.iniciar().subscribe({
    next: () => {this.router.navigate(['/game']);},
    error: (error) => {
      this.error =
        error.error?.error ?? 'No se pudo iniciar la partida.';
      this.startSeason = false;
      this.cdr.detectChanges();
    }
  });
}//metodo de iniciar partida

saveCode(seasonId: string): void {
  const codes = this.generateCode();
  this.codesfseason[seasonId] = codes;
  console.log('ID:', seasonId);
  console.log('Código asociado:', this.codesfseason[seasonId]);
}


  ngOnInit(): void {
    const sesion = this.partidaService.obtenerSesion();

    if (!sesion) {
      console.error('No hay una partida activa');
      return;
    }

    this.seasonId = sesion.partidaId;
    this.saveCode(this.seasonId);

    // Mostrar los datos iniciales de la sesión
    this.actualizarJugadores(sesion.partida.jugadores);

   if (sesion.partida.fase !== 'sala') {
        this.router.navigate(['/game']);
        return;} // metodo que manda a todos a la sala de juego 




    // Consultar al servidor cada 2 segundos
    this.actualizacionSub = interval(2000).pipe(
        startWith(0),
        switchMap(() =>
          this.partidaService.obtener().pipe(
            catchError(error => {
              console.error('ERROR AL CONSULTAR PARTIDA:', error);
              return of(null);
      })
    )
  )
).subscribe(vista => {
  if (!vista) {
    console.warn('No se recibieron datos de la partida');
    return;
  }

  this.actualizarJugadores(vista.jugadores);
  this.cdr.detectChanges(); //detencta y actualiza la lista de jugadores borra y desecha la lista vieja
  if (vista.fase && vista.fase !== 'sala') {
    this.actualizacionSub?.unsubscribe();
    this.router.navigate(['/game']);
  }
});
    
  }

  private actualizarJugadores(jugadores: {id: string;nombre: string;es_anfitrion: boolean;}[]): void {
    this.jugadores = [...jugadores].map(jugador => ({id: jugador.id,nombre: jugador.nombre,es_anfitrion: jugador.es_anfitrion
  }));

  const anfitrion = this.jugadores.find(
    jugador => jugador.es_anfitrion
  );

  this.hostName = anfitrion?.nombre ?? 'Anfitrión no encontrado';

  this.esAnfitrion =
    anfitrion?.id === this.partidaService.obtenerSesion()?.jugadorId;


  console.log('Jugadores actualizados en ngular:', this.jugadores.length);
  
}
  ngOnDestroy(): void {
    this.actualizacionSub?.unsubscribe();
  }
}
