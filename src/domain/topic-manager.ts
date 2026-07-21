import { topicsByTheme } from './topics';

export const themes = Object.freeze(Object.keys(topicsByTheme));

export function isTheme(value: string): boolean {
  return themes.includes(value);
}
