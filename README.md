# 目录

- [快速开始](#快速开始)
- [Hooks](#hooks)
- [最佳实践 & 典型案例分析](#最佳实践--典型案例分析)

# 快速开始

## 介绍

`Raydux` 是一个基于 `Redux` 的前端状态管理工具。特点是使用类似 `React Hooks` 的方式构建你的状态管理仓库，并具有`轻量化`、`快速`的优势。

## 安装

你可以从 [npm](https://www.npmjs.com/package/raydux) 安装：

```bash
# NPM
npm install raydux
# Or, use any package manager of your choice.
```

## 创建一个 Slice

使用 `createSlice` 函数创建一个 Slice。第一个参数提供数据切片名称，第二个参数传入一个`连续函数`，其中第二层函数为 `loop 函数`。loop 函数会在 Slice 生命周期里被多次执行，以生成最新的数据切片状态。

至于第一层函数的作用，在 [slice 初始化章节](#slice-初始化)会介绍。

```js
import { createSlice, takeCallback, takeState } from "raydux";

export const takeFoo = createSlice("foo", () => () => {
  // 定义状态
  const [count, setCount] = takeState(0);

  // 定义操作
  const increment = takeCallback(() => {
    setCount(count + 1);
  }, [count]);

  // 返回结果
  return {
    count,
    increment,
  };
});
```

## 使用这个 Slice

在组件中执行 `createSlice` 返回的 `take` 函数，状态和操作都被定义在其中，可一同引入。

```jsx
function Counter() {
  // 状态和操作均可一同引入
  const { count, increment } = takeFoo();

  return (
    <div>
      <h1>count: {count}</h1>
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

至此你已经完成了一个最简单的案例。当你点击按钮时，count 值会自动+1。

**注意：`Raydux` 虽然基于 `Redux` 开发，但你无需在项目最外侧包裹 Provider 即可实现数据更新，其原理为在 `take` 函数内置了 `React.useSyncExternalStore` 的调用逻辑。**

# Hooks

## takeState

声明一个可变状态，会返回一个二元组，第一个元素是值，第二个元素是变更值的函数。

当需要变更状态时执行 setState 函数，传入一个新的值或者一个`状态转移函数`。

```js
// 定义状态，提供初始值 0
const [count, setCount] = takeState(0);

// 传入新值
setCount(1);

// 传入状态转移函数
setCount((count) => count + 1);
```

### 无初始值

状态可以不提供初始值，但需要用`泛型`标出类型，这是初始值默认是 `undefined`。

```ts
// 无初始值，用泛型标出类型，默认值是 undefined，变量类型是 number | undefined
const [count, sertCount] = takeState<number>();
```

### 状态转移函数

可以通过**状态转移函数**返回一个新的对象，从而确保基于状态的最新值进行变化。但这样的状态转移逻辑可能会比较繁琐，这时你可以直接修改对象，由框架负责计算变更内容。但需要注意**直接修改对象的状态转移函数用法不能有返回值**，否则会报错。

```ts
// 定义一个比较复杂的状态
const [state, setState] = takeState({
  a: "xxx",
  b: {
    c: [1, 2, 3, 4, 5],
    ...
  },
  ...
});

// 状态转移函数方式，使用解构方式返回新值，逻辑可能会很繁琐
// 比如将 state.b.c 数组的第 3 项修改为 9，逻辑如下：
setState((state) => {
  return {
    ...state,
    b: {
      ...state.b,
      c: [
        ...state.b.c.slice(0, 2),
        9,
        ...state.b.c.slice(3)
      ],
    },
  };
});

// 可以直接修改状态，但不可再返回新状态，否则会报错
// 实现和上面相同的逻辑，但会更简洁
setState((state) => {
  state.b.c[2] = 9;
});
```

### Pure 更新

如果某个变量对性能的需求比较高，可以考虑使用 `Pure 更新`，它再修改变量的时候不会变异 `lastState`，而是采用纯粹的 `reducer` 写法，结尾需要返回一个新状态。

只需要在 setState 的第二个参数传递一个 `true` 即可开启 `Pure 更新`.

```ts
const [state, setState] = takeState({
  foo: 1,
});

// 第二个参数传递 true 以开启 Pure 更新。这时不可直接修改 state，需要返回新的 state
setState((state) => {
  return {
    ...state,
    foo: state.foo + 1,
  };
}, true);
```

## takeCallback

声明一个函数。当且仅当依赖列表有变化时生成一个新的函数引用。

```ts
const [count, setCount] = takeState(0);

// 定义函数，依赖 count。当 count 变化时函数引用会变
const plus = takeCallback(
  (num: number) => {
    // 更新状态，因为有依赖，可直接使用外部变量
    setCount(count + num);
  },
  [count]
);

// 结尾可将函数和状态一同抛出去
return {
  count,
  plus,
};
```

### 通过 takeCallback 实现 getter 函数

`getter 函数`指类似 `getSkuById` 这种查询函数，可以让数据使用者传入参数以查询 state 中的某个结果。需要将所有依赖项都放在依赖列表中，以保证任意依赖项变化时，函数引用也会变更。这样外部可以根据函数引用是否变更来判断是否需要重新渲染。

```ts
const [skuMap, setSkuMap] = takeState({
  "1": {
    skuId: "1",
    skuName: "Sku-1",
  },
  "2": {
    skuId: "2",
    skuName: "Sku-2",
  },
});

// getter 函数依赖 skuMap
const getSkuById = takeCallback(
  (skuId: string) => {
    return skuMap[skuId];
  },
  [skuMap]
);
```

### 通过 takeCallback 实现异步函数

实现异步函数同样简单，你可以在任何时刻执行 setState 更新状态。

```ts
const [response, setResponse] = takeState<FooResponse>();

const request = takeCallback(async () => {
  // 执行一个异步操作，然后更新状态
  const { data } = await axios.get<FooResponse>("/foo");
  setResponse(data);
}, []);
```

## takeMemo

声明一个 `Selector`，根据依赖列表计算一个新值。当且仅当依赖列表有变化时会重新计算。

```ts
const [count, setCount] = takeState(0);

// 定义 Selector，根据 count 计算出一个新的值
const countText = takeMemo(() => {
  return `the count is ${count}`;
}, [count]);
```

### 通过 takeMemo 实现 getter 函数

takeMemo 也可以用来实现与 takeCallback 一样的 getter 函数。它们的区别是 takeMemo 可以对 getter 函数进行包装，例如实现一个包装了防抖功能的 getter 函数。

```ts
const [skuMap, setSkuMap] = takeState({
  "1": {
    skuId: "1",
    skuName: "Sku-1",
  },
  "2": {
    skuId: "2",
    skuName: "Sku-2",
  },
});

// getter 函数依赖 skuMap
const getSkuById = takeMemo(() => {
  return debounce((skuId: string) => {
    return skuMap[skuId];
  }, 100);
}, [skuMap]);
```

## takeEffect

执行一个可能函数副作用的函数，结尾可返回一个回收函数，用于回收本次执行遗留的副作用。

当且仅当依赖列表有变化时重新执行函数，重新执行前会先回收上一次的副作用。

```ts
const [count, setCount] = takeState(0);

// 执行一个副作用操作，每当 count 变化时会重新执行
takeEffect(() => {
  console.log(`当前的 count 是：${count}`);

  // 延迟 3 秒后自动加 1
  const timeoutId = setTimeout(() => {
    setCount(count + 1);
  }, 3000);

  // 由于延时操作有副作用，需要回收
  return () => {
    clearTimeout(timeoutId);
  };
}, [count]);
```

**任何时候都应该书写副作用回收函数，即使依赖列表是空数组。因为项目是持续迭代的，未来这部分逻辑可能会被其他人修改。为了避免未来依赖列表加入新依赖时忘记回复副作用函数，应该做到有副作用就回收，而不区分是否必要。**

```ts
const [count, setCount] = takeState(0);

takeEffect(() => {
  const intervalId = setInterval(() => {
    setCount((count) => count + 1);
  }, 3000);

  // 依赖列表为空时，副作用回收函数不会被执行。但为了避免未来可能的问题，还是要书写副作用回收函数
  return () => {
    clearInterval(intervallId);
  };
}, []);
```

# 最佳实践 & 典型案例分析

## slice 初始化

有的 slice 需要初始化过程，例如请求后端以获取初始状态，从而避免状态具有 undefined 类型而需要频繁进行非空判断。因为**界面会在所有 slice 都初始化完毕后才开始渲染**。

这时可将连续函数的第一层用起来，如下扩展为一个异步函数：

```ts
export const takeFoo = createSlice("foo", async () => {
  // 向后端请求初始数据
  const { data } = await axios.get<FooResponse>("/foo");

  // 第一层函数返回 loop 函数
  return () => {
    // 这样定义的 foo 不会有空值，界面无需对其进行非空判断
    const [foo, setFoo] = takeState(data);

    return {
      foo,
    };
  };
});
```

## 预加载 Preloading

由于 slice 存在异步初始化的情况，如果界面在 slice 初始化完毕前显示，有可能会碰到空引用错误，所以需要在所有 slice 初始化完毕前阻止界面展示。方式是在你的项目最外侧包裹一个 `StartUp` 组件，并在其中进行判断，如下：

```jsx
import { StartUp } from "raydux";

// 将 StartUp 的内容修改为一个函数，其入参中包含 ready 属性，用以判断数据仓库是否准备完毕
createRoot(document.getElementById("app")).render(
  <StartUp>
    {(ctx) => {
      return ctx.ready ? <div>正式逻辑</div> : <div>加载中，请稍候...</div>;
    }}
  </StartUp>
);
```

## 懒加载

你的界面可能会采用`懒加载`方式，在用户访问到时才加载和初始化，这样的界面所依赖的 slice 也会被懒加载。

slice 懒加载发生时，界面会被暂时隐藏，并重新显示 `Preloading` 界面，等到懒加载的 slice 初始化完毕后重新显示界面。

在开发方面是透明的，无需额外关注 slice 是否被懒加载。

## 多个 slice 相互依赖

实际情景下经常会有一个 slice 依赖另外一个 slice 的情况。

- 直接在 loop 函数中使用另外一个 slice 即可，就像在界面中使用一样

```ts
// foo-slice.ts
export const takeFoo = createSlice("foo", () => () => {
  const [count, setCount] = takeState(0);

  return {
    count,
    setCount,
  };
});
```

```ts
// another-slice.ts
import { takeFoo } from "./foo-slice";

export const takeAnother = createSlice("another", () => () => {
  // 直接执行 take 函数获取其他 slice 的状态和操作
  const { count } = takeFoo();

  ...
});
```

## 执行异步操作后获取最新状态

你可以在任何时候通过执行 `take 函数` 获取到 slice 的最新状态，包括异步函数结尾：

```ts
// foo-slice.ts
export const takeFoo = createSlice("foo", () => () => {
  const [foo, setFoo] = takeState<FooResponse>();

  const fetchFoo = takeCallback(async () => {
    const { data } = await axios.get<FooResponse>("/foo");
    setFoo(data);
  }, []);

  return {
    foo,
    fetchFoo,
  };
});
```

```tsx
// ui.tsx
import { takeFoo } from "./foo-slice";

function UI() {
  const { foo, fetchFoo } = takeFoo();

  useEffect(() => {
    // 执行异步操作
    fetchFoo().then(() => {
      // 重新执行 takeFoo 以获取最新状态
      const { foo } = takeFoo();
      console.log("The latest foo state is", foo);
    });
  }, []);
}
```
