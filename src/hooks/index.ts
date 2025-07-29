import { create, Draft } from "mutative";
import { useSyncExternalStore } from "react";
import { ImmediateOrDelayed } from "../types/immediate-or-delayed";
import { isSimpleValue } from "../utils/object-util";
import { store } from "./store";

export type Loop<State> = () => State;

type SliceContext<State> = {
  name: string;
  ready: boolean;
  initialized: boolean;
  dirty: boolean;
  froms: { name: string; hookIndex: number }[];
  hooks: { type: string; extra: any }[];
  callbackMap: { [key: string]: Function };
  dependents: (() => void)[];
  subscribers: ((state: State) => void)[];
  loop?: Loop<State>;
};

const sliceMap: { [name: string]: SliceContext<any> } = {};
// 当前正在运行的 Slice 的 Context
let curContext: SliceContext<any> | null = null;
let curHookIndex = 0;

const localPromise = Promise.resolve();

const sliceInitPromiseList: Promise<void>[] = [];
export async function whenAllSlicesReady() {
  await Promise.all(sliceInitPromiseList);
}

const sliceCreatedListeners: ((take: () => any) => void)[] = [];
export function listenSliceCreated(
  listener: (take: () => any) => void
): () => void {
  if (sliceCreatedListeners.indexOf(listener) < 0) {
    sliceCreatedListeners.push(listener);
  }
  return () => {
    const index = sliceCreatedListeners.indexOf(listener);
    if (index >= 0) {
      sliceCreatedListeners.splice(index, 1);
    }
  };
}

export type Take<State> = {
  (): State;
  <Selector = (state: State) => any>(
    selector: Selector
  ): Selector extends (state: State) => infer Data ? Data : never;

  /**
   * 获取 slice 名字
   */
  readonly name: string;

  /**
   * 是否准备完毕
   */
  readonly ready: boolean;

  /**
   * 准备完毕的 Promise
   */
  readonly whenReady: Promise<void>;

  /**
   * 获取所有 takeState 的当前值
   */
  getHookStates(): any[];

  /**
   * 设置所有 takeState 的当前值，数量如果不一致会报错
   * @param hookStates
   */
  setHookStates(hookStates: any[]): void;

  /**
   * 监听状态变更
   * @param subscriber
   */
  subscribe(subscriber: (state: State) => void): () => void;
};

