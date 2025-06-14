import { Middleware } from ".";

export type PersistProps = {
  /**
   * localStorage 中的 key 值
   */
  key: string;
  /**
   * 字段白名单
   */
  whitelist?: string[];
  /**
   * 字段黑名单
   */
  blacklist?: string[];
  /**
   * 是否在控制台输出调试信息
   */
  debug?: boolean;
};

export const persist: Middleware<PersistProps> = (take, props) => {
  const { key, whitelist = [], blacklist = [], debug = false } = props;
  let lastState: any = undefined;
  let lastStorageStr = localStorage.getItem(key);
  if (lastStorageStr) {
    lastState = JSON.parse(lastStorageStr);
    take.set(lastState);
  }
  take.subscribe((state) => {
    if (state !== lastState) {
      let toPersist: any = state;
      if (state instanceof Object) {
        // 处理白名单
        if (whitelist.length > 0) {
          toPersist = whitelist.reduce((toPersist, key) => {
            if (key in state) {
              toPersist[key] = state[key as keyof typeof state];
            }
            return toPersist;
          }, {} as any);
        }
        // 处理黑名单
        if (blacklist.length > 0) {
          toPersist = blacklist.reduce(
            (toPersist, key) => {
              delete toPersist[key];
              return toPersist;
            },
            { ...toPersist }
          );
        }
      }
      const toPersistStr = JSON.stringify(toPersist);
      if (toPersistStr !== lastStorageStr) {
        localStorage.setItem(key, toPersistStr);
        lastStorageStr = toPersistStr;
        if (debug) {
          console.log("[persist middleware]", toPersist);
        }
      }
      lastState = state;
    }
    return state;
  });
  return take;
};
