/**
 * En typad IPC-kanal. Definieras en gång (i en features `ipc/`-mapp),
 * hanteras i main med `handleChannel` och anropas i renderer med `invokeChannel`.
 * Typparametrarna bärs bara på typnivå.
 */
export interface Channel<Req, Res> {
  readonly name: string;
  readonly __req?: Req;
  readonly __res?: Res;
}

export function defineChannel<Req = undefined, Res = undefined>(name: string): Channel<Req, Res> {
  return { name };
}

/**
 * En typad händelse som main skickar till renderer, t.ex. framsteg under en analys.
 * Skickas med `emitEvent` i main och lyssnas på med `subscribeEvent` i renderer.
 */
export interface IpcEvent<Payload> {
  readonly name: string;
  readonly __payload?: Payload;
}

export function defineEvent<Payload>(name: string): IpcEvent<Payload> {
  return { name };
}
