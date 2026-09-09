// No accounts for players or hosts (spec requirement) — identity is just a
// token kept in localStorage, scoped per game so a browser can rejoin its
// own game after a refresh/reconnect without losing place.

export interface PlayerSession {
  gameId: string;
  teamId: string;
  playerId: string;
  nickname: string;
}

export interface HostSession {
  gameId: string;
  hostToken: string;
}

// One token per property a host has created on this browser — used to
// prove creator-only edit rights (add/edit locations) when they come back
// to a property they made earlier. Anyone can still browse/use a property
// for a new game without one.
export interface PropertySession {
  propertyId: string;
  hostToken: string;
}

const playerKey = (gameId: string) => `treasure-hunt:player:${gameId}`;
const hostKey = (gameId: string) => `treasure-hunt:host:${gameId}`;
const propertyKey = (propertyId: string) => `treasure-hunt:property:${propertyId}`;

export function savePropertySession(session: PropertySession) {
  localStorage.setItem(propertyKey(session.propertyId), JSON.stringify(session));
}

export function loadPropertySession(propertyId: string): PropertySession | null {
  const raw = localStorage.getItem(propertyKey(propertyId));
  return raw ? (JSON.parse(raw) as PropertySession) : null;
}

export function savePlayerSession(session: PlayerSession) {
  localStorage.setItem(playerKey(session.gameId), JSON.stringify(session));
}

export function loadPlayerSession(gameId: string): PlayerSession | null {
  const raw = localStorage.getItem(playerKey(gameId));
  return raw ? (JSON.parse(raw) as PlayerSession) : null;
}

export function saveHostSession(session: HostSession) {
  localStorage.setItem(hostKey(session.gameId), JSON.stringify(session));
}

export function loadHostSession(gameId: string): HostSession | null {
  const raw = localStorage.getItem(hostKey(gameId));
  return raw ? (JSON.parse(raw) as HostSession) : null;
}