export function createSlice<State extends Readonly<object>>(
  name: string,
  creator: () => ImmediateOrDelayed<Loop<State>>
): Take<State> {
  if (name in sliceMap) {
    throw new Error(`Slice ${name} already exists`);
  }

  const context: SliceContext<State> = {
    name,
    ready: false,
    initialized: false,
    dirty: false,
    froms: [],
    hooks: [],
    callbackMap: {},
    dependents: [],
    subscribers: [],
    loop: undefined,
  };
  sliceMap[name] = context;

  // 需要等前置全部 Slice ready 后再开始初始化自身
  const readyPromise = whenAllSlicesReady().then(() => {
    return new Promise<void>((resolve) => {
      const initializeHandler = (loop: Loop<State>) => {
        context.loop = loop;
        context.ready = true;
        runLoop(context);
        context.initialized = true;
        resolve();
      };
      const loop = creator();
      if (loop instanceof Promise) {
        loop.then(initializeHandler);
      } else {
        initializeHandler(loop);
      }
    });
  });
  sliceInitPromiseList.push(readyPromise);

  // 因为 store 中不会记录函数，这里要记录 store 状态和 wholeState 的映射关系
  // 只需记录一个即可，因为状态变化后将不会再寻找之前的状态了
  let lastState: any;
  let lastWholeState: any;
  let lastWholeStateProxy: any;
  let lastStoreSlice: any;
  let lastStoreSliceState: any;
  const depPaths: {
    [name: string]: { [key: string]: any };
  } = {};
  const take = ((selector?: (state: State) => any) => {
    const getState = () => {
      const state = store.getState()[name];
      if (state !== lastState) {
        // 计算新的 wholeState
        lastWholeState = {
          ...(lastState = state),
          ...context.callbackMap,
        };
        lastWholeStateProxy = new Proxy(lastWholeState, {
          get(wholeState, key: string) {
            const targetState = wholeState[key];
            if (targetState !== depPaths[name]?.[key]) {
              depPaths[name] = {
                ...depPaths[name],
                [key]: targetState,
              };
            }
            return targetState;
          },
        });
      }
      return selector ? selector(lastWholeStateProxy) : lastWholeStateProxy;
    };
    try {
      return useSyncExternalStore(
        (callback) => {
          return store.subscribe(() => {
            const curStoreState = store.getState();
            if (curStoreState[name] !== lastStoreSlice) {
              lastStoreSliceState = {
                ...(lastStoreSlice = curStoreState[name]),
                ...context.callbackMap,
              };
            }
            // 遍历所有依赖路径，确定是否有变化
            all: for (const name in depPaths) {
              const sliceState = depPaths[name];
              for (const key in sliceState) {
                const lastState = sliceState[key];
                const curState = lastStoreSliceState[key];
                if (curState !== lastState) {
                  // 与之前不同了，触发回调
                  callback();
                  // 跳出双重循环
                  break all;
                }
              }
            }
          });
        },
        () => {
          // 获取时要确保数据最新
          flush(context);
          if (curContext) {
            // 在某个 Slice 里面间接调用了另一个 Slice，需要添加依赖
            const dependentContext = curContext;
            const dependentHookIndex = curHookIndex;
            if (!dependentContext.initialized) {
              context.dependents.push(() => {
                setDirty(dependentContext, {
                  name: context.name,
                  hookIndex: dependentHookIndex,
                });
              });
            }
          }
          getState();
        }
      );
    } catch {
      // 报错，说明可能不在正常的 hooks 中，直接获取数据
      return getState();
    }
  }) as Take<State>;
  Object.defineProperties(take, {
    name: {
      configurable: true,
      enumerable: true,
      writable: false,
      value: name,
    },
    ready: {
      configurable: true,
      enumerable: true,
      get: () => {
        return context.initialized;
      },
    },
    whenReady: {
      configurable: true,
      enumerable: true,
      writable: false,
      value: readyPromise,
    },
    getHookStates: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: () => {
        return context.hooks.reduce((states, hook) => {
          if (hook.type === "state") {
            states.push(hook.extra.state);
          }
          return states;
        }, [] as any[]);
      },
    },
    setHookStates: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: (hookStates: any[]) => {
        const stateHooks = context.hooks.filter(
          (hook) => hook.type === "state"
        );
        if (stateHooks.length !== hookStates.length) {
          throw new Error(
            "hookStats's count by setHookStates is not equal with takeState's"
          );
        }
        // 更新状态
        stateHooks.forEach((stateHook, index) => {
          stateHook.extra.state = hookStates[index];
        });
      },
    },
    subscribe: {
      configurable: true,
      enumerable: false,
      writable: false,
      value: (subscriber: (state: State) => void) => {
        if (!context.subscribers.includes(subscriber)) {
          context.subscribers.push(subscriber);
        }
        return () => {
          const index = context.subscribers.indexOf(subscriber);
          if (index >= 0) {
            context.subscribers.splice(index, 1);
          }
        };
      },
    },
  });
  // 触发 Listeners
  sliceCreatedListeners.forEach((listener) => {
    try {
      listener(take);
    } catch (err) {
      console.error(
        "[Store error]",
        `Slice "${name}" sliceCreatedListeners listener error`,
        err
      );
    }
  });
  return take;
}

