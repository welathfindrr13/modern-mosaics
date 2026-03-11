declare module 'cookie' {
  export function parse(
    str: string,
    options?: {
      decode?: (value: string) => string;
      map?: boolean;
    }
  ): Record<string, string>;
}
