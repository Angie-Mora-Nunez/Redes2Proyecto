import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyG } from './lobby-g';

describe('LobbyG', () => {
  let component: LobbyG;
  let fixture: ComponentFixture<LobbyG>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LobbyG],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyG);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
