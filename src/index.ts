/// <reference types="mutative" />
/// <reference types="react" />
/// <reference types="react-redux" />
/// <reference types="redux" />

import { createElement, FC, StrictMode, useMemo } from "react";
import { Provider, ProviderProps } from "./hooks/provider";

export * from "./hooks/index";
export { Provider } from "./hooks/provider";
export * from "./hooks/store";

export type StartrUpProps = ProviderProps & {
  /**
   * 是否开发模式
   */
  development?: boolean;
};

export const StartUp: FC<StartrUpProps> = (options) => {
  const { development, ...providerProps } = options;

  const rendererDeps = useMemo(() => {
    return Object.keys(providerProps)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        return providerProps[key as keyof typeof providerProps];
      });
  }, [providerProps]);

  const renderer = useMemo(() => {
    return createElement(Provider, providerProps);
  }, rendererDeps);

  const rendererWithStrictMode = useMemo(() => {
    return development ? createElement(StrictMode, {}, renderer) : renderer;
  }, [development, renderer]);

  return rendererWithStrictMode;
};
