declare module 'html-to-image' {
  export type HtmlToImageOptions = {
    cacheBust?: boolean;
    pixelRatio?: number;
    backgroundColor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    filter?: (node: HTMLElement) => boolean;
  };

  export function toPng(node: HTMLElement, options?: HtmlToImageOptions): Promise<string>;
}
