
import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { PartidaService } from '../../core/services/partida.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lobby-g',
  imports: [CommonModule,MatCardModule],
  templateUrl: './lobby-g.html',
  styleUrl: './lobby-g.css',
})
export class LobbyG implements OnInit {
  seasonId = '';
  hostName = '';
  code = Math.floor(1000 + Math.random() * 9000).toString;


      jugadores: {
        id: string;
        nombre: string;
        es_anfitrion: boolean;
      }[] = [];

 



  constructor(
    private partidaService: PartidaService,
  ) {}

  ngOnInit(): void {
    const sesion = this.partidaService.obtenerSesion();

    if (!sesion) {
      console.error('No hay una partida activa');
      return;
    }

    this.seasonId = sesion.partidaId;

    // quien es el anfitrion
    const anfitrion = sesion.partida.jugadores.find(
      jugador => jugador.es_anfitrion
    );
    this.hostName = anfitrion?.nombre ?? 'Anfitrión no encontrado';

    // Ver todos los jugadores de la partida
    this.jugadores = sesion.partida.jugadores.map(jugador => ({
  
      id: jugador.id,
      nombre: jugador.nombre,
      es_anfitrion: jugador.es_anfitrion,
      
    }));
      console.log('Jugadores que se han unidp:', sesion.partida.jugadores);
      console.log('Cantidad de jugadores unidos:', sesion.partida.jugadores.length);
  }



}
