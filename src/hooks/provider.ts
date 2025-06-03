import {
  createElement,
  FC,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Provider as _Provider } from "react-redux";
import { listenSliceCreated, whenAllSlicesReady } from ".";
import { store } from "./store";

export type ProviderChildrenContext = {
  ready: boolean;
};

export type ProviderProps = {
  /**
   * 要渲染的内容，或者内容工厂方法
   */
  children?: ReactNode | ((ctx: ProviderChildrenContext) => ReactNode);

  /**
   * 是否支持动态初始化 Slice
   * 默认为 false，因为动态初始化 Slice 会让所有组件暂时卸载，这其中可能有部分组件存在副作用无法回收的问题
   * 如确实需要动态初始化，则可以置为 true
   */
  dynamicallyInitialize?: boolean;
};

export const Provider: FC<ProviderProps> = (props) => {
  const { children, dynamicallyInitialize } = props;
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

  const _children = useMemo(() => {
    if (typeof children === "function") {
      return children({
        ready,
      });
    } else {
      return children;
    }
  }, [ready]);

  // Slice 没全部准备好时不呈现 children
  return createElement(_Provider, {
    store,
    children: _children,
  });
};
