/// <reference types="mutative" />
/// <reference types="react" />
/// <reference types="react-redux" />
/// <reference types="react-router-dom" />
/// <reference types="redux" />

import { createElement, FC, ReactNode, StrictMode, useMemo } from "react";
import { Provider } from "./hooks/provider";

export type StartrUpProps = {
  /**
   * 要渲染的内容
   */
  children?: ReactNode;

  /**
   * 启动前的预加载内容
   */
  preload?: ReactNode;

  /**
   * 是否开发模式
   */
  development?: boolean;

  /**
   * 是否支持动态初始化 Service
   * 默认为 false，因为动态初始化 Service 会让所有组件暂时卸载，这其中可能有部分组件存在副作用无法回收的问题
   * 如确实需要动态初始化，则可以置为 true
   */
  dynamicallyInitialize?: boolean;
};

export const StartUp: FC<StartrUpProps> = (options) => {
  const { preload, children, development, dynamicallyInitialize } = options;

  const renderer = useMemo(() => {
    return createElement(
      Provider,
      {
        preload,
        dynamicallyInitialize,
      },
      children
    );
  }, [preload, children, dynamicallyInitialize]);

  const rendererWithStrictMode = useMemo(() => {
    return development ? createElement(StrictMode, {}, renderer) : renderer;
  }, [development, renderer]);

  return rendererWithStrictMode;
};
