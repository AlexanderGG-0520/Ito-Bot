export class ThemeStore {
  private readonly themes = new Map<string, string>();

  public set(guildId: string, theme: string): void {
    this.themes.set(guildId, theme);
  }

  public get(guildId: string): string | undefined {
    return this.themes.get(guildId);
  }
}