function separateState(state: any) {
  // state 里面包含了 memos 和 callbacks，需要将其摘除，只保留 state
  const stateMap: any = {};
  const callbackMap: {
    [key: string]: Function;
  } = {};
  for (const key in state) {
    const value = state[key];
    if (typeof value === "function") {
      callbackMap[key] = value;
    } else {
      stateMap[key] = value;
    }
  }
  return [stateMap, callbackMap];
}

function runLoop(context: SliceContext<any>) {
  if (!context.ready) {
    throw new Error(`Slice ${context.name} not ready`);
  }
  if (curContext) {
    throw new Error("Do not call hooks inside another hook");
  }
  const lastContext = curContext;
  curContext = context;
  curHookIndex = 0;
  try {
    const state = context.loop!();
    // state 里面包含了 memos 和 callbacks，需要将其摘除，只保留 state
    const [stateMap, callbackMap] = separateState(state);
    context.callbackMap = callbackMap;
    let type = `${context.initialized ? "setState" : "initializeSlice"}::${context.name}`;
    if (context.froms.length > 0) {
      for (const from of context.froms) {
        if (from.name === context.name) {
          type += `|${from.hookIndex}`;
        } else {
          type += `|${from.hookIndex}(by ${from.name})`;
        }
      }
    }
    store.dispatch({
      type,
      payload: stateMap,
    });
    // 如果有依赖关系，执行
    for (const dependent of context.dependents) {
      dependent();
    }
    // 通知监听器
    for (const subscriber of context.subscribers) {
      try {
        subscriber(state);
      } catch (err) {
        console.error(err);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    curContext = lastContext;
  }
}

function flush(context: SliceContext<any>) {
  if (!context.ready) {
    throw new Error(`Slice ${context.name} not ready`);
  }
  if (context.dirty) {
    runLoop(context);
    context.dirty = false;
    context.froms = [];
  }
}

function setDirty(
  context: SliceContext<any>,
  from: { name: string; hookIndex: number }
) {
  if (!context.ready) {
    throw new Error(`Slice ${context.name} not ready`);
  }
  // 记录 from 信息
  context.froms.push(from);
  if (!context.dirty) {
    context.dirty = true;
    localPromise
      .then(() => {
        flush(context);
      })
      .catch((err) => {
        context.dirty = false;
        context.froms = [];
        return Promise.reject(err);
      });
  }
}

/**
 * 浅比较依赖列表
 * @param deps
 * @param lastDeps
 * @returns 是否相同
 */
function isDepsEqual(deps: any[], lastDeps: any[]): boolean {
  // 如果长度不相同报错
  if (deps.length !== lastDeps.length) {
    throw new Error("Deps' length must be consistent");
  }
  // 首层的每一项都要相等才算相等
  return deps.every((dep, index) => {
    return dep === lastDeps[index];
  });
}

export type SimpleValueDispatch<State> = {
  (nextState: State): State;
  (reducer: (lastState: State) => State): State;
};

export type ComplexTypeDispatch<State> = {
  (nextState: State): State;
  (reducer: (lastState: Readonly<State>) => Readonly<State>, pure: true): State;
  (mutator: (state: State) => void | undefined, pure?: false): State;
};

export type Dispatch<State, OriState = State> = OriState extends object
  ? ComplexTypeDispatch<State>
  : SimpleValueDispatch<State>;

/**
 * 构建一个可变状态
 * @param state 初始状态，只有首次执行时生效。如果是函数，只会在首次执行时调用，可以节省计算资源
 * @returns 返回一个元组，第一个元素是当前状态，第二个元素是更新状态的函数
 */
export function takeState<State>(
  state: State | (() => State)
): [State, Dispatch<State>];
/**
 * 构建一个可变状态
 * @returns 返回一个元组，第一个元素是当前状态，第二个元素是更新状态的函数
 */
export function takeState<State = undefined>(): [
  State | undefined,
  Dispatch<State | undefined, State>,
];
export function takeState<State>(
  state?: State | (() => State)
): [State | undefined, Dispatch<State | undefined>] {
  if (!curContext) {
    throw new Error("Hooks must be called inside a slice");
  }
  const context = curContext;
  const index = curHookIndex++;
  let extra = context.hooks[index]?.extra;
  let lastState: State | undefined;
  if (!context.initialized) {
    lastState = typeof state === "function" ? (state as () => State)() : state;
    context.hooks[index] = {
      type: "state",
      extra: (extra = {
        state: lastState,
        setState: <Dispatch<State>>((nextStateOrReducer, pure) => {
          // extra 要重新获取，因为这是在闭包里，可能缓存的是老版本
          const extra = context.hooks[index].extra;
          // lastState 要重新获取，因为可能被外部改了
          const lastState = extra.state;
          let newState: State;
          if (typeof nextStateOrReducer === "function") {
            if (!!pure || isSimpleValue(lastState)) {
              newState = (
                nextStateOrReducer as (lastState: Readonly<State>) => State
              )(lastState);
            } else {
              newState = create<State>(lastState, (draft) => {
                return (nextStateOrReducer as (state: Draft<State>) => void)(
                  draft
                );
              });
            }
          } else {
            newState = nextStateOrReducer as State;
          }
          if (newState !== lastState) {
            extra.state = newState;
            // 触发更新
            setDirty(context, {
              name: context.name,
              hookIndex: index,
            });
          }
          return newState;
        }),
      }),
    };
  } else {
    lastState = extra.state;
  }
  return [lastState, extra.setState];
}

/**
 * 构建选择器
 * @param memo 选择器函数
 * @param deps 依赖列表
 * @returns 选择器计算值
 */
export function takeMemo<Memo>(memo: () => Memo, deps: any[]): Memo {
  if (!curContext) {
    throw new Error("Hooks must be called inside a slice");
  }
  const context = curContext;
  const index = curHookIndex++;
  let extra = context.hooks[index]?.extra;
  if (!context.initialized) {
    context.hooks[index] = {
      type: "memo",
      extra: (extra = {
        deps,
        memo: memo(),
      }),
    };
  } else {
    // 判断 deps 是否相同
    if (!isDepsEqual(deps, extra.deps)) {
      // 有变化，重新计算
      extra.deps = deps;
      extra.memo = memo();
    }
  }
  return extra.memo;
}

/**
 * 构建回调函数
 * @param callback 回调函数
 * @param deps 依赖列表
 * @returns 回调函数
 */
export function takeCallback<Callback extends Function>(
  callback: Callback,
  deps: any[]
): Callback {
  if (!curContext) {
    throw new Error("Hooks must be called inside a slice");
  }
  const context = curContext;
  const index = curHookIndex++;
  let extra = context.hooks[index]?.extra;
  if (!context.initialized) {
    context.hooks[index] = {
      type: "callback",
      extra: (extra = {
        deps,
        callback,
      }),
    };
  } else {
    // 判断 deps 是否相同
    if (!isDepsEqual(deps, extra.deps)) {
      // 有变化，重新计算
      extra.deps = deps;
      extra.callback = callback;
    }
  }
  return extra.callback;
}

export function takeEffect(effect: () => (() => void) | void, deps: any[]) {
  if (!curContext) {
    throw new Error("Hooks must be called inside a slice");
  }
  const context = curContext;
  const index = curHookIndex++;
  // 模仿 react，将 effect 放到微任务延时执行，确保执行时 loop 已经结束
  localPromise.then(() => {
    let extra = context.hooks[index]?.extra;
    if (!extra) {
      context.hooks[index] = {
        type: "effect",
        extra: (extra = {
          deps,
          cleanup: effect(),
        }),
      };
    } else {
      // 判断 deps 是否相同
      if (!isDepsEqual(deps, extra.deps)) {
        // 有变化，重新执行
        if (extra.cleanup) {
          extra.cleanup();
        }
        extra.deps = deps;
        extra.cleanup = effect();
      }
    }
  });
}
