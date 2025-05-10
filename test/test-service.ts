import { createService, takeCallback, takeState } from "../src/hooks";

export const takeTest = createService("test", () => () => {
  const [count, setCount] = takeState(0);

  const increment = takeCallback((num: number) => {
    setCount((count) => count + num);
  }, []);

  return {
    count,
    setCount,
    increment,
  };
});
