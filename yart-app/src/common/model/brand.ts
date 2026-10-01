/** Change this value to rename the app's visible product name. */
export const APP_NAME = 'yart';

/** For copy shared with agents and schemas outside the UI translation catalogue. */
export function brandText(text: string): string {
  return text.replaceAll('{appName}', APP_NAME);
}
