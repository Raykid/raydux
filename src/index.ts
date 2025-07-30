/// <reference types="mutative" />
/// <reference types="react" />
/// <reference types="redux" />

import {
  ComponentType,
  createElement,
  FC,
  ReactNode,
  StrictMode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listenSliceCreated, whenAllSlicesReady } from "./hooks/index";

export * from "./hooks/index";
export * from "./hooks/store";

export type StartrUpChildrenContext = {
  ready: boolean;
  failReason?: any;
};

export type StartrUpProps = {
  /**
   * 要渲染的内容，或者内容工厂方法
   */
  children?: ReactNode | ComponentType<StartrUpChildrenContext>;

  /**
   * 是否支持动态初始化 Slice
   * 默认为 false，因为动态初始化 Slice 会让所有组件暂时卸载，这其中可能有部分组件存在副作用无法回收的问题
   * 如确实需要动态初始化，则可以置为 true
   */
  dynamicallyInitialize?: boolean;

  /**
   * 是否开发模式
   */
  development?: boolean;
};

export const StartUp: FC<StartrUpProps> = (props) => {
  const { children, dynamicallyInitialize, development } = props;

  const [ready, setReady] = useState(false);
  const [failReason, setFailReason] = useState<any>();
  useEffect(() => {
    let allReady: Promise<unknown>;
    const validateReady = () => {
      // 中途设置 ready 为 false 会移除掉所有节点，造成一瞬间大量组件卸载，其中可能有些不可预料的问题发生，因此这里默认不设置 false，但提供参数可以打开 —— Raykid
      if (dynamicallyInitialize) {
        setReady(false);
      }
      setFailReason(undefined);
      const myReady = (allReady = whenAllSlicesReady()
        .then(() => {
          // 如果 allReady 和 myReady 一致，说明在这之后没有其他新增的 slice，可以确认 ready
          if (allReady === myReady) {
            setReady(true);
          }
        })
        .catch((reason) => {
          if (allReady === myReady) {
            setReady(false);
            setFailReason(reason);
          }
        }));
    };
    // 首次执行
    validateReady();
    // 监听新进 Slice 事件
    return listenSliceCreated(validateReady);
  }, [dynamicallyInitialize]);

  // Slice 没全部准备好时不呈现 children
  const childrenIsComponentType = useMemo(
    () => typeof children === "function",
    [children]
  );
  const renderer = useMemo(() => {
    if (childrenIsComponentType) {
      return createElement(children as ComponentType<StartrUpChildrenContext>, {
        ready,
        failReason,
      });
    } else {
      return children as ReactNode;
    }
  }, [
    childrenIsComponentType && ready,
    childrenIsComponentType && setFailReason,
  ]);

  const rendererWithStrictMode = useMemo(() => {
    return development ? createElement(StrictMode, {}, renderer) : renderer;
  }, [development, renderer]);

  return rendererWithStrictMode;
};
