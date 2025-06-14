import { Middleware } from ".";
import { isShallowEquals } from "../utils/object-util";

export type PersistProps = {
  /**
   * localStorage 中的 key 值
   */
  key: string;
  /**
   * 是否在控制台输出调试信息
   */
  debug?: boolean;
};

export const persist: Middleware<PersistProps> = (take, props) => {
  const { key, debug = false } = props;
  let lastHookStates: any[] | null = null;
  let lastStorageStr = localStorage.getItem(key);
  if (lastStorageStr) {
    const hookStates = (lastHookStates = JSON.parse(lastStorageStr) as any[]);
    take.whenReady.then(() => {
      take.setHookStates(hookStates);
    });
  }
  take.subscribe(() => {
    const curHookStates = take.getHookStates();
    if (!lastHookStates || !isShallowEquals(curHookStates, lastHookStates)) {
      const toPersistStr = JSON.stringify(curHookStates);
      localStorage.setItem(key, toPersistStr);
      lastStorageStr = toPersistStr;
      lastHookStates = curHookStates;
      if (debug) {
        console.log("[persist middleware]", curHookStates);
      }
    }
  });
  return take;
};
