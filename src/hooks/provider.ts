import { createElement, FC, ReactNode, useEffect, useState } from "react";
import { Provider as _Provider } from "react-redux";
import { listenSliceCreated, whenAllSlicesReady } from ".";
import { store } from "./store";

export const Provider: FC<{
  children?: ReactNode;
  preload?: ReactNode;
  dynamicallyInitialize?: boolean;
}> = (props) => {
  const { children, preload, dynamicallyInitialize } = props;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let allReady: Promise<unknown>;
    const validateReady = () => {
      // 中途设置 ready 为 false 会移除掉所有节点，造成一瞬间大量组件卸载，其中可能有些不可预料的问题发生，因此这里默认不设置 false，但提供参数可以打开 —— Raykid
      if (dynamicallyInitialize) {
        setReady(false);
      }
      const myReady = (allReady = whenAllSlicesReady().then(() => {
        // 如果 allReady 和 myReady 一致，说明在这之后没有其他新增的 slice，可以确认 ready
        if (allReady === myReady) {
          setReady(true);
        }
      }));
    };
    // 首次执行
    validateReady();
    // 监听新进 Slice 事件
    return listenSliceCreated(validateReady);
  }, [dynamicallyInitialize]);

  // Slice 没全部准备好时不呈现 children
  return createElement(_Provider, {
    store,
    children: ready ? children : preload,
  });
};
